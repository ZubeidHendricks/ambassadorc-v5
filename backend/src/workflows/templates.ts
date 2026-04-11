import prisma from "../lib/prisma";
import type { WorkflowTrigger } from "@prisma/client";

// ─── Template Definitions ──────────────────────────────────────────────────

interface StepTemplate {
  order: number;
  name: string;
  actionType: string;
  config: Record<string, unknown>;
}

interface WorkflowTemplate {
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: StepTemplate[];
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ── 1. New Ambassador Onboarding ──────────────────────────────────────────
  {
    name: "New Ambassador Onboarding",
    description:
      "Welcomes newly registered ambassadors, scores their lead potential, and sends follow-up instructions.",
    trigger: "ON_REGISTRATION",
    steps: [
      {
        order: 1,
        name: "Send Welcome SMS",
        actionType: "SEND_SMS",
        config: {
          template:
            "Welcome to AmbassadorC, {{firstName}}! You have been registered as an ambassador in {{province}}. Start referring friends and earn commissions today.",
          recipientField: "mobileNo",
          smsType: "WELCOME",
        },
      },
      {
        order: 2,
        name: "Wait 1 Hour",
        actionType: "WAIT",
        config: { hours: 1 },
      },
      {
        order: 3,
        name: "Run Lead Scorer Agent",
        actionType: "RUN_AGENT",
        config: { agentName: "lead-scorer" },
      },
      {
        order: 4,
        name: "Send Referral Instructions SMS",
        actionType: "SEND_SMS",
        config: {
          template:
            "Hi {{firstName}}, ready to earn? Share your unique code {{uniqueCode}} with friends and family. Each successful referral earns you commission. Visit our portal for details.",
          recipientField: "mobileNo",
          smsType: "AMBASSADOR",
        },
      },
    ],
  },

  // ── 2. New Sale Pipeline ──────────────────────────────────────────────────
  {
    name: "New Sale Pipeline",
    description:
      "Automatically validates new sales through QA, seeks approval, and calculates commissions.",
    trigger: "ON_SALE_CREATED",
    steps: [
      {
        order: 1,
        name: "Run Auto QA Agent",
        actionType: "RUN_AGENT",
        config: { agentName: "qa-auto-checker" },
      },
      {
        order: 2,
        name: "QA Officer Approval",
        actionType: "APPROVAL",
        config: { approverRole: "QA_OFFICER" },
      },
      {
        order: 3,
        name: "Update Sale Status to QA Approved",
        actionType: "UPDATE_STATUS",
        config: { field: "status", value: "QA_APPROVED" },
      },
      {
        order: 4,
        name: "Run Commission Calculator",
        actionType: "RUN_AGENT",
        config: { agentName: "commission-calculator" },
      },
      {
        order: 5,
        name: "Send Confirmation SMS to Client",
        actionType: "SEND_SMS",
        config: {
          template:
            "Dear {{clientFirstName}}, your insurance application has been approved. Policy details will follow shortly. Ref: {{saleId}}. Thank you for choosing AmbassadorC.",
          recipientField: "clientCellphone",
          smsType: "QA_VERIFY",
        },
      },
    ],
  },

  // ── 3. Policy Activation ──────────────────────────────────────────────────
  {
    name: "Policy Activation",
    description:
      "Activates policies after QA approval, sends welcome packs, and follows up on document viewing.",
    trigger: "ON_QA_APPROVED",
    steps: [
      {
        order: 1,
        name: "Update Policy Status to Active",
        actionType: "UPDATE_STATUS",
        config: { field: "status", value: "ACTIVE" },
      },
      {
        order: 2,
        name: "Run Welcome Pack Sender",
        actionType: "RUN_AGENT",
        config: { agentName: "welcome-pack-sender" },
      },
      {
        order: 3,
        name: "Wait 24 Hours",
        actionType: "WAIT",
        config: { hours: 24 },
      },
      {
        order: 4,
        name: "Send Welcome Pack Follow-up SMS",
        actionType: "SEND_SMS",
        config: {
          template:
            "Hi {{clientFirstName}}, we sent you a welcome pack for your new policy. Please review and sign it at your earliest convenience. Need help? Call us.",
          recipientField: "clientCellphone",
          smsType: "WELCOME",
        },
      },
      {
        order: 5,
        name: "Wait 72 Hours for Viewing",
        actionType: "WAIT",
        config: { hours: 72 },
      },
      {
        order: 6,
        name: "Send Reminder SMS if Not Viewed",
        actionType: "SEND_SMS",
        config: {
          template:
            "Reminder: Your welcome pack is still awaiting your review, {{clientFirstName}}. Please sign your documents to complete your policy activation. Policy: {{policyNumber}}.",
          recipientField: "clientCellphone",
          smsType: "CALLBACK",
        },
      },
    ],
  },

