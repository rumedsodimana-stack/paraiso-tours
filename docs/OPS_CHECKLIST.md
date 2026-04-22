# Operations checklist

Two env + DB items you should verify / apply in production once.

## 1. `ADMIN_SESSION_SECRET` in Vercel

Since the audit fix landed, admin session cookies are signed with
`ADMIN_SESSION_SECRET` (preferred) or `ADMIN_PASSWORD` (fallback). If
neither is set the code throws on login rather than silently using a
hardcoded string.

Check what's set in Vercel → Project → Settings → Environment Variables.

- If you see **both** `ADMIN_SESSION_SECRET` and `ADMIN_PASSWORD` set to
  different long random values → you're good.
- If you see **only** `ADMIN_PASSWORD` → it still works (fallback), but
  rotating the password also rotates all cookies. Set `ADMIN_SESSION_SECRET`
  to a separate long random value so the two concerns are independent:

  ```
  ADMIN_SESSION_SECRET=<openssl rand -base64 48>
  ```

- If you see **neither** → admin login is currently broken in prod. Set
  both before your next admin session.

## 2. `confirmation_id` columns in Supabase

The scheduling flow now denormalizes the tour's confirmation id onto the
invoice and payment rows so reports can chain them in a single lookup.
This needs a one-time schema migration — the code handles missing
columns gracefully (writes are try/caught) but reports are cleaner once
the columns exist.

Apply: `docs/migrations/2026-04-22_confirmation_id_linkage.sql`

Options:

- **Supabase SQL editor** — open the project, paste the file contents,
  Run. Idempotent (uses `ADD COLUMN IF NOT EXISTS`), safe to re-run.
- **Supabase CLI** — `supabase db push` against the file if you have
  migrations configured.
- **psql** — `psql "$DATABASE_URL" -f docs/migrations/2026-04-22_confirmation_id_linkage.sql`

After running, verify:

```sql
select column_name from information_schema.columns
where table_name in ('invoices','payments') and column_name = 'confirmation_id';
```

You should see two rows.

## 3. `RESEND_API_KEY` in Vercel

Email sending (guest confirmations, supplier reservations, invoice
PDFs, itinerary PDFs, pre-trip reminders, post-trip follow-ups, booking
change notices) all go through Resend.

If `RESEND_API_KEY` is unset, every send returns
`{ ok: false, error: "Email not configured" }` gracefully — nothing
breaks, but no email goes out. Check Vercel env vars.

`RESEND_FROM_EMAIL` is optional; if unset we fall back to
`"Paraíso Ceylon Tours <onboarding@resend.dev>"` which is Resend's
shared sandbox sender. Set your verified domain sender before going
live with real customers.
