import prisma from "../lib/prisma";
import type { AgentResult } from "./index";

// ─── Welcome Pack Agent ─────────────────────────────────────────────────────

export async function runWelcomePackSender(): Promise<AgentResult> {
  const actions: string[] = [];
  const errors: string[] = [];
  let processed = 0;

  try {
    // Find active policies that do not have a welcome pack yet
    const policiesWithoutWelcomePack = await prisma.policy.findMany({
      where: {
        status: "ACTIVE",
        welcomePacks: {
          none: {},
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cellphone: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (policiesWithoutWelcomePack.length === 0) {
      return {
        agentName: "welcome-pack-sender",
        success: true,
        processed: 0,
        actions: ["No policies pending welcome packs."],
        errors: [],
        duration: 0,
      };
    }

    actions.push(
      `Found ${policiesWithoutWelcomePack.length} active policies without welcome packs.`
    );

    for (const policy of policiesWithoutWelcomePack) {
      try {
        // Determine template name based on product type
        const templateName = getTemplateName(policy.product.type, policy.product.name);

        // Create WelcomePack record
        const welcomePack = await prisma.welcomePack.create({
          data: {
            clientId: policy.client.id,
            policyId: policy.id,
            type: "HTML",
            templateName,
            status: "SENT",
            sentAt: new Date(),
          },
        });

        // Queue a welcome SMS with a link to the welcome pack
        const welcomeLink = `${process.env.APP_URL || "https://app.ambassadorc.co.za"}/welcome/${welcomePack.id}`;
        const smsBody = `Hi ${policy.client.firstName}, welcome to ${policy.product.name}! View your welcome pack here: ${welcomeLink}`;

        await prisma.smsMessage.create({
          data: {
            recipientNumber: policy.client.cellphone,
            messageBody: smsBody,
            status: "QUEUED",
            type: "WELCOME",
          },
        });

        // Log the welcome pack creation
        await prisma.auditLog.create({
          data: {
            userId: "SYSTEM_AGENT",
            action: "WELCOME_PACK_SENT",
            entity: "WelcomePack",
            entityId: String(welcomePack.id),
            details: {
              policyId: policy.id,
              policyNumber: policy.policyNumber,
              clientId: policy.client.id,
              clientName: `${policy.client.firstName} ${policy.client.lastName}`,
              productName: policy.product.name,
              templateName,
              smsQueued: true,
            },
          },
        });

        processed++;
        actions.push(
          `Policy ${policy.policyNumber}: Welcome pack created & SMS queued for ${policy.client.firstName} ${policy.client.lastName} (${policy.product.name})`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(
          `Failed to create welcome pack for Policy ${policy.policyNumber}: ${msg}`
        );
      }
    }

    // Report on outstanding welcome packs that have been sent but not viewed
    const unviewedPacks = await prisma.welcomePack.count({
      where: {
        status: "SENT",
        viewedAt: null,
        sentAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Older than 7 days
        },
      },
    });

    if (unviewedPacks > 0) {
      actions.push(
        `Note: ${unviewedPacks} welcome pack(s) sent over 7 days ago have not been viewed.`
      );
    }

    return {
      agentName: "welcome-pack-sender",
      success: errors.length === 0,
      processed,
      actions,
      errors,
      duration: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agentName: "welcome-pack-sender",
      success: false,
      processed,
      actions,
      errors: [...errors, msg],
      duration: 0,
    };
  }
}

// ─── Template Name Resolution ───────────────────────────────────────────────

function getTemplateName(productType: string, productName: string): string {
  const templateMap: Record<string, string> = {
    LIFE_COVER: "welcome-life-cover",
    LEGAL: "welcome-legal-assist",
    SOS: "welcome-sos-emergency",
    FIVE_IN_ONE: "welcome-five-in-one",
    SHORT_TERM: "welcome-short-term",
    CONSULT: "welcome-consultation",
  };

  return templateMap[productType] ?? `welcome-${productName.toLowerCase().replace(/\s+/g, "-")}`;
}
