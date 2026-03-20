import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppArchitectureKnowledgeContext,
  buildAppUsageKnowledgeContext,
  buildWorkspaceCopilotCapabilitiesContext,
  getWorkspaceCopilotCapabilities,
} from "./ai-app-knowledge";

test("workspace copilot capabilities list exposes supported executable actions", () => {
  const capabilities = getWorkspaceCopilotCapabilities();
  assert.ok(
    capabilities.some((capability) => capability.type === "update_booking_status")
  );
  assert.ok(
    capabilities.some(
      (capability) => capability.type === "mark_payment_received"
    )
  );
});

test("app knowledge contexts include architecture, usage, and capability guidance", () => {
  const architecture = buildAppArchitectureKnowledgeContext();
  const usage = buildAppUsageKnowledgeContext();
  const capabilities = buildWorkspaceCopilotCapabilitiesContext();

  assert.match(architecture, /Next\.js App Router/i);
  assert.match(architecture, /package snapshot/i);
  assert.match(usage, /Bookings first/i);
  assert.match(usage, /user guide/i);
  assert.match(capabilities, /schedule_tour_from_booking/);
  assert.match(capabilities, /Only one executable action/);
});
