import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { hasSyncTables } from "../lib/syncCheck";
import {
  FOXPRO_STATUS_CASE_SQL,
  FOXPRO_STATUS_DEFINITIONS,
  foxProStatusLabel,
} from "../lib/foxproStatus";

const router = Router();

router.use(authenticate);

function requireAdmin(req: Request, res: Response): boolean {
  const user = (req as any).ambassador;
  if (!user || user.role !== "ADMIN") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return false;
  }
  return true;
}

const moneyFormat = '"R"#,##0.00;[Red]-"R"#,##0.00';
const integerFormat = '#,##0';

type NumericLike = number | string | null;
type DateLike = Date | string | null;

interface ExportStatusSummaryRow {
  productName: string;
  premiumAmount: NumericLike;
  statusGroup: string;
  count: number;
  estimatedPremium: NumericLike;
}

interface ExportStatusDetailRow {
  id: number;
  clientName: string;
  idNumber: string;
  cellphone: string;
  productName: string;
  premiumAmount: NumericLike;
  agentName: string;
  rawStatus: string;
  subStatus: string;
  statusGroup: string;
  lastOutcome: string | null;
  lastUpdated: DateLike;
  dateLoaded: DateLike;
  syncedAt: DateLike;
}

interface MonthlyPremiumRow {
  productName: string;
  premiumAmount: NumericLike;
  exportedSales: number;
  debitOrder: number;
  debitSuccessful: number;
  debitFailed: number;
  persal: number;
  persalSuccessful: number;
  persalFailed: number;
}

interface GlobalBookRow {
  code: string;
  description: string;
  month: number;
  count: number;
  amount: NumericLike;
}

interface ProductBookRow {
  productName: string;
  month: number;
  count: number;
  amount: NumericLike;
}

const nativeSalesStatusToFoxProGroup: Record<string, string> = {
  NEW: "new",
  QA_PENDING: "qa_pending",
  QA_APPROVED: "qa_passed",
  ACTIVE: "qlink_uploaded",
  QA_REJECTED: "repair",
  CANCELLED: "cancelled",
};

let hasSyncSagepayTransactionsCache: boolean | null = null;

async function hasSyncSagepayTransactions(): Promise<boolean> {
  if (hasSyncSagepayTransactionsCache !== null) return hasSyncSagepayTransactionsCache;
  try {
    await prisma.$queryRaw`SELECT 1 FROM sync_sagepay_transactions LIMIT 1`;
    hasSyncSagepayTransactionsCache = true;
  } catch {
    hasSyncSagepayTransactionsCache = false;
  }
  return hasSyncSagepayTransactionsCache;
}

function dateStamp() {
  return new Date().toISOString().split("T")[0];
}

function fullName(first?: string | null, last?: string | null) {
  return `${first ?? ""} ${last ?? ""}`.trim() || "Unknown";
}

