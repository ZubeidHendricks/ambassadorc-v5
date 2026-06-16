# FNB Export & Ambassador Payment Cycle — Specification

> Purpose: a self-contained brief describing how the **FNB ambassador payout export**
> works in AmbassadorC v5, so an engineering agent can understand, verify, or extend it
> without re-reading the whole codebase.

---

## 1. Context

Ambassadors earn money by (a) submitting **referrals** and (b) driving **member sign-ups**
that convert into paid policies. Periodically, an admin pays the amounts owed to each
ambassador through **FNB** (First National Bank). The system does **not** push money to
FNB directly — instead it produces a payout file the admin uploads into FNB online
banking, and then records which payments were actually paid.

This is a **file-based, human-in-the-loop** flow. There are three artefacts:

1. A **due-payment batch** (rows in the `AmbassadorPayment` table, status `PENDING`).
2. An **FNB CSV export** (downloaded, uploaded to FNB by a human).
3. A **reconciliation step** that marks the paid rows back as `PAID`.

Admin UI lives at `/admin/ambassador-backend`. All endpoints are admin-only.

---

## 2. Earnings rules (source of truth)

Computed per active ambassador in `getOperationalRows()`
(`backend/src/routes/ambassador-payments.ts`).

| Metric | Definition |
|---|---|
| **Referral lead count** | `referrals[]` + leads of type `REFERRAL_LEAD` |
| **Confirmed numbers** | referrals with status `CONTACTED`/`CONVERTED`, plus `REFERRAL_LEAD` leads with status `CONTACTED`/`PAID` |
| **Member sign-ups** | leads of type `MEMBER_SIGNUP` |
| **Sales (converted sign-ups)** | `MEMBER_SIGNUP` leads with status `PAID` |

**Money:**

- **Referral earnings** = `floor(referralLeadCount / 10) * R100`
  (every completed batch of 10 referrals pays R100)
- **Member sign-up earnings** = `sales * R100` (R100 per converted sign-up)
- **Bonus** = `R1000` if `sales >= 10`, else `R0`
- **Total earned** = referral + sign-up + bonus
- **Already paid** = sum of this ambassador's `AmbassadorPayment` rows with status `PAID`
- **Pending** = sum of rows with status `PENDING`
- **Amount due** = `max(0, totalEarned − alreadyPaid − pending)`

> Note: `valueRands` shown in the backend table excludes the bonus
> (`referralValue + memberSignupValue`); `totalForPayment` includes the bonus.

`paymentStatus` label: `DUE` if amountDue > 0 → else `PENDING` if pending > 0 →
else `YES` if anything earned → else `NO ACTIVITY`.

---

## 3. The payment lifecycle (step by step)

### Step 1 — Review the backend table
`GET /api/ambassador-payments/operations`
Returns one row per active ambassador (the rules above) plus a summary. This is the
read-only worksheet the admin reviews before generating payments.

### Step 2 — Generate the due batch
`POST /api/ambassador-payments/generate-due`
- Takes every operational row where `amountDue > 0`.
- Creates one `AmbassadorPayment` per ambassador with:
  - `amount = amountDue`, `type = "MANUAL"`, `status = "PENDING"`
  - `reference = AMB-<ambassadorId>-<timestamp>`
  - `batchRef = AMB-<YYYYMMDD>` (shared across the batch)
  - `notes` summarising referral/sign-up/sales counts
- Writes an audit log `AMBASSADOR_PAYMENT_BATCH_CREATED` (count + total).
- **Idempotency caveat:** there is no guard against generating a second batch the same
  day. Because `amountDue` already subtracts existing `PENDING` rows, re-running
  immediately produces no new rows — but this relies on the subtraction, not a lock.

### Step 3 — Download the FNB CSV
`GET /api/ambassador-payments/export-fnb.csv`
- Selects **all** `AmbassadorPayment` rows with `status = "PENDING"`, ordered by
  `createdAt asc`.
- Filename: `Ambassador_FNB_Payments_<YYYY-MM-DD>.csv`.
- Every field is quoted (CSV-escaped via `toCsvValue`).

**Column layout (exact order):**

| # | Header | Source |
|---|---|---|
| 1 | Date Submitted | `createdAt` (date only) |
| 2 | Name | ambassador first name |
| 3 | Surname | ambassador last name |
| 4 | Mobile Number | ambassador `mobileNo` |
| 5 | Amount | `amount` to 2 decimals |
| 6 | Reference | `reference` or `AMB-<id>` |
| 7 | Batch | `batchRef` |
| 8 | Status | literal `PENDING` |

> The admin uploads/keys this into FNB online banking (e.g. FNB Cash Send / EFT batch).
> The CSV is an **export for FNB**, not an FNB-native import format — if the bank
> requires a specific column spec, that mapping happens outside this system today.

