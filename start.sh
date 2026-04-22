#!/bin/bash
set -e

cd backend

# Prisma client is generated during the build step.
# Schema sync (db push) also runs during build.
# Just start the compiled server here.
exec node dist/index.js