function productPremiumAmount(productName?: string | null, fallback?: number | string | null) {
  const name = (productName ?? "").toLowerCase();
  if (name.includes("24") && name.includes("basic")) return 259;
  if (name.includes("24") && name.includes("plus")) return 349;
  if (name.includes("legal") && name.includes("basic")) return 179;
  if (name.includes("legal") && name.includes("plus")) return 299;
  if (name.includes("five-in-one") || name.includes("five in one")) return 199;
  if (name.includes("life saver 24") || name.includes("lifesaver 24")) return 199;
  if (name.includes("legal")) return 129;
  const numeric = Number(fallback ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function productPremiumSql(alias = "s", includeSourceFallback = false) {
  const sourceFallback = includeSourceFallback
    ? `COALESCE((
      SELECT ABS(sp."Amount"::numeric)
      FROM sync_sagepay_transactions sp
      WHERE sp."IdNumber" = ${alias}."IDNumber"
        AND sp."Amount" ~ '^-?[0-9]+(\\.[0-9]+)?$'
      ORDER BY sp."Date" DESC NULLS LAST, sp._synced_at DESC
      LIMIT 1
    ), 0)`
    : "0";
  return `CASE
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%24%basic%' THEN 259
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%24%plus%' THEN 349
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%legal%basic%' THEN 179
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%legal%plus%' THEN 299
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%five-in-one%' OR COALESCE(${alias}."ProductName", '') ILIKE '%five in one%' THEN 199
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%life saver 24%' OR COALESCE(${alias}."ProductName", '') ILIKE '%lifesaver 24%' THEN 199
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%legal%' THEN 129
    ELSE ${sourceFallback}
  END`;
}

function statusCaseSql(alias = "s") {
  return FOXPRO_STATUS_CASE_SQL
    .replaceAll('"Status"', `${alias}."Status"`)
    .replaceAll('"SubStatus"', `${alias}."SubStatus"`);
}

function prepareWorksheet(sheet: ExcelJS.Worksheet, headerColor = "FF1E40AF") {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  };
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
  row.alignment = { vertical: "middle" };
}

function styleNumberColumns(sheet: ExcelJS.Worksheet, keys: string[], format = integerFormat) {
  for (const key of keys) {
    const column = sheet.getColumn(key);
    column.numFmt = format;
  }
}

function runReportQuery<T>(sql: string) {
  return prisma.$queryRaw<T>(Prisma.raw(sql));
}

async function sendWorkbook(res: Response, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}_${dateStamp()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

async function getSyncExportStatusData(): Promise<{ summaryRows: ExportStatusSummaryRow[]; detailRows: ExportStatusDetailRow[] }> {
  const groupSql = statusCaseSql("s");
  const premiumSql = productPremiumSql("s", await hasSyncSagepayTransactions());
  const [summaryRows, detailRows] = await Promise.all([
    runReportQuery<ExportStatusSummaryRow[]>(
      `SELECT COALESCE(s."ProductName", 'Unknown') as "productName",
              ${premiumSql}::numeric as "premiumAmount",
              ${groupSql} as "statusGroup",
              COUNT(*)::integer as count,
              SUM(${premiumSql})::numeric as "estimatedPremium"
       FROM sync_sales_data s
       GROUP BY COALESCE(s."ProductName", 'Unknown'), ${premiumSql}, ${groupSql}
       ORDER BY "productName", "statusGroup"`
    ),
    runReportQuery<ExportStatusDetailRow[]>(
      `SELECT s._sync_id::integer as id,
              CONCAT(COALESCE(s."FirstName", ''), ' ', COALESCE(s."LastName", '')) as "clientName",
              COALESCE(s."IDNumber", '') as "idNumber",
              COALESCE(s."CellPhone", '') as "cellphone",
              COALESCE(s."ProductName", 'Unknown') as "productName",
              ${premiumSql}::numeric as "premiumAmount",
              COALESCE(s."SalesAgentUserName", '') as "agentName",
              COALESCE(s."Status", 'Unknown') as "rawStatus",
              COALESCE(s."SubStatus", '') as "subStatus",
              ${groupSql} as "statusGroup",
              s."LastOutcome" as "lastOutcome",
              s."LastUpdated" as "lastUpdated",
              s."DateLoaded" as "dateLoaded",
              s._synced_at as "syncedAt"
       FROM sync_sales_data s
       ORDER BY s."LastUpdated" DESC NULLS LAST, s._synced_at DESC`
    ),
  ]);
  return { summaryRows, detailRows };
}

async function getNativeExportStatusData(): Promise<{ summaryRows: ExportStatusSummaryRow[]; detailRows: ExportStatusDetailRow[] }> {
  const sales = await prisma.sale.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { firstName: true, lastName: true, idNumber: true, cellphone: true } },
      product: { select: { name: true, premiumAmount: true } },
      agent: { select: { firstName: true, lastName: true } },
    },
  });
  const summary = new Map<string, ExportStatusSummaryRow>();
  const detailRows: ExportStatusDetailRow[] = sales.map((sale) => {
    const productName = sale.product?.name ?? "Unknown";
    const premiumAmount = productPremiumAmount(productName, String(sale.product?.premiumAmount ?? 0));
    const statusGroup = nativeSalesStatusToFoxProGroup[String(sale.status)] ?? "new";
    const key = `${productName}|${premiumAmount}|${statusGroup}`;
    const existing = summary.get(key) ?? { productName, premiumAmount, statusGroup, count: 0, estimatedPremium: 0 };
    existing.count += 1;
    existing.estimatedPremium += premiumAmount;
    summary.set(key, existing);
    return {
      id: sale.id,
      clientName: fullName(sale.client?.firstName, sale.client?.lastName),
      idNumber: sale.client?.idNumber ?? "",
      cellphone: sale.client?.cellphone ?? "",
      productName,
      premiumAmount,
      agentName: fullName(sale.agent?.firstName, sale.agent?.lastName),
      rawStatus: String(sale.status),
      subStatus: "",
      statusGroup,
      lastOutcome: "",
      lastUpdated: sale.updatedAt,
      dateLoaded: sale.createdAt,
      syncedAt: sale.createdAt,
    };
  });
  return { summaryRows: [...summary.values()], detailRows };
}

