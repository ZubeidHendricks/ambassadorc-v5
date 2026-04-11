# Lifesaver Refer & Earn - Ambassador Program v5

Modern rebuild of the Ambassador referral management system using React, TypeScript, PostgreSQL, and Express.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, TailwindCSS v4, shadcn/ui, Recharts |
| Backend | Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Auth | JWT + bcrypt |
| DevOps | Docker Compose |

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
docker-compose up --build
```

This starts:
- PostgreSQL on port 5432
- Backend API on http://localhost:3001
- Frontend on http://localhost:5173

### Option 2: Manual Setup

**Prerequisites**: Node.js 22+, PostgreSQL 16+

```bash
# 1. Start PostgreSQL and create database
createdb ambassadorc

# 2. Backend
cd backend
npm install
cp .env.example .env   # Edit DATABASE_URL if needed
npx prisma migrate dev  # Creates tables
npx prisma db seed      # Imports data from CSV exports
npm run dev

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure

```
ambassadorc-v5/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Database schema (5 models)
│   ├── src/
│   │   ├── index.ts            # Express entry point
│   │   ├── seed.ts             # CSV data importer
│   │   ├── lib/
│   │   │   ├── prisma.ts       # Prisma client singleton
│   │   │   ├── jwt.ts          # JWT helpers
│   │   │   └── validators.ts   # Zod request schemas
│   │   ├── middleware/
│   │   │   └── auth.ts         # JWT auth middleware
│   │   └── routes/
│   │       ├── auth.ts         # Register, login, me
│   │       ├── ambassadors.ts  # Profile CRUD
│   │       ├── referrals.ts    # Batch referral submission
│   │       ├── leads.ts        # Lead submission
│   │       └── dashboard.ts    # Stats & analytics
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Router + routes
│   │   ├── context/            # Auth context
│   │   ├── lib/                # API client, utils
│   │   ├── components/
│   │   │   ├── ui/             # Button, Input, Card, Select, Badge, Toast
│   │   │   └── layout/         # Header, Layout
│   │   └── pages/              # All page components
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register new ambassador |
| POST | /api/auth/login | No | Login with mobile + password |
| GET | /api/auth/me | Yes | Get current profile |
| GET | /api/ambassadors | Yes | List all ambassadors |
| PUT | /api/ambassadors/:id | Yes | Update profile |
| POST | /api/ambassadors/change-mobile | Yes | Request number change |
| POST | /api/referrals/batch | Yes | Submit referral batch (1-10) |
| GET | /api/referrals/batches | Yes | List referral batches |
| GET | /api/referrals/batch/:id | Yes | Get batch detail |
| POST | /api/leads | Yes | Submit a lead |
| GET | /api/leads | Yes | List leads |
| GET | /api/dashboard/stats | Yes | Dashboard statistics |
| GET | /api/dashboard/stats/monthly | Yes | Monthly breakdown |

## Data Migration

The seed script (`backend/src/seed.ts`) imports data from the CSV exports in `AMBASSADORC_DB_Export/`:
- `am_reg.csv` → Ambassador accounts
- `am_ambassador.csv` → Profile enrichment
- `am_refbatch.csv` → Referral batches + individual referrals
- `am_amleads.csv` → Leads

All imported ambassadors get the default password: `Welcome123`

## Security Improvements over v4

- Parameterized queries (Prisma ORM) — no SQL injection
- Password authentication with bcrypt (cost 12)
- JWT tokens with configurable expiry
- Rate limiting on all endpoints
- Helmet security headers
- CORS whitelist
- Input validation with Zod
- No hardcoded credentials
