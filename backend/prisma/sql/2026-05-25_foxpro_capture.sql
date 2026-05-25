-- FoxPro Product Capture — additive schema changes
-- ------------------------------------------------------------------
-- Adds the capture fields used by POST /api/sales/capture and the
-- dependants table. All changes are additive and idempotent, so they
-- are safe to run against the populated production database.
--
-- This project normally syncs schema via `prisma db push` during build
-- (no migrations folder). This file is the explicit, reviewable artifact
-- for the same change; running it by hand is equivalent to db push for
-- these objects.
--
-- Apply:  psql "$DATABASE_URL" -f backend/prisma/sql/2026-05-25_foxpro_capture.sql
-- Or:     cd backend && npx prisma db push   (diffs schema.prisma → DB)

BEGIN;

-- ── sales: capture columns ────────────────────────────────────────
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "foxStatus"        VARCHAR(10);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "tierName"         VARCHAR(100);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "premiumAmount"    DECIMAL(10,2);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "collectionMethod" VARCHAR(20);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "firstDebitDate"   TIMESTAMP(3);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "persalNumber"     VARCHAR(40);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "department"       VARCHAR(120);
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "validationAgent"  VARCHAR(200);

-- ── dependants ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dependants" (
  "id"           SERIAL PRIMARY KEY,
  "saleId"       INTEGER NOT NULL,
  "name"         VARCHAR(200) NOT NULL,
  "relationship" VARCHAR(50),
  "dateOfBirth"  VARCHAR(20),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "dependants_saleId_idx" ON "dependants" ("saleId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'dependants_saleId_fkey'
  ) THEN
    ALTER TABLE "dependants"
      ADD CONSTRAINT "dependants_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
