import test from "node:test";
import assert from "node:assert/strict";
import {
  coerceClarification,
  CLARIFIER_SYSTEM_PROMPT,
} from "./agent-clarification";

test("coerceClarification: minimal valid input", () => {
  const out = coerceClarification(
    {
      question: "Which hotel?",
      suggestions: [
        { label: "Jetwing Sea", value: "Jetwing Sea" },
        { label: "Cinnamon Grand", value: "Cinnamon Grand" },
      ],
    },
    "fallback"
  );
  assert.equal(out.question, "Which hotel?");
  assert.equal(out.suggestions.length, 4); // padded
  assert.equal(out.allowCustomText, true);
});

test("coerceClarification: pads to 4 with Option N when too few", () => {
  const out = coerceClarification({ question: "Q", suggestions: [] }, "fb");
  assert.equal(out.suggestions.length, 4);
  assert.match(out.suggestions[0].label, /Option 1/);
  assert.match(out.suggestions[3].label, /Option 4/);
});

test("coerceClarification: clips to 4 when too many", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    label: `opt ${i}`,
    value: `v ${i}`,
  }));
  const out = coerceClarification(
    { question: "Q", suggestions: many },
    "fb"
  );
  assert.equal(out.suggestions.length, 4);
  assert.equal(out.suggestions[0].label, "opt 0");
  assert.equal(out.suggestions[3].label, "opt 3");
});

test("coerceClarification: clamps long labels to ~60 chars", () => {
  const longLabel = "A".repeat(200);
  const out = coerceClarification(
    {
      question: "Q",
      suggestions: [{ label: longLabel, value: "v" }],
    },
    "fb"
  );
  assert.ok(out.suggestions[0].label.length <= 60);
  assert.match(out.suggestions[0].label, /…$/);
});

test("coerceClarification: null input returns fallback question", () => {
  const out = coerceClarification(null, "Please help");
  assert.equal(out.question, "Please help");
  assert.equal(out.suggestions.length, 4);
});

test("coerceClarification: defaults custom placeholder when missing", () => {
  const out = coerceClarification({ question: "Q" }, "fb");
  assert.ok(out.customPlaceholder.length > 0);
});

test("coerceClarification: rejects suggestion entries missing label+value", () => {
  const out = coerceClarification(
    {
      question: "Q",
      suggestions: [
        { label: "", value: "" },
        { label: "good", value: "ok" },
      ],
    },
    "fb"
  );
  // Empty entry dropped, "good" kept, then 3 more pads
  assert.equal(out.suggestions[0].label, "good");
  assert.equal(out.suggestions.length, 4);
});

test("CLARIFIER_SYSTEM_PROMPT contains the JSON schema + rules", () => {
  assert.match(CLARIFIER_SYSTEM_PROMPT, /EXACTLY 4/);
  assert.match(CLARIFIER_SYSTEM_PROMPT, /question/);
  assert.match(CLARIFIER_SYSTEM_PROMPT, /suggestions/);
  assert.match(CLARIFIER_SYSTEM_PROMPT, /customPlaceholder/);
});
