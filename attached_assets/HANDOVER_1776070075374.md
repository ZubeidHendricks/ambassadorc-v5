# AmbassadorC v5 - Replit Handover Document

## What This System Is

AmbassadorC v5 is a **unified insurance management platform** built for South African insurance operations. It replaces three legacy .NET systems:

| Legacy System | What It Did | Now Handled By |
|---|---|---|
| **AMBASSADORC** (DNN/.NET) | Ambassador portal - referrals, leads, commissions | `frontend/src/pages/` + `backend/src/routes/referrals.ts`, `leads.ts`, `commissions.ts` |
| **FoxBilling** (.NET) | Billing, debit orders, SagePay/QLink/NetCash payments | `backend/src/routes/payments.ts` + `backend/src/integrations/` |
| **FoxPro DNN** (.NET/FoxPro) | Sales processing, client management, SMS, documents | `backend/src/routes/sales.ts`, `clients.ts`, `sms.ts`, `documents.ts` |

### What The Code Does

**For Ambassadors (government employees):**
- Register, log in, submit referrals and leads
- Track earnings and commissions on a dashboard
- Compete on a leaderboard with tier progression (Bronze/Silver/Gold/Platinum)

**For Admins:**
- Manage 85,000+ insurance clients
- Process sales through a pipeline (NEW -> SUBMITTED -> QA -> APPROVED -> ACTIVE)
- Run quality assurance checks on sales data
- Calculate and pay agent commissions
- Send bulk SMS to clients
- Generate welcome packs (policy documents)
- Manage insurance products and premium changes
- Monitor 6 AI automation agents
- Configure 7 third-party integrations (QLink, SagePay, NetCash, GuardRisk, ViciDialer, WATI, SMS Portal)
- Build and trigger custom workflows

---

## Infrastructure

### Server (DigitalOcean Droplet)

| Property | Value |
|---|---|
| IP Address | `142.93.44.48` |
| OS | Ubuntu 24.04.3 LTS |
| Size | s-2vcpu-2gb (2 vCPUs, 2GB RAM) |
| Region | lon1 (London) |
| Disk | 60GB (3.6GB used) |
| SSH Access | Key-based, root user |
| Node.js | v22.22.2 |

### Database (DigitalOcean Managed PostgreSQL)

| Property | Value |
|---|---|
| Host | `ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com` |
| Port | `25060` |
| Database | `ambassadorc` |
| User | `doadmin` |
| Password | `AVNS_OBCZjJATLVZy_1E3T_3` |
| SSL | Required (`sslmode=require`) |
| Size | db-s-1vcpu-1gb |
| Region | lon1 (London) |
| Engine | PostgreSQL 16 |
| Tables | 34 |

**Full Connection String:**
```
postgresql://doadmin:AVNS_OBCZjJATLVZy_1E3T_3@ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com:25060/ambassadorc?sslmode=require
```

**psql command:**
```bash
PGPASSWORD=AVNS_OBCZjJATLVZy_1E3T_3 psql -h ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com -p 25060 -U doadmin -d ambassadorc --set=sslmode=require
```

### DigitalOcean Access

| Property | Value |
|---|---|
| Console | https://cloud.digitalocean.com |
| Account Email | pricklypairstudiosza@gmail.com |
| SSH Key Location | `/tmp/do_deploy_key` (local machine) |

### GitHub Repository

