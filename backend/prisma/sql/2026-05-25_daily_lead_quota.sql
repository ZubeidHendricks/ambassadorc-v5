-- Daily lead quota (call-centre "leads/day" allocation: 5/10/15/20)
-- ------------------------------------------------------------------
-- Additive + idempotent. Safe to run against the populated production DB,
-- or apply via `cd backend && npx prisma db push` (diffs schema.prisma → DB).
--
-- Apply: psql "$DATABASE_URL" -f backend/prisma/sql/2026-05-25_daily_lead_quota.sql

ALTER TABLE "ambassadors"
  ADD COLUMN IF NOT EXISTS "dailyLeadQuota" INTEGER NOT NULL DEFAULT 10;
