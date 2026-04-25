import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppArchitectureKnowledgeContext,
  buildAppUsageKnowledgeContext,
} from "./ai-app-knowledge";

test("app knowledge contexts include architecture and usage guidance", () => {
  const architecture = buildAppArchitectureKnowledgeContext();
  const usage = buildAppUsageKnowledgeContext();

  assert.match(architecture, /Next\.js App Router/i);
  assert.match(architecture, /package snapshot/i);
  assert.match(architecture, /agent-ooda\.ts/);
  assert.match(usage, /Bookings first/i);
  assert.match(usage, /user guide/i);
});