### Step 4 — (Optional) Authorise
`PUT /api/ambassador-payments/:id/authorise`
- Only allowed when status is `PENDING`.
- Does **not** change status; it stamps a `reference` if missing and appends
  `"FNB payment authorised"` to notes. Audit: `AMBASSADOR_PAYMENT_AUTHORISED`.
- Represents the internal sign-off that the payment is approved to be paid at FNB.

### Step 5 — Reconcile: mark as paid
After FNB confirms payment, the admin marks rows paid. Two equivalent endpoints both
call the shared `completePayment()`:
- `PUT /api/ambassador-payments/:id/import-paid` (only from `PENDING`)
- `PUT /api/ambassador-payments/:id/mark-paid`

> This is **per-row only**. For settling a whole batch from FNB's returned results file,
> see **§4 Reimport** — that bulk, file-based reconciliation is the part to build.

`completePayment()` performs, in one logical step:
1. Sets the payment `status = "PAID"`, `paidAt = now`, appends a note.
2. Marks **linked** member-sign-up leads (`ambassadorPaymentId = id`, type `MEMBER_SIGNUP`)
   as `status = "PAID"`, `datePaid = now`.
3. Queues an SMS to the ambassador
   (`SmsMessage`, status `QUEUED`, type `AMBASSADOR`):
   *"Hi <first name>, your Ambassador payment of R<amount> has been processed."*
4. Writes audit log `AMBASSADOR_PAYMENT_IMPORTED`.

> Leads are linked to a payment via `lead.ambassadorPaymentId`. The generic
> `POST /api/ambassador-payments` accepts `leadIds[]` and links them; the
> `generate-due` batch path does **not** currently link individual leads, so its
> sign-up leads are not auto-marked paid in step 2 unless they were linked separately.

---

## 4. Reimport: FNB results reconciliation (the file-based re-import)

> **Status: not built yet.** Today reconciliation is per-row only
> (`PUT /:id/import-paid`, one payment at a time, no file). This section specs the
> **bulk reimport**: uploading the file FNB returns after a payout run and settling the
> whole batch in one step. This is the piece to implement.

### 4.1 Where it fits
Picks up after Step 3 (CSV exported + uploaded to FNB) and Step 4 (authorised). FNB
processes the batch and produces a **results / returns file** stating, per payment,
whether it succeeded or failed (with a reason for failures). The admin uploads that file
back; the system matches each result row to a pending `AmbassadorPayment` and settles it.

### 4.2 Input file (the results file)
FNB return-file formats vary by product/channel, so the importer must be
**column-tolerant** (match on header names, not position) and accept CSV (ideally XLSX too).

| Field | Required | Used for |
|---|---|---|
| Reference | yes | primary match key — must equal the `reference` we exported |
| Amount | recommended | sanity check against `payment.amount` |
| Outcome / Status | yes | the bank result: paid vs failed/returned |
| Reason | when failed | failure reason stored on the payment |
| Date Paid | optional | overrides `paidAt`; defaults to now |
| Mobile Number / Batch | optional | fallback match key |

**Outcome normalisation** — map raw bank strings to three internal results:
- `PAID` ← "paid", "success", "successful", "processed", "0", "ok"
- `FAILED` ← "failed", "returned", "rejected", "unpaid", "error", non-zero codes
- `UNKNOWN` ← anything unmapped → skip + report (never silently pay)

### 4.3 Matching rules
1. Match each row to an `AmbassadorPayment` by `reference` (exact). Fallback: `batchRef` + ambassador `mobileNo`.
2. Only `PENDING` payments are eligible to change:
   - already `PAID` with the same reference → **skip as already-reconciled** (idempotent),
   - `CANCELLED` → skip + report.
3. No match → skip + report (`unmatched`).
4. Amount mismatch beyond tolerance (e.g. ≠ to the cent) → **do not auto-pay**; report for manual review.

### 4.4 Per-outcome behaviour
- **PAID** → reuse the existing `completePayment()` logic so behaviour stays identical to
  the per-row path: set `status=PAID` + `paidAt`, flip linked `MEMBER_SIGNUP` leads to
  `PAID`/`datePaid`, queue the ambassador SMS, write `AMBASSADOR_PAYMENT_IMPORTED` audit.
- **FAILED / RETURNED** → store the reason in `notes`, write an `AMBASSADOR_PAYMENT_FAILED`
  audit, **do not** send the "processed" SMS, **do not** flip leads. Status handling needs
  a schema decision (see §4.6).

### 4.5 Endpoint + response
`POST /api/ambassador-payments/import-results` (admin-only), `multipart/form-data` with a
`file`, optional `batchRef` to scope matching.

Process every row independently inside try/catch (one bad row must not abort the batch);
ideally each settlement runs in its own transaction. Return a **reconciliation report**:

