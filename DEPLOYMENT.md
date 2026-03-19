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

On Vercel, the filesystem is read-only. Without a database, data (bookings, tours, invoices, etc.) is stored in memory and **resets on cold starts** — manual bookings will disappear.

### Fix: Use Supabase for persistent bookings

To make manual bookings persist on Vercel:

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Run the schema** — In Supabase Dashboard → SQL Editor, run the contents of `supabase/schema.sql` to create the `leads`, `packages`, and `tours` tables.

3. **Add environment variables** in Vercel (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Service role key (from Supabase → Settings → API)

4. **Redeploy** — After adding env vars, trigger a new deployment.

With these set, leads (manual bookings) persist in Supabase and will show correctly on Vercel.
