# Paraíso Tours — architecture & operating principles

A working developer's tour of the system. Reading this end-to-end
should leave you able to:

1. Find any feature in the codebase from the surface area it
   touches (admin UI, public booking, server action, DB write, PDF,
   email).
2. Understand the failure modes that have already been engineered
   out, and which patterns enforce them.
3. Add a new feature without breaking the schema-tolerant write
   contract, the brand kit, or the audit-log observability.

If you've just landed in the repo and need to ship, start with the
[Quick reference](#quick-reference) at the bottom and skim the
[Failure modes engineered out](#failure-modes-engineered-out)
section.

---

## Stack

- **Framework**: Next.js 16 App Router, React 19, TypeScript strict.
- **DB**: Supabase (Postgres) via PostgREST, with a JSON-file +
  in-memory fallback layer for local development without
  credentials.
- **Hosting**: Vercel (auto-deploy from `main`).
- **Email**: Resend (configured via `RESEND_API_KEY` +
  `RESEND_FROM_EMAIL`).
- **WhatsApp**: Meta WhatsApp Cloud API (configured via
  `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` +
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN`).
- **PDF**: `jspdf` (server-side rendering for invoices,
  itineraries, quotations, vouchers, reports).
- **AI agent**: Anthropic SDK (Claude) with native tool use, JSON
  fallback, and a custom OODA loop. See `src/lib/agent-tools.ts`.

---

## Codebase layout

```
src/
├── app/
│   ├── (client)/              Public booking surfaces (no auth)
│   │   ├── packages/[id]/book/  Packaged-tour booking wizard
│   │   ├── journey-builder/     Custom journey wizard
│   │   ├── booking/[ref]/       Guest's own booking lookup
│   │   ├── my-bookings/         List view by email
│   │   └── booking-confirmed/   Post-submit thank-you page
│   ├── admin/                 Admin dashboard (auth gated)
│   │   ├── bookings/            Lead management
│   │   ├── calendar/            Scheduled tours
│   │   ├── communications/      Audit-log inbox (every email/WhatsApp event)
│   │   ├── health/              Single-page diagnostic (7 checks)
│   │   ├── insights/            Revenue trend + supplier concentration
│   │   ├── invoices/, payments/, payables/, receivable/, payroll/
│   │   ├── packages/, hotels/, activities/, destinations/, transportation/
│   │   ├── quotations/, employees/
│   │   ├── reports/             P&L / supplier / booking / payroll (PDF + CSV)
│   │   └── settings/            Company profile + integration env vars
│   ├── actions/               Server actions ("use server")
│   ├── api/                   Route handlers (PDF downloads, webhooks, etc.)
│   └── quotation/[id]/        Public read-only quotation view
└── lib/                      Pure logic, types, integrations
    ├── db.ts, db-supabase.ts   DB layer (see Schema-tolerant writes)
    ├── booking-pricing.ts      Price calc with NaN/zero guards
    ├── package-price.ts        Per-option price/cost calc
    ├── booking-breakdown.ts    Supplier rollup
    ├── email.ts                15 transactional templates
    ├── whatsapp.ts             3 outbound templates + inbound webhook
    ├── invoice-pdf.ts, itinerary-pdf.ts, quotation-pdf.ts,
    │   voucher-pdf.ts          4 branded PDFs
    ├── pdf-letterhead.ts       Shared brand kit (header band, footer, logo)
    ├── report-pdf.ts           Generic report PDF builder (4 reports use it)
    ├── agent-tools.ts          AI tool definitions (~30 tools)
    ├── audit.ts                Universal audit-log API
    └── types.ts                Single source for all entity types
```

---

## Failure modes engineered out

These bugs used to bite. They are now structurally prevented; new
code MUST preserve the patterns or it will reintroduce them.

### 1. `[object Object]` errors

**Bug**: Supabase returns plain-object errors (`{ message, code,
details, hint }`), NOT `Error` instances. `String({...})` returns
`"[object Object]"`. When an action's catch did
`String(err)` or `err instanceof Error ? err.message : String(err)`,
the user-facing text was useless.

**Pattern**: every catch site uses `extractErrorMessage(err)` from
`src/lib/db.ts`, which unwraps `message` / `details` / `hint` /
`code` into readable text and falls back to `JSON.stringify` for
exotic shapes.

```ts
import { extractErrorMessage } from "@/lib/db";

try {
  await someServerAction();
} catch (err) {
  return { error: extractErrorMessage(err) };
}
```

**New code**: never use `String(err)` in a catch. Always
`extractErrorMessage`.

### 2. Schema cache misses (PGRST204)

**Bug**: PostgREST returns `PGRST204` when a write payload includes
a column that's not in the production schema cache (because the
migration was never run, or the cache is stale). One missing column
killed the whole insert/update.

**Pattern**: every write goes through `tolerantInsertOne`,
`tolerantUpdateOne`, or `tolerantUpsertOne` in
`src/lib/db-supabase.ts`. They detect PGRST204, parse the missing
column out of the error, drop it from the payload, and retry. Up
to 12 retries before giving up. Stripped columns are logged via
`debugLog` for Vercel-log visibility.

```ts
const result = await tolerantInsertOne("hotels", row);
if (result.error || !result.data)
  throw result.error ?? new Error("createHotel failed");
return toHotel(result.data);
```

**New code**: never call `supabase!.from(...).insert(...)` directly.
Always use the helpers. NOT NULL columns without defaults still
throw (Postgres `23502`) — that's intentional, you can't fake a
required value.

### 3. Stuck submit buttons (network failures)

**Bug**: form submits without try/catch left buttons stuck on
"Saving…" forever when the action threw. User had to reload + lose
state.

**Pattern**: every form's submit handler wraps the action call in
`try { ... } catch { setError(...) } finally { setSubmitting(false) }`.
Buttons disable while pending and re-enable on every code path.

**New code**: any new form/button that calls a server action must
follow this shape. See `src/app/admin/employees/EmployeeForm.tsx`
for the canonical version.

### 4. NaN totals from corrupt pricing data

**Bug**: a single corrupt `price` (NaN, undefined, negative, string)
propagated through `Math.max(1, x)` (which is NaN-leaky) and stored
as a NaN total. Postgres `NUMERIC` accepts NaN, so the bad number
silently poisoned every downstream report.

**Pattern**: every multiplication uses `safeNum(value)` (returns 0
if non-finite or negative) and every count input uses `safeCount(value)`
(returns 1 if not a finite integer ≥ 1). See
`src/lib/booking-pricing.ts` and `src/lib/package-price.ts`.

**New code**: any new pricing helper applies these guards at every
field read.

### 5. Silent fire-and-forget failures

**Bug**: WhatsApp confirmations, internal admin alerts, AI agent
startups were `.catch(debugLog)` — failures only landed in the
debug log, never surfaced to admin. Guests weren't getting alerts;
admin had no signal.

**Pattern**: every fire-and-forget path's catch records an audit
event (`*_failed` or `*_skipped`) AND logs via debugLog. The
`*_failed` and `*_skipped` action types are added to `EMAIL_ACTIONS`
in `src/app/admin/communications/page.tsx` so they render in the
inbox.

**New code**: any new fire-and-forget surface follows the same
pattern. The MessageStatus chip system understands `_sent`,
`_received`, `_failed`, `_skipped` suffixes automatically.

### 6. Multi-currency math errors on dashboards

**Bug**: `getSupplierSpend` and `getRevenueTrend` summed amounts
across currencies as if they were one. USD + LKR + EUR added
together produced meaningless totals.

**Pattern**: helpers accept an optional `currency` filter and
default to the most-common currency. Other currencies are returned
as `excludedCurrencies` so the page discloses them rather than
silently dropping. See `src/lib/finance-insights.ts`.

**New code**: any new financial aggregator is single-currency by
default. Multi-currency views must either group-by-currency or
filter to one.

---

## Pipelines & flows

### Booking → Schedule pipeline

```
Public guest action                        Admin action
  /packages/[id]/book                        /admin/bookings/[id]
  /journey-builder           →   Lead   →    Approve & Schedule Tour
                                                ↓
                                  ┌─────────── scheduleTourFromLeadAction ───────────┐
                                  │                                                  │
                                  ↓                                                  ↓
                              createTour ─→ createInvoice ─→ createPayment       Audit events
                                  │              │              │                    │
                                  └──────────────┴──────────────┘                    ↓
                                                 ↓                       /admin/communications
                                       Tour appears in                        (inbox)
                                       /admin/calendar
                                                 +
                                       Receivable + Payables rows
                                                 +
                                       Email guest (confirmation + invoice + itinerary PDFs)
                                                 +
                                       Email each linked supplier (reservation request)
```

The pipeline is **idempotent within a single attempt** (all writes
use upsert / find-then-update patterns) and **rollback-safe through
DB write phase** (see `tours.ts:scheduleTourFromLeadAction` —
`rollback` ref is nulled once writes complete; everything after is
best-effort and logged).

### Brand kit propagation

```
/admin/settings → Company
  ├─ companyName
  ├─ tagline
  ├─ address
  ├─ phone
  ├─ email
  └─ logoUrl
        │
        └──→ Single source of truth, read by:
                ├─ pdf-letterhead.ts (4 PDFs + 4 reports)
                ├─ email.ts (15 templates via buildBrandedEmail)
                ├─ InvoiceLetterhead.tsx (on-screen invoice + voucher pages)
                ├─ whatsapp.ts (booking confirmation + 2 lifecycle templates)
                └─ Admin chrome
```

Update one field in `/admin/settings` → every downstream artifact
shows the new value on the next render. No per-template overrides,
no diverging copies.

### Audit log → Communications inbox

Every email send + WhatsApp send + WhatsApp receive + payable mark-paid +
schedule action records a row in `audit_logs` via `recordAuditEvent`.

`/admin/communications` filters those rows by an allow-list
(`EMAIL_ACTIONS` set in `src/app/admin/communications/page.tsx`)
and renders them with status chips:

| Action suffix | Chip | Meaning |
|---|---|---|
| `_sent`, `_emailed` | Sent (green) | Outbound, delivered |
| `_received` | Received (sky-blue) | Inbound from guest |
| `_failed` | Failed (red) | Tried, error returned |
| `_skipped` | Skipped (yellow) | Prerequisite missing |

To add a new comms event type:
1. Pick an action name with a `_sent` / `_failed` / `_skipped` /
   `_received` suffix.
2. Call `recordAuditEvent` with that action.
3. Add the action to `EMAIL_ACTIONS`.
4. The chip + filtering will work automatically.

---

## /admin/health — operations dashboard

A single page checking 7 things in one render. If any row is red or
yellow, admin knows what to fix without opening 6 different pages.

| # | Check | Red means |
|---|---|---|
| 1 | Email provider | `RESEND_API_KEY` missing |
| 2 | WhatsApp Business | (yellow only — optional) |
| 3 | Database | Supabase unreachable |
| 4 | Supplier emails | (yellow) some suppliers have no email |
| 5 | Booking guest emails | (yellow) some bookings missing email |
| 6 | Recent failures (24h) | Failed audit rows in last 24h |
| 7 | Financial reconciliation | Tour missing receivable / payables / amount mismatch |

To add a new check, append a new function to
`src/app/admin/health/page.tsx` that returns a `CheckResult` and add
it to the `Promise.allSettled` array. It'll auto-render with the
same chip + hint + deep-link pattern.

---

## AI agent — observability contract

Every tool the agent can call returns a `ToolResult` (see
`src/lib/agent-tools.ts`):

```ts
interface ToolResult {
  ok: boolean;
  summary: string;     // Goes into the chat as the assistant's
                       // visible explanation of what happened
  data?: unknown;      // Structured payload for downstream tool use
  error?: string;      // When ok=false
}
```

The `safe()` wrapper auto-handles try/catch with `extractErrorMessage`
so plain-object Supabase errors never reach the agent as
`[object Object]`.

The `schedule_tour_from_lead` tool reads the `warnings` array from
the action result and includes them in the summary so the agent
sees "Tour scheduled. 1 warning: Emails were skipped: Resend not
configured." instead of just "Tour scheduled successfully."

When adding a new tool that returns a non-trivial payload, mirror
this pattern so the agent doesn't lose information.

---

## Deploy → verify cycle

```
git push origin main
        ↓
Vercel auto-deploys (typically ~2 min to "Ready")
        ↓
Run docs/SMOKE_TEST.md against the live site (~6 min)
        ↓
Confirm /admin/health is all green (or expected yellows)
```

The smoke test walks public booking → admin schedule → financial
trail → emails → resend → completed/paid → reports → quotations.
If every section's ✅ Expected outcomes pass, the deploy is good.

---

## Quick reference

### Where do I add an…

| Thing | Where |
|---|---|
| New email template | `src/lib/email.ts` (use `buildBrandedEmail`) |
| New PDF document | New file in `src/lib/`, use `pdf-letterhead.ts` primitives |
| New report (table data) | `src/app/api/admin/reports/route.ts` (use `report-pdf.ts`) |
| New admin form | Mirror `EmployeeForm.tsx` shape (try/catch + submitting state) |
| New server action | `src/app/actions/...` — wrap in try/catch + `extractErrorMessage` |
| New audit event type | Call `recordAuditEvent`, add suffix-conventional name to `EMAIL_ACTIONS` if it should appear in /admin/communications |
| New AI tool | `src/lib/agent-tools.ts` — wrap in `safe()` |
| New health check | `src/app/admin/health/page.tsx` (CheckResult shape) |
| New WhatsApp template | `src/lib/whatsapp.ts` |

### Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — DB
- `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `APP_SETTINGS_SECRET` — auth
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — email (optional but
  scheduling skips emails without them)
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — WhatsApp (all optional)
- `ANTHROPIC_API_KEY` — AI agent (optional)

`/admin/health` and `/admin/settings → Notifications` show live
configuration status for each.

### How to run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Without Supabase credentials the app falls back to JSON files in
`.data/` so you can develop offline.

### Tests

```bash
node --test --import tsx src/lib/booking-pricing.test.ts
node --test --import tsx src/lib/email-shell.test.ts
```

Edge-case tests are pinned in `booking-pricing.test.ts` for the
NaN/negative/zero guards described in §4 above.

---

## Changelog of architectural commitments

This section documents big decisions for future maintainers. Each
entry pins a pattern that everyone should keep using.

- **2026-04**: Schema-tolerant writes added across all CRUD. Direct
  `supabase.from(...).insert/update` calls are deprecated; use the
  `tolerantInsertOne`/`tolerantUpdateOne`/`tolerantUpsertOne` helpers.
- **2026-04**: `extractErrorMessage` mandated in every catch site.
  `String(err)` and `err instanceof Error ? err.message : String(err)`
  are deprecated patterns.
- **2026-04**: Brand kit (`pdf-letterhead.ts` + `buildBrandedEmail`)
  is the source of truth for visual identity. New documents reuse
  these primitives — no per-template stylesheets.
- **2026-05**: NaN/negative guards (`safeNum` / `safeCount`) on
  every pricing multiplication. Required pattern for any new
  pricing helper.
- **2026-05**: Multi-currency-aware aggregators on dashboards.
  Single-currency-or-explicit-filter is the contract; never sum
  across currencies.