async function getSyncMonthlyPremiumRows(): Promise<MonthlyPremiumRow[]> {
  const groupSql = statusCaseSql("s");
  const premiumSql = productPremiumSql("s", await hasSyncSagepayTransactions());
  return runReportQuery<MonthlyPremiumRow[]>(
    `WITH sales AS (
       SELECT COALESCE(s."ProductName", 'Unknown') as "productName",
              ${premiumSql}::numeric as "premiumAmount",
              ${groupSql} as "statusGroup",
              ((COALESCE(s."Status", '') || ' ' || COALESCE(s."SubStatus", '') || ' ' || COALESCE(s."LastOutcome", '')) ILIKE '%persal%') as "isPersal"
       FROM sync_sales_data s
     )
     SELECT "productName",
            "premiumAmount",
            COUNT(*)::integer as "exportedSales",
            SUM(CASE WHEN NOT "isPersal" THEN 1 ELSE 0 END)::integer as "debitOrder",
            SUM(CASE WHEN NOT "isPersal" AND "statusGroup" IN ('qlink_uploaded', 'qa_passed', 'exported_awaiting_outcome') THEN 1 ELSE 0 END)::integer as "debitSuccessful",
            SUM(CASE WHEN NOT "isPersal" AND "statusGroup" IN ('repair', 'cancelled') THEN 1 ELSE 0 END)::integer as "debitFailed",
            SUM(CASE WHEN "isPersal" THEN 1 ELSE 0 END)::integer as "persal",
            SUM(CASE WHEN "isPersal" AND "statusGroup" IN ('qlink_uploaded', 'qa_passed', 'exported_awaiting_outcome') THEN 1 ELSE 0 END)::integer as "persalSuccessful",
            SUM(CASE WHEN "isPersal" AND "statusGroup" IN ('repair', 'cancelled') THEN 1 ELSE 0 END)::integer as "persalFailed"
     FROM sales
     GROUP BY "productName", "premiumAmount"
     ORDER BY "productName"`
  );
}

async function getNativeMonthlyPremiumRows(): Promise<MonthlyPremiumRow[]> {
  const policies = await prisma.policy.findMany({
    include: { product: { select: { name: true, premiumAmount: true } } },
  });
  const rows = new Map<string, MonthlyPremiumRow>();
  for (const policy of policies) {
    const productName = policy.product?.name ?? "Unknown";
    const premiumAmount = productPremiumAmount(productName, String(policy.premiumAmount ?? policy.product?.premiumAmount ?? 0));
    const key = `${productName}|${premiumAmount}`;
    const row = rows.get(key) ?? {
      productName,
      premiumAmount,
      exportedSales: 0,
      debitOrder: 0,
      debitSuccessful: 0,
      debitFailed: 0,
      persal: 0,
      persalSuccessful: 0,
      persalFailed: 0,
    };
    row.exportedSales += 1;
    row.debitOrder += 1;
    if (String(policy.status) === "ACTIVE") row.debitSuccessful += 1;
    if (["LAPSED", "CANCELLED"].includes(String(policy.status))) row.debitFailed += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.productName.localeCompare(b.productName));
}

async function getSyncGlobalBookRows(year: number): Promise<{ rows: GlobalBookRow[]; productRows: ProductBookRow[] }> {
  const groupSql = statusCaseSql("s");
  const premiumSql = productPremiumSql("s", await hasSyncSagepayTransactions());
  const rows = await runReportQuery<GlobalBookRow[]>(
    `WITH sales AS (
       SELECT COALESCE(s."ProductName", 'Unknown') as "productName",
              ${premiumSql}::numeric as "premiumAmount",
              ${groupSql} as "statusGroup",
              COALESCE(s."LastUpdated", s."DateLoaded", s._synced_at) as "activityDate"
       FROM sync_sales_data s
       WHERE EXTRACT(YEAR FROM COALESCE(s."LastUpdated", s."DateLoaded", s._synced_at)) = ${year}
     )
     SELECT code,
            description,
            month,
            COUNT(*)::integer as count,
            SUM("premiumAmount")::numeric as amount
     FROM (
       SELECT CASE
                WHEN "statusGroup" IN ('qlink_uploaded', 'qa_passed', 'exported_awaiting_outcome') THEN 'QREC'
                WHEN "statusGroup" = 'cancelled' THEN 'QTOS'
                ELSE 'QNEW'
              END as code,
              CASE
                WHEN "statusGroup" IN ('qlink_uploaded', 'qa_passed', 'exported_awaiting_outcome') THEN 'Recurring Premium'
                WHEN "statusGroup" = 'cancelled' THEN 'Termination of service'
                ELSE 'New Deduction'
              END as description,
              EXTRACT(MONTH FROM "activityDate")::integer as month,
              "premiumAmount"
       FROM sales
     ) grouped
     GROUP BY code, description, month
     ORDER BY code, month`
  );
  const productRows = await runReportQuery<ProductBookRow[]>(
    `SELECT COALESCE(s."ProductName", 'Unknown') as "productName",
            EXTRACT(MONTH FROM COALESCE(s."LastUpdated", s."DateLoaded", s._synced_at))::integer as month,
            COUNT(*)::integer as count,
            SUM(${premiumSql})::numeric as amount
     FROM sync_sales_data s
     WHERE EXTRACT(YEAR FROM COALESCE(s."LastUpdated", s."DateLoaded", s._synced_at)) = ${year}
     GROUP BY COALESCE(s."ProductName", 'Unknown'), month
     ORDER BY "productName", month`
  );
  return { rows, productRows };
}