| Property | Value |
|---|---|
| URL | https://github.com/ZubeidHendricks/ambassadorc-v5 |
| Branch | `main` |
| Owner | ZubeidHendricks |

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL="postgresql://doadmin:AVNS_OBCZjJATLVZy_1E3T_3@ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com:25060/ambassadorc?sslmode=require"
JWT_SECRET="ambassadorc-v5-jwt-secret-2026-prickly-pair-studios"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="*"
NODE_ENV="production"
```

### Admin Login Credentials

| Field | Value |
|---|---|
| Mobile | `0800000000` |
| Password | `Admin@2024` |
| Role | ADMIN |

---

## Architecture Diagram

```
                         Browser (React SPA)
                              |
                              | HTTP :80
                              v
                    +-------------------+
                    |     Nginx         |
                    |  (reverse proxy)  |
                    +---+----------+----+
                        |          |
              +---------v--+  +----v-----------+
              | GET /*     |  | /api/*         |
              | Serves     |  | proxy_pass     |
              | /opt/.../  |  | localhost:3001 |
              | dist/      |  +----+-----------+
              +------------+       |
                                   v
                    +----------------------------+
                    |    Express.js Backend       |
                    |    (tsx runtime, port 3001) |
                    |                            |
                    |  17 Route Modules          |
                    |  6 AI Agents               |
                    |  7 Integration Connectors  |
                    |  Workflow Engine            |
                    +-------------+--------------+
                                  |
                                  | SSL :25060
                                  v
                    +----------------------------+
                    |  PostgreSQL 16              |
                    |  (DigitalOcean Managed)     |
                    |  34 tables, 85k+ clients   |
                    +----------------------------+
```

---

## How The Backend Works

### Entry Point: `backend/src/index.ts`

Express server on port 3001. Middleware stack:
1. CORS (allow all origins)
2. JSON body parser
3. Helmet security headers
4. Rate limiting (1000 req/15min general, 200 req/15min auth)
5. JWT auth middleware on protected routes

### Route Mounting

```typescript
app.use("/api/auth", authRoutes);           // Register, login, me
app.use("/api/ambassadors", ambassadorRoutes); // Ambassador profiles
app.use("/api/referrals", referralRoutes);   // Referral batches
app.use("/api/leads", leadRoutes);           // Lead management
app.use("/api/dashboard", dashboardRoutes);  // Ambassador stats
app.use("/api/clients", clientRoutes);       // 85k+ clients
app.use("/api/products", productRoutes);     // Insurance products
app.use("/api/policies", policyRoutes);      // Policy lifecycle + premium changes
app.use("/api/payments", paymentRoutes);     // Debit orders
app.use("/api/sales", salesRoutes);          // Sales pipeline + campaigns
app.use("/api/documents", documentRoutes);   // Welcome packs
app.use("/api/sms", smsRoutes);             // SMS messaging
app.use("/api/qa", qaRoutes);               // Quality assurance
app.use("/api/commissions", commissionRoutes); // Commission calc & pay
app.use("/api/admin", adminRoutes);         // Stats, agents list, audit log
app.use("/api/agents", agentRoutes);        // AI agent orchestration
app.use("/api/workflows", workflowRoutes);  // Workflow engine
app.use("/api/integrations", integrationRoutes); // Third-party config
```

### API Response Pattern

ALL endpoints return:
```json
{
  "success": true,
  "data": {
    "<entity_name>": [...],   // e.g. "clients", "sales", "policies"
    "pagination": { "total": 100, "page": 1, "limit": 50 }
  }
}
```

The frontend `api.ts` unwraps these in every function.

### Database (Prisma ORM)

Schema: `backend/prisma/schema.prisma` (33 models)

Key tables and current record counts:
| Table | Records | Description |
|---|---|---|
| `ambassadors` | 40 | Users (ambassadors, agents, admins) |
| `clients` | 85,766 | Insurance clients |
| `leads` | 110 | Sales leads |
| `products` | 9 | Insurance products |
| `policies` | 1 | Active policies |
| `sales` | 0 | Sales (pipeline) |
| `commissions` | 0 | Commission records |
| `referral_batches` | 0 | Referral batches |
| `referrals` | 0 | Individual referrals |

Supporting tables: `audit_logs`, `callback_requests`, `debit_orders`, `document_views`, `e_signatures`, `file_exports`, `integration_configs`, `number_change_requests`, `payments`, `premium_changes`, `premium_tiers`, `premium_updates`, `qlink_batches`, `quality_checks`, `sagepay_transactions`, `sales_campaigns`, `sms_batches`, `sms_messages`, `welcome_pack_logs`, `welcome_packs`, `workflow_instances`, `workflow_step_instances`, `workflow_steps`, `workflows`

### AI Agents (`backend/src/agents/`)

| Agent | File | What It Does |
|---|---|---|
| Lead Scorer | `lead-scorer.ts` | Scores leads by province, recency, ambassador track record |
| Auto QA | `qa-auto-checker.ts` | Verifies sale data against quality rules |
| SMS Dispatcher | `sms-dispatcher.ts` | Sends scheduled bulk SMS |
| Commission Calculator | `commission-calculator.ts` | Calculates agent commissions by tier & rules |
| Payment Reconciler | `debit-order-reconciler.ts` | Matches debit orders with payments |
| Welcome Pack Sender | `welcome-pack-sender.ts` | Generates and sends policy documents |

### Integrations (`backend/src/integrations/`)

| Integration | File | Purpose |
|---|---|---|
| QLink | `qlink.ts` | Government payroll deductions |
| SagePay | `sagepay.ts` | Card payment processing |
| NetCash | `netcash.ts` | Bank account validation & payments |
| GuardRisk | `guardrisk.ts` | Underwriting API |
| ViciDialer | `vicidialer.ts` | Call center lead uploads |
| WATI | `wati.ts` | WhatsApp messaging |
| SMS Portal | `sms-portal.ts` | Bulk SMS delivery |

### Workflow Engine (`backend/src/workflows/`)

Custom workflow system with:
- `engine.ts` - Executes workflow instances step-by-step
- `templates.ts` - Predefined workflow templates (new sale, policy change, etc.)
- Steps can be: AUTO (runs code), APPROVAL (waits for human), NOTIFICATION (sends alert)

---

## How The Frontend Works

### Entry Point: `frontend/src/App.tsx`

React Router with three route groups:
1. **Public**: `/` (Landing), `/login`, `/register`
2. **Protected** (any authenticated user): `/dashboard`, `/referrals`, `/leads`, `/leaderboard`, `/profile`
3. **Admin** (role=ADMIN): `/admin/*` (14 admin pages)

### Auth Flow

`frontend/src/context/AuthContext.tsx`:
1. Login posts to `/api/auth/login` with mobile + password
2. Receives JWT token + user object
3. Stores token in localStorage
4. All subsequent API calls include `Authorization: Bearer <token>`
5. On page load, calls `/api/auth/me` to verify token

### API Client: `frontend/src/lib/api.ts`

**This is the most critical frontend file.** Every API call goes through it.

- `request()` base function adds auth headers and handles errors
- Each page has dedicated functions (e.g. `getClients()`, `getSales()`, `getAgents()`)
- Functions unwrap the `{ success, data: { <entity>: [], pagination } }` response pattern
- Some functions map backend field names to frontend interfaces (e.g. AI agent `name` -> `agentKey`)

### Design System

Tailwind CSS 4 with CSS-first config in `frontend/src/index.css` `@theme` block:

```css
--color-primary: #004D99;        /* D8tavision blue */
--color-primary-light: #0AB3CC;  /* Teal accent */
--color-primary-dark: #1A2C6B;   /* Dark navy */
--color-sidebar: #0D1117;        /* Near-black sidebar */
--radius-lg: 0.3rem;             /* Tight border radius */
```

Font stack: Google Sans -> Inter -> system-ui

### Pages Overview

| Page | Route | Data Source |
|---|---|---|
| Landing | `/` | Static |
| Login | `/login` | `/api/auth/login` |
| Register | `/register` | `/api/auth/register` |
| Ambassador Dashboard | `/dashboard` | `/api/dashboard/stats` |
| Submit Referrals | `/referrals` | `/api/referrals/batch` (POST) |
| Referral History | `/referrals/history` | `/api/referrals/batches` |
| Submit Lead | `/leads` | `/api/leads` (POST) |
| Lead History | `/leads/history` | `/api/leads` |
| Leaderboard | `/leaderboard` | `/api/admin/agents` (derived) |
| Profile | `/profile` | `/api/auth/me` |
| Admin Dashboard | `/admin` | `/api/admin/stats`, `/api/admin/agents`, `/api/admin/audit-log` |
| Clients | `/admin/clients` | `/api/clients` |
| Sales | `/admin/sales` | `/api/sales` |
| Commissions | `/admin/commissions` | `/api/commissions`, `/api/commissions/summary` |
| Quality Assurance | `/admin/qa` | `/api/qa` |
| Policies | `/admin/policies` | `/api/policies` |
| Products | `/admin/products` | `/api/products` |
| Premium Changes | `/admin/premium-changes` | `/api/policies/premium-changes` |
| Agents | `/admin/agents` | `/api/admin/agents` |
| AI Agents | `/admin/ai-agents` | `/api/agents` |
| Workflows | `/admin/workflows` | `/api/workflows`, `/api/workflows/instances`, `/api/workflows/stats` |
| Documents | `/admin/documents` | `/api/documents/welcome-pack` |
| SMS Center | `/admin/sms` | `/api/sms` |
| Integrations | `/admin/integrations` | `/api/integrations` |

---

## Server Management

### SSH Access

```bash
ssh -i /tmp/do_deploy_key root@142.93.44.48
```

### Backend Service

```bash
# Status
systemctl status ambassadorc-backend

