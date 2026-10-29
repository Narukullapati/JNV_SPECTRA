#!/bin/bash
# Build the checkout app and install its dist into deploy/vps/checkout/dist.
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$APP_DIR/../deploy/vps/checkout/dist"
cd "$APP_DIR"
npm install --no-audit --no-fund
VITE_API_BASE_URL=https://api.jnvspectra.com npm run build
rm -rf "$TARGET"
cp -r dist "$TARGET"
echo "Built $APP_DIR/dist -> $TARGET"
