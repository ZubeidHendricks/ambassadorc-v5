import prisma from "../lib/prisma";
import type { AgentResult } from "./index";

// ─── Province Conversion Weight Map ─────────────────────────────────────────
// Higher weight = historically higher conversion rate in that province.

const PROVINCE_WEIGHTS: Record<string, number> = {
  GAUTENG: 25,
  WESTERN_CAPE: 22,
  KWAZULU_NATAL: 20,
  FREE_STATE: 15,
  MPUMALANGA: 14,
  NORTH_WEST: 12,
  EASTERN_CAPE: 12,
  LIMPOPO: 10,
  NORTHERN_CAPE: 8,
};

// ─── Contact Method Preference Weights ──────────────────────────────────────

const CONTACT_METHOD_WEIGHTS: Record<string, number> = {
  whatsapp: 15,
  call: 12,
  sms: 10,
  email: 5,
};

// ─── Priority Tag Thresholds ────────────────────────────────────────────────

function getPriorityTag(score: number): string {
  if (score >= 80) return "HOT";
  if (score >= 60) return "WARM";
  if (score >= 40) return "COOL";
  return "COLD";
}

// ─── Lead Scoring Agent ─────────────────────────────────────────────────────

export async function runLeadScorer(): Promise<AgentResult> {
  const actions: string[] = [];
  const errors: string[] = [];
  let processed = 0;

  try {
    // Fetch all active leads that are NEW or CONTACTED (not yet closed/paid)
    const leads = await prisma.lead.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED"] },
      },
      include: {
        ambassador: {
          select: {
            id: true,
            province: true,
            role: true,
            tier: true,
            referrals: {
              select: { status: true },
            },
            leads: {
              where: { status: "PAID" },
              select: { id: true },
            },
          },
        },
      },
    });

    for (const lead of leads) {
      try {
        let score = 0;

        // 1. Province score (0-25 points)
        const provinceScore = PROVINCE_WEIGHTS[lead.ambassador.province] ?? 10;
        score += provinceScore;

        // 2. Preferred contact method (0-15 points)
        const contactMethod = lead.preferredContact?.toLowerCase() ?? "";
        score += CONTACT_METHOD_WEIGHTS[contactMethod] ?? 5;

        // 3. Recency score (0-20 points) — newer leads score higher
        const daysSinceCreation = Math.floor(
          (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCreation <= 1) {
          score += 20;
        } else if (daysSinceCreation <= 3) {
          score += 15;
        } else if (daysSinceCreation <= 7) {
          score += 10;
        } else if (daysSinceCreation <= 14) {
          score += 5;
        } else {
          score += 2;
        }

        // 4. Ambassador track record (0-25 points)
        const totalReferrals = lead.ambassador.referrals.length;
        const convertedReferrals = lead.ambassador.referrals.filter(
          (r) => r.status === "CONVERTED"
        ).length;
        const paidLeads = lead.ambassador.leads.length;

        // Conversion rate bonus
        if (totalReferrals > 0) {
          const conversionRate = convertedReferrals / totalReferrals;
          score += Math.round(conversionRate * 15);
        }

        // Volume bonus (paid leads)
        if (paidLeads >= 20) {
          score += 10;
        } else if (paidLeads >= 10) {
          score += 7;
        } else if (paidLeads >= 5) {
          score += 5;
        } else if (paidLeads >= 1) {
          score += 3;
        }

        // 5. Already-contacted leads get a small boost (0-15 points)
        if (lead.status === "CONTACTED") {
          score += 15;
        }

        // Clamp to 1-100
        score = Math.max(1, Math.min(100, score));

        const priorityTag = getPriorityTag(score);

        // Update the lead's preferredContact field with score/priority metadata.
        // Since the schema doesn't have a dedicated priority column, we store
        // the priority tag in a convention: we use an AuditLog entry to track
        // the score and update the lead status note via AuditLog.
        await prisma.auditLog.create({
          data: {
            userId: "SYSTEM_AGENT",
            action: "LEAD_SCORED",
            entity: "Lead",
            entityId: String(lead.id),
            details: {
              score,
              priority: priorityTag,
              provinceScore,
              recencyDays: daysSinceCreation,
              ambassadorConversionRate:
                totalReferrals > 0
                  ? Math.round((convertedReferrals / totalReferrals) * 100)
                  : 0,
              ambassadorPaidLeads: paidLeads,
            },
          },
        });

        processed++;
        actions.push(
          `Lead #${lead.id} scored ${score}/100 (${priorityTag}) — Ambassador #${lead.ambassadorId}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to score Lead #${lead.id}: ${msg}`);
      }
    }

    return {
      agentName: "lead-scorer",
      success: errors.length === 0,
      processed,
      actions,
      errors,
      duration: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agentName: "lead-scorer",
      success: false,
      processed,
      actions,
      errors: [...errors, msg],
      duration: 0,
    };
  }
}
