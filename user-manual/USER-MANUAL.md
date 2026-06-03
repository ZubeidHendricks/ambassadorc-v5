# AmbassadorC v5 — User Manual

*How the LifesaverCRM insurance management platform works*

Live system: **https://lifesavercrm.com**

---

## 1. What this system is

AmbassadorC v5 is a single platform that runs a South African insurance
operation end-to-end. It replaces three older systems (AMBASSADORC, FoxBilling
and the FoxPro DNN application) with one modern web app.

It covers the whole journey:

1. **Marketing & Ambassador app** — ambassadors are invited by WhatsApp, register,
   refer members, and earn rewards.
2. **Sales** — agents capture policy sales from leads.
3. **Quality Assurance (QA)** — sales are checked, repaired, or cancelled before
   they go live.
4. **Export & collections** — approved sales are exported nightly to Q-Link and
   Netcash for premium collection.
5. **Client & policy management** — the live book of clients, policies and
   commissions.
6. **Reporting & payments** — operations reports and the ambassador payment cycle.

Everyone signs into the same app; what they can see and do depends on their role
(ambassador, agent, or admin).

---

## 2. Signing in

![Login](./screenshots/01-login.png)

Users log in with their **mobile number** and **password**. After login the
system issues a secure token and sends each user to the area appropriate to their
role. Administrators land on the **Operations Center**.

---

## 3. Operations Center (admin home)

![Admin Dashboard](./screenshots/02-admin-dashboard.png)

The Operations Center is the admin's command centre. The top cards show live
totals for the whole book — total clients, active policies, monthly revenue,
pending QA items, active agents and commissions.

Below that, the work is organised into three columns that mirror the real
operational flow:

- **Marketing & Ambassador App** — ambassador invites, registration, referrals /
  member sign-ups, earnings rules, and the payment cycle.
- **Engagement, Onboarding & Collections** — sales capture, QA validation, and
  export / Q-Link outcomes.
- **Client Communications** — document delivery (welcome packs, policy docs) and
  SMS / bulk messaging.

Each card is a shortcut into the matching workspace. The left-hand menu gives
direct access to every section.

---

## 4. The ambassador journey (Marketing app)

### Ambassador dashboard
![Ambassador Dashboard](./screenshots/23-ambassador-dashboard.png)

Ambassadors get their own dashboard showing their activity and earnings. The flow
begins with a WhatsApp invite, then self-registration, then they start referring
people.

### Referrals
![Referrals](./screenshots/24-referrals.png)

Ambassadors submit referrals here. Each referral and member sign-up is tracked so
that earnings (e.g. R100 / R100 / R1000 incentives) can be calculated
automatically.

### Leaderboard
![Leaderboard](./screenshots/22-leaderboard.png)

The leaderboard ranks ambassadors to drive engagement and friendly competition.

### Leads (ambassador-submitted)
![Leads](./screenshots/25-leads.png)

Member leads captured through the ambassador journey feed into the operational
queue, ready for the sales team to action.

---

## 5. Sales

![Sales Pipeline](./screenshots/04-sales-pipeline.png)

The Sales workspace is where agents capture and track policy sales. It opens with
a worksheet-style dashboard (product spread across the Lifesaver products and an
active-agents table), then moves into the capture-and-track pipeline.

A sale moves through FoxPro-inspired stages:

`Sales Capture → In QA Validation → QA Passed → Exported Awaiting Outcome →
Q-Link Uploaded`, with `Repair` and `Client Cancelled` branches.

When capturing a sale, the agent records the client's surname, ID, address,
Persal/department details, first debit date and dependants. Submit-time checks
validate the data before it is handed to QA.

---

## 6. Quality Assurance (QA Mailbox)

![QA Mailbox](./screenshots/05-qa-mailbox.png)

The QA Mailbox mirrors the operations worksheet. Each row is a sale awaiting
review, with columns for Client ID, Client Name, Date of Sale, the verification
agent, and action buttons: **Submit**, **Repair**, and **Cancel**.

- **Submit** approves the sale and queues it for the midnight Netcash / Q-Link
  export.
- **Repair** sends it back for correction.
- **Cancel** stops the sale.

Approved outcomes are written back to the source system so both platforms stay in
sync, and every write-back (success or failure) is audited.

---

## 7. Export & collections

### Export / Q-Link status
![Export / Q-Link Status](./screenshots/10-export-status.png)

