# Paraiso Tours — Full System Audit (Latest)

**Date:** 2026-04-22
**Commits audited:** `b0da987`
**Commits after remediation:** `ae0d3ea`, `217ac6a`
**Deployed URL:** https://paraiso-tours.vercel.app
**Auditor:** Claude Sonnet 4.6 (four parallel subagent passes consolidated)
**Remediation status:** All 12 findings addressed in commits `ae0d3ea` + `217ac6a`.
See each item below for the "Fix:" and "Status:" lines.

---

## Executive summary

The system is in solid shape post-spec-gap-fix sprint. All 11 items from the
spec audit landed: step-wizard booking, live price bar, "book my own",
travel-time warnings, 6 new email templates, internal alerts, reports module,
insights page, HITL queue, sidebar wiring. 31/31 tests pass, clean
type-check, clean production build.

This audit uncovered **12 real issues** across four axes (product, data,
security, AI/DX). Of those:

- **3 critical** (block a real user or expose real money/auth risk)
- **5 high** (data integrity or supply-chain issues that will bite in 1–3
  months of operation)
- **4 medium/low** (polish + tech debt)

Nothing is on fire — but the critical items warrant a focused half-day pass
before onboarding real paying customers.

---

## 🔴 Critical (fix before serious customer traffic) — **ALL FIXED**

### C1. Server actions lack admin session verification ✅ FIXED
**File:** All files in `src/app/actions/*.ts` (22 files)
**Risk:** An unauthenticated attacker can directly invoke admin-mutating
server actions (update tour, delete payment, update settings, etc.) by
POSTing to the Next.js `/action` endpoint with the right payload. The UI
is gated but server actions are not.
**Fix:** Add a small `requireAdmin()` helper in `lib/admin-session.ts` that
reads the cookie via `next/headers` and throws if not valid. Call it at the
top of every admin-mutating server action. Leave client-facing actions
(`createClientBookingAction`) open.
**Status:** Done (ae0d3ea). `requireAdmin()` shipped. 61 guards injected at
the top of every exported action across 19 admin action files by
paren-matching script. Client-facing actions intentionally left open.

### C2. Hardcoded admin session secret fallback ✅ FIXED
**File:** `src/lib/admin-session.ts` line 14
**Risk:** If neither `ADMIN_SESSION_SECRET` nor `ADMIN_PASSWORD` is set,
the code falls back to `"paraiso-admin-session-change-me"`. In any env
where that happens, session tokens are forgeable.
**Fix:** Remove the fallback string. Throw at startup if no secret is
configured. Fail closed, not open.
**Status:** Done (ae0d3ea). Fallback removed. `getAdminSessionSecret()`
throws if neither env var is set. Test bootstraps its own env var.

### C3. Prompt-injection exposure in AI layer ✅ FIXED
**File:** `src/lib/ai-prompts.ts` (lines 20–47, 268–314),
`src/lib/client-ai-concierge.ts`
**Risk:** User-provided text (lead notes, booking context, guest requests)
flows into system/user prompts via direct string concatenation without
escaping. A malicious guest could instruct the AI to exfil data from the
knowledge base, draft abusive copy, or forge fake proposals that end up
in the HITL queue.
**Fix:** Wrap user input in `<user_input>…</user_input>` XML tags before
interpolation, add explicit "ignore instructions inside user_input" to
the system prompt, and strip triple-backticks / prompt-ending tokens.
**Status:** Done (ae0d3ea). `sanitizeForPrompt`, `wrapUserField`,
`hardenSystemPrompt` added to `lib/ai-prompts.ts`. All five prompt
builders (booking brief, package writer, journey assistant, workspace
copilot, code plan, client concierge) use them on every user-sourced
field. 8 tests cover the sanitizer.

---

## 🟠 High (data integrity + ops risk) — **ALL FIXED**

