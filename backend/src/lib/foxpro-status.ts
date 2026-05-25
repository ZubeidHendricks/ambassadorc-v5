/**
 * FoxPro status taxonomy
 * ----------------------
 * The legacy FoxPro DNN CRM (foxpro.co.za) drives the whole sales → QA →
 * export → collection lifecycle off a small set of short status codes stored
 * in `SalesData.Status` (mirrored into PostgreSQL as `sync_sales_data."Status"`).
 *
 * This module is the single source of truth that decodes those codes into
 * human-readable meaning, groups them by lifecycle stage, and maps each one to
 * the modern AmbassadorC v5 `SaleStatus` enum so both worlds stay in sync.
 *
 * Sources:
 *  - Operational codes supplied by the business (u, QC, t1, RC/C, QA, T …)
 *  - "QA" + "EXPORT STATUS PAGE" sheets of ZUBEID.xlsx
 *  - FoxPro "FoxPro Leads" disposition list (live UI capture)
 *  - "GLOBAL BOOK" Q-Link / Persal monthly result codes (Q* codes)
 *
 * NOTE: nothing here touches the database. It is pure reference data + helpers.
 */

export type FoxStage =
  | "capture"
  | "qa"
  | "qa_passed"
  | "export"
  | "outcome"
  | "cancelled";

/** Modern v5 SaleStatus enum values (mirror of prisma `SaleStatus`). */
export type SaleStatusV5 =
  | "NEW"
  | "QA_PENDING"
  | "QA_APPROVED"
  | "QA_REJECTED"
  | "ACTIVE"
  | "CANCELLED";

export interface FoxStatus {
  /** The raw code as stored in FoxPro `SalesData.Status`. */
  code: string;
  /** Short human label. */
  label: string;
  /** Full description of what the code means operationally. */
  description: string;
  /** Lifecycle stage used for grouping / colouring in the UI. */
  stage: FoxStage;
  /** Equivalent modern v5 SaleStatus. */
  mapsTo: SaleStatusV5;
  /** Tailwind-friendly colour token used by the badge component. */
  color: "amber" | "blue" | "indigo" | "emerald" | "orange" | "red" | "gray";
  /** Whether the legacy code matches the (case-insensitive) `Status` value via exact / prefix. */
  match?: "exact" | "prefix";
}

/**
 * Sales-pipeline status codes — the spine of the FoxPro workflow.
 *
 *   Capture (T) ─▶ QA validation (QA) ─▶ QA passed (QC)
 *            ─▶ exported / uploaded (u, t1, ND) ─▶ collection outcome ─▶ active / cancelled
 */
export const FOX_PIPELINE_STATUSES: FoxStatus[] = [
  {
    code: "T",
    label: "In QA Bay",
    description:
      "Sale captured by the agent and submitted by the validation agent. Holds a 'T' status and lies in the QA Bay awaiting the QA second check.",
    stage: "capture",
    mapsTo: "QA_PENDING",
    color: "amber",
    match: "exact",
  },
  {
    code: "QA",
    label: "In Validation with QA",
    description:
      "In validation with Quality Assurance — a QA officer is reviewing the captured sale (identity, banking, product, beneficiary).",
    stage: "qa",
    mapsTo: "QA_PENDING",
    color: "amber",
    match: "prefix",
  },
  {
    code: "R",
    label: "Repair / Returned",
    description:
      "QA returned the sale to the sales/validation agent for correction (Repair). Re-enters the QA Bay once fixed.",
    stage: "qa",
    mapsTo: "QA_REJECTED",
    color: "orange",
    match: "exact",
  },
  {
    code: "QC",
    label: "Q-Link – QA Passed",
    description:
      "Q-Link QA validation passed. The Persal (Q-Link) sale has cleared QA and is queued for the next Q-Link export run.",
    stage: "qa_passed",
    mapsTo: "QA_APPROVED",
    color: "indigo",
    match: "exact",
  },
  {
    code: "NC",
    label: "Netcash – QA Passed",
    description:
      "QA passed for a Netcash debit-order sale. Queued for the next Netcash / SagePay debit batch submission.",
    stage: "qa_passed",
    mapsTo: "QA_APPROVED",
    color: "indigo",
    match: "exact",
  },
  {
    code: "u",
    label: "Q-Link Uploaded",
    description:
      "Q-Link uploaded — the Persal deduction file has been uploaded to Q-Link for the next collection cycle.",
    stage: "export",
    mapsTo: "ACTIVE",
    color: "blue",
    match: "exact",
  },
  {
    code: "t1",
    label: "Exported – Awaiting Outcome",
    description:
      "Exported and awaiting outcome. The sale is in a submitted batch (Q-Link Persal or Netcash debit order) waiting for the return / result file.",
    stage: "export",
    mapsTo: "ACTIVE",
    color: "blue",
    match: "exact",
  },
  {
    code: "A",
    label: "Active",
    description:
      "Collection succeeded — the policy is active and premium is being collected.",
    stage: "outcome",
    mapsTo: "ACTIVE",
    color: "emerald",
    match: "exact",
  },
  {
    code: "RC/C",
    label: "Client Cancelled – Other",
    description:
      "Client cancelled — other reason. The client cancelled the policy outside the standard Persal/Netcash failure reasons.",
    stage: "cancelled",
    mapsTo: "CANCELLED",
    color: "red",
    match: "exact",
  },
  {
    code: "C",
    label: "Cancelled",
    description: "Sale / policy cancelled.",
    stage: "cancelled",
    mapsTo: "CANCELLED",
    color: "red",
    match: "exact",
  },
];