```json
{
  "success": true,
  "data": {
    "batchRef": "AMB-20260616",
    "totals": { "rows": 42, "paid": 38, "failed": 3, "skipped": 1, "unmatched": 0 },
    "results": [
      { "reference": "AMB-12-1718...", "outcome": "PAID",   "paymentId": 91, "amount": 200 },
      { "reference": "AMB-19-1718...", "outcome": "FAILED", "paymentId": 95, "reason": "Account closed" },
      { "reference": "AMB-XX",         "outcome": "SKIPPED", "note": "no matching pending payment" }
    ]
  }
}
```

Write one batch-level audit (`AMBASSADOR_RESULTS_IMPORTED`) with the totals.

### 4.6 Decisions to make before building
- **Failed-payment status.** `AmbassadorPayment.status` is currently
  `PENDING | PAID | CANCELLED` — there is **no `FAILED`**. Options:
  (a) add `FAILED` to the enum (cleanest; an additive schema change applied to dev then via
  Publish — follow the project's DB rules, never `prisma db push`),
  (b) leave failed rows `PENDING` + reason in notes so they roll into the next batch, or
  (c) mark `CANCELLED` + reason.
  **Recommendation: (a)** so failed payouts are visible and re-payable.
- **Re-payment of failures.** Decide whether a `FAILED` payment is regenerated by the next
  `generate-due` run (it should, if the money is still owed).
- **Parser dependency.** No CSV/upload libs are installed. Either add `multer` + `csv-parse`
  (+ ExcelJS for XLSX) server-side, or parse the file in the browser and POST a normalised
  JSON array to a simpler `POST /import-results` (no multer needed).
- **Idempotency guarantee.** Keep "only PENDING is eligible" as the safety net so the same
  results file can be re-uploaded without double-paying.

### 4.7 Frontend
On `/admin/ambassador-backend`, add a file picker → upload to `import-results` → render the
returned reconciliation report (paid/failed/skipped counts + a per-row table, failures
highlighted with their reason). Keep the per-row `import-paid` as a manual fallback.

---

## 5. Related Excel export (richer, read-only)

`GET /api/reports/ambassador-earnings` produces a multi-sheet `.xlsx` (ExcelJS),
distinct from the payout CSV. Used for analysis/audit, not for FNB upload.

- **Sheet "FNB Cash Send"** — one row per active `AMBASSADOR`: name, mobile, province,
  department, referrals, completed batches (÷10), referral earnings, member sign-ups,
  converted sign-ups, sign-up earnings, total earned, already paid, amount due, plus a
  TOTAL row. Same money rules as §2 **except this sheet does not include the R1000 bonus**.
- **Sheet "Member Sign-Ups Detail"** — every `MEMBER_SIGNUP` lead with status, dates,
  and R100 earning if `PAID`.
- **Sheet "Referral Batches Detail"** — referral batch breakdown.

---

## 6. Data model touchpoints

- `AmbassadorPayment` — `amount`, `type` (`MANUAL`/...), `status`
  (`PENDING`/`PAID`/`CANCELLED`), `reference`, `batchRef`, `paidAt`, `notes`.
- `Lead` — `type` (`REFERRAL_LEAD`/`MEMBER_SIGNUP`), `status` (incl. `PAID`),
  `datePaid`, `ambassadorPaymentId` (link to a payment).
- `Referral` — `status` (`CONTACTED`/`CONVERTED`/...).
- `SmsMessage` — outbound notification queue.
- `AuditLog` — every mutating action is recorded.

---

## 7. Frontend wiring (`frontend/src/lib/api.ts`)

- `getAmbassadorPaymentsOperations()` → `GET /ambassador-payments/operations`
- `generateAmbassadorPayments()` → `POST /ambassador-payments/generate-due`
- `authoriseAmbassadorPayment(id)` → `PUT /ambassador-payments/:id/authorise`
- `importAmbassadorPaymentPaid(id)` → `PUT /ambassador-payments/:id/import-paid`
- FNB CSV download → `GET /api/ambassador-payments/export-fnb.csv`
- Earnings workbook download → `GET /api/reports/ambassador-earnings`

UI page: `frontend/src/pages/admin/AmbassadorBackend.tsx` (route `/admin/ambassador-backend`).

---

## 8. Known gaps / things to verify when extending

1. **No true FNB bank format.** The CSV is a generic columnar export. If FNB requires a
   specific batch-file layout (account numbers, branch codes, beneficiary IDs), that is
   not modelled — ambassadors are identified by mobile number only. Bank account details
   are **not** captured anywhere in this flow.
2. **Generate-due is not transactionally locked.** Concurrent calls could double-create;
   it relies on `amountDue` already subtracting pending amounts.
3. **Batch leads aren't linked.** `generate-due` doesn't attach the contributing leads to
   the payment, so marking that payment paid won't auto-flip those sign-up leads to `PAID`.
4. **Bonus inconsistency.** The R1000 sales bonus is in the operational/payout calc but
   **not** in the `ambassador-earnings` Excel sheet — reconcile if these must match.
5. **Export pulls ALL pending, not a batch.** `export-fnb.csv` ignores `batchRef` and
   exports every `PENDING` row; if multiple batches coexist they all appear together.
