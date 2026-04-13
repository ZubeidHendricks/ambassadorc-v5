# AmbassadorC v5 — Insurance Management Platform

## Overview

A unified insurance management platform for South African insurance operations. Consolidates three legacy systems (AMBASSADORC, FoxBilling, FoxPro DNN) into a single full-stack TypeScript application.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS 4 (port 5000 in dev)
- **Backend**: Node.js + Express + TypeScript + Prisma ORM (port 3001 in dev)
- **Database**: PostgreSQL (Replit managed)
- **Auth**: JWT + bcryptjs

## Project Structure

```
/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── pages/     # 23+ pages (ambassador portal + admin panel)
│   │   ├── components/# Reusable UI components (Radix UI + Tailwind)
│   │   ├── context/   # Auth context (JWT)
│   │   └── lib/api.ts # Central API client
│   └── vite.config.ts # Dev server: port 5000, host 0.0.0.0, proxies /api -> 3001
├── backend/
│   ├── src/
│   │   ├── index.ts   # Express server entry, serves static in production
│   │   ├── routes/    # 17 API route modules
│   │   ├── agents/    # 6 AI automation agents
│   │   ├── workflows/ # Business process workflow engine
│   │   └── integrations/ # Third-party service adapters
│   └── prisma/schema.prisma # 33-model database schema
├── start.sh           # Production startup script
└── replit.md          # This file
```

## Development Setup

Two workflows run concurrently:
1. **Backend** (`cd backend && npm run dev`) — port 3001
2. **Start application** (`cd frontend && npm run dev`) — port 5000 (webview)

Frontend proxies `/api/*` requests to the backend at `localhost:3001`.

## Database

Uses Replit's managed PostgreSQL. Schema managed by Prisma.
- Connection string stored in `DATABASE_URL` environment variable
- Run `cd backend && npx prisma db push` to sync schema changes

## Environment Variables

Backend `.env` (not committed):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `JWT_EXPIRES_IN` — Token expiry (default: 7d)
- `PORT` — Backend port (default: 3001)
- `NODE_ENV` — development / production

## Production Deployment

- Build: Compiles backend TypeScript, builds frontend Vite app, copies static assets to `backend/public/`
- Run: `bash start.sh` — runs Prisma db push + starts compiled Express server
- Express serves static frontend files from `backend/public/` in production
- Backend handles all `/api/*` routes; frontend SPA handles all other routes

## Key Features

- Ambassador/Agent registration and management
- Lead and referral submission + tracking
- Sales processing and QA verification
- Commission calculation
- Policy management and billing
- Admin dashboard with analytics
- AI-powered automation agents (lead scoring, QA checks, SMS dispatch)
- Integration adapters: QLink, SagePay, NetCash, GuardRisk, ViciDialer, WATI
