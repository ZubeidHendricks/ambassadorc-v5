export type FoxProStatusGroup =
  | "new"
  | "qa_pending"
  | "qa_passed"
  | "exported_awaiting_outcome"
  | "qlink_uploaded"
  | "cancelled"
  | "repair"
  | "unknown";

export interface FoxProStatusDefinition {
  group: FoxProStatusGroup;
  label: string;
  examples: string[];
  stage: string;
  action: string;
  description: string;
}

export const FOXPRO_STATUS_DEFINITIONS: FoxProStatusDefinition[] = [
  {
    group: "new",
    label: "New / Sales Capture",
    examples: ["New"],
    stage: "Sales",
    action: "Complete sale capture and send to QA",
    description: "Records still in sales capture or not yet mapped to a downstream operational step.",
  },
  {
    group: "qa_pending",
    label: "In validation with Quality Assurance",
    examples: ["In Validation with Quality Assurance", "Completed Sales Capture Awaiting QA Validation"],
    stage: "QA Mailbox",
    action: "Pass to export, repair, or cancel",
    description: "Sales waiting for QA review before the export process.",
  },
  {
    group: "qa_passed",
    label: "QA Validation Passed",
    examples: ["QA Validation Passed", "QLINK - QA Validation Passed"],
    stage: "Ready for Export",
    action: "Include in next midnight export",
    description: "QA has passed the sale and it is ready to be exported to the collection channel.",
  },
  {
    group: "exported_awaiting_outcome",
    label: "Exported awaiting outcome",
    examples: ["Exported Awaiting Outcome", "T1"],
    stage: "Export",
    action: "Wait for Q-Link / debit return file",
    description: "The record has left sales/QA and is waiting for a collection outcome.",
  },
  {
    group: "qlink_uploaded",
    label: "Q-Link uploaded",
    examples: ["QLink Result: 0 - Ok (Uploaded)", "Uploaded Debit Process"],
    stage: "Q-Link / Debit",
    action: "Monitor first collection and activation",
    description: "Q-Link or debit upload returned a successful upload-style status.",
  },
  {
    group: "cancelled",
    label: "Client Cancelled",
    examples: ["Client Cancelled - Other", "RC/C", "Internal Cancellation"],
    stage: "Cancellation",
    action: "No further sales action unless repaired/reopened",
    description: "Client or internal cancellation outcomes, including QDEL cancellation responses.",
  },
  {
    group: "repair",
    label: "Repair / Failed Return",
    examples: ["INCOMPLETE", "Deduction not found", "Employee number not listed"],
    stage: "Repair",
    action: "Fix details or switch payment method",
    description: "Records that need operations intervention before they can proceed.",
  },
  {
    group: "unknown",
    label: "Unknown / Unmapped",
    examples: ["Unknown", "Blank status"],
    stage: "Review",
    action: "Review and map if recurring",
    description: "Statuses that do not yet match a known FoxPro operations bucket.",
  },
];

export function normalizeFoxProStatus(status?: string | null, subStatus?: string | null): FoxProStatusGroup {
  const value = `${status ?? ""} ${subStatus ?? ""}`.trim().toLowerCase();
  if (!value || value === "unknown") return "unknown";
  if (value === "rc/c" || value.includes("client cancelled") || value.includes("internal cancellation") || value.includes("cancellation qdel") || value.includes("cancel")) return "cancelled";
  if (value.includes("deduction not found") || value.includes("employee number not listed") || value.includes("incomplete") || value.includes("repair") || value.includes("fail") || value.includes("exceeded allowable")) return "repair";
  if (value.includes("qa validation passed")) return "qa_passed";
  if (value.includes("in validation") || value.includes("awaiting qa") || value.includes("completed sales capture")) return "qa_pending";
  if (value.includes("exported awaiting outcome") || value === "t1") return "exported_awaiting_outcome";
  if (value.includes("uploaded debit process") || (value.includes("qlink") && value.includes("uploaded")) || value.includes("result: 0 - ok")) return "qlink_uploaded";
  return "new";
}

export function foxProStatusLabel(group: string): string {
  return FOXPRO_STATUS_DEFINITIONS.find((item) => item.group === group)?.label ?? group.replace(/_/g, " ");
}

export const FOXPRO_STATUS_CASE_SQL = `CASE
  WHEN COALESCE("Status", '') = '' OR COALESCE("Status", '') ILIKE 'Unknown' THEN 'unknown'
  WHEN "Status" = 'RC/C' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%client cancelled%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%internal cancellation%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%cancellation qdel%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%cancel%' THEN 'cancelled'
  WHEN (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%deduction not found%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%employee number not listed%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%incomplete%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%repair%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%fail%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%exceeded allowable%' THEN 'repair'
  WHEN (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%qa validation passed%' THEN 'qa_passed'
  WHEN (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%in validation%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%awaiting qa%' OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%completed sales capture%' THEN 'qa_pending'
  WHEN (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%exported awaiting outcome%' OR "Status" = 'T1' THEN 'exported_awaiting_outcome'
  WHEN (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%uploaded debit process%' OR ((COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%qlink%' AND (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%uploaded%') OR (COALESCE("Status", '') || ' ' || COALESCE("SubStatus", '')) ILIKE '%result: 0 - ok%' THEN 'qlink_uploaded'
  ELSE 'new'
END`;

export function foxProStatusWhere(group: string, alias = ""): string {
  const prefix = alias ? `${alias}.` : "";
  const status = `${prefix}"Status"`;
  const subStatus = `${prefix}"SubStatus"`;
  const statusText = `(COALESCE(${status}, '') || ' ' || COALESCE(${subStatus}, ''))`;
  switch (group) {
    case "unknown":
      return `(COALESCE(${status}, '') = '' OR ${status} ILIKE 'Unknown')`;
    case "cancelled":
      return `(${status} = 'RC/C' OR ${statusText} ILIKE '%client cancelled%' OR ${statusText} ILIKE '%internal cancellation%' OR ${statusText} ILIKE '%cancellation qdel%' OR ${statusText} ILIKE '%cancel%')`;
    case "repair":
      return `(${statusText} ILIKE '%deduction not found%' OR ${statusText} ILIKE '%employee number not listed%' OR ${statusText} ILIKE '%incomplete%' OR ${statusText} ILIKE '%repair%' OR ${statusText} ILIKE '%fail%' OR ${statusText} ILIKE '%exceeded allowable%')`;
    case "qa_passed":
      return `(${statusText} ILIKE '%qa validation passed%')`;
    case "qa_pending":
      return `(${statusText} ILIKE '%in validation%' OR ${statusText} ILIKE '%awaiting qa%' OR ${statusText} ILIKE '%completed sales capture%')`;
    case "exported_awaiting_outcome":
      return `(${statusText} ILIKE '%exported awaiting outcome%' OR ${status} = 'T1')`;
    case "qlink_uploaded":
      return `(${statusText} ILIKE '%uploaded debit process%' OR (${statusText} ILIKE '%qlink%' AND ${statusText} ILIKE '%uploaded%') OR ${statusText} ILIKE '%result: 0 - ok%')`;
    case "new":
      return `NOT (${foxProStatusWhere("unknown", alias)} OR ${foxProStatusWhere("cancelled", alias)} OR ${foxProStatusWhere("repair", alias)} OR ${foxProStatusWhere("qa_passed", alias)} OR ${foxProStatusWhere("qa_pending", alias)} OR ${foxProStatusWhere("exported_awaiting_outcome", alias)} OR ${foxProStatusWhere("qlink_uploaded", alias)})`;
    default:
      return "TRUE";
  }
}
