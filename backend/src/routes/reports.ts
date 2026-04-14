import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

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

export default router;
