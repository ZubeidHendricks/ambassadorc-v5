import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { createClientSchema, updateClientSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── POST /api/clients ─────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createClientSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Check for duplicate ID number
    const existingClient = await prisma.client.findUnique({
      where: { idNumber: data.idNumber },
    });

    if (existingClient) {
      res.status(409).json({
        success: false,
        error: "A client with this ID number already exists.",
      });
      return;
    }

    const client = await prisma.client.create({
      data: {
        title: data.title ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        idNumber: data.idNumber,
        cellphone: data.cellphone,
        email: data.email ?? null,
        address1: data.address1 ?? null,
        address2: data.address2 ?? null,
        address3: data.address3 ?? null,
        addressCode: data.addressCode ?? null,
        province: data.province ?? null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "CREATE",
        entity: "Client",
        entityId: String(client.id),
        details: { clientName: `${client.firstName} ${client.lastName}` },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: client });
  } catch (error) {
    console.error("Create client error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/clients ──────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const search = ((req.query.search as string) || "").trim();

    let clientRows: any[];
    let countRow: [{ n: bigint }];

    if (search) {
      const like = `%${search}%`;
      [clientRows, countRow] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT s._sync_id::integer as id, s."Title" as title, s."FirstName" as "firstName", s."LastName" as "lastName",
                  s."IDNumber" as "idNumber", s."CellPhone" as cellphone, s."CellPhone" as phone,
                  NULL::text as email, NULL::text as province, s."Status" as status, s."ProductName" as product,
                  s."SalesAgentUserName" as agent, s._synced_at as "createdAt",
                  (SELECT COUNT(*)::integer FROM sync_sales_data c WHERE c."IDNumber" = s."IDNumber") as "policyCount"
           FROM sync_sales_data s
           WHERE s."FirstName" ILIKE $1 OR s."LastName" ILIKE $1 OR s."IDNumber" ILIKE $1 OR s."CellPhone" ILIKE $1
           ORDER BY s._synced_at DESC
           LIMIT $2 OFFSET $3`,
          like, limit, skip
        ),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(
          `SELECT COUNT(*) as n FROM sync_sales_data
           WHERE "FirstName" ILIKE $1 OR "LastName" ILIKE $1 OR "IDNumber" ILIKE $1 OR "CellPhone" ILIKE $1`,
          like
        ),
      ]);
    } else {
      [clientRows, countRow] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT s._sync_id::integer as id, s."Title" as title, s."FirstName" as "firstName", s."LastName" as "lastName",
                  s."IDNumber" as "idNumber", s."CellPhone" as cellphone, s."CellPhone" as phone,
                  NULL::text as email, NULL::text as province, s."Status" as status, s."ProductName" as product,
                  s."SalesAgentUserName" as agent, s._synced_at as "createdAt",
                  (SELECT COUNT(*)::integer FROM sync_sales_data c WHERE c."IDNumber" = s."IDNumber") as "policyCount"
           FROM sync_sales_data s
           ORDER BY s._synced_at DESC
           LIMIT $1 OFFSET $2`,
          limit, skip
        ),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(
          `SELECT COUNT(*) as n FROM sync_sales_data`
        ),
      ]);
    }

    const total = Number(countRow[0].n);

    res.json({
      success: true,
      data: {
        clients: clientRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List clients error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/clients/search ───────────────────────────────────────────────

router.get("/search", async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string) || "";

    if (!q || q.length < 2) {
      res.status(400).json({
        success: false,
        error: "Search query must be at least 2 characters.",
      });
      return;
    }

    const like = `%${q}%`;
    const clients = await prisma.$queryRawUnsafe<any[]>(
      `SELECT _sync_id::integer as id, "Title" as title, "FirstName" as "firstName", "LastName" as "lastName",
              "IDNumber" as "idNumber", "CellPhone" as cellphone, NULL::text as email, NULL::text as province
       FROM sync_sales_data
       WHERE "IDNumber" ILIKE $1 OR "CellPhone" ILIKE $1 OR "FirstName" ILIKE $1 OR "LastName" ILIKE $1
       ORDER BY "LastName" ASC
       LIMIT 20`,
      like
    );

    res.json({ success: true, data: clients });
  } catch (error) {
    console.error("Search clients error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/clients/:id ──────────────────────────────────────────────────

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid client ID." });
      return;
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT _sync_id::integer as id, "Title" as title, "FirstName" as "firstName", "LastName" as "lastName",
              "IDNumber" as "idNumber", "CellPhone" as cellphone, NULL::text as email,
              NULL::text as province, "Address1" as address1, "Address2" as address2, "Address3" as address3,
              "AddressCode" as "addressCode", "Status" as status, "SubStatus" as "subStatus",
              "ProductName" as product, "SalesAgentUserName" as agent,
              "DateOfBirth" as "dateOfBirth", _synced_at as "createdAt", "LastUpdated" as "updatedAt",
              "CampaignID" as "campaignId", "DialerID" as "dialerId", "DataSource" as "dataSource",
              "ContactAttempts" as "contactAttempts"
       FROM sync_sales_data
       WHERE _sync_id = $1`,
      id
    );

    if (!rows.length) {
      res.status(404).json({ success: false, error: "Client not found." });
      return;
    }

    // Attach related sales history for this IDNumber
    const client = rows[0];
    let salesHistory: any[] = [];
    if (client.idNumber) {
      salesHistory = await prisma.$queryRawUnsafe<any[]>(
        `SELECT _sync_id::integer as id, "Status" as status, "ProductName" as product,
                "SalesAgentUserName" as agent, _synced_at as "createdAt"
         FROM sync_sales_data
         WHERE "IDNumber" = $1
         ORDER BY _synced_at DESC
         LIMIT 10`,
        client.idNumber
      );
    }

    res.json({ success: true, data: { ...client, policies: salesHistory } });
  } catch (error) {
    console.error("Get client error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/clients/:id ──────────────────────────────────────────────────

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid client ID." });
      return;
    }

    const validation = updateClientSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.client.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Client not found." });
      return;
    }

    const client = await prisma.client.update({
      where: { id },
      data: validation.data,
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "UPDATE",
        entity: "Client",
        entityId: String(id),
        details: { updatedFields: Object.keys(validation.data) },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: client });
  } catch (error) {
    console.error("Update client error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/clients/:id/policies ───────────────────────────────────────

router.get("/:id/policies", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid client ID." }); return; }

    // Get the IDNumber for this client then fetch all their sales records
    const clientRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "IDNumber" FROM sync_sales_data WHERE _sync_id = $1 LIMIT 1`, id
    );
    if (!clientRows.length) { res.json({ success: true, data: [] }); return; }

    const idNumber = clientRows[0].IDNumber;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT _sync_id::integer as id,
              CONCAT('POL-', _sync_id::integer) as "policyNumber",
              COALESCE("ProductName", 'Unknown') as "productName",
              0 as "premiumAmount",
              COALESCE("Status", 'Unknown') as status,
              COALESCE("DateLoaded"::text, _synced_at::text) as "startDate",
              NULL::text as "endDate",
              COALESCE("SalesAgentUserName", '') as "agentName",
              _synced_at as "createdAt"
       FROM sync_sales_data WHERE "IDNumber" = $1 ORDER BY _synced_at DESC LIMIT 20`,
      idNumber
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Client policies error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/clients/:id/payments ───────────────────────────────────────

router.get("/:id/payments", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid client ID." }); return; }

    const clientRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "IDNumber" FROM sync_sales_data WHERE _sync_id = $1 LIMIT 1`, id
    );
    if (!clientRows.length) { res.json({ success: true, data: [] }); return; }

    const idNumber = clientRows[0].IDNumber;

    // Look up payments in sagepay transactions by IdNumber
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT _sync_id::integer as id,
              CONCAT('POL-', _sync_id::integer) as "policyNumber",
              CASE WHEN "Amount" ~ '^[0-9]+(\\.[0-9]+)?$' THEN "Amount"::numeric ELSE 0 END as amount,
              COALESCE("CollectionStatus", 'Unknown') as status,
              COALESCE("Date"::text, _synced_at::text) as "paymentDate",
              'Debit Order' as method,
              "UniqueId" as reference,
              "Product" as "productName"
       FROM sync_sagepay_transactions
       WHERE "IdNumber" = $1
       ORDER BY "Date" DESC NULLS LAST
       LIMIT 20`,
      idNumber
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Client payments error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/clients/:id/documents ──────────────────────────────────────

router.get("/:id/documents", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid client ID." }); return; }
    // Welcome packs are linked by Prisma clientId — likely empty until generated
    const packs = await prisma.welcomePack.findMany({
      where: { clientId: id },
      include: { policy: { include: { product: { select: { name: true } } } } },
      orderBy: { sentAt: "desc" },
    });
    const docs = packs.map((p) => ({
      id: p.id,
      productName: p.policy?.product?.name ?? "Unknown",
      status: p.signedAt ? "signed" : p.viewedAt ? "viewed" : "sent",
      sentAt: p.sentAt,
      viewedAt: p.viewedAt,
      signedAt: p.signedAt,
      downloadUrl: `/api/documents/welcome-pack/${p.id}`,
    }));
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error("Client documents error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/clients/:id/sms ────────────────────────────────────────────

router.get("/:id/sms", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ success: false, error: "Invalid client ID." }); return; }

    // Get client's phone number from sync data
    const clientRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "CellPhone" FROM sync_sales_data WHERE _sync_id = $1 LIMIT 1`, id
    );
    if (!clientRows.length) { res.json({ success: true, data: [] }); return; }

    const phone = clientRows[0].CellPhone;
    const messages = await prisma.smsMessage.findMany({
      where: { recipientNumber: phone ?? "" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const smsRecords = messages.map((m) => ({
      id: m.id,
      recipient: m.recipientNumber,
      message: m.messageBody,
      template: m.type,
      status: m.status,
      sentAt: m.sentAt ?? m.createdAt,
    }));

    res.json({ success: true, data: smsRecords });
  } catch (error) {
    console.error("Client SMS error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
