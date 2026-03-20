import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBookingBriefPrompts,
  buildClientConciergePrompts,
  buildJourneyAssistantPrompts,
  buildPackageWriterPrompts,
  buildWorkspaceCopilotPrompts,
} from "./ai-prompts";
import type { Invoice, Lead, TourPackage } from "./types";

test("booking brief prompts include booking and invoice context", () => {
  const lead: Lead = {
    id: "lead_1",
    reference: "PCT-TEST-001",
    name: "Asha Perera",
    email: "asha@example.com",
    phone: "+94 77 123 4567",
    source: "Client Portal",
    status: "new",
    destination: "Kandy",
    travelDate: "2026-07-10",
    pax: 2,
    notes: "Prefers scenic hotels",
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
  };

  const pkg: TourPackage = {
    id: "pkg_1",
    name: "Hill Country Escape",
    duration: "5D/4N",
    destination: "Kandy & Ella",
    price: 640,
    currency: "USD",
    description: "Tea country route",
    itinerary: [
      { day: 1, title: "Arrive", description: "Airport to Kandy" },
      { day: 2, title: "Explore", description: "Temple and viewpoints" },
    ],
    inclusions: ["Private transport"],
    exclusions: ["Flights"],
    createdAt: "2026-03-20T00:00:00.000Z",
  };

  const invoice: Invoice = {
    id: "inv_1",
    leadId: lead.id,
    invoiceNumber: "INV-0001",
    status: "pending_payment",
    clientName: lead.name,
    clientEmail: lead.email,
    packageName: pkg.name,
    travelDate: lead.travelDate,
    pax: lead.pax,
    baseAmount: 1280,
    lineItems: [],
    totalAmount: 1280,
    currency: "USD",
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
  };

  const prompts = buildBookingBriefPrompts({
    lead,
    pkg,
    invoice,
    knowledgeContext: "Sri Lanka knowledge: Sigiriya works well before Kandy.",
  });

  assert.match(prompts.systemPrompt, /operations assistant/i);
  assert.match(prompts.userPrompt, /Snapshot/);
  assert.match(prompts.userPrompt, /PCT-TEST-001/);
  assert.match(prompts.userPrompt, /INV-0001/);
  assert.match(prompts.userPrompt, /Day 1: Arrive/);
  assert.match(prompts.userPrompt, /Sigiriya works well before Kandy/);
});

test("package writer prompts ask for structured sales output", () => {
  const pkg: TourPackage = {
    id: "pkg_2",
    name: "South Coast Loop",
    duration: "6D/5N",
    destination: "Galle and Mirissa",
    price: 720,
    currency: "USD",
    description: "A coast-focused private route.",
    itinerary: [
      { day: 1, title: "Galle", description: "Fort stay" },
      { day: 2, title: "Mirissa", description: "Beach stay" },
    ],
    inclusions: ["Hotels", "Breakfast"],
    exclusions: ["Lunch"],
    createdAt: "2026-03-20T00:00:00.000Z",
  };

  const prompts = buildPackageWriterPrompts(pkg);

  assert.match(prompts.userPrompt, /Headline/);
  assert.match(prompts.userPrompt, /Ideal guest profile/);
  assert.match(prompts.userPrompt, /South Coast Loop/);
  assert.match(prompts.userPrompt, /Day 1: Galle/);
});

test("journey assistant prompts include route constraints and guest brief", () => {
  const prompts = buildJourneyAssistantPrompts({
    request: "Family trip with wildlife and beach time",
    travelDate: "2026-08-05",
    pax: 4,
  });

  assert.match(prompts.systemPrompt, /Sri Lanka tour operator/i);
  assert.match(prompts.userPrompt, /Family trip with wildlife and beach time/);
  assert.match(prompts.userPrompt, /Allowed destination set:/);
  assert.match(prompts.userPrompt, /Transfer cautions/);
});

test("workspace copilot prompts require JSON and action limits", () => {
  const prompts = buildWorkspaceCopilotPrompts({
    request: "Mark invoice INV-0042 as paid",
    executeRequested: true,
    architectureKnowledge: "Architecture: admin and client portals.",
    usageKnowledge: "Usage: bookings lead to tours and invoices.",
    capabilitiesKnowledge:
      "Capabilities: mark_invoice_paid is supported. Unsupported actions must use answer_only.",
    dataKnowledge: "Live data: invoice INV-0042 is pending_payment for 480 USD.",
    domainKnowledge: "Sri Lanka knowledge: keep advice operationally realistic.",
  });

  assert.match(prompts.systemPrompt, /Return valid JSON only/);
  assert.match(prompts.systemPrompt, /mark_invoice_paid/);
  assert.match(prompts.userPrompt, /Execution requested: yes/);
  assert.match(prompts.userPrompt, /Mark invoice INV-0042 as paid/);
  assert.match(prompts.userPrompt, /Live data: invoice INV-0042 is pending_payment/);
});

test("client concierge prompts require structured public travel JSON", () => {
  const prompts = buildClientConciergePrompts({
    request:
      "Plan a 7-night couple trip with Sigiriya, Kandy, Ella, and a beach finish.",
    currentState: "Travel date: 2026-08-12\nGuest count: 2",
    optionContext:
      "Destination IDs:\n- sigiriya: Sigiriya\nTransport IDs:\n- none: No transport\n- chauffeur_car: Chauffeur Car",
    knowledgeContext: "Sri Lanka journey knowledge: keep the route comfortable.",
  });

  assert.match(prompts.systemPrompt, /Return valid JSON only/);
  assert.match(prompts.systemPrompt, /routeStops/);
  assert.match(prompts.systemPrompt, /transportSelectionId/);
  assert.match(prompts.userPrompt, /Sigiriya, Kandy, Ella/);
  assert.match(prompts.userPrompt, /Destination IDs:/);
  assert.match(prompts.userPrompt, /keep the route comfortable/);
});
