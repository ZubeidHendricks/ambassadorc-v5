import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth";
import ambassadorRoutes from "./routes/ambassadors";
import referralRoutes from "./routes/referrals";
import leadRoutes from "./routes/leads";
import dashboardRoutes from "./routes/dashboard";
import clientRoutes from "./routes/clients";
import productRoutes from "./routes/products";
import policyRoutes from "./routes/policies";
import paymentRoutes from "./routes/payments";
import salesRoutes from "./routes/sales";
import documentRoutes from "./routes/documents";
import smsRoutes from "./routes/sms";
import qaRoutes from "./routes/qa";
import commissionRoutes from "./routes/commissions";
import adminRoutes from "./routes/admin";
import agentRoutes from "./routes/agents";
import workflowRoutes from "./routes/workflows";
import { orchestrator } from "./agents/index";
import { workflowEngine } from "./workflows/engine";
import { seedWorkflowTemplates } from "./workflows/templates";
import integrationRoutes from "./routes/integrations";
import queryRoutes from "./routes/query";
import syncRoutes from "./routes/sync";
import { seedIntegrationConfigs } from "./integrations/index";
import { scheduleDailySync } from "./sync/engine";
import { runLeadScorer } from "./agents/lead-scorer";
import { runQaAutoChecker } from "./agents/qa-auto-checker";
import { runSmsDispatcher } from "./agents/sms-dispatcher";
import { runCommissionCalculator } from "./agents/commission-calculator";
import { runDebitOrderReconciler } from "./agents/debit-order-reconciler";
import { runWelcomePackSender } from "./agents/welcome-pack-sender";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ─── Security Middleware ────────────────────────────────────────────────────

app.use(helmet());

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Rate Limiting ──────────────────────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Stricter limit for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later.",
  },
});

app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);

// ─── Body Parser ────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── Health Check ───────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/ambassadors", ambassadorRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/products", productRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/qa", qaRoutes);
app.use("/api/commissions", commissionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/sync", syncRoutes);

// ─── Serve Static Frontend (Production) ────────────────────────────────────

const publicDir = path.join(__dirname, "..", "public");
if (process.env.NODE_ENV === "production" && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
} else {
  // ─── 404 Handler ──────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: "Route not found.",
    });
  });
}

// ─── Global Error Handler ───────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);

  const statusCode = (err as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred."
      : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
  });
});

// ─── Register AI Agents ────────────────────────────────────────────────────

orchestrator.register(
  "lead-scorer",
  "Analyzes and scores leads based on province, contact method, recency, and ambassador track record",
  runLeadScorer
);

orchestrator.register(
  "qa-auto-checker",
  "Automatically validates new sales for ID correctness, duplicates, missing fields, and premium tier matching",
  runQaAutoChecker
);

orchestrator.register(
  "sms-dispatcher",
  "Processes queued SMS messages with rate limiting (10/sec) and delivery tracking",
  runSmsDispatcher
);

orchestrator.register(
  "commission-calculator",
  "Calculates commissions for sales, paid leads, and referral milestones",
  runCommissionCalculator
);

orchestrator.register(
  "debit-order-reconciler",
  "Reconciles payment records against debit orders, flags failures, and lapses policies after 3 consecutive misses",
  runDebitOrderReconciler
);

orchestrator.register(
  "welcome-pack-sender",
  "Creates welcome packs for new active policies and queues welcome SMS messages",
  runWelcomePackSender
);

// ─── Start Server ───────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`Ambassador API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Registered ${orchestrator.listAgents().length} AI agents`);

  // Seed default workflow templates on startup (no-op if already seeded)
  try {
    await seedWorkflowTemplates();
    console.log("Workflow engine initialised");
  } catch (err) {
    console.error("Failed to seed workflow templates:", err);
  }

  // Seed integration configs on startup (no-op if already present)
  try {
    await seedIntegrationConfigs();
    console.log("Integration configs initialised");
  } catch (err) {
    console.error("Failed to seed integration configs:", err);
  }

  // Schedule daily FoxPro SQL Server sync at 2:00 AM UTC
  try {
    scheduleDailySync(2);
    console.log("FoxPro daily sync scheduler started (runs at 02:00 UTC)");
  } catch (err) {
    console.error("Failed to start daily sync scheduler:", err);
  }
});

export default app;
