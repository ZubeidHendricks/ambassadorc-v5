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
- Sales dashboard and pipeline: `/admin/sales` starts with the worksheet-style Sales Dashboard, showing product spread rows for Lifesaver 24 Basic, Lifesaver 24 Plus, Lifesaver legal Basic, and Lifesaver legal Plus, plus an Active Agents table with linked agent names, sale counts, values, and totals. It then shows the sales agents page for client sale capture (surname, ID, address, Persal, department, first debit date, dependants), submit-sale validation checks, validation-agent edit/correction, final validation handoff into T status/QA bay language, FoxPro-inspired stages (`Sales Capture`, `In QA Validation`, `QA Passed`, `Exported Awaiting Outcome`, `Q-Link Uploaded`, `Repair`, `Client Cancelled`), and preserves raw FoxPro status labels from synced data.
- QA mailbox: `/admin/qa` mirrors the worksheet-style QA mailbox with columns for Client ID, Client Name, Date Of Sale, Sales Verification Agent, SUBMIT BUTTON, REPAIR, and CANCEL BUTTON. It keeps the export note that submitted sales are loaded for midnight Netcash/Q-Link export. Synced FoxPro rows write approved QA outcomes back to FoxPro `SalesData` through the SQL Server sync connection, update the local staging row after success, and audit both successful and failed source-system write-back outcomes.
- Export/Q-Link monitoring: `/admin/export-status` mirrors the worksheet-style export status sketch with product rows for Lifesaver 24 Basic, Lifesaver 24 Plus, Lifesaver legal Basic, and Lifesaver legal plus, showing premium/counts, EXPORT RETURN STATUS, returned reasons in red, and the Switch to Debit Order action. Backend endpoints: `GET /api/sales/status-dictionary` and `GET /api/sales/export-status`.
- Premium increases: `/admin/premium-changes` mirrors the Foxbill worksheet where Nicole can manage product premium increases, with rows for Lifesaver 24 Basic, Lifesaver 24 Plus, Lifesaver legal Basic, and Lifesaver legal Plus, current premium, Change Premium input, Effective Date input, and UPDATE action.
- Operations Excel reports: admins can download workbook-style exports from `/admin/reports` and `/admin/export-status`; `/admin/reports` includes the worksheet-style Monthly Premium page with Lifesaver product rows, Prem, Exported Sales, Debit Order successful/banked/failed/lost revenue, Persal successful/banked/failed/lost revenue, Actual Revenue, Total Banked Revenue, and Total Lost Revenue. It also includes the worksheet-style Global Book page with Persal Monthly Summary rows, Jan-26 through Dec-26 columns, Q-Link Total, Q-Link Big, Netcash, Total Book & Premiums, and Average Premiums sections. Backend endpoints `GET /api/reports/operations/export-status`, `GET /api/reports/operations/monthly-premium`, and `GET /api/reports/operations/global-book` generate Export Status, Monthly Premium, and Global Book reports using synced FoxPro data and the shared status dictionary. Operations report downloads accept reporting `year` and optional `month` query parameters, and each workbook records the selected reporting period in its metadata sheet.
- Native-mode export monitoring maps Prisma sale statuses into the same operational groups for visibility, but native `QA_APPROVED` sales cannot distinguish FoxPro-only `qa_passed` versus `exported_awaiting_outcome` granularity without synced FoxPro status data.
- Agents and campaigns: `/admin/agents` is the call-centre control page for adding call-centre agents, stamping their login setup date, selecting active agents, reviewing product/campaign assignments, and assigning registered agents to sales campaigns via `POST /api/admin/agents` and `PUT /api/admin/agents/:id/campaign`.
- Ambassador payment cycle: `/admin/ambassador-backend` mirrors the ZUBEID workbook's ambassador backend table and FNB payout flow with spreadsheet-style columns for Date Submitted, Name/Surname, Referrals, Confirmed Numbers, Member Signup, Sales, Value Rands, Bonus, Total for payment, CSV/FNB/import/authorisation/update workflow, and Paid/Pending status. Backend endpoints under `/api/ambassador-payments` calculate referral/member-signup earnings, generate due payments, export the FNB CSV, authorise payments, import paid rows, mark linked member-signup leads as paid, queue ambassador SMS notifications, and update the ambassador dashboard activity/earnings table.
- Operations workspace: `/admin` is the FoxPro-style operations entry point. The dashboard is partitioned into Marketing & Ambassador App, Engagement/Onboarding/Collections, and Client Communications. The Marketing column explicitly starts with the first app flow: WhatsApp invite, ambassador registration, referrals/member sign-up, earnings rules, backend table/payment status, and the FNB payment cycle.
- Safety checks: `npm run smoke:foxpro-operations` runs API smoke checks for the status dictionary, sales grouping, export/Q-Link monitoring, QA verdict validation, campaign assignment validation, and operations report workbook downloads, including expected sheet/header layout checks for Export Status, Monthly Premium, and Global Book reports. It also runs frontend route smoke checks for `/admin`, `/admin/sales`, `/admin/qa`, `/admin/agents`, `/admin/export-status`, `/admin/premium-changes`, `/admin/reports`, `/admin/ambassador-backend`, `/admin/documents`, and `/admin/sms`, rendered UI checks for role navigation and worksheet pages, then uses a browser smoke check to confirm the reports page operations download controls request the expected `/api/reports/operations/*` endpoints. All smoke runs must set `SMOKE_ADMIN_MOBILE` and `SMOKE_ADMIN_PASSWORD` explicitly; the scripts do not provide credential fallbacks.
