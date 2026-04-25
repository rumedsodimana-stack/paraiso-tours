/**
 * Zod → JSON Schema for the native-tool-calling runtime.
 *
 * Used by `agent-runtime.ts` to publish the `AGENT_TOOLS` registry's Zod
 * input schemas to Anthropic's `messages.create({ tools: [...] })`
 * endpoint, which expects each tool's `input_schema` to be a JSON Schema
 * object.
 *
 * Implementation: Zod 4 ships with a built-in `z.toJSONSchema(schema)`
 * that already produces draft-2020-12 JSON Schema. We just call it and
 * strip the top-level `$schema` URI — Anthropic doesn't need it and it's
 * a few tokens we don't have to pay for on every tool catalog publish.
 *
 * If we ever need to override behavior (e.g. force `additionalProperties:
 * false` on every nested object), do it here in `toAnthropicSchema` so the
 * call sites stay simple.
 */

import { z } from "zod";

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  description?: string;
}

/**
 * Convert a Zod schema to a JSON Schema fragment Anthropic accepts.
 *
 * Zod 4's `z.toJSONSchema` returns a draft-2020-12 schema with `$schema`
 * set; we strip it because the Anthropic tool API doesn't validate against
 * the meta-schema and the URI is dead weight on every request.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = z.toJSONSchema(schema as any) as Record<string, unknown>;
  const { $schema: _drop, ...rest } = raw;
  void _drop;
  return rest as JsonSchema;
}
