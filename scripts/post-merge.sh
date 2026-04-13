#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing frontend dependencies..."
cd frontend && npm install --legacy-peer-deps
cd ..

echo "Installing backend dependencies..."
cd backend && npm install
cd ..

echo "=== Post-merge setup complete ==="
