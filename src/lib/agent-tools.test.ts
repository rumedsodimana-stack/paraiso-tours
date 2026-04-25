import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_TOOLS, getTool, listToolsForPrompt } from "./agent-tools";

test("AGENT_TOOLS: has at least the core entity + comms tools", () => {
  const names = AGENT_TOOLS.map((t) => t.name);
  const expected = [
    "search_leads",
    "get_lead",
    "get_tour",
    "update_lead_status",
    "schedule_tour_from_lead",
    "mark_tour_completed",
    "create_invoice_from_lead",
    "send_invoice_to_guest",
    "send_itinerary_to_guest",
    "send_pre_trip_reminder",
    "send_post_trip_followup",
    "send_booking_change_notice",
    "create_todo",
    "toggle_todo",
  ];
  for (const name of expected) {
    assert.ok(names.includes(name), `missing tool: ${name}`);
  }
});

test("AGENT_TOOLS: every tool has name, summary, schema, handler, category", () => {
  for (const t of AGENT_TOOLS) {
    assert.ok(t.name, `missing name`);
    assert.ok(t.summary, `${t.name}: missing summary`);
    assert.ok(t.inputSchema, `${t.name}: missing schema`);
    assert.equal(typeof t.handler, "function", `${t.name}: handler not a function`);
    assert.ok(
      ["read", "create", "update", "delete", "send"].includes(t.category),
      `${t.name}: invalid category ${t.category}`
    );
  }
});

test("getTool: returns registered tool", () => {
  const t = getTool("search_leads");
  assert.ok(t);
  assert.equal(t?.name, "search_leads");
});

test("getTool: null for unknown", () => {
  assert.equal(getTool("definitely_not_a_tool"), null);
});

test("listToolsForPrompt: includes every tool name and category headers", () => {
  const out = listToolsForPrompt();
  for (const t of AGENT_TOOLS) {
    assert.ok(out.includes(t.name), `prompt missing tool: ${t.name}`);
  }
  assert.match(out, /READ TOOLS/);
  assert.match(out, /CREATE TOOLS/);
  assert.match(out, /SEND TOOLS/);
  assert.match(out, /UPDATE TOOLS \(auto-execute/);
  assert.match(out, /DELETE TOOLS \(REQUIRE admin approval/);
});

test("schedule_tour_from_lead: schema rejects missing leadId", () => {
  const t = getTool("schedule_tour_from_lead");
  assert.ok(t);
  const r = t!.inputSchema.safeParse({ startDate: "2026-06-15" });
  assert.equal(r.success, false);
});

test("schedule_tour_from_lead: schema accepts valid input", () => {
  const t = getTool("schedule_tour_from_lead");
  const r = t!.inputSchema.safeParse({
    leadId: "lead_abc",
    startDate: "2026-06-15",
  });
  assert.equal(r.success, true);
});

test("schedule_tour_from_lead: schema rejects malformed date", () => {
  const t = getTool("schedule_tour_from_lead");
  const r = t!.inputSchema.safeParse({
    leadId: "lead_abc",
    startDate: "June 15 2026",
  });
  assert.equal(r.success, false);
});

test("send_booking_change_notice: schema enforces changeType enum", () => {
  const t = getTool("send_booking_change_notice");
  const good = t!.inputSchema.safeParse({
    tourId: "t_1",
    changeType: "revision",
    summary: "Dates updated",
  });
  assert.equal(good.success, true);
  const bad = t!.inputSchema.safeParse({
    tourId: "t_1",
    changeType: "other",
    summary: "x",
  });
  assert.equal(bad.success, false);
});

test("update_lead_status: schema enforces status enum", () => {
  const t = getTool("update_lead_status");
  const bad = t!.inputSchema.safeParse({ id: "l", status: "approved" });
  assert.equal(bad.success, false);
  const good = t!.inputSchema.safeParse({ id: "l", status: "scheduled" });
  assert.equal(good.success, true);
});

test("search_leads: schema caps limit at 50", () => {
  const t = getTool("search_leads");
  const bad = t!.inputSchema.safeParse({ limit: 500 });
  assert.equal(bad.success, false);
  const good = t!.inputSchema.safeParse({ limit: 50 });
  assert.equal(good.success, true);
});
