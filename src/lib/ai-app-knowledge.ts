export type WorkspaceCopilotActionType =
  | "answer_only"
  | "create_todo"
  | "update_booking_status"
  | "create_invoice_from_booking"
  | "schedule_tour_from_booking"
  | "mark_invoice_paid"
  | "mark_payment_received";

export function getWorkspaceCopilotCapabilities() {
  return [
    {
      type: "answer_only" as const,
      summary: "Answer questions without mutating data.",
    },
    {
      type: "create_todo" as const,
      summary: "Create an admin todo from a short task title.",
    },
    {
      type: "update_booking_status" as const,
      summary:
        "Change a booking status using one of: new, contacted, quoted, negotiating, won, lost.",
    },
    {
      type: "create_invoice_from_booking" as const,
      summary: "Create an invoice from an existing booking or reuse the existing one.",
    },
    {
      type: "schedule_tour_from_booking" as const,
      summary:
        "Schedule a tour from a booking using its package and travel date, with an optional explicit start date.",
    },
    {
      type: "mark_invoice_paid" as const,
      summary: "Mark an invoice paid and sync linked payments where relevant.",
    },
    {
      type: "mark_payment_received" as const,
      summary: "Mark a payment completed and sync the linked invoice to paid where relevant.",
    },
  ];
}

export function buildAppArchitectureKnowledgeContext() {
  return [
    "App architecture knowledge:",
    "- This is a Next.js App Router application with two major surfaces: a public client portal and an authenticated admin portal.",
    "- The client portal handles package discovery, booking requests, booking lookup, and the journey builder.",
    "- The admin portal handles bookings, packages, hotels and suppliers, tours, invoices, payments, finance, payroll, todos, settings, and the user guide.",
    "- Shared persistence flows through src/lib/db.ts with a Supabase-backed adapter in src/lib/db-supabase.ts and a local JSON fallback for non-hosted environments.",
    "- Core commercial flow is: lead or booking -> package snapshot -> scheduled tour -> invoice -> payment.",
    "- Package snapshots are important because they freeze sold itinerary and option choices even if the live package changes later.",
    "- Pricing logic lives in booking-pricing, package-price, booking-breakdown, payables, and custom-journey utilities rather than in page components.",
    "- Route and destination knowledge for Sri Lanka lives in route-planner and feeds the client journey builder and AI travel guidance.",
    "- Admin mutations are mostly implemented as server actions under src/app/actions.",
    "- Audit history is part of the system and important mutations should create audit entries.",
  ].join("\n");
}

export function buildAppUsageKnowledgeContext() {
  return [
    "App usage knowledge:",
    "- Public users browse packages, choose hotel, transport, and meal options, submit booking requests, and later track pending or confirmed bookings.",
    "- Staff usually work from Bookings first, then schedule tours, create invoices, confirm payments, and coordinate suppliers.",
    "- The Settings page controls agency branding, portal copy, themes, AI runtime, and some operational preferences.",
    "- Hotels & Suppliers is where hotels, transport providers, meal providers, and general suppliers are maintained.",
    "- Package editing is where itinerary days, accommodation choices, transport options, and meal plans are composed.",
    "- The user guide under /admin/user-guide explains the major pages and is the canonical in-app help surface for staff onboarding.",
    "- AI Studio is a staff tool; its outputs should support staff work, not replace operational checks like supplier availability or payment verification.",
  ].join("\n");
}

export function buildWorkspaceCopilotCapabilitiesContext() {
  return [
    "Workspace copilot execution rules:",
    "- Only choose an executable action when the user request is clear enough and matches one supported capability.",
    "- If the user is asking about architecture, codebase behavior, how to use the app, or unsupported operations, choose answer_only.",
    "- If the target entity is unclear or likely ambiguous, choose answer_only and ask for a tighter reference instead of guessing.",
    "- Prefer explicit references such as booking reference, invoice number, payment reference, or a clearly unique client name.",
    "- Never invent IDs, totals, dates, or statuses.",
    "- Only one executable action should be returned per request. If the user asks for multiple things, pick the highest-priority safe action and explain the rest in the response.",
    "",
    "Supported executable actions:",
    ...getWorkspaceCopilotCapabilities().map(
      (capability) => `- ${capability.type}: ${capability.summary}`
    ),
  ].join("\n");
}