# Restart
systemctl restart ambassadorc-backend

# Logs
journalctl -u ambassadorc-backend -f

# Config
cat /etc/systemd/system/ambassadorc-backend.service
```

### Nginx

```bash
# Config
cat /etc/nginx/sites-enabled/ambassadorc

# Restart
systemctl restart nginx

# Logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Deploy Frontend

```bash
# On local machine (build + transfer)
cd frontend && npm run build
# Transfer dist/ to server at /opt/ambassadorc-v5/frontend/dist/
```

### Deploy Backend

```bash
# On server
cd /opt/ambassadorc-v5/backend
git pull
npm install
npx prisma migrate deploy   # if schema changed
systemctl restart ambassadorc-backend
```

### Database Operations

```bash
# Connect
PGPASSWORD=AVNS_OBCZjJATLVZy_1E3T_3 psql -h ambassadorc-db-do-user-35795027-0.j.db.ondigitalocean.com -p 25060 -U doadmin -d ambassadorc --set=sslmode=require

# Run migrations
cd /opt/ambassadorc-v5/backend && npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Open Prisma Studio (GUI)
npx prisma studio
```

---

## File Locations on Server

```
/opt/ambassadorc-v5/
├── backend/
│   ├── .env                          # Environment variables
│   ├── src/index.ts                  # Express entry point
│   ├── src/routes/                   # 17 route files
│   ├── src/agents/                   # 6 AI agents
│   ├── src/integrations/             # 7 connectors
│   ├── src/workflows/                # Workflow engine
│   ├── prisma/schema.prisma          # Database schema
│   └── node_modules/
├── frontend/
│   ├── dist/                         # Built SPA (served by Nginx)
│   ├── src/                          # Source code
│   └── node_modules/
/etc/nginx/sites-enabled/ambassadorc  # Nginx config
/etc/systemd/system/ambassadorc-backend.service  # systemd unit
```

