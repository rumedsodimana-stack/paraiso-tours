"use client";

import { useState } from "react";
import {
  Activity,
  Brain,
  Eye,
  MessageCircle,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import {
  type AgentProposal,
  type AgentMessage,
} from "@/stores/ai-agent.store";
import type { AgentNextAction } from "@/lib/agent-ooda";
import { useAdminWorkspace } from "@/stores/admin-workspace.store";
import { AgentClarification } from "@/components/agent/AgentClarification";
import { AgentProposals } from "@/components/agent/AgentProposals";
import { useAgentLoop } from "@/hooks/useAgentLoop";

/**
 * Client surface for the OODA agent loop. Pulls observation from Zustand
 * stores, sends request to the server action, and routes the decision to
 * the appropriate UI: Answer → message bubble. Clarify → clarification
 * panel. Propose → pending-proposal card in the HITL queue.
 *
 * All OODA logic lives in `useAgentLoop`. This surface is just chrome.
 * The floating `<GlobalAdminAiChat />` widget uses the same hook so the
 * conversation, working memory, and pending proposals stay in sync.
 */
export function AgentSurface() {
  const {
    phase,
    busy,
    messages,
    pendingClarification,
    pendingProposals,
    workingMemory,
    longTermMemory,
    sendText,
    handleChipClick,
    handleProposalApprove,
    handleProposalReject,
    resetConversation,
  } = useAgentLoop();

  const currentView = useAdminWorkspace((s) => s.currentView);
  const currentEntity = useAdminWorkspace((s) => s.currentEntity);
  const recent = useAdminWorkspace((s) => s.recent);

  const [input, setInput] = useState("");
  const pendingProposalsCount = pendingProposals.length;
  const send = () => {
    sendText(input);
    setInput("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* OODA phase pill */}
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a9ba1]">
          <OodaPhasePill phase={phase} />
          {busy && <span className="text-[#c9922f]">thinking…</span>}
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              if (messages.length === 0) return;
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  "Start a fresh conversation? Long-term memory is kept."
                )
              ) {
                return;
              }
              resetConversation();
            }}
            disabled={busy || messages.length === 0}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5e7279] transition hover:border-[#c9922f] hover:text-[#11272b] disabled:cursor-not-allowed disabled:opacity-50"
            title="Start a new conversation (long-term memory preserved)"
          >
            <RefreshCcw className="h-3 w-3" />
            New chat
          </button>
        </div>

        {/* Conversation */}
        <div className="paraiso-card rounded-2xl p-5 space-y-3 min-h-[320px]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles className="h-8 w-8 text-[#8a9ba1]" />
              <p className="text-sm text-[#5e7279]">
                Start a conversation. The agent will observe your current
                context, orient, and propose next actions.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onChip={handleChipClick}
                disabled={busy}
              />
            ))
          )}

          {pendingClarification && (
            <AgentClarification
              clarification={pendingClarification}
              onResolve={(value) => sendText(value)}
            />
          )}

          {pendingProposalsCount > 0 && (
            <AgentProposals
              onApprove={handleProposalApprove}
              onReject={handleProposalReject}
            />
          )}
        </div>

        {/* Composer */}
        <div className="paraiso-card rounded-2xl p-4">
          <label className="sr-only" htmlFor="agent-input">
            Ask the agent
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="agent-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy}
              placeholder="What do you need the agent to do? Press ⏎ to send, ⇧⏎ for newline."
              className="flex-1 resize-none rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-3 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#12343b] px-4 py-3 text-sm font-semibold text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Side panel — context + memory */}
      <aside className="space-y-4">
        <section className="paraiso-card rounded-2xl p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
            <Target className="h-4 w-4 text-[#12343b]" />
            Current context
          </h3>
          <div className="mt-3 space-y-2 text-xs">
            <p className="text-[#8a9ba1]">
              View: <span className="font-semibold text-[#11272b]">{currentView}</span>
            </p>
            {currentEntity ? (
              <p className="text-[#8a9ba1]">
                Focus:{" "}
                <span className="font-semibold text-[#11272b]">
                  {currentEntity.kind}: {currentEntity.label ?? currentEntity.id}
                </span>
              </p>
            ) : (
              <p className="text-[#8a9ba1]">No focused entity.</p>
            )}
            {recent.length > 0 && (
              <div>
                <p className="mt-2 text-[#8a9ba1]">Recent:</p>
                <ul className="mt-1 space-y-1">
                  {recent.slice(0, 5).map((r) => (
                    <li
                      key={`${r.kind}:${r.id}`}
                      className="truncate rounded-md bg-[#f4ecdd] px-2 py-1 text-[#5e7279]"
                    >
                      {r.kind}: {r.label ?? r.id}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="paraiso-card rounded-2xl p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
            <Brain className="h-4 w-4 text-[#12343b]" />
            Working memory ({workingMemory.length})
          </h3>
          <div className="mt-3 space-y-1 text-xs">
            {workingMemory.length === 0 ? (
              <p className="text-[#8a9ba1]">Nothing observed yet this session.</p>
            ) : (
              workingMemory.slice(0, 5).map((m) => (
                <p
                  key={m.id}
                  className="rounded-md bg-[#f4ecdd] px-2 py-1 text-[#5e7279]"
                >
                  <span className="font-semibold text-[#12343b]">[{m.kind}]</span>{" "}
                  {m.text}
                </p>
              ))
            )}
          </div>
        </section>

        <section className="paraiso-card rounded-2xl p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#11272b]">
            <Activity className="h-4 w-4 text-[#12343b]" />
            Long-term memory ({longTermMemory.length})
          </h3>
          <div className="mt-3 space-y-1 text-xs">
            {longTermMemory.length === 0 ? (
              <p className="text-[#8a9ba1]">
                Nothing saved yet. The agent will distill learnings here as
                you interact across sessions.
              </p>
            ) : (
              longTermMemory.slice(0, 5).map((m) => (
                <p
                  key={m.id}
                  className="rounded-md bg-[#eef4f4] px-2 py-1 text-[#5e7279]"
                >
                  <span className="font-semibold text-[#12343b]">[{m.kind}]</span>{" "}
                  {m.text}
                </p>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function OodaPhasePill({ phase }: { phase: string }) {
  const label = phase === "idle" ? "Idle" : phase.charAt(0).toUpperCase() + phase.slice(1);
  const map: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
    idle: { bg: "bg-[#e2e3dd]", text: "text-[#545a54]", Icon: MessageCircle },
    observe: { bg: "bg-[#eef4f4]", text: "text-[#12343b]", Icon: Eye },
    orient: { bg: "bg-[#f4ecdd]", text: "text-[#7a5a17]", Icon: Brain },
    decide: { bg: "bg-[#f3e8ce]", text: "text-[#7a5a17]", Icon: Target },
    act: { bg: "bg-[#dce8dc]", text: "text-[#375a3f]", Icon: Activity },
  };
  const cfg = map[phase] ?? map.idle;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function MessageBubble({
  message,
  onChip,
  disabled,
}: {
  message: AgentMessage;
  onChip: (chip: AgentNextAction) => void;
  disabled: boolean;
}) {
  const isUser = message.role === "user";
  const chips = !isUser && message.nextActions ? message.nextActions : [];
  return (
    <div
      className={`flex flex-col gap-1.5 ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "bg-[#12343b] text-[#f6ead6]"
            : "border border-[#e0e4dd] bg-[#fffbf4] text-[#11272b]"
        }`}
      >
        {message.content}
      </div>
      {chips.length > 0 && (
        <div className="flex max-w-[80%] flex-wrap gap-1.5">
          {chips.map((chip, i) => (
            <button
              key={`${message.id}-chip-${i}`}
              type="button"
              onClick={() => onChip(chip)}
              disabled={disabled}
              title={chip.send ?? chip.label}
              className="rounded-full border border-[#c9922f]/40 bg-[#f4ecdd] px-3 py-1 text-xs font-medium text-[#7a5a17] transition hover:border-[#c9922f] hover:bg-[#f3e8ce] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Export so unused-var lints stay quiet on the import above.
export type { AgentProposal };
