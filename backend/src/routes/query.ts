import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";

const router = Router();
router.use(authenticate);

async function isAdmin(userId: number): Promise<boolean> {
  const ambassador = await prisma.ambassador.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return ambassador?.role === "ADMIN";
}

// ─── POST /api/query/sql ────────────────────────────────────────────────────

router.post("/sql", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }

    const { sql } = req.body as { sql?: string };
    if (!sql || typeof sql !== "string") {
      res.status(400).json({ success: false, error: "sql field is required." });
      return;
    }

    const normalized = sql.trim().replace(/\s+/g, " ").toUpperCase();

    const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE"];
    const firstWord = normalized.split(" ")[0];
    if (forbidden.includes(firstWord)) {
      res.status(400).json({
        success: false,
        error: `${firstWord} queries are not allowed. Only SELECT is permitted.`,
      });
      return;
    }

    if (firstWord !== "SELECT" && firstWord !== "WITH" && firstWord !== "EXPLAIN") {
      res.status(400).json({
        success: false,
        error: "Only SELECT / WITH / EXPLAIN queries are allowed.",
      });
      return;
    }

    const rawRows = await prisma.$queryRawUnsafe(sql) as any[];

    // Serialize BigInt values as strings to avoid JSON serialization errors
    const rows = JSON.parse(JSON.stringify(rawRows, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val
    ));

    res.json({
      success: true,
      data: {
        rows,
        rowCount: rows.length,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message ?? "Query failed.",
    });
  }
});

// ─── GET /api/query/schema ──────────────────────────────────────────────────

router.get("/schema", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }

    const tables = await prisma.$queryRaw`
      SELECT
        t.table_name,
        array_agg(
          json_build_object(
            'column', c.column_name,
            'type',   c.data_type,
            'nullable', c.is_nullable
          ) ORDER BY c.ordinal_position
        ) AS columns
      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON c.table_name = t.table_name AND c.table_schema = t.table_schema
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name
    ` as any[];

    res.json({ success: true, data: { tables } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message ?? "Failed to fetch schema." });
  }
});

// ─── GET /api/query/stats ───────────────────────────────────────────────────

router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "ADMIN only." });
      return;
    }

    const rawCounts = await prisma.$queryRaw`
      SELECT
        relname AS table_name,
        n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    ` as any[];

    const counts = JSON.parse(JSON.stringify(rawCounts, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v
    ));

    res.json({ success: true, data: { counts } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message ?? "Failed to fetch stats." });
  }
});

export default router;
