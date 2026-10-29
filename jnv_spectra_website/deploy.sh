#!/bin/bash
# Build the public website and install its dist into deploy/vps/web/dist.
# Run from anywhere: ./deploy.sh   (inside this directory or via path)
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$APP_DIR/../deploy/vps/web/dist"
cd "$APP_DIR"
npm install --no-audit --no-fund
VITE_API_BASE_URL=https://api.jnvspectra.com npm run build
rm -rf "$TARGET"
cp -r dist "$TARGET"
echo "Built $APP_DIR/dist -> $TARGET"
