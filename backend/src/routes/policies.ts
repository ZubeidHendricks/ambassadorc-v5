import { Router, Response } from "express";
import prisma from "../lib/prisma";
import {
  createPolicySchema,
  updatePolicyStatusSchema,
  premiumChangeRequestSchema,
  approvePremiumChangeSchema,
} from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Helpers ───────────────────────────────────────────────────────────────

function generatePolicyNumber(): string {
  const prefix = "POL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ─── POST /api/policies ────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createPolicySchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { clientId, productId, premiumAmount } = validation.data;

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(404).json({ success: false, error: "Client not found." });
      return;
    }

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    const policy = await prisma.policy.create({
      data: {
        clientId,
        productId,
        policyNumber: generatePolicyNumber(),
        premiumAmount,
        startDate: new Date(),
        status: "PENDING",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        product: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "CREATE",
        entity: "Policy",
        entityId: String(policy.id),
        details: { policyNumber: policy.policyNumber, clientId, productId },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    console.error("Create policy error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/policies ─────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = (req.query.status as string | undefined)?.toLowerCase();
    const search = req.query.search as string | undefined;

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (status) {
      whereClauses.push(`LOWER("Status") ILIKE $${p++}`);
      params.push(`%${status}%`);
    }
    if (search) {
      whereClauses.push(`("FirstName" ILIKE $${p} OR "LastName" ILIKE $${p} OR "IDNumber" ILIKE $${p} OR "ProductName" ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [rows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT s._sync_id::integer as id,
                CONCAT('POL-', s._sync_id::integer) as "policyNumber",
                s._sync_id::integer as "clientId",
                CONCAT(s."FirstName", ' ', s."LastName") as "clientName",
                0 as "productId",
                COALESCE(s."ProductName", 'Unknown') as "productName",
                COALESCE(
                  NULLIF(
                    (SELECT CASE WHEN sp."Amount" ~ '^[0-9]+(\\.[0-9]+)?$' THEN sp."Amount"::numeric ELSE 0 END
                     FROM sync_sagepay_transactions sp WHERE sp."IdNumber" = s."IDNumber" AND sp."Amount" IS NOT NULL AND sp."Amount" != '' LIMIT 1),
                    0
                  ),
                  CASE COALESCE(s."ProductName", '')
                    WHEN 'Life Saver Legal' THEN 129
                    WHEN 'LegalNet' THEN 129
                    WHEN 'Life Saver 24' THEN 199
                    WHEN 'Five-In-One' THEN 199
                    ELSE 129
                  END
                ) as "premiumAmount",
                COALESCE(s."Status", 'Unknown') as status,
                COALESCE(s."DateLoaded"::text, s._synced_at::text) as "startDate",
                NULL::text as "endDate",
                COALESCE(s."SalesAgentUserName", '') as "agentName",
                s._synced_at as "createdAt"
         FROM sync_sales_data s
         ${whereSQL}
         ORDER BY s._synced_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        ...params, limit, skip
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_sales_data s ${whereSQL}`,
        ...params
      ),
    ]);

    const total = Number(countRow[0].n);

    res.json({
      success: true,
      data: {
        policies: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List policies error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/policies/premium-changes ─────────────────────────────────────

router.get("/premium-changes", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const statusFilter = (req.query.status as string | undefined)?.toLowerCase();

    // Build status condition from sync_premium_updates QLinkResult / ErrorCode
    let statusSQL = "";
    if (statusFilter === "approved") {
      statusSQL = `AND ("QLinkResult" IS NOT NULL AND "QLinkResult" != '' AND ("ErrorCode" IS NULL OR "ErrorCode" = ''))`;
    } else if (statusFilter === "rejected") {
      statusSQL = `AND ("ErrorCode" IS NOT NULL AND "ErrorCode" != '')`;
    } else if (statusFilter === "pending") {
      statusSQL = `AND ("QLinkResult" IS NULL OR "QLinkResult" = '') AND ("ErrorCode" IS NULL OR "ErrorCode" = '')`;
    }

    const [rows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT
          _sync_id::integer as id,
          NULL::integer as "policyId",
          CONCAT('UPD-', _sync_id::integer) as "policyNumber",
          COALESCE("ProductName", 'Unknown') as "productName",
          COALESCE("PremiumPlan", '') as "tierName",
          -- currentAmount: best effort from sagepay by MemberId treated as IDNumber
          COALESCE(
            (SELECT CASE WHEN sp."Amount" ~ '^[0-9]+(\\.[0-9]+)?$' THEN sp."Amount"::numeric ELSE NULL END
             FROM sync_sagepay_transactions sp WHERE sp."IdNumber" = "MemberId" AND sp."Amount" IS NOT NULL AND sp."Amount" != '' LIMIT 1),
            CASE WHEN "PremiumValue"::text ~ '^[0-9]+$' AND "PremiumValue"::integer > 0
                 THEN ROUND(("PremiumValue"::numeric / 100) * 0.88, 2)
                 ELSE 0 END
          ) as "currentAmount",
          CASE WHEN "PremiumValue"::text ~ '^[0-9]+$'
               THEN "PremiumValue"::numeric / 100
               ELSE 0 END as "newAmount",
          COALESCE("UpdateType", 'UPDATE') as "changeType",
          COALESCE("DateInserted"::text, _synced_at::text) as "effectiveDate",
          NULL::text as reason,
          CASE
            WHEN "ErrorCode" IS NOT NULL AND "ErrorCode" != '' THEN 'rejected'
            WHEN "QLinkResult" IS NOT NULL AND "QLinkResult" != '' THEN 'approved'
            ELSE 'pending'
          END as status,
          NULL::integer as "affectedPolicies",
          COALESCE("MemberId", '') as "requestedBy",
          NULL::text as "approvedBy",
          _synced_at as "createdAt"
        FROM sync_premium_updates
        WHERE ("PremiumValue"::text ~ '^[0-9]+$' AND "PremiumValue"::integer > 0)
        ${statusSQL}
        ORDER BY _synced_at DESC
        LIMIT $1 OFFSET $2`,
        limit, skip
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_premium_updates
         WHERE ("PremiumValue"::text ~ '^[0-9]+$' AND "PremiumValue"::integer > 0)
         ${statusSQL}`
      ),
    ]);

    const total = Number(countRow[0].n);

    res.json({
      success: true,
      data: {
        premiumChanges: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List premium changes error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/policies/premium-changes/:id ─────────────────────────────────

router.put("/premium-changes/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid premium change ID." });
      return;
    }

    const validation = approvePremiumChangeSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.premiumChange.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Premium change request not found." });
      return;
    }

    if (existing.status !== "PENDING") {
      res.status(400).json({
        success: false,
        error: "This premium change request has already been processed.",
      });
      return;
    }

    const { status } = validation.data;

    const change = await prisma.premiumChange.update({
      where: { id },
      data: {
        status,
        approvedBy: String(req.ambassador!.id),
      },
    });

    // If approved, update the policy premium amount
    if (status === "APPROVED") {
      await prisma.policy.update({
        where: { id: existing.policyId },
        data: { premiumAmount: existing.newAmount },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: status === "APPROVED" ? "APPROVE" : "REJECT",
        entity: "PremiumChange",
        entityId: String(id),
        details: {
          policyId: existing.policyId,
          oldAmount: existing.oldAmount.toString(),
          newAmount: existing.newAmount.toString(),
        },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: change });
  } catch (error) {
    console.error("Approve/reject premium change error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/policies/:id ─────────────────────────────────────────────────

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid policy ID." });
      return;
    }

    const policy = await prisma.policy.findUnique({
      where: { id },
      include: {
        client: true,
        product: true,
        payments: {
          orderBy: { paymentDate: "desc" },
          take: 50,
        },
        premiumChanges: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!policy) {
      res.status(404).json({ success: false, error: "Policy not found." });
      return;
    }

    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("Get policy error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/policies/:id/status ──────────────────────────────────────────

router.put("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid policy ID." });
      return;
    }

    const validation = updatePolicyStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.policy.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Policy not found." });
      return;
    }

    const policy = await prisma.policy.update({
      where: { id },
      data: {
        status: validation.data.status,
        endDate: validation.data.status === "CANCELLED" ? new Date() : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "STATUS_CHANGE",
        entity: "Policy",
        entityId: String(id),
        details: {
          oldStatus: existing.status,
          newStatus: validation.data.status,
        },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("Update policy status error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/policies/:id/premium-change ─────────────────────────────────

router.post("/:id/premium-change", async (req: AuthRequest, res: Response) => {
  try {
    const policyId = parseInt(req.params.id);

    if (isNaN(policyId)) {
      res.status(400).json({ success: false, error: "Invalid policy ID." });
      return;
    }

    const validation = premiumChangeRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const policy = await prisma.policy.findUnique({ where: { id: policyId } });

    if (!policy) {
      res.status(404).json({ success: false, error: "Policy not found." });
      return;
    }

    // Check for existing pending change
    const pendingChange = await prisma.premiumChange.findFirst({
      where: { policyId, status: "PENDING" },
    });

    if (pendingChange) {
      res.status(409).json({
        success: false,
        error: "There is already a pending premium change for this policy.",
      });
      return;
    }

    const { oldAmount, newAmount, reason, effectiveDate } = validation.data;

    const change = await prisma.premiumChange.create({
      data: {
        policyId,
        oldAmount,
        newAmount,
        reason: reason ?? null,
        effectiveDate: new Date(effectiveDate),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "REQUEST",
        entity: "PremiumChange",
        entityId: String(change.id),
        details: { policyId, oldAmount, newAmount },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: change });
  } catch (error) {
    console.error("Premium change request error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
