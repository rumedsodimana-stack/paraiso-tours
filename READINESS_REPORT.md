# Paraíso Ceylon Tours – Real-World Deployment Readiness Report

**Generated:** March 2025  
**Scope:** Full app audit for production deployment

---

## Executive Summary

| Status | Summary |
|--------|---------|
| **Local dev** | ✅ Ready – manual bookings, packages, tours, invoices, payments persist in `data/*.json` |
| **Vercel (Supabase)** | ✅ Production-ready – bookings (leads) persist in Supabase when configured |
| **Production** | ⚠️ Ready for soft launch – Supabase + Resend configured; auth middleware optional |

---

## 1. Manual Booking “Not Appearing” – Root Cause

### What happens

When you create a manual booking (Admin → Bookings → Add Booking):

- **Local:** The lead is written to `data/leads.json`. It appears on the Bookings list (unscheduled leads). **Works correctly.**
- **Vercel:** Data is stored in **in-memory** only. Each serverless request can hit a different instance. Your new booking is written to one instance’s memory; the next request often hits another instance with empty data. **Bookings appear to “disappear.”**

### Fix for production

Use a persistent database. The app includes:

- `src/lib/db-supabase.ts` – Supabase-backed storage (wired for leads when env vars set)
- `src/lib/supabase.ts` – Supabase client

**Done:** When Supabase env vars are set, `db.ts` uses `db-supabase` for leads automatically. Run `supabase/schema.sql` in Supabase SQL Editor.

### If testing locally

1. Run `npm run dev`
2. Go to Admin → Bookings → Add Booking
3. Fill form and submit
4. You should land on `/admin/bookings?saved=1` and see the new lead

If it still doesn’t show:

- Confirm `data/leads.json` exists and contains your lead
- Check browser DevTools for errors
- Check the terminal for server action errors

---

## 2. Readiness Checklist

### Data persistence

| Area | Local | Vercel (no DB) | Production |
|------|-------|----------------|------------|
| Leads / bookings | ✅ `data/leads.json` | ✅ Supabase (when configured) | ✅ Supabase |
| Packages | ✅ `data/packages.json` | ✅ In-memory (seeded) | ⚠️ Need DB |
| Tours | ✅ `data/tours.json` | ❌ In-memory only | ⚠️ Need DB |
| Invoices | ✅ `data/invoices.json` | ❌ In-memory only | ⚠️ Need DB |
| Payments | ✅ `data/payments.json` | ❌ In-memory only | ⚠️ Need DB |
| Employees | ✅ `data/employees.json` | ❌ In-memory only | ⚠️ Need DB |
| Hotels / suppliers | ✅ `data/hotels.json` | ❌ In-memory only | ⚠️ Need DB |
| Settings (password) | ✅ `data/settings.json` | ❌ Use `ADMIN_PASSWORD` env | ⚠️ Need DB |

### Auth & security

| Item | Status |
|------|--------|
| Admin password | ✅ Supported (default `admin123`, change in Settings) |
| Auth middleware | ❌ Disabled – `/admin` is open |
| Session / JWT | ❌ Not implemented |
| CSRF protection | ⚠️ Partial (server actions) |
| Rate limiting | ❌ Not implemented |

### Core flows

| Flow | Status |
|------|--------|
| Client: browse packages | ✅ |
| Client: book package | ✅ |
| Client: view booking | ✅ |
| Client: my bookings | ✅ |
| Admin: add / edit booking | ✅ |
| Admin: schedule tour | ✅ |
| Admin: create invoice | ✅ |
| Admin: record payment | ✅ |
| Admin: email suppliers | ✅ |
| Admin: global search | ✅ |
| Admin: finance dashboard | ✅ |
| Admin: payables | ✅ |
| Admin: payroll | ✅ |

### Not implemented / mock only

| Item | Notes |
|------|-------|
| Quotations | Mock data only; not linked to leads |
| Email confirmations | ✅ Resend – booking, tour, payment receipts; supplier reservation emails |
| WhatsApp | Optional; needs env vars |
| Auth login page | Exists but redirects straight to admin |

---

## 3. Deployment Recommendations

### For demo / testing (Vercel without DB)

1. Set `ADMIN_PASSWORD` in Vercel Environment Variables.
2. Expect: packages visible; all other data (bookings, tours, invoices, etc.) resets on cold start.
3. Use for demos and UI testing only.

### For production

1. **Database**
   - Use Supabase (PostgreSQL) or Vercel Postgres.
   - Wire in `db-supabase.ts` or similar when DB env vars are present.
   - Run migrations for leads, packages, tours, invoices, payments, employees, hotels, settings.

2. **Auth**
   - Re-enable middleware for `/admin/*`.
   - Restore login page and session handling.
   - Consider NextAuth or Supabase Auth.

3. **Email** ✅ Done – Resend configured. Booking confirmation, tour confirmation with invoice, payment receipts, supplier reservation emails.

4. **Environment variables**
   - `DATABASE_URL` or Supabase URL + key
   - `ADMIN_PASSWORD` or auth secrets
   - `RESEND_API_KEY` (or similar) for email
   - `WHATSAPP_*` (optional)

5. **Monitoring**
   - Error tracking (e.g. Sentry)
   - Uptime checks
   - Basic logging (already present in `src/lib/logger.ts`)

---

## 4. Quick Reference

| URL | Purpose |
|-----|---------|
| `/` | Client portal home |
| `/packages` | Browse packages |
| `/packages/[id]/book` | Book a package |
| `/my-bookings` | Client: view bookings by email |
| `/booking/[ref]` | Client: lookup by reference |
| `/admin` | Admin dashboard |
| `/admin/bookings` | Manage bookings |
| `/admin/bookings/new` | Add manual booking |
| `/admin/settings` | Change password, themes, WhatsApp |

**Default password:** `admin123` (change in Settings or via `ADMIN_PASSWORD`)
