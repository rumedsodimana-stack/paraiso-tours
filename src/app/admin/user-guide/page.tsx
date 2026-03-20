import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Bot,
  Home,
  Package,
  MapPin,
  Calendar,
  Users,
  FileText,
  Banknote,
  Settings,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);

  return {
    title: `User Guide | ${brandName}`,
    description: `Complete guide to using the ${brandName} booking and operations app`,
  };
}

export default async function UserGuidePage() {
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);

  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <div className="rounded-2xl border border-teal-200/60 bg-teal-50/30 p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-100">
            <BookOpen className="h-7 w-7 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">
              {brandName} — User Guide
            </h1>
            <p className="mt-2 text-stone-600">
              Everything you need to know to use this app from A to Z. Use this guide to onboard
              staff, troubleshoot, and understand the full booking and operations flow.
            </p>
            <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3 text-sm">
              <strong className="text-teal-800">Recent updates:</strong> Global search (bookings, packages, tours, invoices, employees, suppliers), Change password in Settings, structured logging, Things to do in Sri Lanka slideshow.
            </div>
          </div>
        </div>
      </div>

      {/* Recent Updates */}
      <div className="rounded-xl border border-teal-200/60 bg-teal-50/20 p-4">
        <h3 className="font-semibold text-stone-800">Recent updates</h3>
        <ul className="mt-2 space-y-1 text-sm text-stone-600">
          <li>• <strong>Booking itinerary</strong> — click a booking name or reference to view full day-by-day summary with hotels, transport, meals</li>
          <li>• <strong>Email suppliers</strong> — one-click mailto to all suppliers (hotels, transport, meals) with pre-filled reservation request</li>
          <li>• <strong>Per-night accommodation</strong> — clients choose different hotels for each night on multi-day packages</li>
          <li>• <strong>Star ratings</strong> — set for hotels in Hotels &amp; Suppliers; shown on client booking form</li>
        </ul>
      </div>

      {/* Table of Contents */}
      <nav className="rounded-xl border border-stone-200 bg-white/80 p-6">
        <h2 className="text-lg font-semibold text-stone-900">Table of contents</h2>
        <ol className="mt-4 space-y-2 text-sm">
          <li><a href="#overview" className="text-teal-600 hover:underline">1. Overview</a></li>
          <li><a href="#client-portal" className="text-teal-600 hover:underline">2. Client Portal (Guest-facing)</a></li>
          <li><a href="#admin-portal" className="text-teal-600 hover:underline">3. Admin Portal (Staff)</a></li>
          <li><a href="#key-concepts" className="text-teal-600 hover:underline">4. Key Concepts</a></li>
          <li><a href="#auth-password" className="text-teal-600 hover:underline">5. Login & Password</a></li>
          <li><a href="#ai-setup" className="text-teal-600 hover:underline">6. AI Setup</a></li>
          <li><a href="#whatsapp" className="text-teal-600 hover:underline">7. WhatsApp Integration</a></li>
          <li><a href="#logging" className="text-teal-600 hover:underline">8. Logging</a></li>
          <li><a href="#launch-readiness" className="text-teal-600 hover:underline">9. Launch Readiness Checklist</a></li>
        </ol>
      </nav>

      {/* Recent updates */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
        <h3 className="font-semibold text-stone-900">Recent updates</h3>
        <ul className="mt-2 space-y-1 text-sm text-stone-600">
          <li>• Click any booking to view its <strong>itinerary summary</strong> (hotels per night, transport, meals)</li>
          <li>• <strong>Email suppliers</strong> — send reservation requests to all suppliers at once from the booking detail page</li>
          <li>• <strong>Per-night accommodation</strong> — clients choose different hotels for each night on multi-day packages</li>
          <li>• Hotel <strong>star ratings</strong> and <strong>email</strong> fields in Hotels &amp; Suppliers</li>
        </ul>
      </div>

      {/* 1. Overview */}
      <section id="overview" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">1</span>
          Overview
        </h2>
        <p className="mt-4 text-stone-600">
          {brandName} is a tour booking and operations app for Sri Lanka. It has two main
          parts: the <strong>Client Portal</strong> (where guests browse packages, book, and view their
          bookings) and the <strong>Admin Portal</strong> (where staff manage bookings, packages,
          suppliers, tours, quotations, and payments).
        </p>
        <div className="mt-4 flex gap-4">
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700" target="_blank">
            Open Client Portal
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/admin" className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Admin Dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* 2. Client Portal */}
      <section id="client-portal" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">2</span>
          Client Portal (Guest-facing)
        </h2>
        <p className="mt-4 text-stone-600">
          The client portal is the public website where guests browse tours, make booking requests,
          and view their bookings.
        </p>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Home className="h-5 w-5 text-teal-600" />
              Home (/)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Hero section with &quot;Explore tours&quot; and &quot;Manage my bookings&quot;</li>
              <li>Trust badges (24/7 support, best price, etc.)</li>
              <li><strong>Things to do in Sri Lanka</strong> — slideshow of activities (whale watching, hiking, surfing, cultural tours, etc.) with images</li>
              <li>Featured top tours — cards with price and &quot;Book now&quot;</li>
              <li><strong>View your booking</strong> — enter reference or email to look up a booking</li>
            </ul>
            <p className="mt-2 text-xs text-stone-500">
              Demo: Try <code className="rounded bg-stone-100 px-1">PCT-20260312-A3B7</code> or{" "}
              <code className="rounded bg-stone-100 px-1">john.mitchell@email.com</code>
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Package className="h-5 w-5 text-teal-600" />
              Packages (/packages)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Browse all published tour packages</li>
              <li>Filter by region (All, Colombo, Kandy, Galle, Ella, Sigiriya, Yala, Nuwara Eliya, Southern Coast, Cultural Triangle, Tea Country)</li>
              <li>Search by name or description</li>
              <li>Sort by price, rating, or name</li>
              <li>Each card shows &quot;From X USD / person&quot; (lowest possible price with default options)</li>
              <li>Click &quot;Book now&quot; to see package details</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <MapPin className="h-5 w-5 text-teal-600" />
              Package Detail &amp; Book (/packages/[id] and /packages/[id]/book)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Package name, duration, region, rating, description</li>
              <li>Full itinerary with days and accommodations — <strong>per-night accommodation</strong> for multi-night packages (choose hotel for each night)</li>
              <li>Hotel star ratings shown under accommodation options (when set in Hotels &amp; Suppliers)</li>
              <li>Inclusions and exclusions</li>
              <li><strong>Book now</strong> — choose Accommodation (per night), Transport, Meal plan</li>
              <li>Live total price as options and pax change</li>
              <li>Must select one option per category (accommodation, transport, meal)</li>
              <li>Form: name, email, phone, travel date, pax, notes</li>
              <li>On submit → creates a lead and redirects to booking-confirmed with reference</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Users className="h-5 w-5 text-teal-600" />
              My Bookings (/my-bookings)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Enter email to see all bookings for that email</li>
              <li><strong>Pending requests</strong> — leads without a confirmed tour yet</li>
              <li><strong>Confirmed tours</strong> — leads that have a linked tour</li>
              <li>Click to view details (uses reference for pending, tour id for confirmed)</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <FileText className="h-5 w-5 text-teal-600" />
              View Booking (/booking/[ref])
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Look up by <strong>booking reference</strong> (e.g. PCT-20260312-A3B7) or <strong>tour ID</strong></li>
              <li>Optional: add email to verify identity</li>
              <li>If pending: shows &quot;Pending approval&quot; with package info</li>
              <li>If confirmed: shows full itinerary, dates, inclusions/exclusions</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Admin Portal */}
      <section id="admin-portal" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">3</span>
          Admin Portal (Staff)
        </h2>
        <p className="mt-4 text-stone-600">
          Access the admin at <strong>/admin</strong>. Default password: <code className="rounded bg-stone-100 px-1">admin123</code>. Change it in Settings → Change Admin Password (or set <code className="rounded bg-stone-100 px-1">ADMIN_PASSWORD</code> env on Vercel).
        </p>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Home className="h-5 w-5 text-teal-600" />
              Dashboard (/admin)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Stats: Active Bookings, Scheduled Tours, Revenue, Conversion Rate</li>
              <li><strong>Global search</strong> — type in the header to search bookings, packages, tours, invoices, payments, employees, suppliers; also suggests navigation pages (Bookings, Calendar, Finance, etc.)</li>
              <li>World Clock widget</li>
              <li>Exchange Rates widget</li>
              <li>Upcoming Tours list</li>
              <li>Recent Bookings list (with reference and status)</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Users className="h-5 w-5 text-teal-600" />
              Bookings (/admin/bookings)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>List of all leads (bookings) — search by name, email, reference; filter by status</li>
              <li>Click a booking (name or reference) to open its <strong>itinerary summary</strong></li>
              <li>Itinerary view: full day-by-day breakdown with selected hotel per night, transport, meals, total price</li>
              <li>Add New Booking — manual lead creation</li>
              <li>Edit Booking — update status, package, dates, notes</li>
              <li><strong>Breakdown by Supplier</strong> — shows cost per accommodation, transport, meal provider</li>
              <li><strong>Email suppliers</strong> — on the booking detail page, opens your email client with all supplier emails (hotels, transport, meals) and a pre-filled reservation request. Add supplier <strong>Email</strong> in Hotels &amp; Suppliers.</li>
              <li>Status flow: new → contacted → quoted → negotiating → won / lost</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Package className="h-5 w-5 text-teal-600" />
              Tour Packages (/admin/packages)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Create, edit, delete packages</li>
              <li>Fields: name, destination, region, duration, price, image URL, description</li>
              <li>Itinerary days (title, description, accommodation) — each day can have its own hotel choices</li>
              <li><strong>Per-night accommodation</strong> — clients can choose different hotels for each night on multi-day packages</li>
              <li><strong>Options editor</strong>: Meal plans, Transport, Accommodation (per night or package-wide), Custom add-ons</li>
              <li>Options link to Hotels &amp; Suppliers (select from dropdown); prices auto-fill from supplier</li>
              <li>Price types: per person, per night, per day, total</li>
              <li>Cost Breakdown (on package detail) — sample margin with default options</li>
              <li>Itinerary summary on package page shows hotel choices per day</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <MapPin className="h-5 w-5 text-teal-600" />
              Hotels &amp; Suppliers (/admin/hotels)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Three types: <strong>Hotels</strong>, <strong>Transport</strong>, <strong>Meal Providers</strong></li>
              <li>Add Hotel, Add Vehicle, Add Meal Provider</li>
              <li>Fields: name, type, location, <strong>email</strong> (for reservation requests), contact (phone), default price, currency, notes</li>
              <li>Hotels: optional <strong>star rating</strong> (1–5) — shown on client booking form</li>
              <li>Used when configuring package options (accommodation, transport, meal plans)</li>
              <li><strong>Email suppliers</strong> on bookings uses these email addresses to send reservation requests</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Calendar className="h-5 w-5 text-teal-600" />
              Tours (/admin/tours/new) &amp; Calendar (/admin/calendar)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li><strong>Create Tour</strong> — select lead, package, start date, pax</li>
              <li>Creates a scheduled tour linked to the lead (client can then see confirmed itinerary)</li>
              <li>Calendar view — monthly grid with tours by date</li>
              <li>Upcoming tours list with status badges</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <FileText className="h-5 w-5 text-teal-600" />
              Quotations (/admin/quotations)
            </h3>
            <p className="mt-2 text-sm text-amber-700">
              <strong>Note:</strong> Currently uses mock data. Quotations are not yet persisted or linked to leads in the database.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Lists quotations with client, package, amount, status</li>
              <li>Status: draft, sent, accepted, declined</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Banknote className="h-5 w-5 text-teal-600" />
              Payments (/admin/payments) &amp; Invoices (/admin/invoices)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Incoming/outgoing summary — data persisted in data/*.json (or in-memory on Vercel)</li>
              <li>Payment list with type, amount, description, client, status</li>
              <li>Mark payment received — syncs linked invoice status to paid</li>
              <li>Create invoice from booking; status syncs between invoice and payments</li>
            </ul>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white/80 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Settings className="h-5 w-5 text-teal-600" />
              Settings (/admin/settings)
            </h3>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
              <li>Theme selector — 11 visual themes (glass, dark, light variants)</li>
              <li>AI control center — Gemini API key, model routing, and tool switches</li>
              <li><strong>Change Admin Password</strong> — update login password (local only; on Vercel use ADMIN_PASSWORD env var)</li>
              <li>WhatsApp Business integration</li>
              <li>Profile, Company, Notifications cards (UI only — not wired to backend yet)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. Key Concepts */}
      <section id="key-concepts" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">4</span>
          Key Concepts
        </h2>
        <div className="mt-6 space-y-4">
          <div>
            <h4 className="font-semibold text-stone-800">Lead vs Tour</h4>
            <p className="mt-1 text-sm text-stone-600">
              A <strong>Lead</strong> is a booking request (from client portal or manual entry). A <strong>Tour</strong> is
              created when staff confirms a lead and schedules it. One lead can have at most one tour.
              Until a tour exists, the client sees &quot;Pending approval&quot;.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-stone-800">Booking Reference</h4>
            <p className="mt-1 text-sm text-stone-600">
              Format: <code className="rounded bg-stone-100 px-1">PCT-YYYYMMDD-XXXX</code> (e.g. PCT-20260312-A3B7).
              Assigned when a lead is created via Client Portal. Used for client lookup.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-stone-800">Package Options</h4>
            <p className="mt-1 text-sm text-stone-600">
              Each package has accommodation, transport, and meal options. The base price is per person.
              Options add to the total (per person, per night, per day, or fixed). The &quot;From&quot; price on cards
              uses the cheapest combination.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-stone-800">Data Storage (Local)</h4>
            <p className="mt-1 text-sm text-stone-600">
              Locally, data is stored in <code className="rounded bg-stone-100 px-1">data/*.json</code>.
              Run <code className="rounded bg-stone-100 px-1">npm run seed</code> to refresh packages from mock data.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Login & Password */}
      <section id="auth-password" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">5</span>
          Login &amp; Password
        </h2>
        <p className="mt-4 text-stone-600">
          <strong>Default password:</strong> <code className="rounded bg-stone-100 px-1">admin123</code>. Change it in <Link href="/admin/settings" className="text-teal-600 hover:underline">Settings</Link> → Change Admin Password.
        </p>
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-stone-600">
          <li><strong>Local:</strong> Password stored in <code className="rounded bg-stone-100 px-1">data/settings.json</code> (hashed). Change anytime from Settings.</li>
          <li><strong>Vercel:</strong> Set <code className="rounded bg-stone-100 px-1">ADMIN_PASSWORD</code> in Project Settings → Environment Variables. Cannot be changed from UI. Default: <code className="rounded bg-stone-100 px-1">admin123</code> if not set.</li>
          <li>Auth middleware is currently disabled (admin is open). Re-enable when ready for production.</li>
        </ul>
      </section>

      {/* 6. AI Setup */}
      <section id="ai-setup" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">6</span>
          AI Setup
        </h2>
        <div className="mt-6 rounded-xl border border-stone-200 bg-white/80 p-6">
          <h3 className="flex items-center gap-2 font-semibold text-stone-900">
            <Bot className="h-5 w-5 text-teal-600" />
            Gemini runtime
          </h3>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
            <li>Open <Link href="/admin/settings?section=ai" className="text-teal-600 hover:underline">Settings → AI Control Center</Link>.</li>
            <li>Preferred env variable: <code className="rounded bg-stone-100 px-1">GEMINI_API_KEY</code>.</li>
            <li>You can save an encrypted fallback key inside settings if needed.</li>
            <li>Default model routing uses <code className="rounded bg-stone-100 px-1">gemini-2.5-flash-lite</code>, <code className="rounded bg-stone-100 px-1">gemini-2.5-flash</code>, and <code className="rounded bg-stone-100 px-1">gemini-2.5-pro</code>.</li>
            <li>Use the header AI button for quick chat, or <Link href="/admin/ai" className="text-teal-600 hover:underline">AI Workspace</Link> for the full screen.</li>
          </ul>
        </div>
      </section>

      {/* 7. WhatsApp Integration */}
      <section id="whatsapp" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">7</span>
          WhatsApp Integration
        </h2>
        <p className="mt-4 text-stone-600">
          Connect your WhatsApp Business account to send automated messages (e.g. booking confirmations)
          via Meta&apos;s WhatsApp Cloud API.
        </p>
        <div className="mt-6 space-y-4">
          <div>
            <h4 className="font-semibold text-stone-800">Setup</h4>
            <p className="mt-1 text-sm text-stone-600">
              Go to <Link href="/admin/settings" className="text-teal-600 hover:underline">Settings</Link> and use the
              WhatsApp Business section. Add these environment variables:
            </p>
            <ul className="mt-2 space-y-1 font-mono text-sm text-stone-700">
              <li>• WHATSAPP_ACCESS_TOKEN — Meta Graph API token</li>
              <li>• WHATSAPP_PHONE_NUMBER_ID — WhatsApp Business phone number ID</li>
              <li>• WHATSAPP_WEBHOOK_VERIFY_TOKEN — Random string for webhook verification</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-stone-800">Automated messages</h4>
            <p className="mt-1 text-sm text-stone-600">
              When a client books from the Client Portal and provides a phone number, a confirmation
              message is sent automatically (if WhatsApp is configured). The message includes booking
              reference and package name.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-stone-800">Webhook</h4>
            <p className="mt-1 text-sm text-stone-600">
              Register <code className="rounded bg-stone-100 px-1">/api/whatsapp/webhook</code> in the Meta
              Developer Console to receive incoming messages and delivery status. Use the same
              WHATSAPP_WEBHOOK_VERIFY_TOKEN for verification.
            </p>
          </div>
          <p className="text-sm text-stone-500">
            Full setup guide:{" "}
            <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
              Meta WhatsApp Cloud API
            </a>
          </p>
        </div>
      </section>

      {/* 8. Logging */}
      <section id="logging" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">8</span>
          Logging
        </h2>
        <p className="mt-4 text-stone-600">
          Structured logging via <code className="rounded bg-stone-100 px-1">src/lib/logger.ts</code>. Logs to console with timestamp, level, context, and optional meta. Set <code className="rounded bg-stone-100 px-1">LOG_LEVEL</code> env to <code className="rounded bg-stone-100 px-1">debug</code>, <code className="rounded bg-stone-100 px-1">info</code>, <code className="rounded bg-stone-100 px-1">warn</code>, or <code className="rounded bg-stone-100 px-1">error</code> to control verbosity.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Specialized loggers: <code className="rounded bg-stone-100 px-1">authLogger</code>, <code className="rounded bg-stone-100 px-1">apiLogger</code>, <code className="rounded bg-stone-100 px-1">dbLogger</code>.
        </p>
      </section>

      {/* 9. Current Production Setup */}
      <section id="launch-readiness" className="scroll-mt-6">
        <h2 className="flex items-center gap-2 text-xl font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">9</span>
          Current Production Setup
        </h2>
        <p className="mt-4 text-stone-600">
          Your app is configured and ready for production use.
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h4 className="font-semibold text-stone-800">Data persistence (Supabase)</h4>
              <p className="mt-1 text-sm text-stone-600">Bookings (leads) persist in Supabase. Ensure supabase/schema.sql has been run in your Supabase project.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h4 className="font-semibold text-stone-800">Email notifications (Resend)</h4>
              <p className="mt-1 text-sm text-stone-600">Guests receive booking confirmation, tour confirmation with invoice, and payment receipts. Suppliers receive reservation emails when you schedule a tour.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h4 className="font-semibold text-stone-800">Admin login</h4>
              <p className="mt-1 text-sm text-stone-600">Password protected via ADMIN_PASSWORD. Log in at /admin/login.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h4 className="font-semibold text-stone-800">Core flows</h4>
              <p className="mt-1 text-sm text-stone-600">Client browse, book, look up. Admin manages bookings, packages, suppliers, tours, calendar. Invoices &amp; payments persisted and synced.</p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-stone-500">
          See <Link href="https://github.com/rumedsodimana-stack/paraiso-tours/blob/main/IMPROVEMENTS.md" className="text-teal-600 hover:underline">IMPROVEMENTS.md</Link> for the full roadmap.
        </p>
      </section>
    </div>
  );
}
