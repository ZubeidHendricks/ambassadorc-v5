---
name: Database wiring, schema drift & publish flow
description: Where this app's DBs actually live, why prisma db push is dangerous here, and how prod schema changes must be applied
---

## The app uses Replit-managed Postgres, NOT DigitalOcean
`replit.md` claims dev connects to DigitalOcean Managed Postgres. That is **stale**. The
running app's `DATABASE_URL` points at the Replit-managed databases:
- **dev** = `heliumdb` (host "helium") — this is also what `executeSql({environment:"development"})` hits, so that tool can read/alter the real dev DB.
- **prod** = `neondb` — `executeSql({environment:"production"})` is a read-only replica of it.

**How to apply:** to inspect/alter the dev DB, use `executeSql` development (it's the same DB the backend uses). Don't trust the replit.md DigitalOcean section.

## NEVER run `prisma db push` here — it drops the sync_* tables
The FoxPro ETL `sync_*` staging tables (sync_checkpoints, sync_am_*, sync_sales_*, etc.)
are NOT modeled in `schema.prisma` (they're queried via raw SQL). `prisma db push` (and
`migrate diff`) therefore emit `DROP TABLE sync_*` to make the DB match the schema —
destroying ETL data.

**Why:** schema is intentionally a partial model of the DB; unmanaged staging tables coexist.
**How to apply:** for dev schema changes apply a targeted `ALTER TABLE` via `executeSql` (development), matching what Prisma expects (check `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` and cherry-pick only the additive change you need). Never run a bare `db push`/`db:push`.

## Production schema changes go through Publish, not DDL
Per the database skill: do not run DDL against prod, no startup/deploy-time DDL, no
migrate-prod scripts. Make the additive change in the dev DB, verify, then the user
re-Publishes — Replit diffs dev→prod and applies it (with a confirmation prompt for
destructive/rename changes).

**Known drift (2026-06): ** `schema.prisma` was ahead of both dev and prod DBs — e.g.
`ambassadors.dailyLeadQuota Int @default(10)` existed in schema/Prisma-client but not in
the DBs, so the login `findUnique` (which selects it) threw and every login failed with
"An unexpected error occurred during login." Other additive drift also exists
(sales.collectionMethod/department/foxStatus/persalNumber/etc., leads.callOutcome enum).
Fixing login only needs the `dailyLeadQuota` column; the rest may surface on other pages.