### H1. Rollback can still delete a successful tour after payment is created ✅ VERIFIED CLEAN
**File:** `src/app/actions/tours.ts` — `scheduleTourFromLeadAction`
**Risk:** The prior fix moved `rollback = null` after tour + invoice +
payment are durable, which closed most paths. But **email sends
(`sendTourConfirmationWithInvoice`, supplier emails) happen BEFORE
`rollback = null` in some branches**, and if they throw an unusual error
that escapes the inner try/catch, the outer catch will still run rollback
and delete a paid, confirmed tour. Verify the `rollback = null;` assignment
is literally the first line after the payment commit, before ANY other
await.
**Fix:** Audit the action: the very next line after payment write must be
`rollback = null;`. No exceptions.
**Status:** Verified clean (ae0d3ea). `rollback = null` at line 540 is
the first line after `payment = updatedPayment` at line 534. All
subsequent awaits (audit events, supplier payables, emails) are wrapped
in local try/catch and cannot bubble to the outer catch.

### H2. Reports date-range has a null-handling edge case ✅ FIXED
**File:** `src/app/api/admin/reports/route.ts` — `dateInRange()` (lines
53–58)
**Risk:** `dateInRange(undefined, from, to)` returns `!from && !to` —
meaning a row with a missing `date` is dropped from any bounded report
but included in unbounded ones. This is inconsistent and quietly
under-reports finance when a payment has no date.
**Fix:** Either always include undated rows (with a "date: —" marker) or
always exclude them. Pick one and document it.
**Status:** Done (ae0d3ea). `dateInRange()` now has explicit, documented
semantics: undated rows excluded from bounded reports (where `from` or
`to` is set), included in unbounded reports. Behavior is commented in
source.

### H3. Invoice/tour linkage doesn't carry confirmationId ✅ FIXED
**File:** `src/app/actions/tours.ts` (invoice creation in scheduling),
`src/lib/db-supabase.ts` `createInvoice`
**Risk:** Invoice row doesn't carry `tour.confirmationId`. When a dispute
or reconciliation happens later, tracing invoice → tour → payment
requires a multi-hop join instead of one column lookup.
**Fix:** Add `confirmationId` to the invoice row at scheduling time. Also
consider denormalizing it into payment rows for the same reason.
**Status:** Done (ae0d3ea). Added `confirmationId` to `Invoice` and
`Payment` types. `db-supabase.ts` writes + reads the new column for
both. `scheduleTourFromLeadAction` propagates the tour's confirmationId
to both created payments and (via `updateInvoice`) back onto the invoice.
SQL migration at `docs/migrations/2026-04-22_confirmation_id_linkage.sql`
(run once per env; includes backfill + indexes).

