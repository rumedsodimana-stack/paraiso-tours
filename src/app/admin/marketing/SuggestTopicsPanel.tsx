"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import {
  generateSocialPostDraftsAction,
  suggestMarketingTopicsAction,
  type MarketingTopicSuggestion,
} from "@/app/actions/marketing";

const PLATFORM_EMOJI: Record<string, string> = {
  instagram: "📸",
  facebook: "📘",
  x: "𝕏",
  linkedin: "💼",
};

export function SuggestTopicsPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafting, setDrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MarketingTopicSuggestion[]>([]);

  const fetchSuggestions = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await suggestMarketingTopicsAction();
        if (r.error) {
          setError(r.error);
          setSuggestions([]);
          return;
        }
        setSuggestions(r.suggestions ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't reach the server. Please check your connection and try again."
        );
      }
    });
  };

  const draftFromSuggestion = (s: MarketingTopicSuggestion) => {
    setError(null);
    setDrafting(s.id);
    startTransition(async () => {
      try {
        const r = await generateSocialPostDraftsAction({
          platforms: s.platforms,
          targetKind: s.targetKind,
          targetId: s.targetId,
          brief: s.brief,
          countPerPlatform: 1,
        });
        if (r.error) {
          setError(r.error);
          return;
        }
        setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Network error. Try again."
        );
      } finally {
        setDrafting(null);
      }
    });
  };

  return (
    <section className="paraiso-card space-y-3 rounded-2xl border-2 border-[#5e3aa3]/20 bg-[#f4ecdd]/30 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Lightbulb className="h-5 w-5 text-[#5e3aa3]" />
        <h2 className="text-lg font-semibold text-[#11272b]">
          Suggested topics
        </h2>
        <p className="text-xs text-[#5e7279]">
          AI scans the catalog + bookings + drafts and proposes what to
          post about this week.
        </p>
        <button
          type="button"
          onClick={fetchSuggestions}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[#5e3aa3] bg-[#5e3aa3]/10 px-3 py-1.5 text-xs font-bold text-[#5e3aa3] transition hover:bg-[#5e3aa3]/20 disabled:opacity-50"
        >
          {pending && !drafting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {suggestions.length === 0 ? "Suggest topics" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {suggestions.length === 0 && !pending && !error && (
        <p className="text-sm italic text-[#8a9ba1]">
          Click "Suggest topics" to see AI-driven recommendations based on
          your current catalog + booking activity.
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((s) => {
            const isDrafting = drafting === s.id;
            return (
              <div
                key={s.id}
                className="space-y-2 rounded-xl border border-[#5e3aa3]/30 bg-[#fffbf4] p-3"
              >
                <div className="flex items-start gap-2">
                  <h3 className="flex-1 font-semibold text-[#11272b]">
                    {s.title}
                  </h3>
                  <div className="flex shrink-0 gap-1 text-xs">
                    {s.platforms.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-[#f4ecdd] px-1.5 py-0.5 text-[10px]"
                        aria-label={p}
                      >
                        {PLATFORM_EMOJI[p] ?? p}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs italic text-[#5e7279]">
                  {s.rationale}
                </p>
                {s.brief && (
                  <p className="rounded bg-[#f4ecdd]/50 px-2 py-1 text-xs text-[#5e7279]">
                    Brief: {s.brief}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => draftFromSuggestion(s)}
                  disabled={pending}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#5e3aa3] px-3 py-1.5 text-xs font-bold text-[#f6ead6] transition hover:bg-[#4a2e83] disabled:opacity-50"
                >
                  {isDrafting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isDrafting ? "Drafting…" : "Draft this"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
