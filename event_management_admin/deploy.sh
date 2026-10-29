#!/bin/bash
# Build the admin portal and install its dist into deploy/vps/admin/dist.
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$APP_DIR/../deploy/vps/admin/dist"
cd "$APP_DIR"
npm install --no-audit --no-fund
VITE_API_BASE_URL=https://api.jnvspectra.com npm run build
rm -rf "$TARGET"
cp -r dist "$TARGET"
echo "Built $APP_DIR/dist -> $TARGET"
