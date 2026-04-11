import prisma from "../lib/prisma";
import type { AgentResult } from "./index";

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES = 3; // After 3 missed payments, mark debit order as FAILED

// ─── Debit Order Reconciler Agent ───────────────────────────────────────────

export async function runDebitOrderReconciler(): Promise<AgentResult> {
  const actions: string[] = [];
  const errors: string[] = [];
  let processed = 0;

  try {
    // ── Step 1: Get all active debit orders ─────────────────────────────────

    const activeDebitOrders = await prisma.debitOrder.findMany({
      where: {
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      include: {
        policy: {
          select: {
            id: true,
            policyNumber: true,
            status: true,
            premiumAmount: true,
          },
        },
        client: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (activeDebitOrders.length === 0) {
      return {
        agentName: "debit-order-reconciler",
        success: true,
        processed: 0,
        actions: ["No active debit orders to reconcile."],
        errors: [],
        duration: 0,
      };
    }

    let totalDebitOrders = activeDebitOrders.length;
    let healthyCount = 0;
    let warningCount = 0;
    let failedCount = 0;
    let lapsedPolicies = 0;

    // ── Step 2: For each debit order, check recent payment history ──────────

    for (const debitOrder of activeDebitOrders) {
      try {
        // Get recent payments for this policy, ordered most recent first
        const recentPayments = await prisma.payment.findMany({
          where: {
            policyId: debitOrder.policyId,
          },
          orderBy: {
            paymentDate: "desc",
          },
          take: MAX_CONSECUTIVE_FAILURES + 1,
          select: {
            id: true,
            status: true,
            paymentDate: true,
            amount: true,
          },
        });

        // Count consecutive failures from the most recent payment backward
        let consecutiveFailures = 0;
        for (const payment of recentPayments) {
          if (payment.status === "FAILED" || payment.status === "REVERSED") {
            consecutiveFailures++;
          } else {
            break; // Stop counting at the first successful payment
          }
        }

        // Flag any individual failed payments that are not yet flagged
        const unflaggedFailedPayments = await prisma.payment.findMany({
          where: {
            policyId: debitOrder.policyId,
            status: "FAILED",
          },
          select: { id: true },
        });

        for (const failedPayment of unflaggedFailedPayments) {
          // Log each failed payment if not already logged
          const existingLog = await prisma.auditLog.findFirst({
            where: {
              action: "PAYMENT_FAILED_FLAGGED",
              entity: "Payment",
              entityId: String(failedPayment.id),
            },
          });

          if (!existingLog) {
            await prisma.auditLog.create({
              data: {
                userId: "SYSTEM_AGENT",
                action: "PAYMENT_FAILED_FLAGGED",
                entity: "Payment",
                entityId: String(failedPayment.id),
                details: {
                  policyId: debitOrder.policyId,
                  debitOrderId: debitOrder.id,
                  clientId: debitOrder.clientId,
                },
              },
            });
          }
        }

        // ── Step 3: Apply business rules based on consecutive failures ──────

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          // Mark debit order as FAILED
          await prisma.debitOrder.update({
            where: { id: debitOrder.id },
            data: { status: "FAILED" },
          });

          // Lapse the policy if it is still ACTIVE
          if (debitOrder.policy.status === "ACTIVE") {
            await prisma.policy.update({
              where: { id: debitOrder.policyId },
              data: { status: "LAPSED" },
            });

            lapsedPolicies++;
            actions.push(
              `Policy ${debitOrder.policy.policyNumber} LAPSED — ${consecutiveFailures} consecutive failed payments for ${debitOrder.client.firstName} ${debitOrder.client.lastName}`
            );
          }

          // Log the debit order failure
          await prisma.auditLog.create({
            data: {
              userId: "SYSTEM_AGENT",
              action: "DEBIT_ORDER_FAILED",
              entity: "DebitOrder",
              entityId: String(debitOrder.id),
              details: {
                consecutiveFailures,
                policyNumber: debitOrder.policy.policyNumber,
                clientName: `${debitOrder.client.firstName} ${debitOrder.client.lastName}`,
                policyLapsed: debitOrder.policy.status === "ACTIVE",
              },
            },
          });

          failedCount++;
          processed++;
          actions.push(
            `DebitOrder #${debitOrder.id} marked FAILED (${consecutiveFailures} consecutive misses)`
          );
        } else if (consecutiveFailures > 0) {
          warningCount++;
          processed++;
          actions.push(
            `DebitOrder #${debitOrder.id} WARNING: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} consecutive failures (${debitOrder.client.firstName} ${debitOrder.client.lastName})`
          );
        } else {
          healthyCount++;
          processed++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to reconcile DebitOrder #${debitOrder.id}: ${msg}`);
      }
    }

    // ── Step 4: Generate summary ────────────────────────────────────────────

    const totalSuccessfulPayments = await prisma.payment.count({
      where: { status: "SUCCESSFUL" },
    });

    const totalPayments = await prisma.payment.count();

    const collectionRate =
      totalPayments > 0
        ? Math.round((totalSuccessfulPayments / totalPayments) * 10000) / 100
        : 0;

    actions.push(
      `Reconciliation Summary: ${totalDebitOrders} debit orders checked — ${healthyCount} healthy, ${warningCount} warnings, ${failedCount} failed, ${lapsedPolicies} policies lapsed`
    );
    actions.push(`Overall Collection Rate: ${collectionRate}%`);

    return {
      agentName: "debit-order-reconciler",
      success: errors.length === 0,
      processed,
      actions,
      errors,
      duration: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agentName: "debit-order-reconciler",
      success: false,
      processed,
      actions,
      errors: [...errors, msg],
      duration: 0,
    };
  }
}
