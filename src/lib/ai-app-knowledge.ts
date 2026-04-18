export function getWorkspaceCopilotCapabilities() {
  return [
    // Bookings
    { type: "create_booking", summary: "Create a new booking/lead with client name, email, phone, destination, travel date, pax, and notes." },
    { type: "update_booking", summary: "Edit a booking's details — name, email, phone, destination, travel date, pax, notes, or status." },
    { type: "delete_booking", summary: "Archive/delete a booking by reference, name, or email." },
    { type: "update_booking_status", summary: "Change a booking status to: new, contacted, quoted, negotiating, won, or lost." },
    { type: "create_invoice_from_booking", summary: "Create an invoice from a booking or reuse the existing one." },
    { type: "schedule_tour_from_booking", summary: "Schedule a tour from a booking. Creates tour, invoice, payment, and sends notifications." },
    // Todos
    { type: "create_todo", summary: "Create an admin todo task." },
    { type: "toggle_todo", summary: "Toggle a todo between complete/incomplete." },
    { type: "delete_todo", summary: "Delete a todo item." },
    // Tours
    { type: "update_tour_status", summary: "Change a tour status to: scheduled, confirmed, in-progress, completed, or cancelled." },
    { type: "delete_tour", summary: "Delete a scheduled tour." },
    { type: "mark_tour_completed", summary: "Mark tour as completed, settle payments, send receipt." },
    // Invoices
    { type: "mark_invoice_paid", summary: "Mark an invoice as paid and sync linked payments." },
    { type: "update_invoice_status", summary: "Change invoice status to: pending_payment, paid, overdue, or cancelled." },
    // Payments
    { type: "mark_payment_received", summary: "Mark a payment as received and sync the linked invoice." },
    // Packages
    { type: "create_package", summary: "Create a new tour package with name, destination, duration, price, and description." },
    { type: "delete_package", summary: "Archive a tour package." },
    // Quotations
    { type: "create_quotation", summary: "Create a quotation with contact info, line items, and pricing." },
    { type: "mark_quotation_sent", summary: "Mark a quotation as sent to the client." },
    { type: "accept_quotation", summary: "Accept a quotation — converts it into a package, booking, tour, and invoice." },
    { type: "delete_quotation", summary: "Delete a quotation." },
    // Suppliers
    { type: "create_supplier", summary: "Create a hotel, transport, or meal provider. supplierType: hotel, transport, meal, or supplier." },
    { type: "delete_supplier", summary: "Archive a supplier." },
    // Activities & meal plans
    { type: "create_activity", summary: "Create a planner activity for a destination with title, summary, duration, and energy level." },
    { type: "create_meal_plan", summary: "Create a meal plan option (BB, HB, FB, etc.) for a hotel." },
    // Communication
    { type: "send_supplier_email", summary: "Send an email to a supplier (hotel, transport, etc.) via Resend." },
    { type: "send_client_email", summary: "Send an email to a booking's client contact via Resend." },
    // Agents
    { type: "start_booking_agent", summary: "Start the automated booking processor agent for a booking." },
    // Fallback
    { type: "answer_only", summary: "Answer questions, summarize data, give recommendations — no data mutation." },
  ];
}

export function buildAppArchitectureKnowledgeContext() {
  return [
    "App architecture knowledge:",
    "- Next.js App Router with a public client portal (/app/(client)) and an authenticated admin portal (/app/admin).",
    "- Client portal routes: /packages, /bookings, /journey-builder, /track-booking.",
    "- Admin portal routes: /admin/bookings, /admin/packages, /admin/hotels, /admin/tours, /admin/invoices, /admin/payments, /admin/finance, /admin/payroll, /admin/todos, /admin/quotations, /admin/settings, /admin/ai.",
    "- Persistence: Supabase (primary) with JSON file fallback under /data/.",
    "- Commercial flow: lead/booking → package snapshot → scheduled tour → invoice → payment.",
    "- Package snapshots are important because they freeze the sold itinerary even if the live package changes.",
    "- Admin mutations are server actions under src/app/actions/ (leads, invoices, payments, tours, quotations, packages, ai).",
    "- All important mutations create audit entries via src/lib/audit.ts.",
    "- Database access layer: src/lib/db.ts — all CRUD functions for every entity.",
    "- AI copilot execution: src/lib/ai-copilot.ts — WorkspaceCopilotAction union type, coerceWorkspaceCopilotPlan, executeWorkspaceCopilotAction.",
    "- AI prompts: src/lib/ai-prompts.ts — buildWorkspaceCopilotPrompts, buildBookingBriefPrompts, etc.",
    "- AI RAG (retrieval): src/lib/ai-rag.ts — buildRagContext, chunk scoring, self-learning from interactions.",
    "- AI data context: src/lib/ai-data-context.ts — buildAppDataContext, live entity snapshot for the copilot.",
    "- App config & settings: src/lib/app-config.ts — DEFAULT_APP_SETTINGS, getAppSettings, saveAppSettings.",
    "- AI knowledge base: src/lib/ai-app-knowledge.ts — getWorkspaceCopilotCapabilities, buildWorkspaceCopilotCapabilitiesContext.",
    "- Global AI chat (sidebar drawer): src/components/GlobalAdminAiChat.tsx.",
    "- Admin shell layout: src/components/AdminShell.tsx.",
    "- Journey builder (client-facing): src/app/(client)/journey-builder/JourneyPlanner.tsx.",
    "- Types: src/lib/types.ts — all entity types (Lead, Tour, TourPackage, Invoice, Payment, HotelSupplier, Quotation, etc.).",
    "- Entity references: bookings (PCT-…), tours (TCF-…), packages (PKG-…), quotations (QUO-…).",
    "- All AI self-learning: interactions stored in ai_interactions table; auto-promoted to ai_knowledge_documents after 3+ successes.",
  ].join("\n");
}

export function buildAppUsageKnowledgeContext() {
  return [
    "App usage knowledge:",
    "- Public users browse packages, submit booking requests, track bookings, and use the journey builder.",
    "- Bookings first: staff start in Bookings, then schedule tours, create invoices, confirm payments, and coordinate suppliers.",
    "- Settings: agency branding, portal copy, themes, AI runtime, notifications.",
    "- Hotels & Suppliers: hotels, transport, meal providers, general suppliers.",
    "- Packages: itinerary days, accommodation, transport, meals.",
    "- Every entity has a reference ID: bookings (PCT-…), tours (TCF-…), packages (PKG-…), quotations (QUO-…).",
    "- The admin user guide explains the workflow screen by screen when staff need operational detail.",
  ].join("\n");
}

export function buildWorkspaceCopilotCapabilitiesContext() {
  return [
    "Workspace copilot capabilities and rules:",
    "",
    "YOU HAVE FULL CRUD CONTROL OVER THE APP. You can create, read, update, and delete bookings, tours, packages, invoices, payments, todos, quotations, and suppliers.",
    "",
    "ALWAYS choose an executable action when the staff request maps to a supported capability. Do NOT default to answer_only when an action exists.",
    "Only one executable action is allowed per response.",
    "Only use answer_only when the user is genuinely asking a question or requesting information, NOT when they want something done.",
    "",
    "Entity resolution: use booking references (PCT-…), tour confirmations (TCF-…), package references (PKG-…), quotation references (QUO-…), client names, or emails. The system does fuzzy matching.",
    "",
    "Supported executable actions:",
    ...getWorkspaceCopilotCapabilities().map(
      (c) => `- ${c.type}: ${c.summary}`,
    ),
  ].join("\n");
}