async function getNativeGlobalBookRows(year: number): Promise<{ rows: GlobalBookRow[]; productRows: ProductBookRow[] }> {
  const policies = await prisma.policy.findMany({
    include: { product: { select: { name: true } } },
  });
  const summary = new Map<string, GlobalBookRow>();
  const products = new Map<string, ProductBookRow>();
  for (const policy of policies) {
    const activityDate = policy.updatedAt ?? policy.createdAt;
    if (activityDate.getFullYear() !== year) continue;
    const month = activityDate.getMonth() + 1;
    const status = String(policy.status);
    const code = status === "ACTIVE" ? "QREC" : ["LAPSED", "CANCELLED"].includes(status) ? "QTOS" : "QNEW";
    const description = code === "QREC" ? "Recurring Premium" : code === "QTOS" ? "Termination of service" : "New Deduction";
    const amount = Number(policy.premiumAmount ?? 0);
    const summaryKey = `${code}|${month}`;
    const summaryRow = summary.get(summaryKey) ?? { code, description, month, count: 0, amount: 0 };
    summaryRow.count += 1;
    summaryRow.amount += amount;
    summary.set(summaryKey, summaryRow);
    const productName = policy.product?.name ?? "Unknown";
    const productKey = `${productName}|${month}`;
    const productRow = products.get(productKey) ?? { productName, month, count: 0, amount: 0 };
    productRow.count += 1;
    productRow.amount += amount;
    products.set(productKey, productRow);
  }
  return { rows: [...summary.values()], productRows: [...products.values()] };
}

function addDictionarySheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Status Dictionary");
  sheet.columns = [
    { header: "Group", key: "group", width: 26 },
    { header: "Label", key: "label", width: 32 },
    { header: "Stage", key: "stage", width: 24 },
    { header: "Action", key: "action", width: 42 },
    { header: "Examples", key: "examples", width: 60 },
    { header: "Description", key: "description", width: 70 },
  ];
  for (const item of FOXPRO_STATUS_DEFINITIONS) {
    sheet.addRow({ ...item, examples: item.examples.join(", ") });
  }
  prepareWorksheet(sheet, "FF334155");
}

function addMetadataSheet(workbook: ExcelJS.Workbook, reportName: string, dataSource: "Synced FoxPro tables" | "Native fallback tables") {
  const sheet = workbook.addWorksheet("Report Metadata");
  sheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 80 },
  ];
  sheet.addRows([
    { field: "Report", value: reportName },
    { field: "Generated At", value: new Date().toISOString() },
    { field: "Data Source", value: dataSource },
    { field: "Fallback Note", value: dataSource === "Native fallback tables" ? "Synced FoxPro tables were unavailable, so this workbook uses native application records with reduced FoxPro granularity." : "Workbook uses synced FoxPro operational records." },
  ]);
  prepareWorksheet(sheet, "FF475569");
}

// ─── GET /api/reports/ambassador-earnings — Excel export for FNB Cash Send ──

