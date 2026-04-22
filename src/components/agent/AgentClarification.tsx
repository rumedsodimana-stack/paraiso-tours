"use client";

import { useState } from "react";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { useAgent } from "@/stores/ai-agent.store";
import type { ClarificationRequest } from "@/stores/ai-agent.store";

interface Props {
  clarification: ClarificationRequest;
  /** Called when the human picks a suggestion or types a custom answer.
   *  Receives the resolved value + whether it came from a suggestion. */
  onResolve?: (value: string, source: "suggestion" | "custom") => void;
}

/**
 * HITL clarification panel. Renders the AI's question plus exactly 4
 * suggestion buttons and a free-text input. Picking any option resolves
 * the clarification in the store so the agent loop can continue.
 */
export function AgentClarification({ clarification, onResolve }: Props) {
  const resolveClarification = useAgent((s) => s.resolveClarification);
  const [customValue, setCustomValue] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (clarification.resolvedAt) {
    // Already answered — render a compact summary
    return (
      <div className="rounded-[1.4rem] border border-[#e0e4dd] bg-[#faf6ef] px-4 py-3 text-sm text-[#5e7279]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a9ba1]">
          Resolved
        </p>
        <p className="mt-1 text-[#11272b]">{clarification.question}</p>
        <p className="mt-1 text-[#5e7279]">
          → {clarification.resolution?.value}
        </p>
      </div>
    );
  }

  const resolve = (value: string, source: "suggestion" | "custom") => {
    setSubmitting(source === "custom" ? "custom" : value);
    resolveClarification(clarification.id, { source, value });
    onResolve?.(value, source);
  };

  const handleCustomSubmit = () => {
    const v = customValue.trim();
    if (!v) return;
    resolve(v, "custom");
  };

  return (
    <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/90 px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c9922f] text-white">
          <MessageCircleQuestion className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a7220]">
            I need a quick clarification
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#11272b]">
            {clarification.question}
          </h3>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {clarification.suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => resolve(s.value, "suggestion")}
            disabled={submitting != null}
            title={s.rationale}
            className="group flex items-start gap-2 rounded-[1.1rem] border border-[#e0d4bc] bg-white px-4 py-3 text-left transition hover:border-[#c9922f] hover:bg-[#fffbf4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-[#8a7220] group-hover:text-[#c9922f]">
              →
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#11272b]">{s.label}</p>
              {s.rationale && (
                <p className="mt-0.5 text-xs leading-5 text-[#5e7279]">
                  {s.rationale}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {clarification.allowCustomText && (
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#8a7220]">
            Or answer in your own words
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCustomSubmit();
                }
              }}
              placeholder={
                clarification.customPlaceholder ||
                "Type a different answer…"
              }
              disabled={submitting != null}
              className="min-w-[240px] flex-1 rounded-[1rem] border border-[#e0d4bc] bg-white px-4 py-2.5 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={submitting != null || !customValue.trim()}
              className="inline-flex items-center gap-1.5 rounded-[1rem] bg-[#12343b] px-4 py-2.5 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
