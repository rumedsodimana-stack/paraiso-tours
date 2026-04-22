import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOrientPrompt,
  coerceDecision,
  OODA_SYSTEM_PROMPT,
  type AgentObservation,
} from "./agent-ooda";

test("buildOrientPrompt: empty observation yields empty string", () => {
  const obs: AgentObservation = { recentDialogue: [] };
  assert.equal(buildOrientPrompt(obs), "");
});

test("buildOrientPrompt: surfaces current entity", () => {
  const obs: AgentObservation = {
    recentDialogue: [],
    currentEntity: { kind: "tour", id: "t_123", label: "Ceylon Heritage" },
  };
  const out = buildOrientPrompt(obs);
  assert.match(out, /currently viewing tour/i);
  assert.match(out, /Ceylon Heritage/);
  assert.match(out, /t_123/);
});

test("buildOrientPrompt: includes recent entities + dialogue", () => {
  const obs: AgentObservation = {
    recentDialogue: [
      { role: "user", content: "send invoice" },
      { role: "assistant", content: "proposed: send_invoice" },
    ],
    recent: [
      { kind: "invoice", id: "inv_1", label: "INV-001" },
      { kind: "lead", id: "l_1" },
    ],
  };
  const out = buildOrientPrompt(obs);
  assert.match(out, /Recently touched/);
  assert.match(out, /invoice: INV-001/);
  assert.match(out, /Recent messages/);
  assert.match(out, /send invoice/);
});

test("buildOrientPrompt: truncates long message content", () => {
  const longContent = "x".repeat(500);
  const obs: AgentObservation = {
    recentDialogue: [{ role: "user", content: longContent }],
  };
  const out = buildOrientPrompt(obs);
  assert.ok(out.length < 600);
  assert.match(out, /…/);
});

test("buildOrientPrompt: working + long-term memory both shown", () => {
  const obs: AgentObservation = {
    recentDialogue: [],
    workingMemory: [
      { kind: "fact", text: "Admin prefers email over WhatsApp" },
    ],
    longTermMemory: [
      { kind: "preference", text: "Always quote in USD" },
    ],
  };
  const out = buildOrientPrompt(obs);
  assert.match(out, /Session memory/);
  assert.match(out, /Long-term memory/);
  assert.match(out, /USD/);
});

test("coerceDecision: valid answer", () => {
  const d = coerceDecision({ kind: "answer", response: "Hello!" });
  assert.equal(d.kind, "answer");
  if (d.kind === "answer") {
    assert.equal(d.response, "Hello!");
  }
});

test("coerceDecision: valid clarify", () => {
  const d = coerceDecision({
    kind: "clarify",
    question: "Which invoice?",
    reason: "multiple matches",
  });
  assert.equal(d.kind, "clarify");
  if (d.kind === "clarify") {
    assert.match(d.question, /Which invoice/);
    assert.equal(d.reason, "multiple matches");
  }
});

test("coerceDecision: valid propose", () => {
  const d = coerceDecision({
    kind: "propose",
    title: "Send invoice",
    summary: "Email INV-001 to client",
    tool: "send_invoice_to_guest",
    input: { invoiceId: "inv_1" },
    confidence: 0.9,
    entityRefs: [{ kind: "invoice", id: "inv_1", label: "INV-001" }],
  });
  assert.equal(d.kind, "propose");
  if (d.kind === "propose") {
    assert.equal(d.tool, "send_invoice_to_guest");
    assert.equal(d.confidence, 0.9);
    assert.equal(d.entityRefs?.[0].label, "INV-001");
  }
});

test("coerceDecision: clamps confidence to [0,1]", () => {
  const d1 = coerceDecision({
    kind: "propose",
    tool: "t",
    input: {},
    confidence: 2.5,
  });
  const d2 = coerceDecision({
    kind: "propose",
    tool: "t",
    input: {},
    confidence: -0.2,
  });
  if (d1.kind === "propose") assert.equal(d1.confidence, 1);
  if (d2.kind === "propose") assert.equal(d2.confidence, 0);
});

test("coerceDecision: invalid → safe clarify fallback", () => {
  const d = coerceDecision(null);
  assert.equal(d.kind, "clarify");
});

test("coerceDecision: unknown kind → safe clarify fallback", () => {
  const d = coerceDecision({ kind: "explode", payload: "oops" });
  assert.equal(d.kind, "clarify");
});

test("OODA_SYSTEM_PROMPT includes the three decision kinds", () => {
  assert.match(OODA_SYSTEM_PROMPT, /answer/);
  assert.match(OODA_SYSTEM_PROMPT, /clarify/);
  assert.match(OODA_SYSTEM_PROMPT, /propose/);
  assert.match(OODA_SYSTEM_PROMPT, /JSON/);
});

test("OODA_SYSTEM_PROMPT forbids I-cannot-retrieve refusals and maps common asks to read tools", () => {
  // Defensive regression — the agent was caught saying "I cannot retrieve
  // a list of guest names for pending bookings" when search_leads would
  // have answered trivially. The prompt must push read-tool proposals.
  assert.match(OODA_SYSTEM_PROMPT, /NEVER say/i);
  assert.match(OODA_SYSTEM_PROMPT, /I cannot retrieve/);
  assert.match(OODA_SYSTEM_PROMPT, /search_leads/);
  assert.match(OODA_SYSTEM_PROMPT, /list_tours/);
  assert.match(OODA_SYSTEM_PROMPT, /list_invoices/);
  assert.match(OODA_SYSTEM_PROMPT, /list_packages/);
  assert.match(OODA_SYSTEM_PROMPT, /Refusing to fetch available data is a policy violation/);
});
