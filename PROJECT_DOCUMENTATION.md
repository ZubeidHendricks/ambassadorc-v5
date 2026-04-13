# AmbassadorC v5 - Complete Project Documentation

## Project Overview

**AmbassadorC v5** is a unified modern platform that consolidates three legacy .NET systems into a single full-stack web application:

| Legacy System | Description | Status |
|---|---|---|
| **AMBASSADORC** (DNN/.NET) | Ambassador management portal, lead tracking, referrals | Replaced |
| **FoxBilling** (.NET) | Billing, debit orders, SagePay payments, QLink integration | Replaced |
| **FoxPro DNN** (.NET/FoxPro) | Sales processing, client management, SMS workflows | Replaced |

**Live URL:** http://142.93.44.48
**GitHub Repository:** https://github.com/ZubeidHendricks/ambassadorc-v5

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22.x | Runtime |
| Express.js | 4.21.2 | HTTP framework |
| TypeScript | 5.7.3 | Type safety |
| Prisma ORM | 6.4.0 | Database ORM & migrations |
| PostgreSQL | 16 | Database (DigitalOcean Managed) |
| JSON Web Tokens | 9.0.2 | Authentication |
| bcryptjs | 2.4.3 | Password hashing (cost factor 12) |
| Zod | 3.24.2 | Request validation |
| Helmet | 8.0.0 | Security headers |
| express-rate-limit | 7.5.0 | Rate limiting |
| tsx | 4.19.2 | TypeScript execution |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.0.0 | UI framework |
| React Router | 7.1.0 | Client-side routing |
| TypeScript | 5.7.3 | Type safety |
| Vite | 6.1.0 | Build tool & dev server |
| Tailwind CSS | 4.0.0 | Utility-first styling |
| Radix UI | Various | Accessible UI primitives (select, dialog, dropdown, tabs, toast, label) |
| Recharts | 2.15.0 | Dashboard charts & data visualization |
| Lucide React | 0.474.0 | Icon library |
| clsx + tailwind-merge | Latest | Conditional class utilities |

### Infrastructure
| Component | Provider | Details |
|---|---|---|
| Droplet (App Server) | DigitalOcean | s-2vcpu-2gb, Ubuntu 24.04, lon1 region |
| Managed Database | DigitalOcean | db-s-1vcpu-1gb, PostgreSQL 16, lon1 region |
| Reverse Proxy | Nginx | Serves frontend static + proxies /api to backend:3001 |
| Process Manager | systemd | Manages Node.js backend service |
| Runtime | tsx | Executes TypeScript directly (no build step) |

---

## Architecture

```
                    +------------------+
                    |   Client Browser |
                    +--------+---------+
                             |
                    +--------v---------+
                    |    Nginx :80      |
                    |  (Reverse Proxy)  |
                    +---+----------+---+
                        |          |
              +---------v--+  +----v--------+
              | Static     |  | /api/*      |
              | Frontend   |  | Proxy Pass  |
              | /dist      |  | :3001       |
              +------------+  +----+--------+
                                   |
                          +--------v--------+
                          | Express Backend |
                          | (tsx runtime)   |
                          +--------+--------+
                                   |
                          +--------v--------+
                          | PostgreSQL 16   |
                          | (DO Managed DB) |
                          | 34 tables       |
                          +-----------------+
```

### Backend Architecture (Express + Prisma)

