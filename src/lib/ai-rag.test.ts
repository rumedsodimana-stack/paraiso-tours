import assert from "node:assert/strict";
import test from "node:test";
import { buildRagContext } from "./ai-rag";

test("RAG context retrieves built-in playbooks for relevant queries", async () => {
  const context = await buildRagContext({
    query: "write a supplier email reminder for reservation details",
    tagHints: ["email", "supplier"],
  });

  assert.match(context, /Retrieved knowledge:/);
  assert.match(context, /Email Skill Playbook|Supplier Coordination Playbook/);
});

test("RAG context retrieves architecture knowledge for system questions", async () => {
  const context = await buildRagContext({
    query: "how do package snapshots work in the app architecture",
    tagHints: ["architecture", "package"],
  });

  assert.match(context, /App Architecture/);
  assert.match(context, /package snapshots are important/i);
});
