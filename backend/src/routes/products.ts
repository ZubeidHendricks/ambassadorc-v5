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

router.use(authenticate);

// ─── Type helpers ───────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  Life: "LIFE_COVER",
  "Life Cover": "LIFE_COVER",
  Funeral: "LIFE_COVER",
  Legal: "LEGAL",
  SOS: "SOS",
  "Five-In-One": "FIVE_IN_ONE",
  "Short Term": "SHORT_TERM",
  Accident: "SHORT_TERM",
  Consult: "CONSULT",
  Health: "CONSULT",
};

const SYNC_TYPE_MAP: Record<string, string> = {
  "Life Saver Legal": "LEGAL",
  LegalNet: "LEGAL",
  "Life Saver 24": "LIFE_COVER",
  "Five-In-One": "FIVE_IN_ONE",
};

const SYNC_PREMIUM_MAP: Record<string, number> = {
  "Life Saver Legal": 129,
  LegalNet: 129,
  "Life Saver 24": 199,
  "Five-In-One": 199,
};

function toProductType(raw: string): any {
  const mapped = TYPE_MAP[raw] ?? raw;
  const valid = ["LIFE_COVER", "LEGAL", "SOS", "FIVE_IN_ONE", "SHORT_TERM", "CONSULT"];
  return valid.includes(mapped) ? mapped : "LEGAL";
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureProductsSeeded() {
  const count = await prisma.product.count();
  if (count > 0) return;

  const syncRows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT DISTINCT "ProductName" as name FROM sync_sales_data
     WHERE "ProductName" IS NOT NULL AND "ProductName" != ''
     ORDER BY name`
  );

  for (const row of syncRows) {
    const code = slugify(row.name);
    await prisma.product.upsert({
      where: { code },
      create: {
        name: row.name,
        code,
        type: (SYNC_TYPE_MAP[row.name] ?? "LEGAL") as any,
        premiumAmount: SYNC_PREMIUM_MAP[row.name] ?? 129,
        description: null,
      },
      update: {},
    });
  }
}

function formatProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    type: p.type,
    description: p.description ?? null,
    active: p.isActive,
    premiumAmount: Number(p.premiumAmount),
    premiumTiers: (p.premiumTiers ?? []).map((t: any) => ({
      id: t.id,
      productId: t.productId,
      tierName: t.tierName,
      premiumAmount: Number(t.amount),
      coverAmount: 0,
      active: t.isActive,
    })),
    createdAt: p.createdAt,
  };
}

// ─── GET /api/products ──────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    await ensureProductsSeeded();

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          premiumTiers: {
            where: { isActive: true },
            orderBy: { amount: "asc" },
          },
        },
      }),
      prisma.product.count(),
    ]);

    res.json({
      success: true,
      data: {
        products: products.map(formatProduct),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List products error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/products/:id ──────────────────────────────────────────────────

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid product ID." });
      return;
    }
    const product = await prisma.product.findUnique({
      where: { id },
      include: { premiumTiers: { where: { isActive: true }, orderBy: { amount: "asc" } } },
    });
    if (!product) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }
    res.json({ success: true, data: formatProduct(product) });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/products ─────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });
    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({ success: false, error: "Only administrators can create products." });
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
    const code = data.code?.trim() || slugify(data.name);
    const type = toProductType(data.type);
    const premiumAmount = data.premiumAmount ?? 0;

    const existing = await prisma.product.findUnique({ where: { code } });
    if (existing) {
      res.status(409).json({ success: false, error: "A product with this code already exists." });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        code,
        type,
        premiumAmount,
        description: data.description ?? null,
      },
      include: { premiumTiers: true },
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

    res.status(201).json({ success: true, data: formatProduct(product) });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/products/:id ──────────────────────────────────────────────────

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid product ID." });
      return;
    }

    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });
    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({ success: false, error: "Only administrators can update products." });
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

    const updateData: any = { ...validation.data };
    if (updateData.type) updateData.type = toProductType(updateData.type);
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { premiumTiers: { where: { isActive: true }, orderBy: { amount: "asc" } } },
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

    res.json({ success: true, data: formatProduct(product) });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/products/:id/tiers ────────────────────────────────────────────

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
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/products/:id/tiers ───────────────────────────────────────────

router.post("/:id/tiers", async (req: AuthRequest, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      res.status(400).json({ success: false, error: "Invalid product ID." });
      return;
    }

    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });
    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({ success: false, error: "Only administrators can manage premium tiers." });
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
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/products/tiers/:tierId ────────────────────────────────────────

router.put("/tiers/:tierId", async (req: AuthRequest, res: Response) => {
  try {
    const tierId = parseInt(req.params.tierId);
    if (isNaN(tierId)) {
      res.status(400).json({ success: false, error: "Invalid tier ID." });
      return;
    }

    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });
    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({ success: false, error: "Only administrators can manage premium tiers." });
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
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
