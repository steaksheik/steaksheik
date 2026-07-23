# Vercel Deployment Guide for Steak Sheikh

## Prerequisites

Your code is ready to push to GitHub and deploy to Vercel. The local setup is complete with:
- ✅ Git initialized with initial commit
- ✅ All files staged and committed
- ✅ `.env` properly gitignored (secrets are safe)
- ✅ Database schema and seeds working locally

---

## Step 1: Push to GitHub

### Option A: Manual Push (Recommended)
Since the repository `steaksheik/steaksheik` needs to be created first:

1. **Create the repository on GitHub:**
   - Go to https://github.com/new
   - Repository name: `steaksheik`
   - Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

2. **Push your code:**
   ```bash
   cd /home/ubuntu/steak-sheikh-github
   git remote set-url origin https://github.com/steaksheik/steaksheik.git
   git push -u origin main
   ```
   When prompted, use your GitHub username and a **Personal Access Token** (not password):
   - Create token at: https://github.com/settings/tokens/new
   - Required scopes: `repo` (Full control of private repositories)

### Option B: SSH (If you have SSH keys set up)
```bash
cd /home/ubuntu/steak-sheikh-github
git remote set-url origin git@github.com:steaksheik/steaksheik.git
git push -u origin main
```

---

## Step 2: Deploy to Vercel

### 2.1 Connect GitHub Repository to Vercel

1. **Go to Vercel:** https://vercel.com/new
2. **Import Git Repository:**
   - Click "Add New Project"
   - Select "Import Git Repository"
   - Authorize Vercel to access your GitHub account if needed
   - Select the `steaksheik/steaksheik` repository

### 2.2 Configure Environment Variables

Vercel will detect this as a Next.js project automatically. You need to add these environment variables:

#### Required Database Variables
```env
DATABASE_URL=your-production-postgres-url
DIRECT_DATABASE_URL=your-production-postgres-url
```

**Database Options:**
- **Vercel Postgres** (Recommended): Create in Vercel dashboard, automatically configured
- **Neon.tech**: Free tier available, PostgreSQL-compatible
- **Supabase**: Free tier with PostgreSQL
- **Railway**: Simple PostgreSQL hosting

#### Required Auth Variables
```env
NEXTAUTH_URL=https://your-app-name.vercel.app
NEXTAUTH_SECRET=<generate-new-secret>
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

#### Required Admin Credentials
```env
ADMIN_EMAIL=admin@steakshk.com
ADMIN_PASSWORD=<choose-strong-password>
```

#### Required Encryption Keys
```env
CREDENTIALS_ENCRYPTION_KEY=<generate-64-char-hex>
CURSOR_SECRET=<generate-random-string>
CRON_SECRET=<generate-random-string>
```

Generate encryption key:
```bash
openssl rand -hex 32
```

#### Stripe Variables (Required for checkout)
```env
STRIPE_SECRET_KEY=sk_live_your_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

Get these from https://dashboard.stripe.com/apikeys

#### Optional but Recommended
```env
# Redis (Upstash - free tier available)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# QStash for event delivery
QSTASH_TOKEN=your-token
QSTASH_CURRENT_SIGNING_KEY=your-key
QSTASH_NEXT_SIGNING_KEY=your-key

# AWS S3 for file storage
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket
AWS_FOLDER_PREFIX=steak-sheikh/

# Abacus AI for notifications
ABACUSAI_API_KEY=your-key
WEB_APP_ID=your-app-id
NOTIF_ID_NEW_ORDER_RECEIVED=your-id
NOTIF_ID_ORDER_STATUS_UPDATE=your-id
NOTIF_ID_ORDER_CANCELLED=your-id
NOTIF_ID_DAILY_SALES_SUMMARY=your-id
NOTIF_ID_WELCOME_EMAIL=your-id
```

### 2.3 Build Settings

Vercel should auto-detect these, but verify:

```
Build Command: yarn build
Output Directory: .next
Install Command: yarn install
Development Command: yarn dev
```

### 2.4 Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (2-5 minutes)
3. Vercel will provide your production URL

---

## Step 3: Post-Deployment Setup

### 3.1 Run Database Migrations

After first deployment, you need to push the schema and seed the database:

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Run Prisma commands in Vercel environment
vercel env pull .env.production
yarn prisma generate
yarn prisma db push
yarn prisma db seed
```

#### Option B: Manual (from local with production DB URL)
```bash
# Temporarily set production DATABASE_URL
export DATABASE_URL="your-production-postgres-url"
yarn prisma generate
yarn prisma db push
yarn prisma db seed
```

### 3.2 Configure Stripe Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-app-name.vercel.app/api/webhooks/stripe`
3. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
4. Copy the webhook secret and add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`
5. Redeploy to apply the new environment variable

### 3.3 Test Your Deployment

1. **Storefront:** `https://your-app-name.vercel.app`
2. **Admin Login:** `https://your-app-name.vercel.app/admin/login`
3. **Health Check:** `https://your-app-name.vercel.app/api/health`

---

## Step 4: Continuous Deployment

Once connected, Vercel automatically deploys:
- **Production:** Every push to `main` branch
- **Preview:** Every push to other branches or pull requests

You can now make changes locally, commit, push to GitHub, and Vercel will auto-deploy.

---

## Quick Setup with Vercel Postgres (Easiest)

1. In Vercel dashboard, go to Storage → Create Database → Postgres
2. Connect it to your project
3. Vercel automatically adds `DATABASE_URL` and other Postgres env vars
4. Just add the other required env vars listed above
5. Deploy!

---

## Troubleshooting

### Build Fails
- Check Vercel build logs for specific errors
- Ensure all required env vars are set
- Verify `yarn.lock` is committed to repo

### Database Connection Issues
- Verify `DATABASE_URL` is accessible from Vercel's servers
- Check database firewall rules allow Vercel IPs
- Use connection pooling if available

### Prisma Issues
- Run `yarn prisma generate` is part of the build (it's in postinstall script)
- Ensure `DATABASE_URL` is set before build

### Environment Variable Changes
- After adding/changing env vars in Vercel dashboard, redeploy to apply them
- Use `vercel env pull` to sync local env with production

---

## Local Development Workflow

```bash
# Pull latest from GitHub
git pull origin main

# Make changes
# ... edit files ...

# Test locally
yarn dev

# Commit and push
git add .
git commit -m "Your changes"
git push origin main

# Vercel auto-deploys!
```

---

## Need Help?

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **Prisma with Vercel:** https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
