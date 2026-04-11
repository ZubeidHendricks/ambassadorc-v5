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
    const search = (req.query.search as string) || "";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { idNumber: { contains: search } },
        { cellphone: { contains: search } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          firstName: true,
          lastName: true,
          idNumber: true,
          cellphone: true,
          email: true,
          province: true,
          createdAt: true,
        },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        clients,
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

    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { idNumber: { contains: q } },
          { cellphone: { contains: q } },
        ],
      },
      take: 20,
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        title: true,
        firstName: true,
        lastName: true,
        idNumber: true,
        cellphone: true,
        email: true,
        province: true,
      },
    });

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

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        policies: {
          orderBy: { createdAt: "desc" },
          include: {
            product: { select: { id: true, name: true, code: true, type: true } },
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({ success: false, error: "Client not found." });
      return;
    }

    res.json({ success: true, data: client });
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
