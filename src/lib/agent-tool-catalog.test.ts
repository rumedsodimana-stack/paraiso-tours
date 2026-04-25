import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_TOOLS, requiresApproval } from "./agent-tools";
import {
  TOOL_CATEGORY,
  getToolCategory,
  toolRequiresApproval,
} from "./agent-tool-catalog";

test("client catalog: every server tool name is mapped", () => {
  for (const t of AGENT_TOOLS) {
    const cat = TOOL_CATEGORY[t.name];
    assert.ok(cat, `catalog missing: ${t.name}`);
  }
});

test("client catalog: every tool category matches the server's", () => {
  for (const t of AGENT_TOOLS) {
    assert.equal(
      TOOL_CATEGORY[t.name],
      t.category,
      `${t.name}: client catalog says ${TOOL_CATEGORY[t.name]}, server says ${t.category}`
    );
  }
});

test("client catalog: no stale entries", () => {
  const serverNames = new Set(AGENT_TOOLS.map((t) => t.name));
  for (const name of Object.keys(TOOL_CATEGORY)) {
    assert.ok(
      serverNames.has(name),
      `catalog has stale tool not in registry: ${name}`
    );
  }
});

test("requiresApproval: delete only (updates auto-run)", () => {
  assert.equal(requiresApproval("delete"), true);
  assert.equal(requiresApproval("update"), false);
  assert.equal(requiresApproval("read"), false);
  assert.equal(requiresApproval("create"), false);
  assert.equal(requiresApproval("send"), false);
});

test("toolRequiresApproval: unknown tool → false (safe default)", () => {
  assert.equal(toolRequiresApproval("definitely_not_a_tool"), false);
});

test("toolRequiresApproval: only deletes are gated", () => {
  assert.equal(toolRequiresApproval("delete_package"), true);
  assert.equal(toolRequiresApproval("delete_lead"), true);
  assert.equal(toolRequiresApproval("update_lead_status"), false);
  assert.equal(toolRequiresApproval("mark_payment_received"), false);
  assert.equal(toolRequiresApproval("search_leads"), false);
  assert.equal(toolRequiresApproval("create_lead"), false);
  assert.equal(toolRequiresApproval("send_invoice_to_guest"), false);
});

test("getToolCategory: resolves known tools", () => {
  assert.equal(getToolCategory("create_package"), "create");
  assert.equal(getToolCategory("delete_lead"), "delete");
  assert.equal(getToolCategory("list_tours"), "read");
  assert.equal(getToolCategory("send_pre_trip_reminder"), "send");
  assert.equal(getToolCategory("nope"), null);
});