---

## Known Issues / Warnings

1. **Documents page**: `/api/documents/welcome-pack` GET endpoint not implemented (only POST for creating). Page shows empty state gracefully.
2. **SMS Templates**: `/api/sms/templates` endpoint not implemented. Page shows empty state.
3. **Rate Limiting**: Auth endpoint limited to 200 requests per 15 minutes. Can cause lockout during testing. Restart backend to clear: `systemctl restart ambassadorc-backend`
4. **No SSL**: Currently HTTP only on port 80. Needs Let's Encrypt / Certbot for HTTPS.
5. **No CI/CD**: Deployment is manual (build locally, transfer files). Could add GitHub Actions.
6. **Sales/Commissions data**: Tables are mostly empty - the system is ready but needs live data flow.

---

## Running Locally (Replit Setup)

### Prerequisites
- Node.js 22+
- Access to the DigitalOcean managed PostgreSQL (connection string above)

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Paste the DATABASE_URL from above into .env
npx prisma generate
npx prisma migrate deploy
npm run dev   # starts on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # starts on port 5173, proxies /api to localhost:3001
```

### E2E Tests
```bash
cd frontend
npx tsx e2e-test.ts   # tests against http://142.93.44.48
```

To test locally, change `BASE` in `e2e-test.ts` to `http://localhost:5173`.
