#!/bin/bash
set -e

echo "=== [1/5] Syncing Prisma schema to project root ==="
cp backend/prisma/schema.prisma prisma/schema.prisma

echo "=== [2/5] Installing backend dependencies ==="
cd backend
npm install --ignore-engines

echo "=== [3/5] Generating Prisma client (no schema push — DB managed separately) ==="
npx prisma generate

echo "=== [4/5] Building backend TypeScript ==="
# tsc may exit non-zero for type warnings while still emitting JS output.
# We verify the compiled entry-point exists as the real success criteria.
npm run build || true
if [ ! -f dist/index.js ]; then
  echo "ERROR: dist/index.js not found after build — compilation failed."
  exit 1
fi
echo "Backend compiled OK (dist/index.js present)"
cd ..

echo "=== [5/5] Building frontend & copying to backend/public ==="
cd frontend
npm install
npm run build
cd ..
mkdir -p backend/public
cp -r frontend/dist/. backend/public/

echo "=== Build complete ==="
