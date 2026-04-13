#!/bin/bash
set -e

cd backend

# Generate Prisma client if needed
npx prisma generate

# Push schema to database
npx prisma db push

# Start the server
node dist/index.js
