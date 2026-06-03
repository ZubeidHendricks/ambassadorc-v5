/**
 * Midnight export engine
 * ----------------------
 * Replicates the FoxPro "loaded for export @ midnight" step: QA-passed sales
 * are batched into export files — Persal sales → Q-Link, debit-order sales →
 * Netcash/SagePay — and advanced to the "exported / awaiting outcome" state.
 *
 * It CREATES the batch records + file content (FoxPro "Create Files Only");
 * actual transmission to Q-Link / SagePay stays a separate, explicit step.
 */
import prisma from "../lib/prisma";

export interface ExportGroupResult {
  channel: "QLINK" | "SAGEPAY";
  collectionMethod: "PERSAL" | "DEBIT_ORDER";
  count: number;
  fileExportId?: number;
  fileName: string;
  qlinkBatchId?: string;
  csv: string;
}

export interface MidnightExportResult {
  ranAt: string;
  totalExported: number;
  groups: ExportGroupResult[];
  message: string;
}

function ymd(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build the export batches for all QA-passed sales not yet exported.
 * Idempotent: a sale is only picked up while foxStatus is not already 'u'/'t1'.
 */
export async function buildMidnightExport(): Promise<MidnightExportResult> {
  const ready = await prisma.sale.findMany({
    where: {
      status: "QA_APPROVED",
      OR: [{ foxStatus: null }, { foxStatus: { notIn: ["u", "t1"] } }],
    },
    include: {
      client: { select: { firstName: true, lastName: true, idNumber: true, cellphone: true } },
      product: { select: { name: true } },
    },
  });

  const buckets: Record<"PERSAL" | "DEBIT_ORDER", typeof ready> = { PERSAL: [], DEBIT_ORDER: [] };
  for (const s of ready) {
    const m = s.collectionMethod === "PERSAL" ? "PERSAL" : "DEBIT_ORDER";
    buckets[m].push(s);
  }

  const groups: ExportGroupResult[] = [];

  for (const method of ["PERSAL", "DEBIT_ORDER"] as const) {
    const rows = buckets[method];
    if (rows.length === 0) continue;

    const channel = method === "PERSAL" ? "QLINK" : "SAGEPAY";
    const header =
      method === "PERSAL"
        ? ["SaleId", "IDNumber", "Name", "Surname", "Product", "Premium", "PersalNumber", "Department", "FirstDebitDate"]
        : ["SaleId", "IDNumber", "Name", "Surname", "Product", "Premium", "Cellphone", "FirstDebitDate"];
    const lines = [header.join(",")];
    for (const s of rows) {
      const base = [s.id, s.client.idNumber, s.client.firstName, s.client.lastName, s.product.name, Number(s.premiumAmount ?? 0)];
      const extra =
        method === "PERSAL"
          ? [s.persalNumber ?? "", s.department ?? "", s.firstDebitDate ? s.firstDebitDate.toISOString().slice(0, 10) : ""]
          : [s.client.cellphone, s.firstDebitDate ? s.firstDebitDate.toISOString().slice(0, 10) : ""];
      lines.push([...base, ...extra].map(csvCell).join(","));
    }
    const csv = lines.join("\n");
    const fileName = `${channel}_EXPORT_${ymd()}_${Date.now()}.csv`;

    // Record the outbound file
    const fileExport = await prisma.fileExport.create({
      data: {
        fileName,
        direction: "OUTBOUND",
        entryCount: rows.length,
        importType: channel,
        description: `Midnight export — ${rows.length} ${method === "PERSAL" ? "Persal (Q-Link)" : "debit-order (Netcash)"} sale(s)`,
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });

    let qlinkBatchId: string | undefined;
    if (method === "PERSAL") {
      qlinkBatchId = `QL-${ymd()}-${fileExport.id}`;
      await prisma.qLinkBatch.create({
        data: { batchId: qlinkBatchId, product: "PERSAL", description: fileName, recordCount: rows.length, status: "PENDING" },
      });
    }

    // Advance the sales: Persal → 'u' (uploaded), debit order → 't1' (awaiting outcome)
    await prisma.sale.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { foxStatus: method === "PERSAL" ? "u" : "t1", status: "ACTIVE" },
    });

    groups.push({ channel, collectionMethod: method, count: rows.length, fileExportId: fileExport.id, fileName, qlinkBatchId, csv });
  }

  const totalExported = groups.reduce((n, g) => n + g.count, 0);
  return {
    ranAt: new Date().toISOString(),
    totalExported,
    groups,
    message:
      totalExported > 0
        ? `Exported ${totalExported} QA-passed sale(s): ${groups.map((g) => `${g.count} → ${g.channel}`).join(", ")}.`
        : "No QA-passed sales were ready for export.",
  };
}

// ─── Scheduler (mirrors sync/engine.ts scheduleDailySync) ───────────────────
// Default 22:00 UTC = 00:00 SAST (midnight in South Africa).
export function scheduleMidnightExport(hourUtc = 22): () => void {
  let timer: NodeJS.Timeout | null = null;

  function scheduleNext() {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const delay = next.getTime() - now.getTime();
    console.log(`[Export] Next midnight export scheduled at ${next.toISOString()} (in ${Math.round(delay / 60000)} min)`);
    timer = setTimeout(async () => {
      try {
        const r = await buildMidnightExport();
        console.log(`[Export] ${r.message}`);
      } catch (err) {
        console.error("[Export] Midnight export failed:", err);
      }
      scheduleNext();
    }, delay);
  }

  scheduleNext();
  return () => { if (timer) clearTimeout(timer); };
}
