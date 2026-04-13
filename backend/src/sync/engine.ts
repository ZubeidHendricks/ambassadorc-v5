import { getMssqlPool } from "./mssql-client";
import { TABLE_MAPPINGS, TableMapping } from "./table-map";
import prisma from "../lib/prisma";

export interface SyncResult {
  table: string;
  destTable: string;
  label: string;
  status: "success" | "error" | "skipped";
  rowsSynced: number;
  rowsTotal: number;
  error?: string;
  durationMs: number;
  resumed?: boolean;
}

export interface SyncJobResult {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalRowsSynced: number;
  tablesSucceeded: number;
  tablesFailed: number;
  results: SyncResult[];
}

// ─── Schema helpers ────────────────────────────────────────────────────────────

/**
 * Ensures the checkpoint table exists. One row per source table, storing
 * the last successfully committed id so interrupted syncs can resume.
 */
async function ensureCheckpointTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sync_checkpoints (
      source_table TEXT PRIMARY KEY,
      dest_table   TEXT NOT NULL,
      last_id      BIGINT NOT NULL DEFAULT 0,
      rows_synced  BIGINT NOT NULL DEFAULT 0,
      updated_at   TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function ensureJobLogTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sync_job_log (
      id BIGSERIAL PRIMARY KEY,
      job_id TEXT NOT NULL,
      started_at TIMESTAMP,
      finished_at TIMESTAMP,
      duration_ms BIGINT,
      tables_total INT,
      tables_succeeded INT,
      tables_failed INT,
      rows_synced BIGINT,
      status TEXT,
      detail JSONB
    )
  `);
}

/**
 * Dynamically creates a PostgreSQL staging table matching the columns
 * returned from SQL Server for that table.
 */
async function ensureDestTable(
  destTable: string,
  columns: { name: string; type: string }[]
): Promise<void> {
  const colDefs = columns
    .map((c) => {
      const t = c.type.toLowerCase();
      let pgType = "TEXT";
      if (t === "int" || t === "smallint" || t === "tinyint" || t === "bigint") pgType = "BIGINT";
      else if (t === "decimal" || t === "numeric" || t === "money" || t === "smallmoney" || t === "float" || t === "real") pgType = "NUMERIC";
      else if (t === "bit") pgType = "BOOLEAN";
      else if (t === "date") pgType = "DATE";
      else if (t === "datetime" || t === "datetime2" || t === "smalldatetime") pgType = "TIMESTAMP";
      return `"${c.name}" ${pgType}`;
    })
    .join(",\n  ");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${destTable}" (
      _sync_id   BIGSERIAL PRIMARY KEY,
      _synced_at TIMESTAMP DEFAULT NOW(),
      ${colDefs}
    )
  `);

  if (columns.some((c) => c.name === "id")) {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "${destTable}_id_idx" ON "${destTable}"("id")
    `);
  }
}

// ─── Value serialisation ───────────────────────────────────────────────────────

const NUMERIC_TYPES = new Set(["int", "bigint", "smallint", "tinyint", "decimal", "numeric", "money", "smallmoney", "float", "real"]);
const DATETIME_TYPES = new Set(["datetime", "datetime2", "smalldatetime"]);
const DATE_TYPES = new Set(["date"]);

function serializeValue(val: any, colType: string): any {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "boolean") return val;
  if (typeof val === "number" || typeof val === "bigint") return Number(val);
  if (NUMERIC_TYPES.has(colType.toLowerCase())) {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  return String(val);
}

function buildInsertSql(
  destTable: string,
  colNames: string,
  columns: { name: string; type: string }[],
  rows: any[]
): { sql: string; values: any[] } {
  const valuePlaceholders = rows.map((_, ri) => {
    const vals = columns.map((col, ci) => {
      const ph = `$${ri * columns.length + ci + 1}`;
      const t = col.type.toLowerCase();
      if (DATETIME_TYPES.has(t)) return `${ph}::TIMESTAMP`;
      if (DATE_TYPES.has(t)) return `${ph}::DATE`;
      return ph;
    });
    return `(NOW(), ${vals.join(", ")})`;
  });

  const values: any[] = [];
  for (const row of rows) {
    for (const col of columns) {
      values.push(serializeValue(row[col.name], col.type));
    }
  }

  return {
    sql: `INSERT INTO "${destTable}" (_synced_at, ${colNames}) VALUES ${valuePlaceholders.join(", ")} ON CONFLICT DO NOTHING`,
    values,
  };
}

// ─── Checkpoint helpers ────────────────────────────────────────────────────────

async function loadCheckpoint(sourceTable: string): Promise<{ lastId: number; rowsSynced: number } | null> {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT last_id, rows_synced FROM sync_checkpoints WHERE source_table = $1`,
      sourceTable
    ) as any[];
    if (rows.length === 0) return null;
    return { lastId: Number(rows[0].last_id), rowsSynced: Number(rows[0].rows_synced) };
  } catch {
    return null;
  }
}