```
backend/
  src/
    index.ts                  # Express server entry point (port 3001)
    seed.ts                   # Initial data seeding script
    lib/
      prisma.ts               # Prisma client singleton
      jwt.ts                  # JWT sign/verify helpers
      validators.ts           # Zod validation schemas
    middleware/
      auth.ts                 # JWT authentication middleware
    routes/
      auth.ts                 # POST /register, /login, GET /me
      dashboard.ts            # Dashboard stats & analytics
      ambassadors.ts          # Ambassador CRUD
      clients.ts              # Client management
      leads.ts                # Lead submission & tracking
      referrals.ts            # Referral management
      sales.ts                # Sales processing
      policies.ts             # Policy management
      products.ts             # Product catalog
      payments.ts             # Payment processing
      commissions.ts          # Commission calculations
      sms.ts                  # SMS messaging center
      documents.ts            # Document management
      qa.ts                   # Quality assurance checks
      workflows.ts            # Workflow engine routes
      integrations.ts         # Third-party integration config
      agents.ts               # AI agent orchestration
      admin.ts                # Admin-only operations
    agents/
      index.ts                # Agent registry & orchestrator
      commission-calculator.ts # Auto commission calculation
      debit-order-reconciler.ts # Debit order matching
      lead-scorer.ts          # AI lead scoring
      qa-auto-checker.ts      # Automated QA verification
      sms-dispatcher.ts       # Bulk SMS dispatch
      welcome-pack-sender.ts  # Welcome pack automation
    integrations/
      index.ts                # Integration registry
      guardrisk.ts            # GuardRisk underwriting API
      netcash.ts              # NetCash payment gateway
      qlink.ts                # QLink government deductions
      sagepay.ts              # SagePay payment processing
      sms-portal.ts           # SMS Portal bulk messaging
      vicidialer.ts           # ViciDialer call center
      wati.ts                 # WATI WhatsApp integration
    workflows/
      engine.ts               # Workflow execution engine
      templates.ts            # Predefined workflow templates
  prisma/
    schema.prisma             # Database schema (858 lines, 33 models)
```

### Frontend Architecture (React 19 + Vite)

```
frontend/
  src/
    main.tsx                  # App entry point
    App.tsx                   # Router & route definitions
    context/
      AuthContext.tsx          # Authentication state management
    lib/
      api.ts                  # Axios API client with JWT interceptor
      utils.ts                # Utility functions (cn, formatCurrency, etc.)
    components/
      ProtectedRoute.tsx      # Auth guard for ambassador routes
      AdminRoute.tsx          # Auth guard for admin routes
      layout/
        Layout.tsx            # Main app layout (sidebar + content)
        Header.tsx            # Top navigation bar
      ui/
        badge.tsx             # Status badge component
        button.tsx            # Button variants
        card.tsx              # Card container
        data-table.tsx        # Sortable, searchable, paginated table
        input.tsx             # Form input
        label.tsx             # Form label
        modal.tsx             # Dialog modal
        select.tsx            # Dropdown select
        stat-card.tsx         # Dashboard statistic card
        status-badge.tsx      # Colored status indicator
        toast.tsx             # Toast notification system
    pages/
      Landing.tsx             # Public landing page
      Login.tsx               # Ambassador login (mobile + password)
      Register.tsx            # Ambassador registration
      Dashboard.tsx           # Ambassador dashboard
      Profile.tsx             # Ambassador profile management
      SubmitLead.tsx          # Lead submission form
      LeadHistory.tsx         # Lead tracking history
      SubmitReferrals.tsx     # Referral submission
      ReferralHistory.tsx     # Referral tracking
      admin/
        AdminDashboard.tsx    # Admin overview with charts
        Agents.tsx            # Ambassador/agent management
        AiAgents.tsx          # AI agent monitoring & control
        Clients.tsx           # Client listing & search
        ClientDetail.tsx      # Individual client view
        Commissions.tsx       # Commission reports
        Documents.tsx         # Document management
        Integrations.tsx      # Integration configuration panel
        Policies.tsx          # Policy management
        PremiumChanges.tsx    # Premium adjustment tracking
        Products.tsx          # Product catalog management
        QualityAssurance.tsx  # QA check dashboard
        Sales.tsx             # Sales pipeline
        SmsCenter.tsx         # SMS messaging dashboard
        Workflows.tsx         # Workflow listing
        WorkflowDetail.tsx    # Workflow step editor
        WorkflowInstance.tsx  # Running workflow instance view
```

---

## Database Schema

### 34 Tables (33 Prisma Models + _prisma_migrations)

