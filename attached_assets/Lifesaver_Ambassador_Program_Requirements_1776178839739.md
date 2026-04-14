# Lifesaver Ambassador Program — Requirements & Specifications

**From:** Ian Friederang  
**To:** Zubeid Hendricks  
**Date:** 14 April 2026  
**Project:** Lifesaver Ambassador App (lifesaverambassador.life)

---

## Overview

The Ambassador Program allows registered Ambassadors to earn income by submitting referral leads and member sign-ups targeting government employees. Each Ambassador has a profile dashboard showing their activity, earnings, and payment transparency.

---

## Ambassador Dashboard

Each registered Ambassador can view under their profile:

- **Referral activity** — leads submitted
- **Member sign-up activity** — pre-qualified leads submitted
- **Payment records** — transparent view of all earnings and payouts

---

## Payment Model

### 1. Referral Leads (Simple)

| Detail | Value |
|--------|-------|
| Action | Ambassador submits unique leads |
| Threshold | 10 unique leads per batch |
| Payout | R100 per batch of 10 |
| Condition | Paid regardless of sales outcome |

### 2. Member Sign-Ups (Performance-Based)

| Detail | Value |
|--------|-------|
| Action | Ambassador submits pre-qualified member sign-ups |
| Payout | R100 per successful conversion |
| Condition | Lead must translate into a confirmed sale |
| Qualification | Ambassador must have already established interest and intent from the government employee |

**Key distinction:** A "member sign-up" is a pre-qualified sale — the Ambassador has already confirmed the government employee's interest before submission.

---

## Backend / Technical Requirements

### Data & Reporting

- Database table running behind the program must track all Ambassador activity
- System must generate an **Excel report** exportable from the database
- Report must contain payment details per Ambassador for bulk processing

### Payment Processing

- Excel report is uploaded to **FNB Enterprise account**
- FNB initiates **Cash Send** payments to Ambassadors based on the report
- Payment data must be tagged and traceable back to activity type (referral vs member sign-up)

### Data Tagging

- Member sign-up leads must be **tagged as "member-signups"** in the database
- Sales data must be pullable filtered by this tag to determine which sign-ups converted
- Referral leads tracked separately with batch counting (per 10)

---

## Data Flow

```
Ambassador submits lead (Referral or Member Sign-Up)
        ↓
Lead stored in database with type tag
        ↓
Dashboard updates Ambassador's activity view
        ↓
For Referrals: Batch counter increments → R100 triggered at 10
For Sign-Ups: Linked to sales pipeline → R100 on conversion
        ↓
Admin generates Excel report from database
        ↓
Report uploaded to FNB Enterprise → Cash Send payments
        ↓
Ambassador sees payment in their dashboard
```

---

## Attachments from Ian

- **AMBASSADOR ACTIVITY AND EARNINGS DASHBOARD.xlsx** — Sample dashboard layout showing what Ambassadors see under their profile (referral and sign-up activity with earnings)
- **image001.jpg** — Visual representation of the dashboard

---

## Open Items / To Discuss (Meeting 15 April)

- [ ] Dashboard design and UX for Ambassador profile
- [ ] Registration flow for new Ambassadors
- [ ] Lead submission form fields (what data is captured per referral / sign-up)
- [ ] Sales pipeline integration — how do we track member sign-up conversions?
- [ ] FNB Enterprise report format requirements
- [ ] Cash Send API or manual upload process?
- [ ] Ambassador tiers or incentive scaling (future feature?)
- [ ] Admin panel for Lifesaver team to manage Ambassadors
- [ ] Foxpro database status — system has been down since 11 April
- [ ] Legal application to business — setup and next steps
- [ ] Payment arrangements with Zubeid

---

*Document prepared by Claude for Zubeid Hendricks — Prickly Pair Studios*
