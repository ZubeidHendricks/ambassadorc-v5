# AmbassadorC v5 — Insurance Management Platform

## Overview

A unified insurance management platform for South African insurance operations. Consolidates three legacy systems (AMBASSADORC, FoxBilling, FoxPro DNN) into a single full-stack TypeScript application.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4 (port 5000 in dev)
- **Backend**: Node.js + Express + TypeScript + Prisma ORM (port 3001 in dev)
- **Database**: PostgreSQL (Replit managed)
- **Auth**: JWT + bcryptjs

## Project Structure

```
/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── pages/     # 23+ pages (ambassador portal + admin panel)
│   │   ├── components/# Reusable UI components (Radix UI + Tailwind)
│   │   ├── context/   # Auth context (JWT)
│   │   └── lib/api.ts # Central API client
│   └── vite.config.ts # Dev server: port 5000, host 0.0.0.0, proxies /api -> 3001
├── backend/
│   ├── src/
│   │   ├── index.ts   # Express server entry, serves static in production
│   │   ├── routes/    # 17 API route modules
│   │   ├── agents/    # 6 AI automation agents
│   │   ├── workflows/ # Business process workflow engine
│   │   └── integrations/ # Third-party service adapters
│   └── prisma/schema.prisma # 33-model database schema
├── start.sh           # Production startup script
└── replit.md          # This file
```

## Development Setup

Two workflows run concurrently:
1. **Backend** (`cd backend && npm run dev`) — port 3001
2. **Start application** (`cd frontend && npm run dev`) — port 5000 (webview)

Frontend proxies `/api/*` requests to the backend at `localhost:3001`.

## Database

Connected to **DigitalOcean Managed PostgreSQL** (production database).
- Host: `ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com:25060`
- Database: `ambassadorc`
- SSL: required
- Schema managed by Prisma (`backend/prisma/schema.prisma`, 34 tables)

## Admin Credentials

- Mobile: `0800000000`
- Password: `Admin@2024`
- Role: ADMIN

## Environment Variables

Backend `.env` (not committed):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `JWT_EXPIRES_IN` — Token expiry (default: 7d)
- `PORT` — Backend port (default: 3001)
- `NODE_ENV` — development / production

## SQL Console

Available at `/admin/sql` (ADMIN only). Supports SELECT / WITH / EXPLAIN queries.
- View schema browser with table/column explorer
- 9 preset queries for common data lookups
- Query history (last 30 runs)
- Export results as CSV
- Backend route: `POST /api/query/sql`, `GET /api/query/schema`, `GET /api/query/stats`

## Production Deployment

- Build: Compiles backend TypeScript, builds frontend Vite app, copies static assets to `backend/public/`
- Run: `bash start.sh` — runs Prisma db push + starts compiled Express server
- Express serves static frontend files from `backend/public/` in production
- Backend handles all `/api/*` routes; frontend SPA handles all other routes

## FoxPro Sync Pipeline

ETL pipeline that replicates FoxPro SQL Server (foxpro.co.za:3231) into PostgreSQL `sync_*` staging tables.

### Architecture
- 29 tables mapped in `backend/src/sync/table-map.ts`
- Engine: `backend/src/sync/engine.ts`
- Three sync strategies:
  1. **Keyset pagination** (`WHERE id > lastId ORDER BY id`) — for indexed tables with small-medium row counts
  2. **OFFSET/FETCH** — for tables without an `id` column (small tables)
  3. **Stream dump** (`streamDump: true`) — for wide/unindexed tables (SalesData, SalesLeads, SagePayTransactions). Uses mssql streaming mode with `SELECT * WITH (NOLOCK)` — no ORDER BY, no WHERE — rows flow in heap order. Avoids full-table scan + sort that caused 10+ minute timeouts on SQL Server Express.
- **Checkpoints**: `sync_checkpoints` table tracks `(source_table, last_id, rows_synced)` — persists across process restarts so interrupted syncs resume automatically
- **Schedule**: daily at 02:00 UTC via `node-schedule`
- **API**: `POST /api/sync/run` (with optional `tables[]` and `forceReset: true`), `GET /api/sync/status`, `GET /api/sync/checkpoints`

### Current Sync Status (as of 2026-04-13)
All 29 tables synced — **1,182,293 total rows**:
- `sync_sales_history`: 502,111 rows
- `sync_sagepay_transactions`: 354,224 rows (streamDump)
- `sync_sales_leads`: 112,562 rows (streamDump)
- `sync_sales_data`: 103,830 rows (streamDump)
- `sync_invoice_data`: 48,674 rows
- `sync_welcome_pack_history`: 19,849 rows
- `sync_premium_updates`: 18,860 rows
- `sync_sales_transactions`: 17,757 rows
- + 21 smaller tables

