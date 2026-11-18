#!/usr/bin/env bash
# One-command deploy for the live backend (pm2 process "privily-test").
# Run on the server:  bash /var/www/privily-test/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
echo "==> pulling latest main"
git pull --ff-only origin main
echo "==> installing dependencies"
npm install --omit=dev --no-audit --no-fund
echo "==> restarting pm2 process"
pm2 restart privily-test --update-env
echo "==> last 20 log lines"
pm2 logs privily-test --lines 20 --nostream
