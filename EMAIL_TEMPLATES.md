# Email Templates & Configuration

## Configuration Status

| Component | Status |
|-----------|--------|
| **Resend API** | Configured (`RESEND_API_KEY` in Vercel) |
| **Client Tour Confirmation** | Sends when tour is scheduled (with invoice PDF) |
| **Supplier Reservation (auto)** | Sends when tour is scheduled—one email per supplier |
| **Payment Receipt** | Sends when tour marked "completed & paid" |
| **Manual Email Suppliers** | mailto opens with professional pre-filled body |

---

## Supplier Reservation Emails (Automatic)

When you **Schedule a tour** from a booking, the app sends tailored emails to each supplier (hotels, transport, meals). Each type has its own template.

### 1. Accommodation (Hotel)

**Subject:** `Room reservation request – PCT-YYYYMMDD-XXXX – Guest Name`

**Structure:**
- Header: "Reservation Request" / "Paraíso Ceylon Tours"
- Guest name(s), number of guests, booking reference, package
- **Stay dates:** Check-in (full date), Check-out (full date)
- Accommodation: room/type (e.g. "Deluxe Double Room")
- **Billing:** Bill to **Paraíso Ceylon Tours**
- Professional signature: Paraíso Ceylon Tours, tagline, email

**Style:** Georgia serif, teal accent, clean table layout, warm cream background.

---

### 2. Transport

**Subject:** `Transport reservation – PCT-YYYYMMDD-XXXX – Guest Name`

**Structure:**
- Header: "Transport Reservation"
- Guest name(s), passengers, reference, package
- **Service dates:** From, To (formatted)
- Vehicle/service type (e.g. "Private car with driver")
- **Billing:** Bill to **Paraíso Ceylon Tours**
- Same signature

---

### 3. Meals

**Subject:** `Meal reservation – PCT-YYYYMMDD-XXXX – Guest Name`

**Structure:**
- Header: "Meal / Catering Reservation"
- Guest name(s), guests, reference, package
- **Service dates:** From, To
- Meal plan type (e.g. "Half board")
- **Billing:** Bill to **Paraíso Ceylon Tours**
- Same signature

---

## Manual “Email Suppliers” (Booking Detail Page)

When you click **Email suppliers** on a booking, your email client opens with a pre-filled message:

```
Dear Sir/Madam,

We would like to request a reservation for our guest. Please find the details below:

GUEST & BOOKING
Guest name(s): [Name] and [Accompanied Guest]
Number of guests: [Pax]
Booking reference: [Ref]
Package: [Package]

DATES
Check-in: [Full date]
Check-out: [Full date]

BILLING
Bill to: Paraíso Ceylon Tours

Please confirm availability and send us your best rate. We look forward to your reply.

Kind regards,

Paraíso Ceylon Tours
Crafted journeys across Sri Lanka
hello@paraisoceylontours.com
```

---

## Data Included in Supplier Emails

| Field | Source | Notes |
|-------|--------|------|
| Guest name(s) | Lead name + accompanied guest | e.g. "John Smith and Jane Smith" |
| Check-in | Tour start date | Full format (e.g. Monday, 15 January 2025) |
| Check-out | Tour end date | Same format |
| Room/vehicle/meal type | Package option label | From selected accommodation/transport/meal |
| Reference | Lead reference (e.g. PCT-YYYYMMDD-XXXX) | For lookup |
| Bill to | Fixed | Paraíso Ceylon Tours |

---

## Client Emails

### Tour Confirmation
- Sent when tour is scheduled
- Includes package, dates, pax, reference, booking link
- Invoice PDF attached when available

### Payment Receipt
- Sent when tour is marked “completed & paid”
- Amount, description, date, reference