#### Core Business Entities
| Table | Description | Key Fields |
|---|---|---|
| `ambassadors` | Ambassador/agent/admin users | firstName, lastName, mobileNo, passwordHash, province, department, role |
| `clients` | Insurance clients (from legacy IDNumber records) | firstName, lastName, idNumber, cellphone, address fields |
| `products` | Insurance products (Life Cover, Legal, SOS, etc.) | name, type, premiumAmount, description |
| `premium_tiers` | Product premium tier definitions | productId, tierName, premiumAmount, coverAmount |
| `policies` | Client insurance policies | clientId, productId, policyNumber, status, premiumAmount |
| `sales` | Sales records linking ambassador to client+policy | ambassadorId, clientId, policyId, status, commissionAmount |
| `sales_campaigns` | Marketing campaigns | name, code, startDate, endDate |

#### Leads & Referrals
| Table | Description |
|---|---|
| `leads` | Ambassador-submitted leads (firstName, lastName, contactNo, status) |
| `referrals` | Client referrals |
| `referral_batches` | Batch referral uploads |

#### Financial
| Table | Description |
|---|---|
| `debit_orders` | Bank debit order records (clientId, bankName, accountNumber, branchCode) |
| `payments` | Payment records |
| `commissions` | Ambassador commission calculations |
| `sagepay_transactions` | SagePay payment gateway transactions |
| `premium_changes` | Premium adjustment history |
| `premium_updates` | Legacy premium update records |

#### Communications
| Table | Description |
|---|---|
| `sms_messages` | Individual SMS records (recipient, body, status, type) |
| `sms_batches` | Bulk SMS batch tracking |
| `callback_requests` | Client callback requests |

#### Operations
| Table | Description |
|---|---|
| `welcome_packs` | Welcome pack dispatch records |
| `welcome_pack_logs` | Welcome pack processing logs |
| `quality_checks` | QA verification records |
| `document_views` | Client document viewing audit trail |
| `e_signatures` | Electronic signature records |
| `qlink_batches` | QLink batch submission history |
| `number_change_requests` | Ambassador phone number change requests |

#### System
| Table | Description |
|---|---|
| `audit_logs` | System-wide audit trail (userId, action, entity, entityId, details JSONB) |
| `workflows` | Workflow definitions |
| `workflow_steps` | Individual steps within workflows |
| `workflow_instances` | Running workflow instances |
| `workflow_step_instances` | Individual step execution records |
| `integration_configs` | Third-party integration credentials & settings |
| `file_exports` | Generated file export records |

### Enum Types
| Enum | Values |
|---|---|
| Province | EASTERN_CAPE, FREE_STATE, GAUTENG, KWAZULU_NATAL, LIMPOPO, MPUMALANGA, NORTH_WEST, NORTHERN_CAPE, WESTERN_CAPE |
| AmbassadorRole | AMBASSADOR, AGENT, ADMIN, QA_OFFICER |
| ProductType | LIFE_COVER, LEGAL, SOS, FIVE_IN_ONE, SHORT_TERM, CONSULT |
| PolicyStatus | ACTIVE, LAPSED, CANCELLED, PENDING |
| SaleStatus | NEW, QA_PENDING, QA_APPROVED, QA_REJECTED, ACTIVE, CANCELLED |
| LeadStatus | NEW, CONTACTED, PAID, CLOSED |
| ReferralStatus | PENDING, CONTACTED, CONVERTED, INVALID |
| NumberChangeStatus | PENDING, APPROVED, REJECTED |
| PaymentMethod | DEBIT_ORDER, SAGEPAY, CASH, EFT |
| PaymentStatus | PENDING, SUCCESSFUL, FAILED, REVERSED |
| DebitOrderStatus | ACTIVE, PAUSED, CANCELLED, FAILED |
| SmsStatus | QUEUED, SENT, DELIVERED, FAILED |
| SmsType | WELCOME, QA_VERIFY, PREMIUM_INCREASE, CALLBACK, AMBASSADOR, AGENT_CAPTURE |
| BatchStatus | PENDING, PROCESSING, COMPLETED, FAILED |
| WorkflowStatus | DRAFT, ACTIVE, PAUSED, COMPLETED |
| StepStatus | PENDING, IN_PROGRESS, COMPLETED, FAILED, SKIPPED |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/auth/register | Register new ambassador | Public |
| POST | /api/auth/login | Login with mobile + password | Public |
| GET | /api/auth/me | Get current user profile | JWT |

