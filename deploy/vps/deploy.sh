#!/bin/bash
# Master deploy: pull latest from GitHub, build all apps, redeploy the stack.
# Runs ON THE VPS. Usage: ./deploy.sh [branch]   (default: Hari_Redesign)
set -e
REPO=${REPO:-/root/JNV_SPECTRA}
DEPLOY=${DEPLOY:-/root/jnv-spectra}
BRANCH=${1:-Hari_Redesign}

cd "$REPO"
echo "==> pull $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> build apps (dist into deploy/vps/*)"
( cd "$REPO" && bash event_management_backend_final/deploy.sh )
for APP in jnv_spectra_website event_management_admin jnv-checkout-app; do
  docker run --rm -v "$REPO:/repo" -w "/repo/$APP" node:20 bash ./deploy.sh
done

echo "==> sync $REPO/deploy/vps -> $DEPLOY (keeping .env)"
rsync -a --delete --exclude='.env' --exclude='.env.bak' --exclude='*.bak' "$REPO/deploy/vps/" "$DEPLOY/"

cd "$DEPLOY"
docker compose up -d --build
docker image prune -f
echo "==> done"
