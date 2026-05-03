# Smoke test — run after every deploy

A 5-minute checklist to confirm the booking → schedule → invoice →
emails pipeline works end-to-end. If every box is checked, the
deploy is good.

If anything fails, paste the specific step + observed output to the
maintainer (or open `/admin/health` first — the dashboard answers
most "what went wrong" questions in one glance).

---

## Pre-flight

- [ ] **Deploy is live**: latest commit on `main` shows "Ready" in
  Vercel dashboard.
- [ ] **`/admin/health` is all green** (or expected yellows). If
  any row is red, fix it before continuing — most other tests
  will fail downstream.
  - Email provider: green or yellow (yellow = sandbox sender,
    OK for testing)
  - Database: green
  - Booking guest emails: green
  - Recent failures (24h): green or yellow
  - Financial reconciliation: green

---

## 1 · Public booking (packaged tour)

Open the public site `https://paraiso.tours/packages` in a private/incognito window.

- [ ] Pick any **published** package
- [ ] Click into it, then **Book this tour**
- [ ] Fill in:
  - Guest name (test value)
  - Email — **use a real address you control**
  - Phone (optional)
  - Travel date — anything 30+ days out
  - Pax — 2
- [ ] Pick accommodation / transport / meal options
- [ ] **Submit booking**

✅ Expected: redirect to `/booking-confirmed?ref=PCT-…` with the
reference shown.

✅ Expected within 30 seconds:
- Test email inbox receives a "Booking received" confirmation
  with branded teal header and gold "Booking received" kicker
- If admin email is set, the admin inbox receives the
  internal new-booking alert

---

## 2 · Public booking (custom journey)

Open `https://paraiso.tours/journey-builder` in a private window.

- [ ] Pick a travel date
- [ ] Add 2-3 destination stops with night counts
- [ ] Choose transport + meal options
- [ ] Submit with the same test email

✅ Expected: same redirect + same email patterns as Step 1, but
package name reads "Custom Sri Lanka journey".

---

## 3 · Admin sees the booking

Log into `/admin/bookings`.

- [ ] The two test bookings from Steps 1 + 2 appear at the top
  with status = **new**
- [ ] Both have a guest email visible
- [ ] Click into the packaged-tour booking

---

## 4 · Schedule the tour

On the booking detail page:

- [ ] Verify the package is linked + travel date is set
- [ ] Click **Approve & Schedule Tour**

✅ Expected on success: redirected to `/admin/tours/[id]`. The
booking appears in `/admin/calendar`.

✅ Expected on partial success (e.g. Resend not configured): a
yellow warnings panel BEFORE redirect, with one warning per
issue. Click "Continue to tour" to proceed.

---

## 5 · Verify the financial trail

After schedule succeeds:

- [ ] `/admin/receivable` shows a row for the test guest with
  the tour's total amount
- [ ] `/admin/payables` shows one row per linked supplier
- [ ] `/admin/invoices` shows a new invoice for this booking
- [ ] `/admin/payments` shows the receivable + payable rows
- [ ] `/admin/health` → Financial reconciliation row is still
  green (no drift)

---

## 6 · Verify emails went out

Check the test email inbox:

- [ ] Subject "Tour confirmation – PKG-…" arrived
- [ ] Body has the teal header band, gold "Booking confirmation"
  kicker, italic gold sign-off
- [ ] **Two PDF attachments**: invoice + itinerary
- [ ] Open the invoice PDF — branded header, gold-tinted total
  band, footer with company + page count
- [ ] Open the itinerary PDF — same branded header + day cards
  with gold left rule + accommodation pills

Then check `/admin/communications`:

- [ ] One row "guest_confirmation_emailed" — status = sent
- [ ] One row per linked supplier: "supplier_reservation_emailed"
  — status = sent. (If any supplier has no email on file, that
  row says "*_skipped" with a clear reason)
- [ ] Optional: "admin_new_booking_alert_sent" if admin email is
  configured under `/admin/settings`

---

## 7 · Resend a confirmation

In `/admin/communications`, find a row with template
"Tour confirmation (with invoice)".

- [ ] Click **Resend** → confirm dialog → **Yes**

✅ Expected:
- Toast or row updates to "Sent"
- The test inbox receives a duplicate of the email
- A NEW row appears in the inbox marked
  `metadata.resent: true`

---

## 8 · Mark Completed/Paid

Open the tour at `/admin/tours/[id]`.

- [ ] Click **Completed / Guest Paid**

✅ Expected:
- Tour status flips to "completed"
- A payment receipt email goes to the test inbox
- `/admin/payments` shows the incoming payment with status =
  completed
- `/admin/communications` records a "payment_receipt_emailed"
  row

---

## 9 · Generate a report

Open `/admin/reports`.

- [ ] Set date range to today
- [ ] Click **Download P&L (.pdf)**

✅ Expected:
- A branded PDF downloads with teal header + gold kicker
- 3 stat cards: Inbound / Outbound / Net (gold-tinted)
- The test booking's payment shows in the rows table
- Footer page count visible

Repeat with **Booking revenue (.pdf)**.

- [ ] PDF downloads with the test tour listed in the rows

---

## 10 · Quotation flow (if used by your business)

`/admin/quotations/new`:

- [ ] Fill in a corporate client + 2 line items
- [ ] **Save Draft**

On the quotation detail page:

- [ ] **Download PDF** → branded quotation with status pill =
  DRAFT
- [ ] Click **Mark as Sent** → status updates to "Sent"
- [ ] If client email is set, "Quotation emailed" appears in
  `/admin/communications`
- [ ] Re-download the PDF → status pill = SENT

---

## 11 · Cleanup

- [ ] Delete the two test bookings via
  `/admin/bookings/[id]` → **Delete** (or admin search)
- [ ] Delete the test tour via `/admin/calendar` → tour →
  **Delete**
- [ ] Delete the test invoice + payments

---

## Pass criteria

If all 11 sections completed without red errors and emails were
delivered to the test inbox, the deploy is **green** for guest +
admin flows.

If only Sections 1-7 passed and 8-10 weren't tested, mark the
deploy as **green for booking** — sufficient for letting new
guests book today, with secondary surfaces verified later.

If anything red surfaced, file an issue with:
- The exact step that failed
- Screenshot of the error message (or the row in
  `/admin/communications`)
- Browser + OS

---

## Time budget

| Step | Time |
|---|---|
| Pre-flight | 30s |
| 1 + 2 (public booking) | 2 min |
| 3 + 4 (admin schedule) | 1 min |
| 5 + 6 (verify trail + emails) | 1 min |
| 7 + 8 (resend + complete) | 1 min |
| 9 + 10 (reports + quotations) | 1 min |
| 11 (cleanup) | 30s |
| **Total** | **~6 min** |

---

## When to run this

- After every deploy that touches `actions/`, `lib/`, or
  `app/admin/`
- Before handing the system to a new admin / accountant for the
  first time
- After enabling `RESEND_API_KEY` or `RESEND_FROM_EMAIL` for the
  first time
- Once a month, even with no recent deploys, to catch silent
  regressions from upstream service drift
