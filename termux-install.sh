#!/usr/bin/env bash
# Difonti installer/launcher for Termux.
# Usage: bash termux-install.sh   (works from any folder)
set -e

REPO="https://github.com/K1MES-VO1D/difonti"
DIR="${HOME:-$PWD}/difonti"

echo "==> Installing packages"
if command -v pkg >/dev/null 2>&1; then
  pkg update -y
  pkg install -y nodejs git
else
  echo "pkg not found - run this inside the Termux app (F-Droid version)." >&2
  command -v node >/dev/null && command -v git >/dev/null || exit 1
fi

if [ -d "$DIR/.git" ]; then
  echo "==> Updating $DIR"
  git -C "$DIR" pull --ff-only
else
  echo "==> Cloning $REPO into $DIR"
  git clone "$REPO" "$DIR"
fi

echo "==> Building frontend"
cd "$DIR/frontend"
npm install
VITE_API_URL="" npm run build

echo "==> Installing backend"
cd "$DIR/backend"
npm install --omit=dev

echo "==> Starting Difonti on http://localhost:4000 (Ctrl+C to stop)"
command -v termux-wake-lock >/dev/null && termux-wake-lock || true
exec node server.js