/**
 * FoxPro Leads call dispositions (from the live "FoxPro Leads" module dropdown).
 * Used to outcome a dialled lead before it becomes a sale.
 */
export interface FoxDisposition {
  code: string;
  label: string;
  outcome: "sale" | "callback" | "bad_number" | "no_answer" | "declined";
}

export const FOX_LEAD_DISPOSITIONS: FoxDisposition[] = [
  { code: "PSA_UNION_SALE", label: "PSA Union Sale", outcome: "sale" },
  { code: "SALE_LS24", label: "Sale Made — go to Life Saver 24 Capture", outcome: "sale" },
  { code: "CALLBACK", label: "Callback Again Later", outcome: "callback" },
  { code: "WRONG_NUMBER", label: "Wrong Number", outcome: "bad_number" },
  { code: "UNOBTAINABLE", label: "Numbers Unobtainable", outcome: "bad_number" },
  { code: "NO_ANSWER", label: "Just Rings : No Answer", outcome: "no_answer" },
  { code: "VOICEMAIL", label: "Voicemail / Machine", outcome: "no_answer" },
  { code: "DEC_UNEMPLOYED", label: "Client Declined — Unemployed", outcome: "declined" },
  { code: "DEC_DNC", label: "Client Declined — Do Not Call Again (DNC)", outcome: "declined" },
  { code: "DEC_HAS_PRODUCT", label: "Client Declined — Already has Product (Life Saver 24)", outcome: "declined" },
  { code: "DEC_NOT_INTERESTED", label: "Client Declined — Not Interested", outcome: "declined" },
];

/**
 * Q-Link / Persal monthly result codes (from the "GLOBAL BOOK" sheet).
 * These arrive in the monthly Persal return file and update the policy/premium book.
 */
export interface QLinkCode {
  code: string;
  label: string;
  /** Does this code keep the policy collecting, or stop it? */
  effect: "collecting" | "stopped" | "neutral";
}

export const QLINK_PERSAL_CODES: QLinkCode[] = [
  { code: "QREC", label: "Recurring Premium", effect: "collecting" },
  { code: "QNEW", label: "New Deduction", effect: "collecting" },
  { code: "QTOS", label: "Termination of Service", effect: "stopped" },
  { code: "QTOL", label: "Deceased", effect: "stopped" },
  { code: "QTOR", label: "Retired", effect: "stopped" },
  { code: "QTOD", label: "Deduction Terminated", effect: "stopped" },
  { code: "QLWP", label: "Leave Without Pay / Frozen", effect: "stopped" },
  { code: "QSUP", label: "Supplementary Payment — Once-off", effect: "neutral" },
  { code: "QTOT", label: "Deduction Terminated (Transferred Out)", effect: "stopped" },
  { code: "QTIN", label: "New Deduction (Transferred In)", effect: "collecting" },
  { code: "QRPL", label: "Reconciliation Positive", effect: "neutral" },
  { code: "QRMN", label: "Reconciliation Negative", effect: "neutral" },
  { code: "QREV", label: "Negative / Reversal", effect: "stopped" },
];

