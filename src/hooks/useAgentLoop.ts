/**
 * Shared OODA agent loop hook.
 *
 * Both `<AgentSurface />` (full /admin/ai page) and the floating
 * `<GlobalAdminAiChat />` widget use this hook so the agent behaves
 * identically across surfaces — same Zustand store, same tools, same
 * HITL gates. The conversation persists when the admin moves between
 * the floating widget and the full workspace.
 *
 * Page context (current pathname + active entity) is fed into the
 * observation so the agent stays page-aware Cowork-style.
 */

"use client";

import { useMemo, useTransition } from "react";
import {
  useAgent,
  type AgentMessage,
  type AgentProposal,
  type ClarificationRequest,
} from "@/stores/ai-agent.store";
import { useAdminWorkspace } from "@/stores/admin-workspace.store";
import type { AgentNextAction } from "@/lib/agent-ooda";
import { decideAgentAction, executeProposalAction } from "@/app/actions/agent";
import { toolRequiresApproval } from "@/lib/agent-tool-catalog";

export interface PageContext {
  /** Current admin path, e.g. /admin/bookings/lead_X. */
  path?: string;
  /** Human-readable label, e.g. "Booking detail". */
  label?: string;
  /** Free-form details the agent should know about the page. */
  details?: string[];
}

export interface AgentLoopApi {
  // State
  phase: ReturnType<typeof useAgent.getState>["phase"];
  busy: boolean;
  messages: AgentMessage[];
  pendingClarification: ClarificationRequest | null;
  pendingProposals: AgentProposal[];
  workingMemory: ReturnType<typeof useAgent.getState>["workingMemory"];
  longTermMemory: ReturnType<typeof useAgent.getState>["longTermMemory"];

  // Actions
  sendText: (raw: string) => void;
  handleChipClick: (chip: AgentNextAction) => void;
  handleProposalApprove: (proposalId: string) => Promise<void>;
  handleProposalReject: (proposalId: string, reason?: string) => Promise<void>;
  resetConversation: () => void;
}

/**
 * @param pageContext optional page-context override. The floating widget
 *   passes one in based on `usePathname()`; the full /admin/ai page
 *   doesn't need to (the workspace store already tracks currentEntity).
 */
export function useAgentLoop(pageContext?: PageContext): AgentLoopApi {
  const phase = useAgent((s) => s.phase);
  const busy = useAgent((s) => s.busy);
  const messages = useAgent((s) => s.messages);
  // ⚠️  Zustand v5 + React 19: subscribe to the raw maps (stable references
  // when nothing changed) and derive filtered/sorted lists in `useMemo`.
  // Returning a fresh `Object.values(...).filter(...).sort(...)` from a
  // selector causes "getSnapshot should be cached" → infinite re-render.
  const clarificationsMap = useAgent((s) => s.clarifications);
  const proposalsMap = useAgent((s) => s.proposals);
  const workingMemory = useAgent((s) => s.workingMemory);
  const longTermMemory = useAgent((s) => s.longTermMemory);

  const pendingClarification = useMemo<ClarificationRequest | null>(
    () => Object.values(clarificationsMap).find((c) => !c.resolvedAt) ?? null,
    [clarificationsMap]
  );
  const pendingProposals = useMemo<AgentProposal[]>(
    () =>
      Object.values(proposalsMap)
        .filter((p) => p.status === "pending")
        .sort((a, b) => b.createdAt - a.createdAt),
    [proposalsMap]
  );

  const addMessage = useAgent((s) => s.addMessage);
  const addClarification = useAgent((s) => s.addClarification);
  const addProposal = useAgent((s) => s.addProposal);
  const setPhase = useAgent((s) => s.setPhase);
  const setBusy = useAgent((s) => s.setBusy);
  const rememberWorking = useAgent((s) => s.rememberWorking);
  const markProposalExecuted = useAgent((s) => s.markProposalExecuted);
  const markProposalFailed = useAgent((s) => s.markProposalFailed);
  const allProposals = useAgent((s) => s.proposals);
  const resetConversation = useAgent((s) => s.resetConversation);

  const currentView = useAdminWorkspace((s) => s.currentView);
  const currentEntity = useAdminWorkspace((s) => s.currentEntity);
  const recent = useAdminWorkspace((s) => s.recent);

  const [, startTransition] = useTransition();

  // ── Observation builder ────────────────────────────────────────────
  // Same shape used everywhere: dialogue tail + entity focus + memory.
  // Page context is appended as part of the dialogue so the agent treats
  // it as a system-style fact about where the admin currently is.
  const buildObservation = (
    priorMessages: AgentMessage[],
    nextUserText: string
  ) => {
    const pageContextLine = pageContext?.path
      ? `[page-context] ${pageContext.label ?? "page"} — ${pageContext.path}${
          pageContext.details && pageContext.details.length
            ? "\n" + pageContext.details.map((d) => `  ${d}`).join("\n")
            : ""
        }`
      : null;

    return {
      recentDialogue: priorMessages
        .slice(-10)
        .map((m) => ({
          role: m.role === "tool" ? ("tool" as const) : m.role,
          content: m.content,
          toolName: m.toolName,
        }))
        .concat(
          pageContextLine
            ? [
                {
                  role: "system" as const,
                  content: pageContextLine,
                  toolName: undefined,
                },
              ]
            : []
        )
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
      recent: recent.map((r) => ({ kind: r.kind, id: r.id, label: r.label })),
      workingMemory: workingMemory.map((e) => ({ kind: e.kind, text: e.text })),
      longTermMemory: longTermMemory.map((e) => ({ kind: e.kind, text: e.text })),
      view: currentView,
      pagePath: pageContext?.path,
    };
  };

  // ── Proposal runner (auto-execute + post-execute follow-up) ────────
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

        // Continue the loop — feed the outcome back to the agent so it
        // either summarizes or proposes the next step.
        setPhase("observe");
        const observation = buildObservation(
          useAgent.getState().messages,
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

  // ── Send a user turn ───────────────────────────────────────────────
  const sendText = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    addMessage({ role: "user", content: text });
    setBusy(true);
    setPhase("observe");

    startTransition(async () => {
      try {
        setPhase("orient");
        const observation = buildObservation(
          useAgent.getState().messages,
          text
        );

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
              addMessage({
                role: "assistant",
                content: `Step paused: **${step.title}** (edit/delete) — approve below to continue the chain.`,
                proposalId: stepProposal.id,
              });
              break;
            }
            await runProposal(stepProposal.id, { humanApproved: false });
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
            addMessage({
              role: "assistant",
              content: `**${decision.title}** is an edit/delete — approve it below to run.`,
              proposalId: proposal.id,
              nextActions: decision.nextActions,
            });
          } else {
            await runProposal(proposal.id, { humanApproved: false });
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

  const handleChipClick = (chip: AgentNextAction) => {
    if (busy) return;
    sendText(chip.send ?? chip.label);
  };

  const handleProposalApprove = (proposalId: string) =>
    runProposal(proposalId, { humanApproved: true });

  const handleProposalReject = async (proposalId: string, reason?: string) => {
    rememberWorking({
      kind: "learning",
      text: `Admin rejected proposal ${proposalId}${reason ? `: ${reason}` : ""}. Avoid similar.`,
    });
  };

  return {
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
  };
}
