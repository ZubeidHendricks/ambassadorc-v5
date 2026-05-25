# FoxPro CRM Compatibility Layer

Adds the legacy **FoxPro sales → QA → export → collection** lifecycle to AmbassadorC v5,
using the real FoxPro operational status codes (`T`, `QA`, `QC`, `u`, `t1`, `RC/C`, …) on top
of the already-synced `sync_*` staging data.

Built from: `ZUBEID (1).xlsx` (QA + EXPORT STATUS PAGE sheets), the business-supplied status
list, the live `foxpro.co.za` UI (see `foxpro-screenshots/`), and the FoxPro architecture doc.

## What was added

### Backend (`backend/src/`)
| File | Purpose |
|---|---|
| `lib/foxpro-status.ts` | **Canonical status taxonomy.** Pipeline codes, FoxPro Leads dispositions, Q-Link/Persal result codes (Q*), export-return reasons. Helpers `decodeFoxStatus()`, `mapToSaleStatus()`, `statusReference()`. Pure data — no DB. |
| `routes/foxpro.ts` | REST routes mounted at **`/api/foxpro`** (auth required). |
| `index.ts` | Mounts the route (`app.use("/api/foxpro", foxproRoutes)`). |

**Endpoints**
- `GET /api/foxpro/statuses` — full taxonomy reference
- `GET /api/foxpro/qa-bay` — QA queue from `sync_sales_data`, bucketed New / In-Process
- `GET /api/foxpro/qa-bay/stats` — counts by lifecycle stage
- `POST /api/foxpro/qa-bay/:saleId/action` — `submit` → `QC`, `repair` → `R`, `cancel` → `RC/C` (writes an `audit_logs` entry; staging data is never mutated)
- `GET /api/foxpro/export-status` — per-product exported / awaiting / active / cancelled (EXPORT STATUS PAGE) + return reasons
- `GET /api/foxpro/export-batches` — recent Q-Link & SagePay batches
- `GET /api/foxpro/persal-book` — Q-Link/Persal code reference
- `GET /api/foxpro/lead-dispositions` — FoxPro Leads disposition list
- `GET /api/foxpro/capture/products` — per-product capture catalog (products, plans, methods)
- `POST /api/foxpro/validate-id` — SA ID validation (Luhn + DOB/gender) for live form feedback
- `POST /api/foxpro/capture` — **Product Capture**: validates ID + mobile, upserts client + product, creates the Sale (lands in QA Bay, status T → QA_PENDING) + a PENDING QualityCheck; Persal/banking/dependants preserved on the audit log

Every query is wrapped defensively — if a `sync_*` table is missing it returns empty data
instead of erroring.

### Product Capture (per-product)
- `lib/fox-products.ts` — capture catalog: Life Saver 24 (Basic R259 / Plus R349), Life Saver
  Legal (Basic R179 / Plus R299), LegalNet (R99–R179), Five-In-One (R199); each supports
  Debit Order (Netcash) and Persal (Q-Link).
- `lib/sa-id.ts` — South African ID validation (Luhn checksum + DOB / gender / citizenship).
- `validators.ts` → `foxCaptureSchema` — validates the capture payload, requiring Persal
  (department + employee no) **or** banking (bank + account) per collection method.
- Frontend `pages/admin/foxpro/ProductCapture.tsx` + `lib/saId.ts` (instant client check) —
  one data-driven form covering product/plan/method, client details with live ID validation,
  collection details, and dependants. Route `/admin/foxpro/capture` (AGENT + QA_OFFICER + ADMIN).

### Frontend (`frontend/src/`)
| File | Route | Mirrors |
|---|---|---|
| `pages/admin/foxpro/FoxProHome.tsx` | `/admin/foxpro` | FoxPro top-nav / Business-Sector module map |
| `pages/admin/foxpro/FoxQaBay.tsx` | `/admin/foxpro/qa-bay` | FoxPro QA module (New / In-Process Applications) + Excel "QA" sheet |
| `pages/admin/foxpro/FoxExports.tsx` | `/admin/foxpro/exports` | Excel "EXPORT STATUS PAGE" + Debit Batch Submission |
| `pages/admin/foxpro/FoxStatusReference.tsx` | `/admin/foxpro/statuses` | Status-code documentation |
| `pages/admin/foxpro/FoxHeader.tsx` | — | Shared charcoal/orange FoxPro-themed header |
| `components/ui/FoxStatusBadge.tsx` | — | Colour-coded legacy status chip with tooltip |
| `lib/api.ts` | — | `getFoxStatuses`, `getFoxQaBay`, `getFoxQaStats`, `foxQaAction`, `getFoxExportStatus`, `getFoxExportBatches` |
| `App.tsx`, `components/layout/Sidebar.tsx` | — | Routes + "FoxPro CRM" sidebar section (QA_OFFICER + ADMIN) |

## Status taxonomy (sales pipeline)

| Code | Meaning | v5 SaleStatus |
|---|---|---|
| `T` | Captured — in QA Bay (awaiting 2nd check) | QA_PENDING |
| `QA` | In validation with Quality Assurance | QA_PENDING |
| `R` | Repair / returned to agent | QA_REJECTED |
| `QC` | Q-Link — QA validation passed | QA_APPROVED |
| `NC` | Netcash — QA passed (debit order) | QA_APPROVED |
| `u` | Q-Link uploaded | ACTIVE |
| `t1` | Exported — awaiting outcome | ACTIVE |
| `A` | Active — collecting | ACTIVE |
| `RC/C` | Client cancelled — other | CANCELLED |
| `C` | Cancelled | CANCELLED |

Plus: FoxPro Leads dispositions, Q-Link/Persal codes (QREC…QREV), export-return reasons.

## Deploy (no migration required)

This layer adds **no Prisma schema changes** — nothing to migrate.

```bash
# backend
cd /opt/ambassadorc-v5/backend && git pull && npm install --omit=dev || npm install
systemctl restart ambassadorc-backend

# frontend (build locally, copy dist/)
cd frontend && npm install && npm run build
# deploy dist/ to the server's frontend/dist (or backend/public)
```

Verify: `GET /api/foxpro/statuses` returns the taxonomy; open `/admin/foxpro`.

## Notes / next steps
- `POST /qa-bay/:id/action` currently records the decision to `audit_logs`. To push the
  status back to the live FoxPro SQL Server, add a write-path in `routes/foxpro.ts` (out of
  scope for the read-only sync replica).
- The **Process Batch** button on Export & Status is intentionally disabled — wire it to a
  real debit-batch / `qlink/export` endpoint when ready to trigger live exports.
- Live FoxPro UI screenshots captured during this build are in `foxpro-screenshots/`.
