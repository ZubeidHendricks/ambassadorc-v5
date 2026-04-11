import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { registerSchema, loginSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// ─── POST /api/auth/register ────────────────────────────────────────────────

router.post("/register", async (req: AuthRequest, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { firstName, lastName, mobileNo, password, province, department, acceptTerms } =
      validation.data;

    // Check if mobile number already registered
    const existing = await prisma.ambassador.findUnique({
      where: { mobileNo },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        error: "An ambassador with this mobile number already exists.",
      });
      return;
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Create ambassador
    const ambassador = await prisma.ambassador.create({
      data: {
        firstName,
        lastName,
        mobileNo,
        passwordHash,
        province,
        department,
        acceptTerms,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNo: true,
        province: true,
        department: true,
        createdAt: true,
      },
    });

    // Generate JWT
    const token = signToken({ id: ambassador.id, mobileNo: ambassador.mobileNo });

    res.status(201).json({
      success: true,
      data: {
        token,
        ambassador,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred during registration.",
    });
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────────────────

router.post("/login", async (req: AuthRequest, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { mobileNo, password } = validation.data;

    // Find ambassador by mobile number
    const ambassador = await prisma.ambassador.findUnique({
      where: { mobileNo },
    });

    if (!ambassador) {
      res.status(401).json({
        success: false,
        error: "Invalid mobile number or password.",
      });
      return;
    }

    if (!ambassador.isActive) {
      res.status(403).json({
        success: false,
        error: "This account has been deactivated. Please contact support.",
      });
      return;
    }

    // Verify password against bcrypt hash
    const passwordValid = await bcrypt.compare(password, ambassador.passwordHash);

    if (!passwordValid) {
      res.status(401).json({
        success: false,
        error: "Invalid mobile number or password.",
      });
      return;
    }

    // Generate JWT
    const token = signToken({ id: ambassador.id, mobileNo: ambassador.mobileNo });

    // Return profile without passwordHash
    const { passwordHash: _, ...profile } = ambassador;

    res.json({
      success: true,
      data: {
        token,
        ambassador: profile,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred during login.",
    });
  }
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────

router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNo: true,
        email: true,
        province: true,
        department: true,
        shopSteward: true,
        union: true,
        town: true,
        location: true,
        acceptTerms: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!ambassador) {
      res.status(404).json({
        success: false,
        error: "Ambassador not found.",
      });
      return;
    }

    res.json({
      success: true,
      data: ambassador,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