### Ambassador Portal
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/dashboard/stats | Dashboard statistics |
| GET/PUT | /api/ambassadors/profile | Profile management |
| POST | /api/leads | Submit new lead |
| GET | /api/leads | Lead history |
| POST | /api/referrals | Submit referral |
| GET | /api/referrals | Referral history |

### Admin Panel
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/admin/stats | Admin dashboard stats |
| GET/POST | /api/clients | Client management |
| GET | /api/clients/:id | Client detail |
| GET/POST | /api/products | Product management |
| GET/POST | /api/policies | Policy management |
| GET/POST | /api/sales | Sales pipeline |
| GET | /api/commissions | Commission reports |
| GET/POST | /api/payments | Payment management |
| GET/POST | /api/sms | SMS center |
| GET/POST | /api/qa | Quality assurance |
| GET/POST | /api/workflows | Workflow management |
| GET/POST | /api/integrations | Integration configuration |
| GET/POST | /api/agents | AI agent management |
| GET | /api/documents | Document management |

---

## Integrated Services

The platform includes pre-built integration adapters for:

| Service | File | Purpose |
|---|---|---|
| **QLink** | `integrations/qlink.ts` | Government payroll deductions for public sector clients |
| **SagePay** | `integrations/sagepay.ts` | Online payment gateway for card payments |
| **NetCash** | `integrations/netcash.ts` | Debit order collection & bank payment processing |
| **GuardRisk** | `integrations/guardrisk.ts` | Insurance underwriting & risk assessment |
| **SMS Portal** | `integrations/sms-portal.ts` | Bulk SMS messaging service |
| **WATI** | `integrations/wati.ts` | WhatsApp Business API for client communication |
| **ViciDialer** | `integrations/vicidialer.ts` | Call center integration for outbound campaigns |

---

## AI Agents (Workflow Automation)

Built-in AI agents that automate key business processes:

| Agent | File | Function |
|---|---|---|
| **Commission Calculator** | `agents/commission-calculator.ts` | Automatically calculates ambassador commissions based on sales & tiers |
| **Debit Order Reconciler** | `agents/debit-order-reconciler.ts` | Matches bank statements to expected debit order collections |
| **Lead Scorer** | `agents/lead-scorer.ts` | Scores and prioritizes leads based on conversion likelihood |
| **QA Auto-Checker** | `agents/qa-auto-checker.ts` | Automated quality verification of new sales |
| **SMS Dispatcher** | `agents/sms-dispatcher.ts` | Intelligent bulk SMS routing and dispatch |
| **Welcome Pack Sender** | `agents/welcome-pack-sender.ts` | Automates welcome pack generation and delivery |

---

## Workflow Engine

A configurable workflow engine (`workflows/engine.ts`) supports multi-step business processes:

- **Step Types:** API_CALL, VALIDATION, NOTIFICATION, APPROVAL, DATA_TRANSFORM
- **Features:** Sequential execution, error handling, context passing between steps, instance tracking
- **Pre-built Templates:** New sale onboarding, premium increase processing, client verification

---

## Historical Data Migration

### Source Data
- **283 CSV files** exported from legacy SQL Server databases (~390MB total)
- Covering operational data from 2013 to present

### Migration Summary

