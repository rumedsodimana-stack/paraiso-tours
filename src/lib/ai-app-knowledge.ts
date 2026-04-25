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
    "- AI agent (OODA loop): src/lib/agent-ooda.ts — observe → orient → decide → act, with tool definitions and HITL gating.",
    "- AI prompts: src/lib/ai-prompts.ts — buildBookingBriefPrompts, buildPackageWriterPrompts, buildJourneyAssistantPrompts, etc.",
    "- AI RAG (retrieval): src/lib/ai-rag.ts — buildRagContext, chunk scoring, self-learning from interactions.",
    "- AI data context: src/lib/ai-data-context.ts — buildAppDataContext, live entity snapshot for the agent.",
    "- App config & settings: src/lib/app-config.ts — DEFAULT_APP_SETTINGS, getAppSettings, saveAppSettings.",
    "- Agent surface (chat in /admin/ai + floating drawer): src/components/agent/AgentConversation.tsx, mounted by src/app/admin/ai/AgentSurface.tsx and src/components/GlobalAdminAiChat.tsx.",
    "- Workspace context store: src/stores/admin-workspace.store.ts — currentView + currentEntity that the agent reads to bind 'this'/'it' references.",
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
