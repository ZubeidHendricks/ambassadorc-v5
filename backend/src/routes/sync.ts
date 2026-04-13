import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { runSyncJob, SyncJobResult } from "../sync/engine";
import { TABLE_MAPPINGS } from "../sync/table-map";
import prisma from "../lib/prisma";

const router = Router();
router.use(authenticate);

async function isAdmin(userId: number): Promise<boolean> {
  const a = await prisma.ambassador.findUnique({ where: { id: userId }, select: { role: true } });
  return a?.role === "ADMIN";
}

// Track in-memory running state (one job at a time)
let runningJob: Promise<SyncJobResult> | null = null;
let lastResult: SyncJobResult | null = null;

// ─── GET /api/sync/status ──────────────────────────────────────────────────
// Returns current status, last job result, and table map

router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }

    // Last 10 job log entries
    let history: any[] = [];
    try {
      history = await prisma.$queryRaw`
        SELECT job_id, started_at, finished_at, duration_ms,
               tables_total, tables_succeeded, tables_failed, rows_synced, status
        FROM sync_job_log
        ORDER BY started_at DESC
        LIMIT 10
      ` as any[];
      history = JSON.parse(JSON.stringify(history, (_k, v) => typeof v === "bigint" ? v.toString() : v));
    } catch {
      // table may not exist yet
    }

    res.json({
      success: true,
      data: {
        isRunning: runningJob !== null,
        lastResult,
        tables: TABLE_MAPPINGS.map((m) => ({
          sourceTable: m.sourceTable,
          destTable: m.destTable,
          label: m.label,
          category: m.category,
          pkColumn: m.pkColumn,
        })),
        history,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ─── POST /api/sync/run ───────────────────────────────────────────────────
// Trigger a sync job (optionally filter specific tables)

router.post("/run", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }

    if (runningJob) {
      res.status(409).json({ success: false, error: "A sync job is already running." });
      return;
    }

    const { tables, forceReset }: { tables?: string[]; forceReset?: boolean } = req.body;

    runningJob = runSyncJob(tables, forceReset === true);
    runningJob
      .then((result) => { lastResult = result; runningJob = null; })
      .catch((err) => { console.error("[Sync] Job failed:", err); runningJob = null; });

    res.json({
      success: true,
      data: { message: "Sync job started.", tables: tables ?? "all", forceReset: forceReset === true },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ─── GET /api/sync/checkpoints ───────────────────────────────────────────
// Returns per-table resumption checkpoints so the UI can show partial progress

router.get("/checkpoints", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }
    let rows: any[] = [];
    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT source_table, dest_table, last_id, rows_synced, updated_at FROM sync_checkpoints ORDER BY updated_at DESC`
      ) as any[];
      rows = JSON.parse(JSON.stringify(rows, (_k, v) => typeof v === "bigint" ? v.toString() : v));
    } catch { }
    res.json({ success: true, data: { checkpoints: rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ─── GET /api/sync/history ────────────────────────────────────────────────

router.get("/history", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);

    let rows: any[] = [];
    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM sync_job_log ORDER BY started_at DESC LIMIT ${limit}`
      ) as any[];
      rows = JSON.parse(JSON.stringify(rows, (_k, v) => typeof v === "bigint" ? v.toString() : v));
    } catch {
      // table not yet created
    }

    res.json({ success: true, data: { jobs: rows } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ─── GET /api/sync/preview/:table ────────────────────────────────────────
// Preview latest 50 rows of a synced staging table

router.get("/preview/:table", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }

    const { table } = req.params;
    const allowed = TABLE_MAPPINGS.map((m) => m.destTable);
    if (!allowed.includes(table)) {
      res.status(400).json({ success: false, error: "Unknown table." });
      return;
    }

    let rows: any[] = [];
    let count = 0;
    try {
      const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS cnt FROM "${table}"`) as any[];
      count = Number(countRows[0]?.cnt ?? 0);
      rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY _sync_id DESC LIMIT 50`) as any[];
      rows = JSON.parse(JSON.stringify(rows, (_k, v) => typeof v === "bigint" ? v.toString() : v));
    } catch {
      // staging table not yet created — return empty
    }

    res.json({ success: true, data: { rows, total: count } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