| Source CSV | Target Table | Records Imported |
|---|---|---|
| SalesHistory_FULL.csv | audit_logs | 501,430 |
| SagePayTransactions_FULL.csv | sagepay_transactions | 353,270 |
| Reference_FULL.csv | debit_orders | 101,466 |
| SalesData_FULL.csv | clients | 85,766 |
| WelcomePackHistory.csv | welcome_pack_logs | 19,847 |
| SalesTransactions.csv | audit_logs | 17,757 |
| PremiumUpdatesSMS.csv + AmbassadorSMSDelivery.csv | sms_messages | 19,282 |
| PremiumUpdates.csv | premium_updates | 14,491 |
| EventLog.csv | audit_logs (capped 10K) | 8,254 |
| QLinkBatchHistory.csv | qlink_batches | 1,885 |
| am_amleads.csv | leads | 110 |
| am_numberchange.csv | number_change_requests | 14 |
| **TOTAL** | | **~1,123,572** |

### Seeded Reference Data
| Table | Records | Description |
|---|---|---|
| ambassadors | 40 | Ambassador/agent accounts with hashed passwords |
| products | 9 | Insurance product catalog |
| sales_campaigns | 4 | Marketing campaigns |
| workflows | 5 | Pre-configured workflow templates |
| workflow_steps | 28 | Workflow step definitions |
| integration_configs | 7 | Third-party service configurations |

### Migration Scripts
- `seed-all.js` - Main bulk import script (12 data sources, batched SQL INSERTs via psql)
- `debit-import.js` - Separate debit order import (requires FK lookup by client idNumber)
- `backend/src/seed.ts` - Prisma-based initial reference data seeding

---

## Deployment Details

### Infrastructure
| Resource | Specification |
|---|---|
| **App Server** | DigitalOcean Droplet, s-2vcpu-2gb, Ubuntu 24.04, London (lon1) |
| **Database** | DigitalOcean Managed PostgreSQL 16, db-s-1vcpu-1gb, London (lon1) |
| **IP Address** | 142.93.44.48 |
| **SSH Access** | Key-based authentication |

### Server Configuration

**Nginx** (`/etc/nginx/sites-available/ambassadorc`):
- Serves frontend static files from `/opt/ambassadorc-v5/frontend/dist/`
- Proxies `/api/*` requests to `http://localhost:3001`
- SPA fallback: all non-file routes serve `index.html`

**systemd** (`/etc/systemd/system/ambassadorc.service`):
- Runs `npx tsx src/index.ts` as the backend process
- Auto-restarts on failure
- Environment: production, DATABASE_URL, JWT_SECRET

### Deployment Process
1. Code pushed to GitHub repository
2. SSH into droplet and pull latest code
3. `npm install` in both backend/ and frontend/
4. `npx prisma db push` to sync schema changes
5. `npm run build` in frontend/ to rebuild static assets
6. `systemctl restart ambassadorc` to restart backend

---

## User Access

### Admin Account
| Field | Value |
|---|---|
| Mobile Number | 0800000000 |
| Password | Admin123! |
| Role | ADMIN |

### Ambassador Portal
- Self-registration via `/register` with mobile number, name, province, department
- Login via mobile number + password
- JWT-based session (token stored in localStorage)

### Admin Panel
- Accessible at `/admin` routes
- Role-restricted (AmbassadorRole = ADMIN only)
- Full access to all management features

---

## Security Features

| Feature | Implementation |
|---|---|
| Password Hashing | bcryptjs with cost factor 12 |
| Authentication | JWT tokens (jsonwebtoken) |
| Input Validation | Zod schemas on all endpoints |
| Security Headers | Helmet middleware |
| Rate Limiting | express-rate-limit on auth endpoints |
| CORS | Configured via cors middleware |
| SQL Injection Prevention | Prisma ORM parameterized queries |
| SSL/TLS to Database | `sslmode=require` on PostgreSQL connection |

---

## Frontend Features

### Ambassador Portal
- **Dashboard** - Personal stats, recent activity, performance metrics
- **Lead Submission** - Form to submit new leads with contact details
- **Lead History** - Track submitted leads and their status progression
- **Referral Submission** - Submit client referrals
- **Referral History** - Track referral status and conversions
- **Profile Management** - Update personal details, province, department

