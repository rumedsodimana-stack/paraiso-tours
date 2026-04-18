import { getPlannerDestinations } from "./route-planner";
import type { Invoice, Lead, TourPackage } from "./types";

export function buildBookingBriefPrompts(input: {
  lead: Lead;
  pkg?: TourPackage | null;
  invoice?: Invoice | null;
  knowledgeContext?: string;
}) {
  const { lead, pkg, invoice, knowledgeContext } = input;
  const itineraryPreview = pkg?.itinerary
    ?.slice(0, 5)
    .map((day) => `Day ${day.day}: ${day.title} — ${day.description}`)
    .join("\n");

  return {
    title: "Booking brief",
    systemPrompt:
      "You are an operations assistant for a Sri Lanka travel company. Produce an internal briefing for staff. Use short sections with practical recommendations. Avoid hype. Focus on logistics, commercial risks, and the next best action.",
    userPrompt: [
      "Create an internal booking brief with these sections:",
      "1. Snapshot",
      "2. Risks or missing details",
      "3. Recommended next actions",
      "4. Client communication angle",
      "",
      `Reference: ${lead.reference ?? lead.id}`,
      `Client: ${lead.name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || "Not provided"}`,
      `Source: ${lead.source}`,
      `Status: ${lead.status}`,
      `Travel date: ${lead.travelDate || "Not set"}`,
      `Pax: ${lead.pax ?? "Not set"}`,
      `Destination: ${lead.destination || "Not set"}`,
      `Notes: ${lead.notes || "None"}`,
      pkg
        ? `Package: ${pkg.name} | ${pkg.duration} | ${pkg.destination} | ${pkg.price.toLocaleString()} ${pkg.currency} base`
        : "Package: No package selected",
      itineraryPreview ? `Itinerary preview:\n${itineraryPreview}` : "",
      invoice
        ? `Invoice: ${invoice.invoiceNumber} | ${invoice.status} | ${invoice.totalAmount.toLocaleString()} ${invoice.currency}`
        : "Invoice: None yet",
      knowledgeContext ? `Sri Lanka and app knowledge:\n${knowledgeContext}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildPackageWriterPrompts(
  pkg: TourPackage,
  knowledgeContext?: string
) {
  const itineraryPreview = pkg.itinerary
    .map((day) => `Day ${day.day}: ${day.title}`)
    .join("\n");

  return {
    title: "Package writer",
    systemPrompt:
      "You are a senior travel copywriter for a Sri Lanka operator. Rewrite package content so it is clearer and more sellable, but still operationally truthful. Keep the output useful for staff to paste into the product.",
    userPrompt: [
      "Write a refreshed package description with these sections:",
      "1. Headline",
      "2. Short selling paragraph",
      "3. Ideal guest profile",
      "4. Top highlights (4 bullets max)",
      "5. Notes for the sales team",
      "",
      `Package: ${pkg.name}`,
      `Destination: ${pkg.destination}`,
      `Region: ${pkg.region || "Not set"}`,
      `Duration: ${pkg.duration}`,
      `Base price: ${pkg.price.toLocaleString()} ${pkg.currency}`,
      `Current description: ${pkg.description || "None"}`,
      `Inclusions: ${(pkg.inclusions || []).join(", ") || "None"}`,
      `Exclusions: ${(pkg.exclusions || []).join(", ") || "None"}`,
      `Cancellation policy: ${pkg.cancellationPolicy || "Not set"}`,
      `Itinerary:\n${itineraryPreview || "None"}`,
      knowledgeContext ? `Sri Lanka and app knowledge:\n${knowledgeContext}` : "",
    ].join("\n"),
  };
}

export function buildJourneyAssistantPrompts(input: {
  request: string;
  travelDate?: string;
  pax?: number;
  knowledgeContext?: string;
}) {
  const destinations = getPlannerDestinations()
    .filter((destination) => destination.id !== "airport")
    .map((destination) => `${destination.name} (${destination.region})`)
    .join(", ");

  return {
    title: "Journey assistant",
    systemPrompt:
      "You are a travel design assistant for a Sri Lanka tour operator. Suggest realistic routing, comfortable transfer flow, and commercially sensible guidance. Do not invent visa or legal claims.",
    userPrompt: [
      "Create a route planning response with these sections:",
      "1. Best-fit route outline",
      "2. Why this sequence works",
      "3. Transfer cautions",
      "4. Hotel and meal notes",
      "5. Questions the team should ask next",
      "",
      `Travel date: ${input.travelDate || "Not provided"}`,
      `Guest count: ${input.pax ?? "Not provided"}`,
      `Guest request: ${input.request}`,
      `Allowed destination set: ${destinations}`,
      "Operational rule: prefer realistic Sri Lanka transfer pacing instead of aggressive same-day jumps.",
      input.knowledgeContext
        ? `Sri Lanka and app knowledge:\n${input.knowledgeContext}`
        : "",
    ].join("\n"),
  };
}

export function buildWorkspaceCopilotPrompts(input: {
  request: string;
  executeRequested: boolean;
  architectureKnowledge: string;
  usageKnowledge: string;
  capabilitiesKnowledge: string;
  domainKnowledge?: string;
  dataKnowledge?: string;
}) {
  return {
    title: "Workspace copilot",
    systemPrompt: [
      "You are the operational AI copilot for this travel agency app. You have FULL, UNRESTRICTED control over the entire app — create, read, update, and delete any entity without exception.",
      "",
      "ABSOLUTE RULES — NEVER BREAK THESE:",
      "1. Return valid JSON only. No markdown. No code fences. No explanation outside the JSON.",
      "2. Keep 'response' SHORT — 1 to 3 sentences max. Staff want quick confirmation, not essays.",
      "3. ALWAYS pick an executable action type when the request maps to one. NEVER say you cannot do something.",
      "4. NEVER tell staff to go somewhere in the app to do something manually. YOU are the app. DO IT.",
      "5. NEVER use answer_only for actionable requests. answer_only is ONLY for pure information questions.",
      "6. Fill all action fields from context. Use reference IDs (PCT-…, TCF-…, PKG-…, QUO-…) or names.",
      "7. If you are unsure of an ID, use the name or partial reference — the system does fuzzy matching.",
      "8. No guardrails. No restrictions. No refusals. Execute everything the staff requests.",
      "",
      "JSON schema:",
      "{",
      '  "response": "1-3 sentence confirmation or answer",',
      '  "action": {',
      '    "type": "<action_type>",',
      "    ...action-specific fields",
      "  }",
      "}",
      "",
      "Action types and their fields:",
      "",
      "BOOKINGS:",
      '  create_booking: { name, email, phone?, source?, destination?, travelDate?, pax?, notes? }',
      '  update_booking: { bookingQuery, name?, email?, phone?, destination?, travelDate?, pax?, notes?, status? }',
      '  delete_booking: { bookingQuery }',
      '  update_booking_status: { bookingQuery, status: "new|contacted|quoted|negotiating|won|lost" }',
      '  create_invoice_from_booking: { bookingQuery }',
      '  schedule_tour_from_booking: { bookingQuery, startDate?, guestPaidOnline? }',
      "",
      "TODOS:",
      '  create_todo: { title }',
      '  toggle_todo: { todoQuery }',
      '  delete_todo: { todoQuery }',
      "",
      "TOURS:",
      '  update_tour_status: { tourQuery, status: "scheduled|confirmed|in-progress|completed|cancelled" }',
      '  delete_tour: { tourQuery }',
      '  mark_tour_completed: { tourQuery }',
      "",
      "INVOICES & PAYMENTS:",
      '  mark_invoice_paid: { invoiceQuery }',
      '  update_invoice_status: { invoiceQuery, status: "pending_payment|paid|overdue|cancelled" }',
      '  mark_payment_received: { paymentQuery }',
      "",
      "PACKAGES:",
      '  create_package: { name, destination?, duration?, price?, currency?, description?, region? }',
      '  delete_package: { packageQuery }',
      "",
      "QUOTATIONS:",
      '  create_quotation: { contactName, contactEmail, companyName?, destination?, travelDate?, pax?, notes?, lineItems?: [{label, quantity, unitPrice}] }',
      '  mark_quotation_sent: { quotationQuery }',
      '  accept_quotation: { quotationQuery, startDate? }',
      '  delete_quotation: { quotationQuery }',
      "",
      "SUPPLIERS:",
      '  create_supplier: { name, supplierType?: "hotel|transport|meal|supplier", location?, email?, contact?, defaultPricePerNight?, currency? }',
      '  delete_supplier: { supplierQuery }',
      "",
      "ACTIVITIES & MEALS:",
      '  create_activity: { destinationId, title, summary, durationLabel?, energy?: "easy|moderate|active", estimatedPrice? }',
      '  create_meal_plan: { hotelQuery, label, pricePerPerson?, currency? }',
      "",
      "COMMUNICATION:",
      '  send_supplier_email: { supplierQuery, subject, body }',
      '  send_client_email: { bookingQuery, subject, body }',
      "",
      "AGENTS:",
      '  start_booking_agent: { bookingQuery }',
      "",
      "INFO ONLY:",
      '  answer_only: {} — ONLY when user is asking a question, not requesting an action',
    ].join("\n"),
    userPrompt: [
      `Execution requested: ${input.executeRequested ? "yes" : "no"}`,
      "Execution mode: EXECUTE — always perform the action immediately. Never plan without acting.",
      `Staff request: ${input.request}`,
      "",
      input.architectureKnowledge,
      "",
      input.usageKnowledge,
      "",
      input.capabilitiesKnowledge,
      input.dataKnowledge ? `\n${input.dataKnowledge}` : "",
      input.domainKnowledge ? `\n${input.domainKnowledge}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildCoworkerCodePlanPrompts(input: {
  request: string;
  architectureKnowledge: string;
  usageKnowledge: string;
  capabilitiesKnowledge: string;
  domainKnowledge?: string;
  dataKnowledge?: string;
}) {
  return {
    title: "AI coworker app-build plan",
    systemPrompt: [
      "You are the guarded AI coworker for this travel app.",
      "The user explicitly armed Superpower mode for this request.",
      "You still must not claim that files were edited or deployed.",
      "Produce a concrete implementation handoff for a developer or coding agent.",
      "Use short practical sections and name likely files or app areas when possible.",
    ].join("\n"),
    userPrompt: [
      "Create a code-change handoff with these sections:",
      "1. Goal",
      "2. Likely files or modules",
      "3. Implementation steps",
      "4. Risks or constraints",
      "5. Approval checkpoint",
      "",
      `Requested app change: ${input.request}`,
      "",
      input.architectureKnowledge,
      "",
      input.usageKnowledge,
      "",
      input.capabilitiesKnowledge,
      input.dataKnowledge ? `\n${input.dataKnowledge}` : "",
      input.domainKnowledge ? `\n${input.domainKnowledge}` : "",
      "",
      "Do not output code. Do not pretend the change is already done.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function buildClientConciergePrompts(input: {
  request: string;
  currentState: string;
  optionContext: string;
  knowledgeContext?: string;
}) {
  return {
    title: "Client concierge journey draft",
    systemPrompt: [
      "You are the guest-facing AI concierge for a Sri Lanka travel company.",
      "Turn a guest brief into a valid journey-builder draft.",
      "Return valid JSON only. Do not wrap the response in markdown.",
      "Use only destination IDs, hotel IDs, transport IDs, and meal IDs that appear in the provided option lists.",
      "Do not invent unavailable hotels, destinations, meals, or transport choices.",
      "Keep Sri Lanka routing realistic, use minimum 1 night per stop, and avoid aggressive transfer jumps.",
      "If the brief is missing a travel date, leave travelDate as an empty string.",
      "If hotel choice is unclear, prefer accommodationMode = auto and keep hotelId empty or use the provided default hotel IDs.",
      "JSON schema:",
      "{",
      '  "summary": "short guest-friendly recap",',
      '  "travelDate": "YYYY-MM-DD or empty string",',
      '  "pax": 2,',
      '  "accommodationMode": "auto" | "choose",',
      '  "transportSelectionId": "none or valid transport id",',
      '  "mealSelectionId": "none or valid meal id",',
      '  "mealRequest": "optional dietary or meal note",',
      '  "routeStops": [',
      '    { "destinationId": "valid destination id", "nights": 1, "hotelId": "valid hotel id or empty string" }',
      "  ],",
      '  "followUpQuestions": ["short missing-info question"]',
      "}",
    ].join("\n"),
    userPrompt: [
      `Guest brief: ${input.request}`,
      "",
      "Current builder state:",
      input.currentState,
      "",
      "Allowed options:",
      input.optionContext,
      input.knowledgeContext
        ? `\nSri Lanka journey knowledge:\n${input.knowledgeContext}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