router.get("/ambassador-earnings", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    // Fetch all active ambassadors with their activity
    const ambassadors = await prisma.ambassador.findMany({
      where: { isActive: true, role: "AMBASSADOR" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNo: true,
        province: true,
        department: true,
        referrals: { select: { id: true, status: true } },
        leads: {
          select: {
            id: true,
            type: true,
            status: true,
            datePaid: true,
            createdAt: true,
          },
        },
        ambassadorPayments: {
          where: { status: "PAID" },
          select: { amount: true, paidAt: true, type: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AmbassadorC v5";
    workbook.created = new Date();

    // ─── Sheet 1: Ambassador Earnings Summary (FNB Cash Send format) ──────────
    const summarySheet = workbook.addWorksheet("FNB Cash Send");
    summarySheet.columns = [
      { header: "Ambassador Name",        key: "name",               width: 25 },
      { header: "Mobile Number",          key: "mobile",             width: 15 },
      { header: "Province",               key: "province",           width: 15 },
      { header: "Department",             key: "department",         width: 20 },
      { header: "Referrals Submitted",    key: "referrals",          width: 20 },
      { header: "Completed Batches (÷10)",key: "batches",            width: 22 },
      { header: "Referral Batch Earn (R)",key: "batchEarnings",      width: 22 },
      { header: "Member Sign-Ups",        key: "memberSignups",      width: 18 },
      { header: "Converted Sign-Ups",     key: "convertedSignups",   width: 20 },
      { header: "Sign-Up Earn (R)",       key: "signupEarnings",     width: 18 },
      { header: "Total Earned (R)",       key: "totalEarned",        width: 18 },
      { header: "Already Paid (R)",       key: "alreadyPaid",        width: 18 },
      { header: "Amount Due (R)",         key: "amountDue",          width: 16 },
    ];

    // Header row styling
    summarySheet.getRow(1).font = { bold: true, size: 11 };
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

    let grandTotal = 0;
    let grandDue = 0;

    for (const amb of ambassadors) {
      const totalReferrals = amb.referrals.length;
      const batches = Math.floor(totalReferrals / 10);
      const batchEarnings = batches * 100;

      const memberSignups = amb.leads.filter((l) => l.type === "MEMBER_SIGNUP").length;
      const convertedSignups = amb.leads.filter(
        (l) => l.type === "MEMBER_SIGNUP" && l.status === "PAID"
      ).length;
      const signupEarnings = convertedSignups * 100;

      const totalEarned = batchEarnings + signupEarnings;
      const alreadyPaid = amb.ambassadorPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const amountDue = Math.max(0, totalEarned - alreadyPaid);

      grandTotal += totalEarned;
      grandDue += amountDue;

      const row = summarySheet.addRow({
        name: `${amb.firstName} ${amb.lastName}`,
        mobile: amb.mobileNo,
        province: amb.province.replace(/_/g, " "),
        department: amb.department,
        referrals: totalReferrals,
        batches,
        batchEarnings,
        memberSignups,
        convertedSignups,
        signupEarnings,
        totalEarned,
        alreadyPaid,
        amountDue,
      });

      if (amountDue > 0) {
        row.getCell("amountDue").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDCFCE7" },
        };
        row.getCell("amountDue").font = { bold: true, color: { argb: "FF166534" } };
      }
    }

    // Totals row
    const totalRow = summarySheet.addRow({
      name: "TOTAL",
      mobile: "",
      province: "",
      department: "",
      referrals: ambassadors.reduce((s, a) => s + a.referrals.length, 0),
      batches: ambassadors.reduce((s, a) => s + Math.floor(a.referrals.length / 10), 0),
      batchEarnings: ambassadors.reduce(
        (s, a) => s + Math.floor(a.referrals.length / 10) * 100,
        0
      ),
      memberSignups: ambassadors.reduce(
        (s, a) => s + a.leads.filter((l) => l.type === "MEMBER_SIGNUP").length,
        0
      ),
      convertedSignups: ambassadors.reduce(
        (s, a) =>
          s +
          a.leads.filter(
            (l) => l.type === "MEMBER_SIGNUP" && l.status === "PAID"
          ).length,
        0
      ),
      signupEarnings: ambassadors.reduce(
        (s, a) =>
          s +
          a.leads.filter(
            (l) => l.type === "MEMBER_SIGNUP" && l.status === "PAID"
          ).length *
            100,
        0
      ),
      totalEarned: grandTotal,
      alreadyPaid: ambassadors.reduce(
        (s, a) =>
          s + a.ambassadorPayments.reduce((ps, p) => ps + Number(p.amount), 0),
        0
      ),
      amountDue: grandDue,
    });
    totalRow.font = { bold: true, size: 11 };
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF9C3" },
    };

    // ─── Sheet 2: Member Sign-Ups Detail ─────────────────────────────────────
    const signupSheet = workbook.addWorksheet("Member Sign-Ups Detail");
    signupSheet.columns = [
      { header: "Ambassador",   key: "ambassador", width: 25 },
      { header: "Mobile",       key: "mobile",     width: 15 },
      { header: "Lead Name",    key: "leadName",   width: 25 },
      { header: "Contact No",   key: "contactNo",  width: 15 },
      { header: "Status",       key: "status",     width: 12 },
      { header: "Date Submitted", key: "submitted", width: 18 },
      { header: "Date Paid",    key: "datePaid",   width: 15 },
      { header: "Earning (R)",  key: "earning",    width: 14 },
    ];
    signupSheet.getRow(1).font = { bold: true, size: 11 };
    signupSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF7C3AED" },
    };
    signupSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

    const allSignups = await prisma.lead.findMany({
      where: { type: "MEMBER_SIGNUP" },
      include: {
        ambassador: { select: { firstName: true, lastName: true, mobileNo: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const lead of allSignups) {
      signupSheet.addRow({
        ambassador: `${lead.ambassador.firstName} ${lead.ambassador.lastName}`,
        mobile: lead.ambassador.mobileNo,
        leadName: `${lead.firstName} ${lead.lastName}`,
        contactNo: lead.contactNo,
        status: lead.status,
        submitted: lead.createdAt.toLocaleDateString("en-ZA"),
        datePaid: lead.datePaid ? lead.datePaid.toLocaleDateString("en-ZA") : "",
        earning: lead.status === "PAID" ? 100 : 0,
      });
    }

    // ─── Sheet 3: Referral Batches Detail ─────────────────────────────────────
    const refSheet = workbook.addWorksheet("Referral Batches");
    refSheet.columns = [
      { header: "Ambassador",     key: "ambassador",  width: 25 },
      { header: "Mobile",         key: "mobile",      width: 15 },
      { header: "Total Referrals",key: "total",       width: 16 },
      { header: "Completed Batches", key: "batches",  width: 18 },
      { header: "Pending (÷10 rem)", key: "pending",  width: 18 },
      { header: "Batch Earning (R)", key: "earning",  width: 18 },
    ];
    refSheet.getRow(1).font = { bold: true, size: 11 };
    refSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0369A1" },
    };
    refSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

    for (const amb of ambassadors) {
      const total = amb.referrals.length;
      const batches = Math.floor(total / 10);
      refSheet.addRow({
        ambassador: `${amb.firstName} ${amb.lastName}`,
        mobile: amb.mobileNo,
        total,
        batches,
        pending: total % 10,
        earning: batches * 100,
      });
    }

    // Stream workbook as xlsx response
    const date = new Date().toISOString().split("T")[0];
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Ambassador_Earnings_${date}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({ success: false, error: "Failed to generate report." });
  }
});

router.get("/operations/export-status", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AmbassadorC v5";
    workbook.created = new Date();

    const syncAvailable = await hasSyncTables();
    const { summaryRows, detailRows } = syncAvailable
      ? await getSyncExportStatusData()
      : await getNativeExportStatusData();

    const summarySheet = workbook.addWorksheet("EXPORT STATUS PAGE");
    summarySheet.columns = [
      { header: "Product", key: "productName", width: 28 },
      { header: "Premium", key: "premiumAmount", width: 14 },
      { header: "Status Group", key: "label", width: 30 },
      { header: "FoxPro Group", key: "statusGroup", width: 24 },
      { header: "Count", key: "count", width: 12 },
      { header: "Estimated Premium", key: "estimatedPremium", width: 20 },
      { header: "Next Action", key: "action", width: 44 },
    ];
    for (const row of summaryRows) {
      const definition = FOXPRO_STATUS_DEFINITIONS.find((item) => item.group === row.statusGroup);
      summarySheet.addRow({
        ...row,
        label: foxProStatusLabel(row.statusGroup),
        estimatedPremium: Number(row.estimatedPremium ?? 0),
        premiumAmount: Number(row.premiumAmount ?? 0),
        action: definition?.action ?? "",
      });
    }
    prepareWorksheet(summarySheet, "FF0F766E");
    styleNumberColumns(summarySheet, ["count"]);
    styleNumberColumns(summarySheet, ["premiumAmount", "estimatedPremium"], moneyFormat);

    const detailSheet = workbook.addWorksheet("Export Status Detail");
    detailSheet.columns = [
      { header: "Record ID", key: "id", width: 12 },
      { header: "Client", key: "clientName", width: 28 },
      { header: "ID Number", key: "idNumber", width: 18 },
      { header: "Cellphone", key: "cellphone", width: 16 },
      { header: "Product", key: "productName", width: 28 },
      { header: "Premium", key: "premiumAmount", width: 14 },
      { header: "Agent", key: "agentName", width: 24 },
      { header: "Status", key: "label", width: 30 },
      { header: "Raw FoxPro Status", key: "rawStatus", width: 36 },
      { header: "Sub Status", key: "subStatus", width: 30 },
      { header: "Last Outcome", key: "lastOutcome", width: 36 },
      { header: "Date Loaded", key: "dateLoaded", width: 18 },
      { header: "Last Updated", key: "lastUpdated", width: 18 },
    ];
    for (const row of detailRows) {
      detailSheet.addRow({
        ...row,
        label: foxProStatusLabel(row.statusGroup),
        premiumAmount: Number(row.premiumAmount ?? 0),
      });
    }
    prepareWorksheet(detailSheet, "FF0369A1");
    styleNumberColumns(detailSheet, ["premiumAmount"], moneyFormat);

    addDictionarySheet(workbook);
    addMetadataSheet(workbook, "Export Status", syncAvailable ? "Synced FoxPro tables" : "Native fallback tables");
    await sendWorkbook(res, workbook, "Export_Status_Report");
  } catch (error) {
    console.error("Export status report error:", error);
    res.status(500).json({ success: false, error: "Failed to generate export status report." });
  }
});

router.get("/operations/monthly-premium", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AmbassadorC v5";
    workbook.created = new Date();
    const syncAvailable = await hasSyncTables();
    const rows = syncAvailable ? await getSyncMonthlyPremiumRows() : await getNativeMonthlyPremiumRows();

    const sheet = workbook.addWorksheet("MONTHLY PREMIUM");
    sheet.columns = [
      { header: "Product", key: "productName", width: 28 },
      { header: "Prem", key: "premiumAmount", width: 12 },
      { header: "Exported Sales", key: "exportedSales", width: 16 },
      { header: "Debit Order", key: "debitOrder", width: 14 },
      { header: "Successful", key: "debitSuccessful", width: 14 },
      { header: "Banked Revenue", key: "debitRevenue", width: 18 },
      { header: "Failed", key: "debitFailed", width: 12 },
      { header: "Lost Revenue", key: "debitLostRevenue", width: 18 },
      { header: "Persal", key: "persal", width: 12 },
      { header: "Successful", key: "persalSuccessful", width: 14 },
      { header: "Banked Revenue", key: "persalRevenue", width: 18 },
      { header: "Failed", key: "persalFailed", width: 12 },
      { header: "Lost Revenue", key: "persalLostRevenue", width: 18 },
      { header: "Total Banked Revenue", key: "totalRevenue", width: 22 },
      { header: "Total Lost Revenue", key: "totalLostRevenue", width: 20 },
    ];
    let totalExported = 0;
    let totalRevenue = 0;
    let totalLostRevenue = 0;
    for (const sourceRow of rows) {
      const premiumAmount = Number(sourceRow.premiumAmount ?? 0);
      const debitSuccessful = Number(sourceRow.debitSuccessful ?? 0);
      const debitFailed = Number(sourceRow.debitFailed ?? 0);
      const persalSuccessful = Number(sourceRow.persalSuccessful ?? 0);
      const persalFailed = Number(sourceRow.persalFailed ?? 0);
      const debitRevenue = debitSuccessful * premiumAmount;
      const debitLostRevenue = debitFailed * premiumAmount;
      const persalRevenue = persalSuccessful * premiumAmount;
      const persalLostRevenue = persalFailed * premiumAmount;
      const totalRowRevenue = debitRevenue + persalRevenue;
      const totalRowLostRevenue = debitLostRevenue + persalLostRevenue;
      totalExported += Number(sourceRow.exportedSales ?? 0);
      totalRevenue += totalRowRevenue;
      totalLostRevenue += totalRowLostRevenue;
      sheet.addRow({
        ...sourceRow,
        premiumAmount,
        debitOrder: Number(sourceRow.debitOrder ?? 0),
        debitSuccessful,
        debitRevenue,
        debitFailed,
        debitLostRevenue,
        persal: Number(sourceRow.persal ?? 0),
        persalSuccessful,
        persalRevenue,
        persalFailed,
        persalLostRevenue,
        totalRevenue: totalRowRevenue,
        totalLostRevenue: totalRowLostRevenue,
      });
    }
    const totalRow = sheet.addRow({
      productName: "TOTAL",
      exportedSales: totalExported,
      totalRevenue,
      totalLostRevenue,
    });
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
    prepareWorksheet(sheet, "FF7C3AED");
    styleNumberColumns(sheet, ["exportedSales", "debitOrder", "debitSuccessful", "debitFailed", "persal", "persalSuccessful", "persalFailed"]);
    styleNumberColumns(sheet, ["premiumAmount", "debitRevenue", "debitLostRevenue", "persalRevenue", "persalLostRevenue", "totalRevenue", "totalLostRevenue"], moneyFormat);
    addDictionarySheet(workbook);
    addMetadataSheet(workbook, "Monthly Premium", syncAvailable ? "Synced FoxPro tables" : "Native fallback tables");
    await sendWorkbook(res, workbook, "Monthly_Premium_Report");
  } catch (error) {
    console.error("Monthly premium report error:", error);
    res.status(500).json({ success: false, error: "Failed to generate monthly premium report." });
  }
});