### Admin Panel
- **Admin Dashboard** - System-wide analytics with charts (Recharts)
- **Ambassador Management** - View, search, activate/deactivate ambassadors
- **Client Management** - Search 85K+ clients, view detail pages
- **Product Catalog** - Manage insurance products and premium tiers
- **Policy Management** - Track all active/lapsed/cancelled policies
- **Sales Pipeline** - Sales tracking from submission through QA to activation
- **Commission Reports** - Ambassador commission calculations and payouts
- **SMS Center** - Send SMS, view delivery history (19K+ messages)
- **Quality Assurance** - QA check workflow for new sales
- **Workflow Management** - Configure and monitor automated workflows
- **Integration Panel** - Configure third-party service credentials
- **AI Agent Monitoring** - View and control automated agent processes
- **Document Management** - Client document tracking and e-signatures

### UI Components
- **DataTable** - Generic sortable, searchable, paginated table component
- **StatCard** - Dashboard metric display cards
- **StatusBadge** - Color-coded status indicators
- **Modal** - Radix Dialog-based modal system
- **Toast** - Notification toast system
- **Select** - Accessible dropdown select (Radix)

---

## Files Summary

| Category | Count |
|---|---|
| Backend TypeScript files | 41 |
| Frontend TypeScript/TSX files | 47 |
| Prisma schema | 1 (858 lines) |
| Total source files | 89 |
| Database tables | 34 |
| Database enum types | 16 |
| API route files | 18 |
| Integration adapters | 8 |
| AI agents | 7 |

---

## Legacy System Mapping

### AMBASSADORC (DNN Portal) -> ambassadorc-v5
| Legacy Feature | New Implementation |
|---|---|
| Ambassador registration & login | `/register`, `/login` with JWT auth |
| Lead submission forms | `/submit-lead` React page |
| Referral tracking | `/referrals` with status workflow |
| Ambassador tier system | `premium_tiers` table + commission calculation |
| Number change requests | `number_change_requests` table + approval workflow |
| SMS notifications | `sms_messages` table + SMS Portal integration |

### FoxBilling -> ambassadorc-v5
| Legacy Feature | New Implementation |
|---|---|
| SagePay payment processing | `sagepay_transactions` + SagePay integration adapter |
| Debit order management | `debit_orders` + NetCash integration |
| QLink batch submissions | `qlink_batches` + QLink integration adapter |
| Premium updates | `premium_updates` + `premium_changes` tables |
| Welcome pack dispatch | `welcome_pack_logs` + welcome-pack-sender agent |
| Billing reconciliation | debit-order-reconciler AI agent |

### FoxPro DNN -> ambassadorc-v5
| Legacy Feature | New Implementation |
|---|---|
| Client records (103K) | `clients` table (85K+ deduplicated by IDNumber) |
| Sales history (502K) | `audit_logs` table with JSONB details |
| Sales transactions | `audit_logs` with SALES_TRANSACTION action |
| Event logging | `audit_logs` with DNN_EVENT entity type |
| Reference/bank data (136K) | `debit_orders` table (101K+ linked to clients) |
| Report generation | Admin dashboard + Recharts analytics |

---

## What Was Built

1. **Full-stack TypeScript application** - 89 source files, React 19 + Express + Prisma
2. **34-table PostgreSQL database** with 16 enum types and comprehensive indexing
3. **18 API route modules** covering all business operations
4. **8 third-party integration adapters** (QLink, SagePay, NetCash, GuardRisk, SMS Portal, WATI, ViciDialer)
5. **7 AI automation agents** for commission calculation, reconciliation, QA, SMS, lead scoring, welcome packs
6. **Configurable workflow engine** with multi-step process support
7. **Complete admin panel** with 17 management screens
8. **Ambassador portal** with dashboard, lead/referral submission, profile management
9. **Historical data migration** - 1.1M+ records imported from legacy CSV exports
10. **Production deployment** on DigitalOcean with managed PostgreSQL, Nginx, and systemd
