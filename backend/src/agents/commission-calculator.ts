import prisma from "../lib/prisma";
import type { AgentResult } from "./index";

// ─── Commission Rules ───────────────────────────────────────────────────────

const COMMISSION_PER_10_REFERRALS = 100; // R100 per 10 referrals
const COMMISSION_PER_PAID_LEAD = 100; // R100 per paid lead

// Percentage of sale premium earned as commission, by ambassador tier
const TIER_COMMISSION_PERCENTAGES: Record<string, number> = {
  bronze: 5,
  silver: 7.5,
  gold: 10,
  platinum: 12.5,
  diamond: 15,
};

const DEFAULT_COMMISSION_PERCENTAGE = 5; // Default if tier is unknown

// ─── Commission Calculator Agent ────────────────────────────────────────────

export async function runCommissionCalculator(): Promise<AgentResult> {
  const actions: string[] = [];
  const errors: string[] = [];
  let processed = 0;

  try {
    // ── Part 1: Commission for Sales (QA_APPROVED sales without commission) ──

    const uncreditedSales = await prisma.sale.findMany({
      where: {
        status: { in: ["QA_APPROVED", "ACTIVE"] },
        commissions: {
          none: {},
        },
      },
      include: {
        agent: {
          select: { id: true, tier: true, firstName: true, lastName: true },
        },
        product: {
          select: { premiumAmount: true, name: true },
        },
        client: {
          select: {
            policies: {
              select: { premiumAmount: true },
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    for (const sale of uncreditedSales) {
      try {
        // Determine the premium amount from the policy or product
        const premiumAmount =
          sale.client.policies.length > 0
            ? Number(sale.client.policies[0].premiumAmount)
            : Number(sale.product.premiumAmount);

        // Determine commission percentage based on ambassador tier
        const tier = sale.agent.tier?.toLowerCase() ?? "";
        const commissionPct =
          TIER_COMMISSION_PERCENTAGES[tier] ?? DEFAULT_COMMISSION_PERCENTAGE;

        const commissionAmount = Math.round((premiumAmount * commissionPct) / 100 * 100) / 100;

        if (commissionAmount > 0) {
          await prisma.commission.create({
            data: {
              ambassadorId: sale.agent.id,
              saleId: sale.id,
              amount: commissionAmount,
              status: "PENDING",
            },
          });

          processed++;
          actions.push(
            `Sale #${sale.id}: R${commissionAmount.toFixed(2)} commission for ${sale.agent.firstName} ${sale.agent.lastName} (${commissionPct}% of R${premiumAmount.toFixed(2)}, tier: ${tier || "default"})`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed commission for Sale #${sale.id}: ${msg}`);
      }
    }

    // ── Part 2: Commission for Paid Leads ───────────────────────────────────

    // Find paid leads that do not yet have a corresponding audit log for commission
    const paidLeads = await prisma.lead.findMany({
      where: {
        status: "PAID",
        datePaid: { not: null },
      },
      include: {
        ambassador: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    for (const lead of paidLeads) {
      try {
        // Check if this lead already has a commission-credited audit entry
        const existingCredit = await prisma.auditLog.findFirst({
          where: {
            action: "COMMISSION_PAID_LEAD",
            entity: "Lead",
            entityId: String(lead.id),
          },
        });

        if (existingCredit) continue;

        // Find or create a sale record to attach the commission to.
        // If no sale exists, we record the credit via AuditLog only.
        const relatedSale = await prisma.sale.findFirst({
          where: {
            agentId: lead.ambassadorId,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (relatedSale) {
          await prisma.commission.create({
            data: {
              ambassadorId: lead.ambassadorId,
              saleId: relatedSale.id,
              amount: COMMISSION_PER_PAID_LEAD,
              status: "PENDING",
            },
          });
        }

        // Log the credit regardless
        await prisma.auditLog.create({
          data: {
            userId: "SYSTEM_AGENT",
            action: "COMMISSION_PAID_LEAD",
            entity: "Lead",
            entityId: String(lead.id),
            details: {
              ambassadorId: lead.ambassadorId,
              amount: COMMISSION_PER_PAID_LEAD,
              hasSaleRecord: !!relatedSale,
            },
          },
        });

        processed++;
        actions.push(
          `Lead #${lead.id}: R${COMMISSION_PER_PAID_LEAD} paid-lead commission for ${lead.ambassador.firstName} ${lead.ambassador.lastName}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed lead commission for Lead #${lead.id}: ${msg}`);
      }
    }

    // ── Part 3: Referral Milestones (R100 per 10 converted referrals) ───────

    const ambassadorsWithReferrals = await prisma.ambassador.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        referrals: {
          where: { status: "CONVERTED" },
          select: { id: true },
        },
      },
    });

    for (const ambassador of ambassadorsWithReferrals) {
      try {
        const convertedCount = ambassador.referrals.length;
        if (convertedCount < 10) continue;

        // How many milestones of 10 have been reached?
        const milestonesReached = Math.floor(convertedCount / 10);

        // Check how many referral milestones have already been credited
        const existingMilestones = await prisma.auditLog.count({
          where: {
            action: "COMMISSION_REFERRAL_MILESTONE",
            entity: "Ambassador",
            entityId: String(ambassador.id),
          },
        });

        const uncreditedMilestones = milestonesReached - existingMilestones;

        if (uncreditedMilestones <= 0) continue;

        // Find a sale to attach the commission to (most recent)
        const recentSale = await prisma.sale.findFirst({
          where: { agentId: ambassador.id },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        for (let m = 0; m < uncreditedMilestones; m++) {
          if (recentSale) {
            await prisma.commission.create({
              data: {
                ambassadorId: ambassador.id,
                saleId: recentSale.id,
                amount: COMMISSION_PER_10_REFERRALS,
                status: "PENDING",
              },
            });
          }

          await prisma.auditLog.create({
            data: {
              userId: "SYSTEM_AGENT",
              action: "COMMISSION_REFERRAL_MILESTONE",
              entity: "Ambassador",
              entityId: String(ambassador.id),
              details: {
                milestone: existingMilestones + m + 1,
                convertedReferrals: convertedCount,
                amount: COMMISSION_PER_10_REFERRALS,
                hasSaleRecord: !!recentSale,
              },
            },
          });

          processed++;
          actions.push(
            `Ambassador #${ambassador.id} (${ambassador.firstName} ${ambassador.lastName}): R${COMMISSION_PER_10_REFERRALS} referral milestone #${existingMilestones + m + 1}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(
          `Failed referral commission for Ambassador #${ambassador.id}: ${msg}`
        );
      }
    }

    return {
      agentName: "commission-calculator",
      success: errors.length === 0,
      processed,
      actions,
      errors,
      duration: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agentName: "commission-calculator",
      success: false,
      processed,
      actions,
      errors: [...errors, msg],
      duration: 0,
    };
  }
}
