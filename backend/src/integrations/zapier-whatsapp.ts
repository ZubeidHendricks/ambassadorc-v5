/**
 * Zapier WhatsApp Integration Service
 *
 * Sends WhatsApp messages via Zapier webhook triggers.
 * Each message template maps to a dedicated Zapier Zap webhook URL
 * stored in environment variables.
 *
 * Set the following env vars to activate each template:
 *   ZAPIER_WA_WEBHOOK_AMBASSADOR_INVITE
 *   ZAPIER_WA_WEBHOOK_REFERRALS_RECEIVED
 *   ZAPIER_WA_WEBHOOK_MEMBER_SIGNUP
 */

export type ZapierWaTemplate =
  | 'ambassador_invite'
  | 'referrals_received'
  | 'member_signup'

interface SendWhatsAppPayload {
  phone: string
  name?: string
  template: ZapierWaTemplate
}

interface ZapierWaResult {
  sent: boolean
  template: ZapierWaTemplate
  phone: string
  webhookConfigured: boolean
}

const WEBHOOK_ENV_MAP: Record<ZapierWaTemplate, string> = {
  ambassador_invite: 'ZAPIER_WA_WEBHOOK_AMBASSADOR_INVITE',
  referrals_received: 'ZAPIER_WA_WEBHOOK_REFERRALS_RECEIVED',
  member_signup: 'ZAPIER_WA_WEBHOOK_MEMBER_SIGNUP',
}

export const ZAPIER_WA_TEMPLATES: Array<{
  id: ZapierWaTemplate
  name: string
  description: string
  envVar: string
}> = [
  {
    id: 'ambassador_invite',
    name: 'Become an Ambassador',
    description: 'Marketing invite — Refer & Earn with link to lifesaverambassador.com',
    envVar: 'ZAPIER_WA_WEBHOOK_AMBASSADOR_INVITE',
  },
  {
    id: 'referrals_received',
    name: 'Referrals Received',
    description: 'Sent when a member submits 10 non-duplicate referrals',
    envVar: 'ZAPIER_WA_WEBHOOK_REFERRALS_RECEIVED',
  },
  {
    id: 'member_signup',
    name: 'Member Sign-Up Received',
    description: 'Sent when a member signup has been received and verified',
    envVar: 'ZAPIER_WA_WEBHOOK_MEMBER_SIGNUP',
  },
]

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) {
    return '27' + digits.slice(1)
  }
  if (digits.startsWith('27') && digits.length === 11) {
    return digits
  }
  return digits
}

export async function sendZapierWhatsApp(
  payload: SendWhatsAppPayload
): Promise<ZapierWaResult> {
  const envKey = WEBHOOK_ENV_MAP[payload.template]
  const webhookUrl = process.env[envKey]

  if (!webhookUrl) {
    return {
      sent: false,
      template: payload.template,
      phone: payload.phone,
      webhookConfigured: false,
    }
  }

  const phone = normalizePhone(payload.phone)

  const body = {
    phone,
    name: payload.name ?? '',
    template: payload.template,
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Zapier webhook returned HTTP ${res.status}`)
  }

  return {
    sent: true,
    template: payload.template,
    phone,
    webhookConfigured: true,
  }
}

export function getZapierWaStatus(): Array<{
  template: ZapierWaTemplate
  name: string
  configured: boolean
}> {
  return ZAPIER_WA_TEMPLATES.map((t) => ({
    template: t.id,
    name: t.name,
    configured: !!process.env[t.envVar],
  }))
}
