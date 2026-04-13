import { Router, Response } from "express";
import prisma from "../lib/prisma";
import {
  createProductSchema,
  updateProductSchema,
  createPremiumTierSchema,
  updatePremiumTierSchema,
} from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET /api/products ─────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    // Extract distinct products from sync_sales_data
    const [rows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as id,
                "ProductName" as name,
                'STANDARD' as type,
                NULL::text as description,
                true as active,
                COUNT(*) as "salesCount",
                ARRAY[]::jsonb[] as "premiumTiers",
                NOW() as "createdAt"
         FROM sync_sales_data
         WHERE "ProductName" IS NOT NULL AND "ProductName" != ''
         GROUP BY "ProductName"
         ORDER BY COUNT(*) DESC
         LIMIT $1 OFFSET $2`,
        limit, skip
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(DISTINCT "ProductName") as n FROM sync_sales_data WHERE "ProductName" IS NOT NULL AND "ProductName" != ''`
      ),
    ]);

    const total = Number(countRow[0].n);

    // Cast id from bigint to number and format premiumTiers as empty array
    const products = rows.map((r: any) => ({
      ...r,
      id: Number(r.id),
      salesCount: Number(r.salesCount),
      premiumTiers: [],
    }));

    res.json({
      success: true,
      data: {
        products,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List products error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/products (admin only) ───────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    // Check admin role
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Only administrators can create products.",
      });
      return;
    }

    const validation = createProductSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Check for duplicate code
    const existingProduct = await prisma.product.findUnique({
      where: { code: data.code },
    });

    if (existingProduct) {
      res.status(409).json({
        success: false,
        error: "A product with this code already exists.",
      });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        premiumAmount: data.premiumAmount,
        description: data.description ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "CREATE",
        entity: "Product",
        entityId: String(product.id),
        details: { productName: product.name, code: product.code },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/products/:id ─────────────────────────────────────────────────

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid product ID." });
      return;
    }

    // Check admin role
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Only administrators can update products.",
      });
      return;
    }

    const validation = updateProductSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.product.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    const product = await prisma.product.update({
      where: { id },
      data: validation.data,
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "UPDATE",
        entity: "Product",
        entityId: String(id),
        details: { updatedFields: Object.keys(validation.data) },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: product });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/products/:id/tiers ───────────────────────────────────────────

router.get("/:id/tiers", async (req: AuthRequest, res: Response) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      res.status(400).json({ success: false, error: "Invalid product ID." });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    const tiers = await prisma.premiumTier.findMany({
      where: { productId },
      orderBy: { amount: "asc" },
    });

    res.json({ success: true, data: tiers });
  } catch (error) {
    console.error("Get premium tiers error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/products/:id/tiers ──────────────────────────────────────────

router.post("/:id/tiers", async (req: AuthRequest, res: Response) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      res.status(400).json({ success: false, error: "Invalid product ID." });
      return;
    }

    // Check admin role
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Only administrators can manage premium tiers.",
      });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    const validation = createPremiumTierSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const tier = await prisma.premiumTier.create({
      data: {
        productId,
        tierName: validation.data.tierName,
        amount: validation.data.amount,
        effectiveDate: new Date(validation.data.effectiveDate),
      },
    });

    res.status(201).json({ success: true, data: tier });
  } catch (error) {
    console.error("Create premium tier error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/products/tiers/:tierId ───────────────────────────────────────

router.put("/tiers/:tierId", async (req: AuthRequest, res: Response) => {
  try {
    const tierId = parseInt(req.params.tierId);

    if (isNaN(tierId)) {
      res.status(400).json({ success: false, error: "Invalid tier ID." });
      return;
    }

    // Check admin role
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Only administrators can manage premium tiers.",
      });
      return;
    }

    const existing = await prisma.premiumTier.findUnique({ where: { id: tierId } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Premium tier not found." });
      return;
    }

    const validation = updatePremiumTierSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const tier = await prisma.premiumTier.update({
      where: { id: tierId },
      data: validation.data,
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "UPDATE",
        entity: "PremiumTier",
        entityId: String(tierId),
        details: { productId: existing.productId, updatedFields: Object.keys(validation.data) },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: tier });
  } catch (error) {
    console.error("Update premium tier error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