async function saveCheckpoint(sourceTable: string, destTable: string, lastId: number, rowsSynced: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO sync_checkpoints (source_table, dest_table, last_id, rows_synced, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (source_table) DO UPDATE
       SET last_id = $3, rows_synced = $4, updated_at = NOW()`,
    sourceTable,
    destTable,
    lastId,
    rowsSynced
  );
}

async function clearCheckpoint(sourceTable: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM sync_checkpoints WHERE source_table = $1`,
    sourceTable
  );
}

// ─── Core table sync ───────────────────────────────────────────────────────────

/**
 * Batch size per SQL Server request.
 *
 * The FoxPro SQL Server Express is slow — especially for wide tables.
 * We keep batches tiny so each individual request finishes well within
 * the 10-minute timeout, and we checkpoint after every commit.
 */
const BATCH_SIZE = 50;

async function syncTable(mapping: TableMapping, forceReset = false): Promise<SyncResult> {
  const start = Date.now();
  const { sourceTable, destTable, pkColumn, orderBy, label } = mapping;
  const batchSize = mapping.batchSize ?? BATCH_SIZE;

  try {
    const pool = await getMssqlPool();

    // Fetch column metadata
    const colResult = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${sourceTable}'
      ORDER BY ORDINAL_POSITION
    `);

    if (colResult.recordset.length === 0) {
      return { table: sourceTable, destTable, label, status: "skipped", rowsSynced: 0, rowsTotal: 0, durationMs: Date.now() - start };
    }

    const columns: { name: string; type: string }[] = colResult.recordset.map((r: any) => ({
      name: r.COLUMN_NAME as string,
      type: r.DATA_TYPE as string,
    }));

    await ensureDestTable(destTable, columns);

    const hasIdCol = columns.some((c) => c.name === "id");
    const colNames = columns.map((c) => `"${c.name}"`).join(", ");

    // streamDump tables skip COUNT(*) — it forces a full table scan on unindexed tables
    if (mapping.streamDump) {
      // ── Stream dump path ───────────────────────────────────────────────────
      // Used for wide/unindexed tables (SalesData, SalesLeads, SagePayTransactions)
      // where COUNT(*) and ORDER BY cause full-table scans > 10 minutes.
      //
      // Strategy: truncate dest, stream all rows in heap order (no WHERE/ORDER BY),
      // insert in batches of 50. On interruption, restart from scratch next time
      // (no checkpoint id, just row count as progress indicator).
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${destTable}" RESTART IDENTITY`);
      await clearCheckpoint(sourceTable);

      let rowsSynced = 0;
      let buffer: Record<string, unknown>[] = [];

      const flushBuffer = async () => {
        if (buffer.length === 0) return;
        const { sql, values } = buildInsertSql(destTable, colNames, columns, buffer);
        await prisma.$executeRawUnsafe(sql, ...values);
        rowsSynced += buffer.length;
        // Save progress (rows_synced only, no last_id since unordered)
        await saveCheckpoint(sourceTable, destTable, 0, rowsSynced);
        console.log(`[Sync]   ${sourceTable} (stream): ${rowsSynced} rows`);
        buffer = [];
      };

      await new Promise<void>((resolve, reject) => {
        const request = pool.request();
        request.stream = true;
        // Use NOLOCK and no ORDER BY so SQL Server returns rows in heap order
        request.query(`SELECT * FROM [${sourceTable}] WITH (NOLOCK)`);

        request.on("row", async (row: Record<string, unknown>) => {
          buffer.push(row);
          if (buffer.length >= (mapping.batchSize ?? BATCH_SIZE)) {
            request.pause();
            try {
              await flushBuffer();
              request.resume();
            } catch (e) {
              reject(e);
            }
          }
        });

        request.on("error", (err: Error) => reject(err));

        request.on("done", async () => {
          try {
            await flushBuffer(); // flush remainder
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      // Clear checkpoint on success so next sync knows to start fresh
      await clearCheckpoint(sourceTable);
      return { table: sourceTable, destTable, label, status: "success", rowsSynced, rowsTotal: rowsSynced, durationMs: Date.now() - start };
    }

    // For non-streamDump tables, get row count (used to decide full vs incremental)
    const countResult = await pool.request().query(`SELECT COUNT(*) AS cnt FROM [${sourceTable}] WITH (NOLOCK)`);
    const rowsTotal: number = Number(countResult.recordset[0].cnt);

    if (!hasIdCol) {
      // ── OFFSET-based path for tables without an integer id ──────────────────
      // These are small tables (<5k rows typically), so simple full-refresh.
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${destTable}" RESTART IDENTITY`);
      await clearCheckpoint(sourceTable);

      let offset = 0;
      let rowsSynced = 0;

      while (true) {
        // NOLOCK avoids shared lock waits on the busy FoxPro SQL Server Express
        const query = `
          SELECT * FROM [${sourceTable}] WITH (NOLOCK)
          ORDER BY [${pkColumn}]
          OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY
        `;
        const req = pool.request();
        const pageResult = await req.query(query);
        const rows = pageResult.recordset;
        if (rows.length === 0) break;

        const { sql, values } = buildInsertSql(destTable, colNames, columns, rows);
        await prisma.$executeRawUnsafe(sql, ...values);
        rowsSynced += rows.length;
        console.log(`[Sync]   ${sourceTable} (offset): ${rowsSynced} rows`);
        offset += batchSize;
        if (rows.length < batchSize) break;
      }

      return { table: sourceTable, destTable, label, status: "success", rowsSynced, rowsTotal, durationMs: Date.now() - start };
    }

    // ── Keyset-paginated path (tables with an `id` column) ───────────────────
    //
    // Strategy:
    // • Full-refresh tables (<= 5 000 rows, no orderBy): truncate then reload.
    // • Incremental tables (> 5 000 rows or has orderBy): use checkpoint to
    //   resume from the last committed id — never re-read rows we already have.
    // • forceReset clears the checkpoint and starts fresh.

    const isIncremental = rowsTotal > 5000 || !!orderBy;

    let checkpoint = await loadCheckpoint(sourceTable);
    let lastId = 0;
    let rowsSynced = 0;
    let resumed = false;

    if (forceReset || !isIncremental) {
      // Full refresh: clear checkpoint and truncate
      await clearCheckpoint(sourceTable);
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${destTable}" RESTART IDENTITY`);
      checkpoint = null;
    } else if (checkpoint) {
      // Resume from saved position
      lastId = checkpoint.lastId;
      rowsSynced = checkpoint.rowsSynced;
      resumed = true;
      console.log(`[Sync]   ↩ ${sourceTable}: resuming from id=${lastId} (${rowsSynced} already synced)`);
    }

    while (true) {
      // NOLOCK avoids shared lock waits on the busy FoxPro SQL Server Express
      const query = `SELECT TOP ${batchSize} * FROM [${sourceTable}] WITH (NOLOCK) WHERE [id] > ${lastId} ORDER BY [id]`;

      // Pool requestTimeout (600 s) governs each batch — global mssql config.
      const request = pool.request();
      const pageResult = await request.query(query);
      const rows = pageResult.recordset;
      if (rows.length === 0) break;

      const { sql, values } = buildInsertSql(destTable, colNames, columns, rows);

      // Wrap each batch in a PostgreSQL transaction
      await prisma.$transaction([
        prisma.$executeRawUnsafe(sql, ...values),
      ]);

      rowsSynced += rows.length;
      lastId = Number(rows[rows.length - 1].id);

      // Persist checkpoint after every committed batch
      await saveCheckpoint(sourceTable, destTable, lastId, rowsSynced);

      console.log(`[Sync]   ${sourceTable}: ${rowsSynced} rows (last id=${lastId})`);

      if (rows.length < batchSize) break;
    }

    // On full completion, remove the checkpoint
    if (!isIncremental) {
      await clearCheckpoint(sourceTable);
    }

    return {
      table: sourceTable,
      destTable,
      label,
      status: "success",
      rowsSynced,
      rowsTotal,
      durationMs: Date.now() - start,
      resumed,
    };
  } catch (err: any) {
    // Do NOT clear the checkpoint on error — next run will resume from it.
    return {
      table: sourceTable,
      destTable,
      label,
      status: "error",
      rowsSynced: 0,
      rowsTotal: 0,
      error: err?.message ?? String(err),
      durationMs: Date.now() - start,
    };
  }
}

// ─── Job runner ────────────────────────────────────────────────────────────────

export async function runSyncJob(
  tableFilter?: string[],
  forceReset = false
): Promise<SyncJobResult> {
  const jobId = `sync_${Date.now()}`;
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const mappings = tableFilter
    ? TABLE_MAPPINGS.filter((m) => tableFilter.includes(m.sourceTable))
    : TABLE_MAPPINGS;

  console.log(`[Sync] Starting job ${jobId} — ${mappings.length} tables${forceReset ? " (force reset)" : ""}`);

  await ensureCheckpointTable();
  await ensureJobLogTable();

  const results: SyncResult[] = [];

  for (const mapping of mappings) {
    console.log(`[Sync] → ${mapping.sourceTable}`);
    const result = await syncTable(mapping, forceReset);
    results.push(result);
    if (result.status === "error") {
      console.error(`[Sync] ✗ ${mapping.sourceTable}: ${result.error}`);
    } else {
      const tag = result.resumed ? " (resumed)" : "";
      console.log(`[Sync] ✓ ${mapping.sourceTable}: ${result.rowsSynced} rows (${result.durationMs}ms)${tag}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;
  const totalRowsSynced = results.reduce((s, r) => s + r.rowsSynced, 0);
  const tablesSucceeded = results.filter((r) => r.status === "success").length;
  const tablesFailed = results.filter((r) => r.status === "error").length;

  const jobResult: SyncJobResult = {
    jobId,
    startedAt,
    finishedAt,
    durationMs,
    totalRowsSynced,
    tablesSucceeded,
    tablesFailed,
    results,
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO sync_job_log
      (job_id, started_at, finished_at, duration_ms, tables_total, tables_succeeded, tables_failed, rows_synced, status, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    jobId,
    new Date(startedAt),
    new Date(finishedAt),
    durationMs,
    mappings.length,
    tablesSucceeded,
    tablesFailed,
    totalRowsSynced,
    tablesFailed > 0 ? "partial" : "success",
    JSON.stringify(results)
  );

  console.log(`[Sync] Job ${jobId} complete — ${totalRowsSynced} rows, ${tablesSucceeded}/${mappings.length} tables OK`);
  return jobResult;
}

// ─── Scheduler ─────────────────────────────────────────────────────────────────

export function scheduleDailySync(hourUtc = 2): () => void {
  let timer: NodeJS.Timeout | null = null;

  function scheduleNext() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const delay = next.getTime() - now.getTime();
    console.log(`[Sync] Next daily sync scheduled at ${next.toISOString()} (in ${Math.round(delay / 60000)} min)`);
    timer = setTimeout(async () => {
      await runSyncJob();
      scheduleNext();
    }, delay);
  }

  scheduleNext();
  return () => { if (timer) clearTimeout(timer); };
}
