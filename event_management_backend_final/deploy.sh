#!/bin/bash
# Sync backend source into the deploy copy at deploy/vps/backend.
# The VPS docker image builds from deploy/vps/backend, not from here.
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$APP_DIR/../deploy/vps/backend"
if command -v rsync >/dev/null; then
  rsync -a --delete --exclude node_modules --exclude .env --exclude '*.log' "$APP_DIR/" "$TARGET/"
else
  mkdir -p "$TARGET" && cp -r "$APP_DIR/src" "$APP_DIR/package.json" "$APP_DIR/Dockerfile" "$TARGET/" 2>/dev/null || true
fi
echo "Synced $APP_DIR -> $TARGET"
