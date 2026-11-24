#!/usr/bin/env bash
# Difonti install + update + start for Termux. Safe to re-run any time:
# it pulls the latest code and only rebuilds what changed.
# Usage: bash termux-install.sh
set -e

REPO="https://github.com/K1MES-VO1D/difonti"
cd "${HOME:-/data/data/com.termux/files/home}"   # never run from shared storage
DIR="$PWD/difonti"

need() { command -v "$1" >/dev/null 2>&1; }
if ! need node || ! need git; then
  need pkg || { echo "Run this inside the Termux app (F-Droid version)." >&2; exit 1; }
  echo "==> Installing nodejs and git"
  pkg update -y && pkg install -y nodejs git
fi

if [ -d "$DIR/.git" ]; then
  OLD=$(git -C "$DIR" rev-parse HEAD)
  git -C "$DIR" pull --ff-only || { echo "Pull failed (local edits?). Run: git -C $DIR stash" >&2; exit 1; }
else
  git clone "$REPO" "$DIR"
  OLD=none
fi
NEW=$(git -C "$DIR" rev-parse HEAD)

changed() { [ "$OLD" = none ] || ! git -C "$DIR" diff --quiet "$OLD" "$NEW" -- "$@"; }

cd "$DIR/backend"
if [ ! -d node_modules ] || changed backend/package.json backend/package-lock.json; then
  echo "==> Installing backend dependencies"
  npm install --omit=dev
fi

cd "$DIR/frontend"
if [ ! -d node_modules ] || changed frontend/package.json frontend/package-lock.json; then
  echo "==> Installing frontend dependencies"
  npm install
fi
if [ ! -f dist/index.html ] || changed frontend; then
  echo "==> Building frontend"
  VITE_API_URL="" npm run build
fi

echo "==> Difonti running on http://localhost:4000 (Ctrl+C to stop)"
if need termux-wake-lock; then termux-wake-lock || true; fi
cd "$DIR/backend"
exec node server.js