/**
 * Export return reasons (from "EXPORT STATUS PAGE"): a rejection comes back
 * from the collector and may trigger a predefined remediation action.
 */
export interface ExportReturnReason {
  code: string;
  label: string;
  action: string;
}

export const EXPORT_RETURN_REASONS: ExportReturnReason[] = [
  {
    code: "EXCEEDED_ALLOWABLE",
    label: "Returned — Exceeded Allowable Insurance",
    action: "Switch to Debit Order",
  },
  {
    code: "INSUFFICIENT_FUNDS",
    label: "Returned — Insufficient Funds",
    action: "Retry next cycle",
  },
  {
    code: "ACCOUNT_CLOSED",
    label: "Returned — Account Closed / Invalid",
    action: "Request banking details / cancel",
  },
  {
    code: "NOT_ON_PERSAL",
    label: "Returned — Not on Persal",
    action: "Switch to Debit Order",
  },
  {
    code: "DEBIT_DISPUTED",
    label: "Returned — Debit Disputed by Client",
    action: "QA call-back & confirm mandate",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const byCode = new Map(FOX_PIPELINE_STATUSES.map((s) => [s.code.toLowerCase(), s]));

/** Look up a pipeline status by its exact code (case-insensitive). */
export function getFoxStatus(code: string | null | undefined): FoxStatus | undefined {
  if (!code) return undefined;
  return byCode.get(code.trim().toLowerCase());
}

/**
 * Best-effort decode of a raw, free-text `SalesData.Status` value into a
 * pipeline status. Handles exact codes, prefixes, and common phrasings used in
 * the live data ("In validation with Quality Assurance", "Q-Link uploaded"…).
 */
export function decodeFoxStatus(raw: string | null | undefined): FoxStatus | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  const lower = v.toLowerCase();

  // 1. Exact code match
  const exact = byCode.get(lower);
  if (exact) return exact;

  // 2. Phrase heuristics (mirror of the patterns used in routes/qa.ts)
  if (/q-?link.*upload|uploaded/.test(lower)) return getFoxStatus("u");
  if (/awaiting outcome|exported/.test(lower)) return getFoxStatus("t1");
  if (/q-?link.*(qa|valid|passed)|qc\b/.test(lower)) return getFoxStatus("QC");
  if (/cancel/.test(lower)) return getFoxStatus("RC/C");
  if (/repair|return/.test(lower)) return getFoxStatus("R");
  if (/qa|quality|validation/.test(lower)) return getFoxStatus("QA");
  if (/active|recurring|success/.test(lower)) return getFoxStatus("A");
  if (/^t\b/.test(lower)) return getFoxStatus("T");
  return undefined;
}

/** Map a raw FoxPro status to the modern v5 SaleStatus enum (defaults to NEW). */
export function mapToSaleStatus(raw: string | null | undefined): SaleStatusV5 {
  return decodeFoxStatus(raw)?.mapsTo ?? "NEW";
}

/** Everything, grouped, for the status-reference UI and the /statuses endpoint. */
export function statusReference() {
  return {
    pipeline: FOX_PIPELINE_STATUSES,
    leadDispositions: FOX_LEAD_DISPOSITIONS,
    qlinkCodes: QLINK_PERSAL_CODES,
    exportReturnReasons: EXPORT_RETURN_REASONS,
    stages: [
      { key: "capture", label: "Captured / QA Bay" },
      { key: "qa", label: "In QA Validation" },
      { key: "qa_passed", label: "QA Passed — Ready to Export" },
      { key: "export", label: "Exported / Awaiting Outcome" },
      { key: "outcome", label: "Collection Outcome" },
      { key: "cancelled", label: "Cancelled / Returned" },
    ] as { key: FoxStage; label: string }[],
  };
}