This page monitors what happened to exported sales. It lists each Lifesaver
product with premiums and counts, the **export return status**, returned reasons
(shown in red), and a **Switch to Debit Order** action for failed Persal
collections.

### Premium changes
![Premium Changes](./screenshots/09-premium-changes.png)

Admins manage product premium increases here — per product, with the current
premium, a new premium, and an effective date, then **Update**.

---

## 8. The live book: Clients, Policies, Commissions

### Clients
![Clients](./screenshots/03-clients.png)

The full client database, searchable by name, ID number or phone. Each row links
to a detailed client record showing their policies.

### Policies
![Policies](./screenshots/07-policies.png)

The policy register, including premium changes.

### Commissions
![Commissions](./screenshots/06-commissions.png)

Commission calculations and summaries for agents and ambassadors.

---

## 9. Agents & campaigns

![Agents](./screenshots/08-agents.png)

The call-centre control page. Admins add call-centre agents, record their login
setup date, mark who is active, review product / campaign assignments, and assign
registered agents to sales campaigns.

---

## 10. Lead handling & dialling

### Lead pipeline
![Lead Pipeline](./screenshots/20-lead-pipeline.png)

A pipeline view of leads as they move toward a sale.

### Dialler
![Dialler](./screenshots/21-dialler.png)

The dialler workspace drives outbound calling against the lead list and records
call outcomes.

---

## 11. Automation: AI Agents & Workflows

### AI Agents
![AI Agents](./screenshots/18-ai-agents.png)

Built-in automation agents handle repetitive work such as lead scoring, QA
checks, and SMS dispatch.

### Workflows
![Workflows](./screenshots/19-workflows.png)

A business-process engine that ties steps together into repeatable workflows.

---

## 12. Client communications

### Documents
![Documents](./screenshots/13-documents.png)

Welcome packs and policy documents, with delivery tracking.

### SMS
![SMS](./screenshots/14-sms.png)

Client messaging, payment notifications, and bulk SMS operations.

---

## 13. Configuration

### Products
![Products](./screenshots/15-products.png)

The product catalogue (the Lifesaver range).

### Integrations
![Integrations](./screenshots/16-integrations.png)

Adapters for third-party services: QLink, SagePay, NetCash, GuardRisk,
ViciDialer, and WhatsApp templates (Ambassador Invite, Referrals Received, Member
Sign-Up).

---

## 14. Ambassador payment cycle (Ambassador Backend)

![Ambassador Backend](./screenshots/12-ambassador-backend.png)

This mirrors the ambassador payout workbook. It shows, per ambassador, the date
submitted, name, referrals, confirmed numbers, member sign-ups, sales, value in
Rands, bonus and total for payment.

The cycle is: calculate what's due → generate payments → export an FNB CSV →
authorise → import the paid rows back → mark linked member-sign-up leads as paid →
notify ambassadors by SMS → update their dashboard. Each row shows **Paid** or
**Pending**.

---

## 15. Reporting

![Reports](./screenshots/11-reports.png)

Admins download workbook-style Excel reports:

- **Monthly Premium** — per product: premium, exported sales, debit-order and
  Persal collection results (successful / banked / failed / lost revenue), actual
  revenue, total banked and total lost.
- **Global Book** — Persal monthly summary across Jan–Dec, Q-Link totals,
  Netcash, total book & premiums, and average premiums.
- **Export Status** — the export/return picture for the period.

Reports accept a reporting year and optional month.

---

## 16. Data sync (admin / technical)

![Sync Dashboard](./screenshots/17-sync-dashboard.png)

The Sync Dashboard manages the ETL pipeline that replicates legacy FoxPro data
into the platform's staging tables. It shows live progress, a force-reset option,
job history, and a preview of any table's latest rows. This runs automatically on
a daily schedule and is mainly used by administrators.

---

## 17. Roles at a glance

| Role | Sees |
|------|------|
| **Ambassador** | Their dashboard, referrals, leads, leaderboard, profile, payments |
| **Agent** | Sales capture and the lead/dialler tools |
| **Admin** | Everything above plus the full Operations Center, QA, exports, clients, policies, commissions, reports, payments, configuration and sync |

---

## 18. Administrator access

The default administrator signs in with the admin mobile number and password held
by your operations lead. Treat these credentials as confidential and change the
password after first use.

---

*This manual was generated from the live production system. Screenshots are stored
alongside this document in `user-manual/screenshots/`.*
