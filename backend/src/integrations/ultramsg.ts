/**
 * UltraMsg WhatsApp Integration
 *
 * Sends WhatsApp messages via UltraMsg (https://ultramsg.com).
 * UltraMsg connects via WhatsApp Web — no Meta template approval required.
 * A regular WhatsApp number is linked once via QR code in the UltraMsg dashboard.
 *
 * Required environment variables:
 *   ULTRAMSG_INSTANCE_ID  — from UltraMsg dashboard (e.g. "instance12345")
 *   ULTRAMSG_TOKEN        — from UltraMsg dashboard settings
 *
 * Optional per-template customisation:
 *   LIFESAVER_AMBASSADOR_URL  — ambassador registration link (default: http://lifesaverambassador.com/)
 *   LIFESAVER_AMBASSADOR_LOGIN_URL — ambassador login link
 */

export type UltraMsgTemplate =
  | 'ambassador_invite'
  | 'referrals_received'
  | 'member_signup'

export interface UltraMsgTemplateInfo {
  id: UltraMsgTemplate
  name: string
  description: string
  trigger: string
}

export const ULTRAMSG_TEMPLATES: UltraMsgTemplateInfo[] = [
  {
    id: 'ambassador_invite',
    name: 'Become an Ambassador',
    description: 'Invite someone to join the Lifesaver Refer & Earn program',
    trigger: 'Send to invite a government employee to become an ambassador',
  },
  {
    id: 'referrals_received',
    name: 'Referrals Received',
    description: 'Confirmation when 10 non-duplicate referrals are submitted',
    trigger: 'Send when an ambassador submits 10 qualifying referrals',
  },
  {
    id: 'member_signup',
    name: 'Member Sign-Up Received',
    description: 'Confirmation that a member signup has been received for compliance processing',
    trigger: 'Send when a verified member signup is received',
  },
]

// ── Message builders ─────────────────────────────────────────────────────────

function buildAmbassadorInvite(name?: string): string {
  const registerUrl =
    process.env.LIFESAVER_AMBASSADOR_URL ?? 'http://lifesaverambassador.com/'
  const greeting = name ? `Hi ${name},\n\n` : ''
  return `${greeting}*LIFESAVER — (Refer & Earn) Ambassador Program* 🎉

Become a Lifesaver Ambassador today and earn extra money by referring fellow government employees.

OR simply complete the member signup for interested Government Employees and Submit. We will do the rest.

*Two Exciting Earning Opportunities:*
1️⃣ *EARN R1 000* — R100 per successful signup. A bonus R1 000 for every 10 successful membership signups you do in a calendar month. You Earn R2 000.
2️⃣ *EARN R100* — For every 10 Government employees/colleagues that you refer.

👉 Click here to Register: ${registerUrl}`
}

function buildReferralsReceived(name?: string): string {
  const loginUrl =
    process.env.LIFESAVER_AMBASSADOR_LOGIN_URL ?? 'http://lifesaverambassador.com/login'
  const greeting = name ? `Hi ${name},\n\n` : ''
  return `${greeting}*LIFESAVER — Congratulations! Referrals Received* ✅

We have received your 10 Referrals.
Check your SMS's for confirmation of your CASH SEND — this will occur in the next 24 HRS.
Payment made Mon–Fri.

*Earning Opportunities Reminder:*
1️⃣ *EARN R1 000* — R100 per successful signup. A bonus R1 000 for every 10 successful membership signups you do in a calendar month. You Earn R2 000.
2️⃣ *EARN R100* — For every 10 Government employees/colleagues that you refer.

👉 Ambassador Login: ${loginUrl}`
}

function buildMemberSignup(name?: string): string {
  const loginUrl =
    process.env.LIFESAVER_AMBASSADOR_LOGIN_URL ?? 'http://lifesaverambassador.com/login'
  const greeting = name ? `Hi ${name},\n\n` : ''
  return `${greeting}*LIFESAVER — Congratulations! Member Sign-Up Received* ✅

We have received your member signup.
Once we have successfully completed the compliance procedure and verified the sale with the client, payment will be made.

Check your SMS's for confirmation of your CASH SEND — this will occur in the next 24 HRS.
Payment made Mon–Fri.

*Earning Opportunities Reminder:*
1️⃣ *EARN R1 000* — R100 per successful signup. A bonus R1 000 for every 10 successful membership signups you do in a calendar month. You Earn R2 000.
2️⃣ *EARN R100* — For every 10 Government employees/colleagues that you refer.

👉 Ambassador Login: ${loginUrl}`
}

export function buildTemplateBody(
  template: UltraMsgTemplate,
  name?: string
): string {
  switch (template) {
    case 'ambassador_invite':
      return buildAmbassadorInvite(name)
    case 'referrals_received':
      return buildReferralsReceived(name)
    case 'member_signup':
      return buildMemberSignup(name)
  }
}

// ── Phone normalisation ──────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // 0xx SA numbers → 27xx
  if (digits.startsWith('0') && digits.length === 10) {
    return '27' + digits.slice(1)
  }
  // Already international
  if (digits.startsWith('27') && digits.length === 11) return digits
  return digits
}

// ── Send ─────────────────────────────────────────────────────────────────────

export interface UltraMsgSendResult {
  sent: boolean
  phone: string
  template: UltraMsgTemplate
  configured: boolean
  error?: string
}

export async function sendUltraMsgWhatsApp(
  phone: string,
  template: UltraMsgTemplate,
  name?: string
): Promise<UltraMsgSendResult> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID
  const token = process.env.ULTRAMSG_TOKEN

  if (!instanceId || !token) {
    return {
      sent: false,
      phone,
      template,
      configured: false,
      error: 'ULTRAMSG_INSTANCE_ID and ULTRAMSG_TOKEN environment variables are not set',
    }
  }

  const to = normalizePhone(phone)
  const body = buildTemplateBody(template, name)

  const url = `https://api.ultramsg.com/${instanceId}/messages/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, to, body }).toString(),
  })

  const data: any = await res.json().catch(() => ({}))

  if (!res.ok || data?.sent === 'false' || data?.error) {
    throw new Error(
      data?.error ?? `UltraMsg returned HTTP ${res.status}`
    )
  }

  return { sent: true, phone: to, template, configured: true }
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getUltraMsgStatus(): {
  configured: boolean
  instanceId: string | null
} {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID
  const token = process.env.ULTRAMSG_TOKEN
  return {
    configured: !!(instanceId && token),
    instanceId: instanceId ?? null,
  }
}
