import prisma from "../lib/prisma";
import type { AgentResult } from "./index";

// ─── Rate Limiter ───────────────────────────────────────────────────────────

const RATE_LIMIT_PER_SECOND = 10;

/**
 * Simple rate limiter that processes items in batches of RATE_LIMIT_PER_SECOND
 * with a 1-second pause between batches.
 */
async function rateLimitedProcess<T>(
  items: T[],
  processFn: (item: T) => Promise<void>,
  perSecond: number
): Promise<void> {
  for (let i = 0; i < items.length; i += perSecond) {
    const batch = items.slice(i, i + perSecond);
    await Promise.all(batch.map(processFn));

    // Wait 1 second before processing the next batch (unless this is the last batch)
    if (i + perSecond < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

// ─── SMS Sending Simulation ─────────────────────────────────────────────────

/**
 * Simulates sending an SMS. In production, this would call the SMS Portal API.
 * Returns true for success, false for failure.
 */
async function simulateSendSms(
  recipientNumber: string,
  _messageBody: string
): Promise<{ success: boolean; error?: string }> {
  // Validate phone number format (basic SA mobile check)
  const normalizedNumber = recipientNumber.replace(/\s+/g, "");
  if (!/^(\+27|0)\d{9}$/.test(normalizedNumber)) {
    return {
      success: false,
      error: `Invalid phone number format: ${recipientNumber}`,
    };
  }

  // Simulate a small random failure rate (2%) for realism in development
  if (process.env.NODE_ENV === "development" && Math.random() < 0.02) {
    return {
      success: false,
      error: "Simulated network timeout",
    };
  }

  // In production, this is where you would call the SMS Portal API:
  // const response = await smsPortalClient.send({ to: normalizedNumber, body: messageBody });
  // return { success: response.ok };

  return { success: true };
}

// ─── SMS Dispatcher Agent ───────────────────────────────────────────────────

export async function runSmsDispatcher(): Promise<AgentResult> {
  const actions: string[] = [];
  const errors: string[] = [];
  let processed = 0;

  try {
    // Fetch all queued SMS messages, ordered by creation time
    const queuedMessages = await prisma.smsMessage.findMany({
      where: {
        status: "QUEUED",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (queuedMessages.length === 0) {
      return {
        agentName: "sms-dispatcher",
        success: true,
        processed: 0,
        actions: ["No queued messages to process."],
        errors: [],
        duration: 0,
      };
    }

    actions.push(`Found ${queuedMessages.length} queued message(s) to dispatch.`);

    // Process with rate limiting (10 messages/second)
    await rateLimitedProcess(
      queuedMessages,
      async (message) => {
        try {
          const result = await simulateSendSms(
            message.recipientNumber,
            message.messageBody
          );

          if (result.success) {
            await prisma.smsMessage.update({
              where: { id: message.id },
              data: {
                status: "SENT",
                sentAt: new Date(),
              },
            });

            processed++;
            actions.push(
              `SMS #${message.id} SENT to ${message.recipientNumber} (${message.type})`
            );
          } else {
            await prisma.smsMessage.update({
              where: { id: message.id },
              data: {
                status: "FAILED",
              },
            });

            errors.push(
              `SMS #${message.id} FAILED to ${message.recipientNumber}: ${result.error}`
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`SMS #${message.id} error: ${msg}`);
        }
      },
      RATE_LIMIT_PER_SECOND
    );

    // Summary
    const sentCount = processed;
    const failedCount = queuedMessages.length - processed;
    actions.push(
      `Dispatch complete: ${sentCount} sent, ${failedCount} failed out of ${queuedMessages.length} total.`
    );

    return {
      agentName: "sms-dispatcher",
      success: errors.length === 0,
      processed,
      actions,
      errors,
      duration: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agentName: "sms-dispatcher",
      success: false,
      processed,
      actions,
      errors: [...errors, msg],
      duration: 0,
    };
  }
}
