import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { zodToJsonSchema } from "./zod-jsonschema";

test("zodToJsonSchema: object with mixed required / optional fields", () => {
  const schema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(320),
    pax: z.number().int().min(1).max(500).optional(),
    tags: z.array(z.string().max(60)).max(8).optional(),
  });
  const out = zodToJsonSchema(schema);

  assert.equal(out.type, "object");
  assert.equal(out.additionalProperties, false);
  assert.deepEqual(out.required?.sort(), ["email", "name"].sort());
  assert.equal(out.properties?.name.type, "string");
  assert.equal(out.properties?.name.minLength, 1);
  assert.equal(out.properties?.name.maxLength, 200);
  assert.equal(out.properties?.email.format, "email");
  assert.equal(out.properties?.pax.type, "integer");
  assert.equal(out.properties?.pax.minimum, 1);
  assert.equal(out.properties?.pax.maximum, 500);
  assert.equal(out.properties?.tags.type, "array");
  assert.equal(out.properties?.tags.items?.type, "string");
  assert.equal(out.properties?.tags.maxItems, 8);
});

test("zodToJsonSchema: enum + literal + boolean", () => {
  const schema = z.object({
    status: z.enum(["new", "scheduled", "cancelled", "completed"]),
    featured: z.boolean().optional(),
    fixed: z.literal("ACK"),
  });
  const out = zodToJsonSchema(schema);

  assert.deepEqual(out.properties?.status.enum, [
    "new",
    "scheduled",
    "cancelled",
    "completed",
  ]);
  assert.equal(out.properties?.featured.type, "boolean");
  assert.equal(out.properties?.fixed.const, "ACK");
});

test("zodToJsonSchema: ISO date regex via z.string().regex(...)", () => {
  const schema = z.object({
    travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  const out = zodToJsonSchema(schema);
  assert.match(out.properties?.travelDate.pattern ?? "", /\\d\{4\}/);
});

test("zodToJsonSchema: union via .or(literal('')) for optional email-or-blank", () => {
  const schema = z.object({
    email: z.string().email().max(320).optional().or(z.literal("")),
  });
  const out = zodToJsonSchema(schema);
  // email is wrapped — top-level ZodObject.email is a union.
  assert.ok(Array.isArray(out.properties?.email.anyOf));
  assert.equal(out.properties?.email.anyOf?.length, 2);
});

test("zodToJsonSchema: .partial() on object makes every field optional", () => {
  const base = z.object({
    name: z.string(),
    email: z.string().email(),
  });
  const partial = base.partial();
  const out = zodToJsonSchema(partial);
  // No required[] when every field is optional.
  assert.ok(!out.required || out.required.length === 0);
  assert.equal(out.properties?.name.type, "string");
});

test("zodToJsonSchema: every AGENT_TOOLS schema serializes without throwing", async () => {
  // Round-trip the entire agent catalog so we discover gaps via this test
  // before they hit the LLM.
  const { AGENT_TOOLS } = await import("./agent-tools");
  for (const t of AGENT_TOOLS) {
    const schema = zodToJsonSchema(t.inputSchema);
    assert.equal(
      schema.type ?? (schema.anyOf ? "anyOf" : ""),
      "object",
      `Tool "${t.name}" did not serialize to an object schema (got ${JSON.stringify(schema).slice(0, 200)})`
    );
    assert.ok(
      schema.additionalProperties === false,
      `Tool "${t.name}" should set additionalProperties:false`
    );
  }
});
