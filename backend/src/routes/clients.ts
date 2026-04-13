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
          `SELECT _sync_id::integer as id, "Title" as title, "FirstName" as "firstName", "LastName" as "lastName",
                  "IDNumber" as "idNumber", "CellPhone" as cellphone, "CellPhone" as phone,
                  NULL::text as email, NULL::text as province, "Status" as status, "ProductName" as product,
                  "SalesAgentUserName" as agent, _synced_at as "createdAt"
           FROM sync_sales_data
           WHERE "FirstName" ILIKE $1 OR "LastName" ILIKE $1 OR "IDNumber" ILIKE $1 OR "CellPhone" ILIKE $1
           ORDER BY _synced_at DESC
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
          `SELECT _sync_id::integer as id, "Title" as title, "FirstName" as "firstName", "LastName" as "lastName",
                  "IDNumber" as "idNumber", "CellPhone" as cellphone, "CellPhone" as phone,
                  NULL::text as email, NULL::text as province, "Status" as status, "ProductName" as product,
                  "SalesAgentUserName" as agent, _synced_at as "createdAt"
           FROM sync_sales_data
           ORDER BY _synced_at DESC
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

export default router;
