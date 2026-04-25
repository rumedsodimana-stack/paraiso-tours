"use client";

import { useMemo, useState } from "react";
import { Check, X, Zap } from "lucide-react";
import { useAgent, type AgentProposal } from "@/stores/ai-agent.store";

interface Props {
  /** Called when the admin approves — host is responsible for actually
   *  executing the proposed tool and reporting back via the store. */
  onApprove?: (proposalId: string) => Promise<void> | void;
  onReject?: (proposalId: string, reason?: string) => Promise<void> | void;
}

/**
 * Renders every pending AI proposal as a confirmation card with Approve /
 * Reject. Nothing executes until the admin clicks Approve — this is the
 * HITL gate the spec asks for.
 */
export function AgentProposals({ onApprove, onReject }: Props) {
  // ⚠️  Zustand v5 + React 19: subscribe to the raw map and derive the
  // sorted/filtered list inside `useMemo`. A selector that returns a fresh
  // `Object.values(...).filter(...).sort(...)` array breaks the
  // useSyncExternalStore snapshot caching → infinite re-render.
  const proposalsMap = useAgent((s) => s.proposals);
  const pending = useMemo<AgentProposal[]>(
    () =>
      Object.values(proposalsMap)
        .filter((p) => p.status === "pending")
        .sort((a, b) => b.createdAt - a.createdAt),
    [proposalsMap]
  );
  const approveProposal = useAgent((s) => s.approveProposal);
  const rejectProposal = useAgent((s) => s.rejectProposal);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectionInput, setRejectionInput] = useState<Record<string, string>>({});

  if (pending.length === 0) return null;

  return (
    <div className="space-y-3">
      {pending.map((p) => {
        const confidencePct = Math.round(p.confidence * 100);
        return (
          <div
            key={p.id}
            className="rounded-[1.4rem] border border-[#e0e4dd] bg-[#fffbf4] px-5 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#c9922f]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a9ba1]">
                    Pending action · confidence {confidencePct}%
                  </p>
                </div>
                <h3 className="mt-1 font-semibold text-[#11272b]">{p.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[#5e7279]">
                  {p.summary}
                </p>
                {p.entityRefs && p.entityRefs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.entityRefs.map((r) => (
                      <span
                        key={`${r.kind}:${r.id}`}
                        className="rounded-full bg-[#eef4f4] px-2 py-0.5 text-xs font-medium text-[#12343b]"
                      >
                        {r.kind}: {r.label ?? r.id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={async () => {
                    setBusy(p.id);
                    try {
                      await onApprove?.(p.id);
                      // If host didn't mark it executed itself, mark approved.
                      approveProposal(p.id);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Approve &amp; run
                </button>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={async () => {
                    const reason = rejectionInput[p.id]?.trim() || "Rejected by admin";
                    setBusy(p.id);
                    try {
                      await onReject?.(p.id, reason);
                      rejectProposal(p.id, reason);
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#7c3a24] transition hover:bg-[#eed9cf]/40 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
            <div className="mt-3">
              <input
                type="text"
                placeholder="Optional: reason for rejecting (helps the agent learn)"
                value={rejectionInput[p.id] ?? ""}
                onChange={(e) =>
                  setRejectionInput((m) => ({ ...m, [p.id]: e.target.value }))
                }
                className="w-full rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-3 py-2 text-xs text-[#5e7279] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