router.get("/operations/global-book", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const year = Math.max(2000, Math.min(2100, parseInt(req.query.year as string) || new Date().getFullYear()));
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AmbassadorC v5";
    workbook.created = new Date();
    const syncAvailable = await hasSyncTables();
    const { rows, productRows } = syncAvailable ? await getSyncGlobalBookRows(year) : await getNativeGlobalBookRows(year);
    const months = Array.from({ length: 12 }, (_, index) => index + 1);
    const monthNames = months.map((month) => new Date(year, month - 1, 1).toLocaleString("en-ZA", { month: "short" }));
    const rowsByCodeMonth = new Map(rows.map((row) => [`${row.code}|${Number(row.month)}`, row]));
    const productRowsByNameMonth = new Map(productRows.map((row) => [`${String(row.productName ?? "Unknown")}|${Number(row.month)}`, row]));

    const sheet = workbook.addWorksheet("GLOBAL BOOK");
    sheet.columns = [
      { header: "Code", key: "code", width: 12 },
      { header: "Description", key: "description", width: 28 },
      ...monthNames.map((name, index) => ({ header: name, key: `m${index + 1}`, width: 14 })),
      { header: "Total", key: "total", width: 14 },
      { header: "Total Premium", key: "totalPremium", width: 18 },
    ];
    const codes = [
      { code: "QREC", description: "Recurring Premium" },
      { code: "QNEW", description: "New Deduction" },
      { code: "QTOS", description: "Termination of service" },
    ];
    for (const code of codes) {
      const row: Record<string, unknown> = { ...code };
      let total = 0;
      let totalPremium = 0;
      for (const month of months) {
        const match = rowsByCodeMonth.get(`${code.code}|${month}`);
        const count = Number(match?.count ?? 0);
        row[`m${month}`] = count;
        total += count;
        totalPremium += Number(match?.amount ?? 0);
      }
      row.total = total;
      row.totalPremium = totalPremium;
      sheet.addRow(row);
    }
    prepareWorksheet(sheet, "FF92400E");
    styleNumberColumns(sheet, [...months.map((month) => `m${month}`), "total"]);
    styleNumberColumns(sheet, ["totalPremium"], moneyFormat);

    const productSheet = workbook.addWorksheet("Product Monthly Book");
    productSheet.columns = [
      { header: "Product", key: "productName", width: 32 },
      ...monthNames.map((name, index) => ({ header: name, key: `m${index + 1}`, width: 14 })),
      { header: "Total", key: "total", width: 14 },
      { header: "Total Premium", key: "totalPremium", width: 18 },
    ];
    const productNames = [...new Set(productRows.map((row) => String(row.productName ?? "Unknown")))].sort();
    for (const productName of productNames) {
      const row: Record<string, unknown> = { productName };
      let total = 0;
      let totalPremium = 0;
      for (const month of months) {
        const match = productRowsByNameMonth.get(`${productName}|${month}`);
        const count = Number(match?.count ?? 0);
        row[`m${month}`] = count;
        total += count;
        totalPremium += Number(match?.amount ?? 0);
      }
      row.total = total;
      row.totalPremium = totalPremium;
      productSheet.addRow(row);
    }
    prepareWorksheet(productSheet, "FF166534");
    styleNumberColumns(productSheet, [...months.map((month) => `m${month}`), "total"]);
    styleNumberColumns(productSheet, ["totalPremium"], moneyFormat);
    addDictionarySheet(workbook);
    addMetadataSheet(workbook, `Global Book ${year}`, syncAvailable ? "Synced FoxPro tables" : "Native fallback tables");
    await sendWorkbook(res, workbook, `Global_Book_Report_${year}`);
  } catch (error) {
    console.error("Global book report error:", error);
    res.status(500).json({ success: false, error: "Failed to generate global book report." });
  }
});

export default router;
