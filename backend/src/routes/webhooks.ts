/**
 * Inbound Webhook Routes
 *
 * Receives real-time delivery notifications from external services.
 * These routes are intentionally unauthenticated — the calling service
 * (UltraMsg, etc.) does not carry a user JWT.
 *
 * Mounted at: /api/webhooks
 */

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

// ── UltraMsg Delivery Webhook ─────────────────────────────────────────────
//
// UltraMsg sends a POST here for every message event (sent, ACK, received).
// Configure in UltraMsg dashboard → Webhook URL:
//   https://<your-domain>/api/webhooks/ultramsg
//
// Payload types:
//   { event_type: "message_ack", id, to, status, "timestamp" }
//   { event_type: "message_create", id, from, to, body, timestamp }
//   { event_type: "message_received", id, from, body, timestamp }

router.post("/ultramsg", async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Always respond 200 quickly so UltraMsg doesn't retry
    res.json({ success: true });

    const eventType: string = payload?.event_type ?? payload?.type ?? "unknown";

    // Log for debugging
    console.log(`[UltraMsg Webhook] event=${eventType}`, JSON.stringify(payload).slice(0, 200));

    // On ACK (delivery confirmation) — update the matching outbound log row
    if (eventType === "message_ack") {
      const { id, status } = payload;
      if (id && status) {
        await prisma.integrationLog
          .updateMany({
            where: { externalId: String(id), integration: "ULTRAMSG" },
            data: {
              status: status === "read" ? "SUCCESS" : status === "delivered" ? "SUCCESS" : "PENDING",
              response: payload,
            },
          })
          .catch(() => {}); // Non-fatal — log table may not exist yet
      }
    }
  } catch (err: any) {
    console.error("[UltraMsg Webhook] Error:", err.message);
    // Still return 200 so UltraMsg doesn't keep retrying
    res.json({ success: true });
  }
});

export default router;