### UI: Sync Dashboard
Available at `/admin/sync` (ADMIN only):
- Live progress polling (5s interval while running)
- Force Reset checkbox to clear checkpoints and reload from scratch
- Progress tab showing active checkpoints
- History tab showing past sync jobs
- Table cards with last-result status indicators
- Preview panel: click any table to see latest 50 rows

## Dual-Path Database Architecture

Routes detect which environment they're running in via `backend/src/lib/syncCheck.ts`:
- **Sync path** (dev/ETL): queries `sync_*` staging tables populated by FoxPro ETL pipeline
- **Native Prisma path** (production): queries native Prisma-managed tables (`clients`, `policies`, `commissions`, etc.)

Detection is cached per process startup (single DB probe). The following routes implement dual-path:
- `clients.ts` — client list + detail + search
- `admin.ts` — dashboard stats + agents list
- `commissions.ts` — commission list + summary
- `qa.ts` — QA checks list
- `policies.ts` — policy list + premium changes
- `documents.ts` — welcome pack list

Production server (`root@142.93.44.48`, `/opt/ambassadorc-v5`, service `ambassadorc-backend`) has 85K clients in native Prisma tables, no sync_* tables.

### Sales route dual-path
`sales.ts` now implements dual-path: sync path normalizes FoxPro statuses (`"Client Cancelled - Other"`, `"Exported Awaiting Outcome"`, etc.) into 5 kanban column values (`new`, `qa_pending`, `approved`, `active`, `cancelled`) via SQL `CASE` expression. Native path maps Prisma `SaleStatus` enum (`QA_APPROVED` → `approved`, etc.).

### BigInt serialization
`backend/src/index.ts` includes global `BigInt.prototype.toJSON` to handle PostgreSQL raw query BigInt returns (prevents `JSON.stringify` crash in client detail and other endpoints).

All 15+ data endpoints verified returning `success: true` on both environments.

## Key Features

- Ambassador/Agent registration and management
- Lead and referral submission + tracking
- Sales processing and QA verification
- Commission calculation
- Policy management and billing
- Admin dashboard with analytics
- AI-powered automation agents (lead scoring, QA checks, SMS dispatch)
- Integration adapters: QLink, SagePay, NetCash, GuardRisk, ViciDialer, WATI

## FoxPro Operations Flow

The admin surface semi-replicates the FoxPro operations workflow while keeping the modern AmbassadorC UI:
- Central status dictionary: `backend/src/lib/foxproStatus.ts` maps FoxPro labels/codes such as `QLink Result: 0 - Ok (Uploaded)`, `Client Cancelled - Other`, `QA Validation Passed`, `Exported Awaiting Outcome`, `T1`, and `In Validation with Quality Assurance` into operational groups.
- Sales pipeline: `/admin/sales` uses FoxPro-inspired stages (`Sales Capture`, `In QA Validation`, `QA Passed`, `Exported Awaiting Outcome`, `Q-Link Uploaded`, `Repair`, `Client Cancelled`) and preserves raw FoxPro status labels from synced data.
- QA mailbox: `/admin/qa` uses Submit, Repair, and Cancel language. Synced FoxPro rows write approved QA outcomes back to FoxPro `SalesData` through the SQL Server sync connection, update the local staging row after success, and audit both successful and failed source-system write-back outcomes.
- Export/Q-Link monitoring: `/admin/export-status` groups synced sales by export and return outcome, with drill-down rows and status explanations. Backend endpoints: `GET /api/sales/status-dictionary` and `GET /api/sales/export-status`.
- Native-mode export monitoring maps Prisma sale statuses into the same operational groups for visibility, but native `QA_APPROVED` sales cannot distinguish FoxPro-only `qa_passed` versus `exported_awaiting_outcome` granularity without synced FoxPro status data.
- Agents and campaigns: `/admin/agents` now highlights master/admin access, call-centre/QA users, active campaigns, and allows admins to assign registered agents to sales campaigns via `PUT /api/admin/agents/:id/campaign`.
- Ambassador payment cycle: `/admin/ambassador-backend` mirrors the ZUBEID workbook's ambassador backend table and FNB payout flow. Backend endpoints under `/api/ambassador-payments` calculate referral/member-signup earnings, generate due payments, export the FNB CSV, authorise payments, import paid rows, mark linked member-signup leads as paid, queue ambassador SMS notifications, and update the ambassador dashboard activity/earnings table.
- Safety checks: `npm run smoke:foxpro-operations` runs API smoke checks for the status dictionary, sales grouping, export/Q-Link monitoring, QA verdict validation, and campaign assignment validation, plus frontend route smoke checks for `/admin/sales`, `/admin/qa`, `/admin/agents`, and `/admin/export-status`. CI/production runs must set `SMOKE_ADMIN_MOBILE` and `SMOKE_ADMIN_PASSWORD` explicitly.
