#!/data/data/com.termux/files/usr/bin/bash
# Difonti installer/launcher for Termux.
# Usage: bash termux-install.sh
set -e

REPO="https://github.com/K1MES-VO1D/costream"
DIR="$HOME/difonti"

echo "==> Installing packages"
pkg update -y
pkg install -y nodejs git

if [ -d "$DIR/.git" ]; then
  echo "==> Updating $DIR"
  git -C "$DIR" pull --ff-only
else
  echo "==> Cloning $REPO"
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
termux-wake-lock 2>/dev/null || true
exec node server.js