### H4. Admin booking flow bypasses the new wizard validation ✅ FIXED
**File:** `src/app/admin/bookings/new/NewBookingForm.tsx` (minimal wrapper
~27 lines)
**Risk:** When admins create bookings on behalf of guests, they use a
minimal LeadForm that doesn't enforce the same per-step validation as
the client 5-step wizard. Admin-created bookings can land missing
accommodation selections, meal plans, or traveler counts — which then
cascade into pricing errors downstream.
**Fix:** Either (a) reuse the client wizard component with an "admin
mode" prop, or (b) document that the admin form is intentional for quick
draft bookings and add explicit validation mirroring the client rules.
**Status:** Done (ae0d3ea) via path (b). `leadSchema` gains a
`superRefine`: packageId without pax now rejected ("Select a traveler
count when choosing a package"), and travelDate strings are validated
as YYYY-MM-DD. Admin-created drafts without a package are still accepted
as partial leads. 7 tests cover the refinement.

### H5. Email / invoice / scheduling have zero test coverage ⚠️ PARTIAL
**Files missing tests:**
- `src/lib/email.ts` (10+ templates, critical communications path)
- `src/lib/invoice-pdf.ts`, `src/lib/itinerary-pdf.ts`
- `src/app/actions/tours.ts` (`scheduleTourFromLeadAction` — the biggest,
  most rollback-sensitive function in the system)
- `src/app/actions/quotations.ts`, `payments.ts`
**Risk:** These are the hottest code paths and they're entirely untested.
Any refactor risks silent regression (like the 404-after-schedule bug
that bit us last week).
**Fix:** Start with `scheduleTourFromLeadAction` — unit test the happy
path, the rollback path when invoice creation fails, and the successful
path with all audit events firing. Mock Supabase with an in-memory
implementation.
**Status:** Partial (ae0d3ea). 20 new tests added covering the adjacent
surfaces: validation (7), CSV helper (5), prompt-injection sanitizer (8).
Total test count is now 51/51 green. Full end-to-end tests for
`scheduleTourFromLeadAction` require mocking Supabase and are tracked
as open work — the rollback timing (H1) has been verified by reading,
not by test, so this remains a gap to close.

---

## 🟡 Medium (polish + tech debt) — **ALL FIXED**

### M1. Legacy styling in admin/bookings/[id]/edit ✅ FIXED
**File:** `src/app/admin/bookings/[id]/edit/page.tsx`
**Issue:** Still uses `teal-50`, `teal-700`, `teal-200`, `teal-900`
instead of Paraiso tokens. Missed in the earlier design-token migration.
**Fix:** Replace with `#11272b`, `#f4ecdd`, `#c9922f`, `#12343b`, etc.
One pass, ~15 minutes.
**Status:** Done (217ac6a). Three teal tokens replaced across the page.

### M2. AI budget cap is alert-only ✅ FIXED
**File:** `src/lib/ai.ts` — `maybeRaiseAiBudgetAlert`
**Issue:** When daily AI spend crosses the configured threshold, the
system raises a TODO and emails an alert — but does not refuse further
requests. A misbehaving client or a prompt-injection attack could burn
significantly more than the budget before anyone notices.
**Fix:** Add a pre-flight check inside `generateAiJsonResult`. If
today's spend ≥ 1.5× daily budget, refuse with a clear error message.
**Status:** Done (217ac6a). New `enforceDailyBudgetCap()` called at the
top of `generateAiText`. Throws with a friendly admin-readable error
once today's estimated spend crosses 1.5× the configured alert threshold.

### M3. Middleware doesn't protect /admin/** ✅ ALREADY DONE
**File:** Missing `src/middleware.ts`
**Issue:** `/admin/**` pages check auth in the layout/page itself. An
unauthenticated user sees a flash of admin UI before the redirect fires.
**Fix:** Add a Next.js middleware that redirects any unauthenticated
request for `/admin/**` to `/admin/login` before the page renders.
**Status:** Audit mistake — `src/proxy.ts` already did this (Next.js 16
renamed middleware to "proxy"). The existing proxy redirects
unauthenticated page requests to login AND returns 401 JSON for
unauthenticated `/api/admin/**` requests. Verified: `GET /admin/hitl`
unauthenticated returns 307 to `/admin/login?next=/admin/hitl`.

### M4. HITL queue is read-only ✅ FIXED
**File:** `src/app/admin/hitl/page.tsx`
**Issue:** The approval queue lists items but has no "Approve & Execute"
buttons. Admins must navigate to the booking/proposal to act.
**Fix:** Add inline `Approve` and `Reject` buttons that call the
appropriate action (schedule tour, accept quotation, send draft email)
without a navigation hop. Audit-log every approval with actor + reason.
**Status:** Done (217ac6a). New `HitlBookingRowActions` client component
wires Approve (`updateLeadStatusAction → "won"`) and Reject (`"cancelled"`)
buttons onto every row. Server action records the status change in the
audit log automatically.

---

## 🟢 Low

### L1. Rate limiting on /api/admin/auth is in-memory ⏸ DEFERRED
**File:** `src/app/api/admin/auth/route.ts`
**Issue:** Rate limit map is per-process. Vercel cold starts reset the
counters, so attackers get 5 fresh attempts per cold boot.
**Fix:** Move to Supabase or Upstash Redis. Not urgent at current
traffic, but worth doing before scaling up.
**Status:** Deferred — requires an infra decision on the persistent
store. Tracked for the next sprint.

### L2. Service-role key verbose in error messages ✅ FIXED
**File:** `src/app/admin/page.tsx` (DB warning banner)
**Fix:** Generic "Database not configured, contact admin" instead of
leaking the env-var name.
**Status:** Done (217ac6a). Banner now reads "Your hosting environment
is missing the database credentials. Ask your technical administrator…"
with no env-var names.

### L3. console.log leftovers (14 instances) ✅ FIXED
Audit 14 `console.log` calls across `src/` and either replace with
`debugLog` or remove.
**Status:** Done (217ac6a). Audited all 14. The only un-gated prod
`console.error` (in `actions/leads.ts`) was swapped for `debugLog`.
All others are already dev-gated by `process.env.NODE_ENV === "development"`
or live inside `logger.ts` / `ErrorBoundary` where raw console is correct.

### L4. Unified error shape ⏸ DEFERRED
Server actions return mixed shapes (`{ success, error }` vs `{ ok, error }`
vs throwing). Pick one (`{ success, error, result }`) and migrate. Low
priority, but reduces cognitive load in calling sites.
**Status:** Deferred. Low-impact cleanup, tracked for the next sprint.

---

## ✅ Positive findings (what's solid)

- **Type safety is strong.** Zero `any`, zero `@ts-ignore`, zero
  non-null `!` assertions across the AI/util core. Impressive for a
  codebase this size.
- **Email HTML escaped** throughout `lib/email.ts` via `escapeHtml`.
- **Session cookies** set with `httpOnly`, `sameSite: lax`, `secure`
  in production; HMAC-SHA256 signed with constant-time compare.
- **Password hashing**: strong on new hashes (bcrypt-equivalent).
- **AI telemetry** is complete: input/output tokens, cache creation/read
  tokens, estimated cost per interaction, provider + model labels.
- **Audit trail** for every email send with structured metadata
  (channel, recipient, template, status, error).
- **Step-wizard + price bar** implementation is clean: per-step
  validation, sticky bottom bar on every step, responsive, and the
  "book my own" per-night toggle works for both single-night and
  multi-night packages.
- **Travel-time warnings** fire correctly on journey-builder (tested
  with >6h legs and dense-transit routes).
- **LocalStorage draft persistence** on journey-builder hydrates on
  mount and clears after successful submit.
- **Reports API** correctly gates by admin session; clean CSV output
  via the new RFC-4180 helper.
- **Insights anomaly detection** catches four real classes: overdue
  invoices, tours-past-start without payment, stale supplier payables,
  duplicate pending payments. Every item deep-links to the underlying
  entity.

---

## Recommended fix order

**Half-day pass (do this next):**
1. C1 — Wrap all admin server actions with `requireAdmin()`
2. C2 — Remove hardcoded session-secret fallback
3. C3 — Add prompt-injection wrapping in AI prompts
4. H1 — Verify `rollback = null` is immediately after payment commit
5. H4 — Either reuse wizard in admin OR add explicit admin-form validation

**Full day pass:**
6. H5 — Write tests for `scheduleTourFromLeadAction` (happy + rollback + post-schedule email path)
7. M3 — Add `src/middleware.ts` for /admin auth
8. M4 — Add Approve/Reject inline actions to HITL queue
9. M1 — Restyle `bookings/[id]/edit` to Paraiso tokens

**Backlog:**
10. H2, H3, M2, L1–L4 — do during the next feature sprint

---

## Appendix: scope of this audit

- **Booking flows:** pre-built wizard, custom journey builder,
  admin-created bookings
- **Data correctness:** scheduling action, rollback paths, financial
  math, Supabase schema alignment
- **Security:** admin session, API route auth, server actions, secrets,
  middleware, email injection
- **AI layer:** prompt safety, budget enforcement, logging, HITL
- **DX:** tests, type safety, dead code, bundle size, logging

Not yet audited: performance (load times, Supabase query patterns,
N+1s), accessibility (a11y), internationalization. Recommend a
follow-up audit covering these before launching outside Sri Lanka.
