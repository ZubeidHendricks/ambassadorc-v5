# AmbassadorC v5 - Insurance Management Platform

A unified modern platform that consolidates three legacy .NET systems (AMBASSADORC, FoxBilling, FoxPro DNN) into a single full-stack web application for South African insurance operations.

**Live:** http://142.93.44.48

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, Recharts |
| Backend | Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 (DigitalOcean Managed) |
| Auth | JWT + bcrypt |
| Infrastructure | DigitalOcean Droplet, Nginx, systemd |
| AI Agents | Lead Scorer, Auto QA, SMS Dispatcher, Commission Calculator, Payment Reconciler, Welcome Pack Sender |
| Integrations | QLink, SagePay, NetCash, GuardRisk, ViciDialer, WATI (WhatsApp), SMS Portal |

## Architecture

```
Client Browser
      |
  Nginx :80
   /      \
Static    /api/* → Express :3001 → PostgreSQL 16
/dist               (34 tables, 33 Prisma models)
```

## Quick Start

### Docker Compose

```bash
docker-compose up --build
```

### Manual Setup

**Prerequisites**: Node.js 22+, PostgreSQL 16+

```bash
# Backend
cd backend
npm install
cp .env.example .env   # Edit DATABASE_URL
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Project Structure

```
ambassadorc-v5/
├── backend/
│   ├── prisma/schema.prisma          # 33 models, 34 tables
│   └── src/
│       ├── index.ts                  # Express entry + middleware
│       ├── routes/                   # 17 route modules
│       │   ├── auth.ts               # Register, login, me
│       │   ├── admin.ts              # Stats, agents, audit log
│       │   ├── clients.ts            # Client CRUD
│       │   ├── sales.ts              # Sales processing
│       │   ├── policies.ts           # Policy lifecycle
│       │   ├── products.ts           # Product catalog
│       │   ├── commissions.ts        # Commission management
│       │   ├── qa.ts                 # Quality assurance
│       │   ├── sms.ts               # SMS center
│       │   ├── documents.ts          # Welcome packs
│       │   ├── workflows.ts          # Workflow engine
│       │   ├── integrations.ts       # Third-party config
│       │   ├── agents.ts             # AI agent orchestration
│       │   ├── payments.ts           # Debit orders & billing
│       │   ├── referrals.ts          # Referral batches
│       │   ├── leads.ts              # Lead management
│       │   ├── dashboard.ts          # Ambassador dashboard
│       │   └── ambassadors.ts        # Ambassador profiles
│       ├── agents/                   # 6 AI automation agents
│       ├── integrations/             # 7 third-party connectors
│       └── workflows/                # Workflow engine + templates
├── frontend/
│   └── src/
│       ├── lib/api.ts                # API client (all endpoints)
│       ├── context/AuthContext.tsx    # JWT auth state
│       ├── components/
│       │   ├── ui/                   # Reusable UI components
│       │   └── layout/               # Sidebar, Header, Layout
│       └── pages/
│           ├── Landing.tsx           # Public landing page
│           ├── Login.tsx             # Authentication
│           ├── Register.tsx          # Ambassador registration
│           ├── Dashboard.tsx         # Ambassador dashboard
│           ├── Leaderboard.tsx       # Ambassador rankings
│           ├── SubmitReferrals.tsx   # Referral submission
│           ├── SubmitLead.tsx        # Lead submission
│           └── admin/               # 14 admin pages
│               ├── AdminDashboard.tsx
│               ├── Clients.tsx
│               ├── Sales.tsx
│               ├── Policies.tsx
│               ├── Products.tsx
│               ├── Commissions.tsx
│               ├── QualityAssurance.tsx
│               ├── Agents.tsx
│               ├── AiAgents.tsx
│               ├── Workflows.tsx
│               ├── Documents.tsx
│               ├── SmsCenter.tsx
│               ├── PremiumChanges.tsx
│               └── Integrations.tsx
└── e2e-test.ts                       # Playwright E2E tests
```

## API Routes

All routes prefixed with `/api/`.

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register ambassador |
| POST | /auth/login | Login (mobile + password) |

### Authenticated
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /auth/me | Current user profile |
| GET | /dashboard/stats | Ambassador dashboard stats |
| POST | /referrals/batch | Submit referral batch (1-10) |
| GET | /referrals/batches | List referral batches |
| POST | /leads | Submit a lead |
| GET | /leads | List leads |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/stats | Platform-wide statistics |
| GET | /admin/agents | List all ambassadors/agents |
| GET | /admin/audit-log | Audit trail |
| GET | /clients | Client management |
| GET | /sales | Sales pipeline |
| GET | /policies | Policy lifecycle |
| GET | /products | Product catalog |
| GET | /commissions | Commission tracking |
| GET | /qa | Quality assurance queue |
| GET | /sms | SMS history |
| GET | /workflows | Workflow definitions |
| GET | /workflows/instances | Running workflow instances |
| GET | /agents | AI agent statuses |
| GET | /integrations | Third-party integration config |
| GET | /policies/premium-changes | Premium change requests |
| GET | /payments/debit-orders | Debit order management |

## Design System

D8tavision brand applied:

| Token | Value |
|-------|-------|
| Primary | `#004D99` |
| Primary Light | `#0AB3CC` |
| Primary Dark | `#1A2C6B` |
| Sidebar | `#0D1117` |
| Font | Google Sans / Inter / JetBrains Mono |
| Border Radius | 0.3rem (tight) |

## E2E Testing

```bash
cd frontend
npx tsx e2e-test.ts
```

Tests all 23 pages via Playwright - login, navigation, API connectivity, error boundaries, and blank page detection.

**Latest results: 20 PASS, 3 WARN, 0 FAIL**

## Legacy Systems Replaced

| Legacy System | Technology | What it did |
|---|---|---|
| AMBASSADORC | DNN/.NET | Ambassador portal, leads, referrals |
| FoxBilling | .NET | Billing, debit orders, SagePay, QLink |
| FoxPro DNN | .NET/FoxPro | Sales, clients, SMS workflows |

## Security

- Prisma ORM (parameterized queries, no SQL injection)
- bcrypt password hashing (cost factor 12)
- JWT authentication with configurable expiry
- Rate limiting (1000 general / 200 auth per 15 min)
- Helmet security headers
- CORS whitelist
- Zod input validation
