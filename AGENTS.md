
## Hostinger Accounts & Tokens

Always use the correct Hostinger API token per account (stored in `.devin/hostinger.env`, gitignored — never commit):

- `HOSTINGER_DOMAIN_TOKEN` — `jyothibabu.vs@gmail.com` → DNS for `jnvspectra.com`
- `HOSTINGER_HOSTING_TOKEN` — `narukullapati.harikrishna@gmail.com` → the VPS hosting JNV api/admin/web/db (72.60.175.59)

## Deployment Workflow

- Local source is source of truth. All changes: edit/test locally → commit & push → VPS pulls from GitHub → deploy.
- Deploy: `/root/deploy-jnv.sh <branch>` on the VPS (builds frontends, syncs `deploy/vps/`, runs docker compose). Never overwrite `.env` files.
- Backend exists twice: `event_management_backend_final` (dev) and `deploy/vps/backend` (production) — keep them in sync.
