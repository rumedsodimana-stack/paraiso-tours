# Vercel Deployment

## Deploy to Vercel

1. **Connect your repo** — Push to GitHub and import the project in [Vercel](https://vercel.com).

2. **Build settings** — Framework preset: Next.js. Root directory: `paraiso-tours` (if in a monorepo).

3. **Environment variables** (recommended for production):
   - `ADMIN_PASSWORD` — Admin login password. **Default if not set: `admin123`**
   - `LOG_LEVEL` — Optional: `debug` | `info` | `warn` | `error` (default: `info`)
   - For WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

4. **Deploy** — Vercel builds and deploys automatically on push.

## Password

| Context | Password |
|--------|----------|
| **Default (no env set)** | `admin123` |
| **Local (first run)** | `admin123` — change in Settings → Change Admin Password |
| **Vercel** | Set `ADMIN_PASSWORD` in Project Settings → Environment Variables |

**Important:** On Vercel, the password cannot be changed from the app UI. Use the Vercel dashboard to update `ADMIN_PASSWORD`.

## Data on Vercel

On Vercel, the filesystem is read-only. Data (leads, tours, invoices, payments, etc.) is stored in memory and resets on cold starts. For production, use a database (e.g. Prisma + PostgreSQL, Supabase).
