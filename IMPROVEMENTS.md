# Paraíso Ceylon Tours – Improvements & Roadmap

This document lists suggested improvements, known gaps, and priorities for the Paraíso Ceylon Tours app.

---

## Launch Readiness (from full app audit)

**Status: Soft launch ready** – Core flows work; Supabase + Resend configured.

| Area | Ready | Needs Work |
|------|-------|------------|
| Client Portal | ✓ Home, Packages, Book, My Bookings, View Booking, Email confirmation | Validation |
| Admin Bookings | ✓ CRUD, supplier breakdown, options | Search/filters |
| Admin Packages | ✓ Full CRUD, options, cost breakdown | — |
| Admin Hotels & Suppliers | ✓ Hotels, transport, meal providers | — |
| Admin Tours | ✓ Create from leads | Edit/delete tours |
| Admin Calendar | ✓ Shows tours by date | — |
| Quotations | ✗ Mock data only | Full CRUD, link to leads |
| Payments | ✓ Persisted, linked to tours | — |
| Auth | ⚠️ Login exists, middleware optional | Re-enable middleware for /admin/* |
| Data | ✓ Leads in Supabase; packages/tours in file or memory | Extend Supabase for other entities |

**Current:** Supabase for leads, Resend for emails (booking, tour, payment, supplier). Auth middleware disabled — /admin is open.

---

## 1. Authentication & Security

| Improvement | Priority | Notes |
|-------------|----------|-------|
| Re-enable admin auth | High | Auth is currently disabled; `/admin` is open. Restore middleware and `/admin/login` flow when ready for production. |
| Session / JWT | High | Implement proper session management (e.g. NextAuth, JWT) once auth is re-enabled. |
| Rate limiting | Medium | Add rate limits on `/api/client/booking` and public forms to prevent abuse. |
| CSRF protection | Medium | Ensure forms and API calls are protected against CSRF when auth is active. |
| Input sanitization | Medium | Validate and sanitize all user input (names, emails, notes) to reduce injection risk. |

---

## 2. Data Persistence

| Improvement | Priority | Notes |
|-------------|----------|-------|
| Quotations storage | High | `mockQuotations` is used directly; quotations should be stored in the DB and linked to leads. |
| Payments storage | High | `mockPayments` is used directly; payments should be persisted and linked to leads/tours. |
| Real database | High | Replace JSON files with Prisma + PostgreSQL (or Supabase) for production. Prisma schema exists but is not wired to app logic. |
| Vercel in-memory | Low | Leads use Supabase when configured. Other entities (packages, tours, etc.) still file/in-memory. |

---

## 3. UX & Client Portal

| Improvement | Priority | Notes |
|-------------|----------|-------|
| Email confirmation | ✅ Done | Resend configured: booking request, tour confirmation, payment receipt, supplier reservation. |
| Booking lookup by email | High | "My Bookings" currently returns all leads for an email; ensure correct scoping and sorting. |
| Loading states | Medium | Add loading skeletons/spinners for package detail, booking confirmation, and admin tables. |
| Form validation | Medium | Add client-side validation (e.g. Zod, react-hook-form) for booking and lookup forms. |
| Mobile responsiveness | Low | Review layout on small screens; improve touch targets and spacing where needed. |
| Success feedback | Low | Improve visual feedback after booking (e.g. toast or clearer success page). |

---

## 4. Admin Portal

| Improvement | Priority | Notes |
|-------------|----------|-------|
| Quotations CRUD | High | Admin should create, edit, and send quotations linked to leads (not mock data). |
| Payments CRUD | High | Record incoming/outgoing payments and associate with leads/tours. |
| Calendar integration | Medium | Calendar view could show tours and availability from real data. |
| Search & filters | Medium | Add search and filters on bookings, tours, and packages tables. |
| Export | Low | Export bookings, tours, or reports (CSV/PDF). |
| Audit log | Low | Track who changed what and when for sensitive records. |

---

## 5. Performance & Reliability

| Improvement | Priority | Notes |
|-------------|----------|-------|
| Package image optimization | Medium | Use `next/image` for package images; add placeholders for slow loads. |
| Caching strategy | Medium | Consider caching for package list and static content. |
| Error retry | Low | Add retry logic for failed API calls and server actions. |
| Bundle size | Low | Lazy-load admin routes and heavy components where beneficial. |

---

## 6. Testing & Quality

| Improvement | Priority | Notes |
|-------------|----------|-------|
| Unit tests | Medium | Add tests for `package-price.ts`, `db.ts` helpers, and key utilities. |
| E2E tests | Medium | Use Playwright or Cypress for critical flows (booking, lookup, admin CRUD). |
| ESLint rules | Low | Run `npm run lint` in CI; fix any outstanding lint issues. |
| Type safety | Low | Ensure no `any` types; add stricter TypeScript checks if needed. |

---

## 7. DevOps & Production

| Improvement | Priority | Notes |
|-------------|----------|-------|
| Environment variables | High | Document required env vars (e.g. `DATABASE_URL`, `NEXTAUTH_*`) and use `.env.example`. |
| CI/CD | Medium | Add GitHub Actions (or similar) for lint, build, and tests. |
| Monitoring | Medium | Add error tracking (e.g. Sentry) and basic analytics. |
| Backup | High | Ensure database backups when moving to a real DB. |

---

## Quick reference: current mock data counts

| Entity | Count |
|--------|-------|
| Leads | 5 |
| Packages | 15 |
| Tours | 5 |
| Quotations | 5 |
| Payments | 5 |
| Hotels | 8 |
| Transport | 5 |
| Meal Providers | 5 |

Demo lookup: `PCT-20260312-A3B7` or `john.mitchell@email.com`, `marie.d@outlook.fr`, `zhang.wei@company.cn`.
