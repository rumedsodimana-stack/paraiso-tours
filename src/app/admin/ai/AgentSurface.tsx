"use client";

import { useState, useTransition } from "react";
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
  useAgent,
  selectPendingClarification,
  selectPendingProposals,
  type AgentProposal,
  type AgentMessage,
} from "@/stores/ai-agent.store";
import type { AgentNextAction } from "@/lib/agent-ooda";
import { useAdminWorkspace } from "@/stores/admin-workspace.store";
import { AgentClarification } from "@/components/agent/AgentClarification";
import { AgentProposals } from "@/components/agent/AgentProposals";
import { decideAgentAction, executeProposalAction } from "@/app/actions/agent";
import { toolRequiresApproval } from "@/lib/agent-tool-catalog";

/**
 * Client surface for the OODA agent loop. Pulls observation from Zustand
 * stores, sends request to the server action, and routes the decision to
 * the appropriate UI: Answer → message bubble. Clarify → clarification
 * panel. Propose → pending-proposal card in the HITL queue.
 */
export function AgentSurface() {
  const phase = useAgent((s) => s.phase);
  const busy = useAgent((s) => s.busy);
  const messages = useAgent((s) => s.messages);
  const pendingClarification = useAgent(selectPendingClarification);
  const pendingProposalsCount = useAgent(
    (s) => selectPendingProposals(s).length
  );
  const workingMemory = useAgent((s) => s.workingMemory);
  const longTermMemory = useAgent((s) => s.longTermMemory);
  const addMessage = useAgent((s) => s.addMessage);
  const addClarification = useAgent((s) => s.addClarification);
  const addProposal = useAgent((s) => s.addProposal);
  const setPhase = useAgent((s) => s.setPhase);
  const setBusy = useAgent((s) => s.setBusy);
  const rememberWorking = useAgent((s) => s.rememberWorking);
  const resetConversation = useAgent((s) => s.resetConversation);

  const currentView = useAdminWorkspace((s) => s.currentView);
  const currentEntity = useAdminWorkspace((s) => s.currentEntity);
  const recent = useAdminWorkspace((s) => s.recent);

  const [input, setInput] = useState("");
  const [, startTransition] = useTransition();

  // Build an OODA observation from the current store state, appending the
  // next user utterance. Shared between the initial send and the
  // continue-after-execute loop so both see the same snapshot shape.
  const buildObservation = (
    priorMessages: typeof messages,
    nextUserText: string
  ) => ({
    recentDialogue: priorMessages
      .slice(-10)
      .map((m) => ({
        role: m.role === "tool" ? ("tool" as const) : m.role,
        content: m.content,
        toolName: m.toolName,
      }))
      .concat([
        { role: "user" as const, content: nextUserText, toolName: undefined },
      ]),
    currentEntity: currentEntity
      ? {
          kind: currentEntity.kind,
          id: currentEntity.id,
          label: currentEntity.label,
        }
      : undefined,
    recent: recent.map((r) => ({
      kind: r.kind,
      id: r.id,
      label: r.label,
    })),
    workingMemory: workingMemory.map((e) => ({
      kind: e.kind,
      text: e.text,
    })),
    longTermMemory: longTermMemory.map((e) => ({
      kind: e.kind,
      text: e.text,
    })),
  });

  const sendText = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInput("");
    addMessage({ role: "user", content: text });
    setBusy(true);
    setPhase("observe");

    startTransition(async () => {
      try {
        setPhase("orient");
        const observation = buildObservation(messages, text);

        setPhase("decide");
        const result = await decideAgentAction({
          request: text,
          observation,
        });

        setPhase("act");
        if (!result.ok || !result.decision) {
          addMessage({
            role: "assistant",
            content:
              result.error ??
              "The agent couldn't reach a decision. Try rephrasing.",
          });
          return;
        }

        const decision = result.decision;

        if (decision.kind === "answer") {
          addMessage({
            role: "assistant",
            content: decision.response,
            nextActions: decision.nextActions,
          });
          rememberWorking({
            kind: "fact",
            text: `Told admin: ${decision.response.slice(0, 160)}`,
          });
        } else if (decision.kind === "clarify" && result.clarification) {
          const cr = addClarification({
            question: result.clarification.question,
            suggestions: result.clarification.suggestions,
            allowCustomText: true,
            customPlaceholder: result.clarification.customPlaceholder,
          });
          addMessage({
            role: "assistant",
            content: result.clarification.question,
            clarificationId: cr.id,
            nextActions: decision.nextActions,
          });
        } else if (decision.kind === "propose_multi") {
          addMessage({
            role: "assistant",
            content: `**${decision.title}** — running ${decision.steps.length} steps.`,
            nextActions: decision.nextActions,
          });
          rememberWorking({
            kind: "fact",
            text: `Chain: ${decision.title} (${decision.steps.length} steps)`,
          });
          for (const step of decision.steps) {
            const stepProposal = addProposal({
              title: step.title,
              summary: step.summary ?? "",
              tool: step.tool,
              input: step.input,
              entityRefs: step.entityRefs,
              confidence: decision.confidence,
            });
            if (toolRequiresApproval(step.tool)) {
              // Chain pauses here — admin must approve this step before
              // the rest of the chain resumes (resumption happens naturally
              // via the post-approval runProposal follow-up).
              addMessage({
                role: "assistant",
                content: `Step paused: **${step.title}** (edit/delete) — approve below to continue the chain.`,
                proposalId: stepProposal.id,
              });
              break;
            }
            await autoExecute(stepProposal.id, step.title);
          }
        } else if (decision.kind === "propose") {
          const proposal = addProposal({
            title: decision.title,
            summary: decision.summary,
            tool: decision.tool,
            input: decision.input,
            entityRefs: decision.entityRefs,
            confidence: decision.confidence,
          });
          rememberWorking({
            kind: "fact",
            text: `Proposed: ${decision.title} (tool=${decision.tool}, conf=${decision.confidence.toFixed(2)})`,
          });

          if (toolRequiresApproval(decision.tool)) {
            // Update/delete — needs HITL approval card
            addMessage({
              role: "assistant",
              content: `**${decision.title}** is an edit/delete — approve it below to run.`,
              proposalId: proposal.id,
              nextActions: decision.nextActions,
            });
          } else {
            // Read/create/send — auto-execute inline
            await autoExecute(proposal.id, decision.title);
          }
        }
      } catch (err) {
        addMessage({
          role: "assistant",
          content:
            err instanceof Error ? `Error: ${err.message}` : "Unknown error.",
        });
      } finally {
        setBusy(false);
        setPhase("idle");
      }
    });
  };

  const send = () => sendText(input);

  const handleChipClick = (chip: AgentNextAction) => {
    if (busy) return;
    sendText(chip.send ?? chip.label);
  };

  const markProposalExecuted = useAgent((s) => s.markProposalExecuted);
  const markProposalFailed = useAgent((s) => s.markProposalFailed);
  const allProposals = useAgent((s) => s.proposals);

  // Shared helper used by both the auto-exec path (read/create/send) and
  // the Approve button (update/delete). Human-approved runs pass
  // approved:true so the server dispatcher allows update/delete.
  const runProposal = async (
    proposalId: string,
    opts: { humanApproved: boolean }
  ) => {
    const proposal = allProposals[proposalId];
    if (!proposal) return;

    setBusy(true);
    setPhase("act");
    try {
      const result = await executeProposalAction({
        tool: proposal.tool,
        input: proposal.input,
        proposalId,
        approved: opts.humanApproved,
      });

      if (result.ok) {
        markProposalExecuted(proposalId, result.data);
        addMessage({
          role: "tool",
          content: result.summary,
          toolName: proposal.tool,
        });
        rememberWorking({
          kind: "learning",
          text: `${proposal.tool} succeeded: ${result.summary}`,
        });

        // Continue the loop — feed the outcome back so the agent either
        // wraps up with an answer or proposes the next step.
        setPhase("observe");
        const observation = buildObservation(
          messages,
          `Tool ${proposal.tool} executed successfully. Summary: ${result.summary}`
        );
        setPhase("decide");
        const follow = await decideAgentAction({
          request: `I just ran ${proposal.tool}. Result: ${result.summary}. What's the next step, if any?`,
          observation,
        });
        if (follow.ok && follow.decision) {
          if (follow.decision.kind === "answer") {
            addMessage({
              role: "assistant",
              content: follow.decision.response,
              nextActions: follow.decision.nextActions,
            });
          } else if (follow.decision.kind === "propose") {
            const next = addProposal({
              title: follow.decision.title,
              summary: follow.decision.summary,
              tool: follow.decision.tool,
              input: follow.decision.input,
              entityRefs: follow.decision.entityRefs,
              confidence: follow.decision.confidence,
            });
            if (toolRequiresApproval(follow.decision.tool)) {
              addMessage({
                role: "assistant",
                content: `Next: **${follow.decision.title}** (edit/delete) — approve below.`,
                proposalId: next.id,
                nextActions: follow.decision.nextActions,
              });
            } else {
              // Chain auto-execute
              await runProposal(next.id, { humanApproved: false });
            }
          } else if (follow.decision.kind === "propose_multi") {
            addMessage({
              role: "assistant",
              content: `**${follow.decision.title}** — running ${follow.decision.steps.length} steps.`,
              nextActions: follow.decision.nextActions,
            });
            for (const step of follow.decision.steps) {
              const stepProposal = addProposal({
                title: step.title,
                summary: step.summary ?? "",
                tool: step.tool,
                input: step.input,
                entityRefs: step.entityRefs,
                confidence: follow.decision.confidence,
              });
              if (toolRequiresApproval(step.tool)) {
                addMessage({
                  role: "assistant",
                  content: `Step paused: **${step.title}** (edit/delete) — approve below to continue the chain.`,
                  proposalId: stepProposal.id,
                });
                break;
              }
              await runProposal(stepProposal.id, { humanApproved: false });
            }
          } else if (follow.decision.kind === "clarify" && follow.clarification) {
            const cr = addClarification({
              question: follow.clarification.question,
              suggestions: follow.clarification.suggestions,
              allowCustomText: true,
              customPlaceholder: follow.clarification.customPlaceholder,
            });
            addMessage({
              role: "assistant",
              content: follow.clarification.question,
              clarificationId: cr.id,
              nextActions: follow.decision.nextActions,
            });
          }
        }
      } else {
        markProposalFailed(proposalId, result.error ?? result.summary);
        addMessage({
          role: "assistant",
          content: `⚠️ ${proposal.tool} failed: ${result.error ?? result.summary}`,
        });
        rememberWorking({
          kind: "learning",
          text: `${proposal.tool} failed: ${result.error ?? result.summary}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      markProposalFailed(proposalId, msg);
      addMessage({
        role: "assistant",
        content: `⚠️ Unexpected execution error: ${msg}`,
      });
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  };

  // Alias used inside the initial send() flow for read/create/send proposals.
  const autoExecute = (proposalId: string, _title: string) =>
    runProposal(proposalId, { humanApproved: false });

  // The Approve button in AgentProposals — always a human approval.
  const handleProposalApprove = (proposalId: string) =>
    runProposal(proposalId, { humanApproved: true });

  const handleProposalReject = async (proposalId: string, reason?: string) => {
    rememberWorking({
      kind: "learning",
      text: `Admin rejected proposal ${proposalId}${reason ? `: ${reason}` : ""}. Avoid similar.`,
    });
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
            <AgentClarification clarification={pendingClarification} />
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
