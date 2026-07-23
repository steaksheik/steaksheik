# Pushing The Steak Sheikh to GitHub

This folder is a clean, secret-free copy of the application, ready to publish.
There is **no `.git` history** and **no `.env`** here, so no live secrets can leak.

## What was excluded for safety
- `.env` (all live secrets) — only the safe `.env.example` template is included.
- `node_modules/`, `.next/`, `.build/`, caches and deploy artefacts.
- Any database dumps, logs, keys.

## Push it (run these on your own machine)

```bash
# 1. Unzip the archive, then from inside the folder:
cd steak-sheikh-github

# 2. Start a fresh repository
git init
git add .
git commit -m "Initial commit: The Steak Sheikh"

# 3. Create an EMPTY repo on GitHub (no README), then:
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

## Before anyone can run it after cloning
1. `cp .env.example .env` and fill in real values.
2. Generate real secrets:
   - `NEXTAUTH_SECRET`, `CURSOR_SECRET`, `CRON_SECRET`: any long random string.
   - `CREDENTIALS_ENCRYPTION_KEY`: 64 hex chars, e.g. `openssl rand -hex 32`.
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`: your chosen back-office login (the seed reads these).
3. `yarn install`
4. `yarn prisma generate && yarn prisma db push`
5. `yarn prisma db seed`
6. `yarn dev`

## IMPORTANT
- **Never commit your real `.env`.** The included `.gitignore` already blocks it.
- If you ever paste a real secret into a committed file by accident, rotate that secret.