  // ── 4. Payment Failed Recovery ────────────────────────────────────────────
  {
    name: "Payment Failed Recovery",
    description:
      "Handles failed payment recovery with escalating notifications and automated reconciliation.",
    trigger: "ON_PAYMENT_FAILED",
    steps: [
      {
        order: 1,
        name: "Send Payment Failed SMS",
        actionType: "SEND_SMS",
        config: {
          template:
            "Dear {{clientFirstName}}, your debit order payment of R{{amount}} has failed. Please ensure sufficient funds are available. Ref: {{policyNumber}}.",
          recipientField: "clientCellphone",
          smsType: "CALLBACK",
        },
      },
      {
        order: 2,
        name: "Wait 48 Hours",
        actionType: "WAIT",
        config: { hours: 48 },
      },
      {
        order: 3,
        name: "Send Reminder SMS",
        actionType: "SEND_SMS",
        config: {
          template:
            "Reminder: Your payment for policy {{policyNumber}} is still outstanding. Please contact us or arrange payment to keep your policy active.",
          recipientField: "clientCellphone",
          smsType: "CALLBACK",
        },
      },
      {
        order: 4,
        name: "Wait 72 Hours",
        actionType: "WAIT",
        config: { hours: 72 },
      },
      {
        order: 5,
        name: "Run Debit Order Reconciler",
        actionType: "RUN_AGENT",
        config: { agentName: "debit-order-reconciler" },
      },
      {
        order: 6,
        name: "Update Policy Status to Lapsed",
        actionType: "UPDATE_STATUS",
        config: { field: "status", value: "LAPSED" },
      },
      {
        order: 7,
        name: "Notify Agent of Lapsed Policy",
        actionType: "SEND_SMS",
        config: {
          template:
            "Alert: Policy {{policyNumber}} for {{clientFirstName}} {{clientLastName}} has lapsed due to non-payment. Please follow up with the client.",
          recipientField: "agentMobileNo",
          smsType: "AGENT_CAPTURE",
        },
      },
    ],
  },

  // ── 5. Premium Increase Notification ──────────────────────────────────────
  {
    name: "Premium Increase Notification",
    description:
      "Manages the full premium increase lifecycle including approval, notifications, and document regeneration.",
    trigger: "ON_PREMIUM_CHANGE",
    steps: [
      {
        order: 1,
        name: "Admin Approval for Premium Change",
        actionType: "APPROVAL",
        config: { approverRole: "ADMIN" },
      },
      {
        order: 2,
        name: "Update Premium Tier",
        actionType: "UPDATE_STATUS",
        config: { field: "premiumAmount", value: "{{newPremiumAmount}}" },
      },
      {
        order: 3,
        name: "Send Premium Increase SMS",
        actionType: "SEND_SMS",
        config: {
          template:
            "Dear {{clientFirstName}}, your monthly premium for policy {{policyNumber}} will increase from R{{oldAmount}} to R{{newAmount}} effective {{effectiveDate}}. Contact us with any questions.",
          recipientField: "clientCellphone",
          smsType: "PREMIUM_INCREASE",
        },
      },
      {
        order: 4,
        name: "Wait 7 Days",
        actionType: "WAIT",
        config: { hours: 168 },
      },
      {
        order: 5,
        name: "Generate Updated Welcome Pack",
        actionType: "RUN_AGENT",
        config: { agentName: "welcome-pack-sender" },
      },
      {
        order: 6,
        name: "Run SMS Dispatcher for Bulk Notifications",
        actionType: "RUN_AGENT",
        config: { agentName: "sms-dispatcher" },
      },
    ],
  },
];

// ─── Seeder Function ────────────────────────────────────────────────────────

/**
 * Seeds default workflow templates into the database.
 * Only creates workflows if none exist, to avoid duplicates on restart.
 */
export async function seedWorkflowTemplates(): Promise<void> {
  const existingCount = await prisma.workflow.count();

  if (existingCount > 0) {
    console.log(
      `[WorkflowTemplates] ${existingCount} workflow(s) already exist. Skipping seed.`
    );
    return;
  }

  console.log("[WorkflowTemplates] Seeding default workflow templates...");

  for (const template of WORKFLOW_TEMPLATES) {
    const workflow = await prisma.workflow.create({
      data: {
        name: template.name,
        description: template.description,
        trigger: template.trigger,
        isActive: true,
        steps: {
          create: template.steps.map((step) => ({
            order: step.order,
            name: step.name,
            actionType: step.actionType,
            config: step.config,
          })),
        },
      },
    });

    console.log(
      `[WorkflowTemplates] Created workflow: "${workflow.name}" (${template.steps.length} steps)`
    );
  }

  console.log(
    `[WorkflowTemplates] Seeded ${WORKFLOW_TEMPLATES.length} workflow templates.`
  );
}

export { WORKFLOW_TEMPLATES };
