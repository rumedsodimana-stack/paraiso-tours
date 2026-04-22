/**
 * Clarification generator — shared between server action and tests.
 *
 * When the AI agent hits ambiguity, it returns a ClarificationRequest:
 * a question plus exactly 4 best-fit suggestions plus a free-text fallback.
 * This file provides a pure function that coerces an LLM response into
 * that shape, so the action can focus on prompt + parsing.
 */

export interface ClarificationSuggestion {
  label: string;
  value: string;
  rationale?: string;
}

export interface ClarificationShape {
  question: string;
  suggestions: ClarificationSuggestion[]; // exactly 4
  allowCustomText: true;
  customPlaceholder: string;
}

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeLabel(label: string): string {
  // Buttons get tight — clamp to ~60 chars.
  const trimmed = label.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57) + "…";
}

/**
 * Coerce any LLM JSON blob into a valid ClarificationShape. If the model
 * returned too few or too many suggestions, pad with safe defaults or
 * clip to 4 — the UI contract is always exactly 4 + free text.
 */
export function coerceClarification(
  raw: unknown,
  fallbackQuestion: string
): ClarificationShape {
  const record = isRecord(raw) ? raw : {};
  const question =
    asText(record.question).trim() ||
    asText(record.prompt).trim() ||
    fallbackQuestion;

  const rawSuggestions = Array.isArray(record.suggestions)
    ? record.suggestions
    : [];

  const normalized: ClarificationSuggestion[] = [];
  for (const entry of rawSuggestions) {
    if (!isRecord(entry)) continue;
    const label = sanitizeLabel(asText(entry.label) || asText(entry.value));
    const value = asText(entry.value) || label;
    if (!label || !value) continue;
    normalized.push({
      label,
      value,
      rationale: asText(entry.rationale).trim() || undefined,
    });
    if (normalized.length === 4) break;
  }

  while (normalized.length < 4) {
    const i = normalized.length + 1;
    normalized.push({
      label: `Option ${i}`,
      value: `Option ${i}`,
    });
  }

  const customPlaceholder =
    asText(record.customPlaceholder).trim() ||
    "Type a different answer or add more context…";

  return {
    question,
    suggestions: normalized,
    allowCustomText: true,
    customPlaceholder,
  };
}

/**
 * System prompt for the clarifier. Kept separate from ai-prompts.ts so
 * it can be imported without pulling the full prompt kit.
 */
export const CLARIFIER_SYSTEM_PROMPT = [
  "You are a helpful travel-agency AI clarifier.",
  "When the admin or guest request is ambiguous, respond with a clarifying",
  "question plus EXACTLY 4 short, high-signal suggestions they might pick.",
  "Suggestions should be ordered best-first and cover the most likely paths.",
  "Always leave room for a custom free-text answer too — the UI renders",
  "that automatically.",
  "Return valid JSON only matching this schema:",
  "{",
  '  "question": "the clarifying question",',
  '  "suggestions": [',
  '    { "label": "short button label", "value": "full answer if picked", "rationale": "optional one-liner" },',
  '    { "label": "...", "value": "..." },',
  '    { "label": "...", "value": "..." },',
  '    { "label": "...", "value": "..." }',
  "  ],",
  '  "customPlaceholder": "hint for the free-text field"',
  "}",
  "No markdown. No code fences. No preamble.",
].join("\n");
