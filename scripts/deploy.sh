#!/bin/bash
set -e

# ── Config ────────────────────────────────────────────────────────────────────
REMOTE_HOST="root@142.93.44.48"
APP_DIR="/var/www/ambassadorc-v5"
SERVICE="ambassadorc-backend"
BRANCH="main"

# Optional: path to your SSH key (leave blank to use ssh-agent / default key)
SSH_KEY="${DO_SSH_KEY_PATH:-}"

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15"
if [ -n "$SSH_KEY" ]; then
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

ssh_run() {
  ssh $SSH_OPTS "$REMOTE_HOST" "$@"
}

# ── Local git check ───────────────────────────────────────────────────────────
echo ""
echo "▶  Checking local git status..."
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" != "0" ]; then
  echo "   ⚠  You have uncommitted local changes. Push them to GitHub first."
  echo "      Run: git add -A && git commit -m 'your message' && git push origin $BRANCH"
  exit 1
fi

LOCAL_SHA=$(git rev-parse HEAD)
echo "   Local  HEAD : $LOCAL_SHA"

# ── Remote deploy ─────────────────────────────────────────────────────────────
echo ""
echo "▶  Connecting to $REMOTE_HOST ..."

ssh_run bash -s <<REMOTE
set -e
cd $APP_DIR

echo ""
echo "▶  Pulling latest code from GitHub ($BRANCH)..."
git fetch origin $BRANCH
git reset --hard origin/$BRANCH
echo "   Remote HEAD : \$(git rev-parse HEAD)"

echo ""
echo "▶  Installing frontend dependencies..."
cd $APP_DIR/frontend
npm install --legacy-peer-deps --silent

echo ""
echo "▶  Building frontend..."
npm run build
echo "   Build complete: \$(du -sh dist | cut -f1) in dist/"

echo ""
echo "▶  Installing backend dependencies..."
cd $APP_DIR/backend
npm install --silent

echo ""
echo "▶  Restarting backend service ($SERVICE)..."
systemctl restart $SERVICE
sleep 2
STATUS=\$(systemctl is-active $SERVICE)
if [ "\$STATUS" = "active" ]; then
  echo "   ✓ $SERVICE is running"
else
  echo "   ✗ $SERVICE failed to start (status: \$STATUS)"
  systemctl status $SERVICE --no-pager -l
  exit 1
fi
REMOTE

echo ""
echo "════════════════════════════════════════════════"
echo "  ✓ Deploy complete — https://142.93.44.48"
echo "════════════════════════════════════════════════"
echo ""
