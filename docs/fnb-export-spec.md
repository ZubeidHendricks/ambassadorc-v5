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

## 4. Related Excel export (richer, read-only)

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

## 5. Data model touchpoints

- `AmbassadorPayment` — `amount`, `type` (`MANUAL`/...), `status`
  (`PENDING`/`PAID`/`CANCELLED`), `reference`, `batchRef`, `paidAt`, `notes`.
- `Lead` — `type` (`REFERRAL_LEAD`/`MEMBER_SIGNUP`), `status` (incl. `PAID`),
  `datePaid`, `ambassadorPaymentId` (link to a payment).
- `Referral` — `status` (`CONTACTED`/`CONVERTED`/...).
- `SmsMessage` — outbound notification queue.
- `AuditLog` — every mutating action is recorded.

---

## 6. Frontend wiring (`frontend/src/lib/api.ts`)

- `getAmbassadorPaymentsOperations()` → `GET /ambassador-payments/operations`
- `generateAmbassadorPayments()` → `POST /ambassador-payments/generate-due`
- `authoriseAmbassadorPayment(id)` → `PUT /ambassador-payments/:id/authorise`
- `importAmbassadorPaymentPaid(id)` → `PUT /ambassador-payments/:id/import-paid`
- FNB CSV download → `GET /api/ambassador-payments/export-fnb.csv`
- Earnings workbook download → `GET /api/reports/ambassador-earnings`

UI page: `frontend/src/pages/admin/AmbassadorBackend.tsx` (route `/admin/ambassador-backend`).

---

## 7. Known gaps / things to verify when extending

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
