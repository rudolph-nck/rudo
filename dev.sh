#!/bin/bash
cd "$(dirname "$0")"

echo "========================================"
echo "  RUDO - Dev Server Restart"
echo "========================================"
echo ""

# Kill anything on port 3000
echo "Killing processes on port 3000..."
lsof -ti :3000 | xargs kill -9 2>/dev/null

# Regenerate Prisma client
echo "Generating Prisma client..."
npx prisma generate || { echo "[ERROR] Prisma generate failed."; exit 1; }

# Clear Next.js cache
echo "Clearing Next.js cache..."
rm -rf .next

# Start dev server
echo ""
echo "Starting dev server on http://localhost:3000 ..."
echo "========================================"
npx next dev -p 3000
