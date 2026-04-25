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

import { useMemo, useRef, useTransition } from "react";
import {
  useAgent,
  type AgentMessage,
  type AgentProposal,
  type ClarificationRequest,
  type MemoryEntry,
  type PlanStep,
  type PlanStepStatus,
} from "@/stores/ai-agent.store";
import { useAdminWorkspace } from "@/stores/admin-workspace.store";
import type { AgentNextAction, AgentObservation } from "@/lib/agent-ooda";
import { decideAgentAction, executeProposalAction } from "@/app/actions/agent";
import {
  runAgentTurnAction,
  resumeAgentTurnAction,
  isNativeAgentRuntimeAvailableAction,
  type AgentTurnActionResponse,
} from "@/app/actions/agent-turn";
import type { AgentTurnState } from "@/lib/agent-runtime";
import { toolRequiresApproval } from "@/lib/agent-tool-catalog";

// ── Plan-tool routing (Cowork Phase C.2) ─────────────────────────────────
//
// `set_plan` and `update_plan_step` are conversational state, not data
// mutations. They auto-execute (category=read) but the client intercepts
// their results so:
//   - Batch and streaming paths skip the default "tool_use → proposal card"
//     and "tool_result → tool bubble + memory pill" rendering.
//   - The runtime payload (validated server-side) is forwarded to the
//     Zustand plan store, which the `<AgentPlanCard />` subscribes to.
//
// Net effect: the admin sees the plan as one persistent card that updates
// in place, without the noisy per-step proposal/tool bubbles that would
// otherwise spam the conversation surface.
const PLAN_TOOL_NAMES = new Set(["set_plan", "update_plan_step"]);

function isPlanTool(name: string): boolean {
  return PLAN_TOOL_NAMES.has(name);
}

/**
 * Route a successful plan tool's payload into the Zustand plan store.
 * Returns true when the result was consumed (caller should skip default
 * rendering); false when the payload was malformed or the tool failed,
 * in which case caller should fall back to the normal tool-bubble path
 * so the admin at least sees something went wrong.
 */
function applyPlanToolResult(
  toolName: string,
  ok: boolean,
  data: unknown
): boolean {
  if (!ok) return false;
  if (toolName === "set_plan") {
    const plan = data as
      | { title?: string; steps?: PlanStep[] }
      | null
      | undefined;
    if (!plan?.title || !Array.isArray(plan.steps) || plan.steps.length === 0)
      return false;
    useAgent.getState().setPlan({ title: plan.title, steps: plan.steps });
    return true;
  }
  if (toolName === "update_plan_step") {
    const upd = data as
      | { id?: string; status?: PlanStepStatus; note?: string }
      | null
      | undefined;
    if (!upd?.id || !upd?.status) return false;
    useAgent.getState().updatePlanStep(upd.id, upd.status, upd.note);
    return true;
  }
  return false;
}

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

  // ── Working-memory helper ─────────────────────────────────────────
  // Every memory write is also surfaced inline in the conversation as a
  // small system pill so the admin sees the agent's awareness flow
  // alongside the chat. The raw `entry.text` reads as machine logs
  // ("Proposed: Send invoice (tool=send_invoice, conf=0.78)"), so
  // callers pass a human-readable `displayText` instead.
  const rememberWorkingAndAnnounce = (
    entry: Omit<MemoryEntry, "id" | "at">,
    displayText?: string
  ) => {
    rememberWorking(entry);
    addMessage({ role: "system", content: displayText ?? entry.text });
  };

  const currentView = useAdminWorkspace((s) => s.currentView);
  const currentEntity = useAdminWorkspace((s) => s.currentEntity);
  const recent = useAdminWorkspace((s) => s.recent);

  const [, startTransition] = useTransition();

  // ── Native-runtime cache ─────────────────────────────────────────
  // First sendText probes whether the configured provider is Anthropic
  // (and AI is enabled+configured). Result is cached for the rest of the
  // session — we don't expect the provider to flip mid-conversation.
  // null = unknown / not yet probed; true = use native path; false = use
  // legacy JSON-mode path.
  const nativeRuntimeAvailable = useRef<boolean | null>(null);

  // Map from proposalId → saved AgentTurnState. Lets a delete approval's
  // resume call back into the runtime with the conversation it was paused
  // on. Hook-local; lost on hard reload (which is fine — admin can re-issue).
  const pendingTurnStates = useRef<Map<string, AgentTurnState>>(new Map());

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
        rememberWorkingAndAnnounce(
          {
            kind: "learning",
            text: `${proposal.tool} succeeded: ${result.summary}`,
          },
          `✓ Ran ${proposal.tool}`
        );

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
                content: `Next: **${follow.decision.title}** (delete) — approve below to run.`,
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
                  content: `Step paused: **${step.title}** (delete) — approve below to continue the chain.`,
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
        rememberWorkingAndAnnounce(
          {
            kind: "learning",
            text: `${proposal.tool} failed: ${result.error ?? result.summary}`,
          },
          `⚠️ ${proposal.tool} failed`
        );
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

  // ── Native-runtime path (Anthropic tool-calling) ───────────────────
  // Renders the server-side event stream into the same UI primitives the
  // legacy path uses: tool_use → proposal card transitioning straight to
  // executed; tool_result → tool bubble + system pill; assistant_text →
  // assistant bubble; pendingApproval → pending proposal card with the
  // saved AgentTurnState stashed for resume.
  const applyNativeEvents = (
    response: AgentTurnActionResponse
  ): { proposalIdForApproval?: string } => {
    const events = response.events ?? [];
    let pendingProposalId: string | undefined;

    // Map tool_use_id → proposalId so the matching tool_result can flip
    // the proposal from pending → executed without a second store search.
    const toolUseToProposal = new Map<string, string>();

    for (const ev of events) {
      if (ev.kind === "assistant_text") {
        if (ev.content.trim()) {
          addMessage({ role: "assistant", content: ev.content });
        }
        continue;
      }
      if (ev.kind === "tool_use") {
        // Plan tools are conversational state — the plan card renders the
        // outcome on tool_result. Skip the proposal-card noise here.
        if (isPlanTool(ev.toolName)) continue;
        // Show the tool call as a proposal so the existing UI surface
        // (proposal card with pending → executed transition) renders it
        // consistently with the legacy path.
        const proposal = addProposal({
          title: ev.toolName,
          summary: `Calling ${ev.toolName}`,
          tool: ev.toolName,
          input: ev.input,
          confidence: 1,
        });
        toolUseToProposal.set(ev.toolUseId, proposal.id);
        continue;
      }
      if (ev.kind === "tool_result") {
        // Plan tools: forward to the plan store and skip the default
        // tool-bubble + memory-pill rendering (the plan card IS the
        // visualization). On payload-shape failure fall through so the
        // admin still sees the error in the conversation.
        if (isPlanTool(ev.toolName) && applyPlanToolResult(ev.toolName, ev.ok, ev.data)) {
          continue;
        }
        const proposalId = toolUseToProposal.get(ev.toolUseId);
        if (proposalId) {
          if (ev.ok) markProposalExecuted(proposalId, ev.data);
          else markProposalFailed(proposalId, ev.summary);
        }
        addMessage({
          role: "tool",
          content: ev.summary,
          toolName: ev.toolName,
        });
        rememberWorkingAndAnnounce(
          {
            kind: ev.ok ? "learning" : "fact",
            text: ev.ok
              ? `${ev.toolName} succeeded: ${ev.summary}`
              : `${ev.toolName} failed: ${ev.summary}`,
          },
          ev.ok ? `✓ Ran ${ev.toolName}` : `⚠️ ${ev.toolName} failed`
        );
        continue;
      }
    }

    if (response.pendingApproval) {
      // The model stopped on a delete tool_use. Surface it as a pending
      // proposal so the existing approval-card UI gates it.
      const pending = response.pendingApproval;
      const proposal = addProposal({
        title: pending.toolName,
        summary: `Pending admin approval: ${pending.toolName}`,
        tool: pending.toolName,
        input: pending.input,
        confidence: 1,
      });
      pendingTurnStates.current.set(proposal.id, pending.state);
      pendingProposalId = proposal.id;
      addMessage({
        role: "assistant",
        content: `**${pending.toolName}** is a delete — approve below to run.`,
        proposalId: proposal.id,
      });
    } else if (response.finalText && response.finalText.trim()) {
      // The final assistant text was already rendered as `assistant_text`
      // events while the loop produced them. No-op here unless we want
      // to surface a summary distinct from streamed text — defer for now.
    }

    return { proposalIdForApproval: pendingProposalId };
  };

  /** Run a fresh user turn through the native-tool-calling runtime
   *  (BATCH path — used as a fallback when SSE streaming fails). */
  const sendTextNativeBatch = async (
    text: string,
    observation: AgentObservation
  ) => {
    setPhase("decide");
    const response = await runAgentTurnAction({ request: text, observation });
    if (!response.ok) {
      addMessage({
        role: "assistant",
        content: response.error ?? "Native agent runtime returned no result.",
      });
      return;
    }
    setPhase("act");
    applyNativeEvents(response);
  };

  /** Run a fresh user turn through the SSE streaming endpoint.
   *
   *  This is the Cowork-grade path: tokens appear in the bubble
   *  character-by-character, tool calls flip to "running" the moment
   *  they begin, and the next iteration's text starts streaming the
   *  instant tool results return.
   *
   *  Falls back to the batch path if the streaming endpoint errors out
   *  (network drop, non-200 status, malformed SSE). The fallback
   *  preserves the message the user already typed and lets them see a
   *  result instead of an aborted bubble. */
  const sendTextNativeStream = async (
    text: string,
    observation: AgentObservation
  ): Promise<void> => {
    setPhase("decide");

    let response: Response;
    try {
      response = await fetch("/api/agent/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text, observation }),
      });
    } catch (err) {
      // Network-level failure — fall back to batch.
      console.warn(
        "[agent] streaming fetch failed, falling back to batch:",
        err
      );
      await sendTextNativeBatch(text, observation);
      return;
    }

    if (!response.ok || !response.body) {
      const fallbackMsg = await response.text().catch(() => "");
      console.warn(
        `[agent] streaming endpoint returned ${response.status}, falling back to batch. Body: ${fallbackMsg.slice(0, 200)}`
      );
      await sendTextNativeBatch(text, observation);
      return;
    }

    setPhase("act");

    // Per-stream state mirroring `applyNativeEvents`. We can't reuse
    // the batch helper because deltas update an existing bubble in place
    // rather than appending whole messages.
    const toolUseToProposal = new Map<string, string>();
    const textBubbleByIndex = new Map<number, string>(); // contentBlockIndex → assistant message id

    const handleEvent = (
      ev: import("@/lib/agent-runtime").StreamEvent
    ): void => {
      switch (ev.kind) {
        case "iteration_start": {
          // Each iteration starts a fresh assistant turn. Reset the
          // text-bubble tracker so a new message bubble is created the
          // first time text arrives this iteration.
          textBubbleByIndex.clear();
          return;
        }
        case "assistant_text_delta": {
          const existing = textBubbleByIndex.get(ev.index);
          if (existing) {
            // Append to the existing bubble — UI re-renders with the
            // longer content.
            useAgent.getState().appendToMessage(existing, ev.text);
          } else {
            // First delta for this content block: create the bubble.
            const msg = addMessage({ role: "assistant", content: ev.text });
            textBubbleByIndex.set(ev.index, msg.id);
          }
          return;
        }
        case "tool_use_start": {
          // Plan tools (set_plan / update_plan_step): the plan card
          // renders the outcome on tool_result. Skip the proposal-card
          // noise here so the conversation surface stays clean.
          if (isPlanTool(ev.toolName)) return;
          // Surface the tool call as a pending proposal card. Input
          // is empty at this point — the input_complete event below
          // will fill it in as the model finishes deciding the args.
          const proposal = addProposal({
            title: ev.toolName,
            summary: `Calling ${ev.toolName}…`,
            tool: ev.toolName,
            input: {},
            confidence: 1,
          });
          toolUseToProposal.set(ev.toolUseId, proposal.id);
          return;
        }
        case "tool_use_input_complete": {
          // Model finished deciding tool args. Update the proposal's
          // input so the UI can render the full call signature.
          // (Currently the store doesn't expose an "update proposal
          // input" mutator — the existing input shows on the card via
          // the initial empty object. We could add one if the UX shows
          // a need for it. For now this event is a no-op on the UI but
          // keeps the wire format symmetric with the runtime.)
          return;
        }
        case "tool_executing": {
          // No-op for now — the proposal card already reads as
          // "calling X". A spinner here would be a nice touch.
          return;
        }
        case "tool_result": {
          // Plan tools: forward payload to the plan store and skip the
          // default tool-bubble + memory-pill rendering. On malformed
          // payload or tool-failure, fall through so the admin still
          // sees the failure in the conversation.
          if (isPlanTool(ev.toolName) && applyPlanToolResult(ev.toolName, ev.ok, ev.data)) {
            return;
          }
          const proposalId = toolUseToProposal.get(ev.toolUseId);
          if (proposalId) {
            if (ev.ok) markProposalExecuted(proposalId, ev.data);
            else markProposalFailed(proposalId, ev.summary);
          }
          addMessage({
            role: "tool",
            content: ev.summary,
            toolName: ev.toolName,
          });
          rememberWorkingAndAnnounce(
            {
              kind: ev.ok ? "learning" : "fact",
              text: ev.ok
                ? `${ev.toolName} succeeded: ${ev.summary}`
                : `${ev.toolName} failed: ${ev.summary}`,
            },
            ev.ok ? `✓ Ran ${ev.toolName}` : `⚠️ ${ev.toolName} failed`
          );
          return;
        }
        case "pending_approval": {
          const proposal = addProposal({
            title: ev.toolName,
            summary: `Pending admin approval: ${ev.toolName}`,
            tool: ev.toolName,
            input: ev.input,
            confidence: 1,
          });
          pendingTurnStates.current.set(proposal.id, ev.state);
          addMessage({
            role: "assistant",
            content: `**${ev.toolName}** is a delete — approve below to run.`,
            proposalId: proposal.id,
          });
          return;
        }
        case "complete": {
          // Final text was already streamed via deltas. Nothing extra
          // to render.
          return;
        }
        case "error": {
          addMessage({
            role: "assistant",
            content: `⚠️ ${ev.error}`,
          });
          return;
        }
      }
    };

    // SSE reader — split incoming bytes on `\n\n` and decode each
    // `data: ...` payload as a StreamEvent. Terminator is `data: [DONE]`.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!block.trim()) continue;
          const dataLine = block
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = dataLine.slice(6);
          if (payload === "[DONE]") return;
          try {
            const ev = JSON.parse(payload) as import(
              "@/lib/agent-runtime"
            ).StreamEvent;
            handleEvent(ev);
          } catch {
            // Skip malformed frames silently.
          }
        }
      }
    } catch (err) {
      addMessage({
        role: "assistant",
        content: `⚠️ Stream interrupted: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }
  };

  /** Public entry: prefer streaming; fall back to batch on failure. */
  const sendTextNative = sendTextNativeStream;

  /** Resume a paused native turn after admin approves/rejects. */
  const resumeNative = async (
    state: AgentTurnState,
    approved: boolean,
    rejectionReason?: string
  ) => {
    setBusy(true);
    setPhase("act");
    try {
      const response = await resumeAgentTurnAction({
        state,
        approved,
        rejectionReason,
      });
      if (!response.ok) {
        addMessage({
          role: "assistant",
          content: response.error ?? "Native agent resume returned no result.",
        });
        return;
      }
      applyNativeEvents(response);
    } catch (err) {
      addMessage({
        role: "assistant",
        content:
          err instanceof Error
            ? `Resume failed: ${err.message}`
            : "Resume failed.",
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

        // First send of the session probes runtime availability. Cached
        // for the rest of the session.
        if (nativeRuntimeAvailable.current === null) {
          try {
            const probe = await isNativeAgentRuntimeAvailableAction();
            nativeRuntimeAvailable.current = probe.ok && probe.available;
          } catch {
            nativeRuntimeAvailable.current = false;
          }
        }

        if (nativeRuntimeAvailable.current === true) {
          await sendTextNative(text, observation);
          return;
        }

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
          rememberWorkingAndAnnounce(
            {
              kind: "fact",
              text: `Told admin: ${decision.response.slice(0, 160)}`,
            },
            "Replied"
          );
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
          rememberWorkingAndAnnounce(
            {
              kind: "fact",
              text: `Chain: ${decision.title} (${decision.steps.length} steps)`,
            },
            `Running ${decision.steps.length}-step chain`
          );
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
                content: `Step paused: **${step.title}** (delete) — approve below to continue the chain.`,
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
          rememberWorkingAndAnnounce(
            {
              kind: "fact",
              text: `Proposed: ${decision.title} (tool=${decision.tool}, conf=${decision.confidence.toFixed(2)})`,
            },
            `Proposed: ${decision.title}`
          );

          if (toolRequiresApproval(decision.tool)) {
            addMessage({
              role: "assistant",
              content: `**${decision.title}** is a delete — approve it below to run.`,
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

  const handleProposalApprove = async (proposalId: string) => {
    // Native-runtime proposals carry a saved AgentTurnState in the
    // `pendingTurnStates` map — approving them resumes the in-flight
    // model conversation instead of running the legacy `executeProposal`
    // path. Fall through to `runProposal` for legacy JSON-mode proposals.
    const nativeState = pendingTurnStates.current.get(proposalId);
    if (nativeState) {
      pendingTurnStates.current.delete(proposalId);
      await resumeNative(nativeState, true);
      return;
    }
    await runProposal(proposalId, { humanApproved: true });
  };

  const handleProposalReject = async (proposalId: string, reason?: string) => {
    rememberWorkingAndAnnounce(
      {
        kind: "learning",
        text: `Admin rejected proposal ${proposalId}${reason ? `: ${reason}` : ""}. Avoid similar.`,
      },
      reason
        ? `Rejected — ${reason}`
        : "Rejected proposal — will avoid similar"
    );

    // Same dispatch logic as approve — native-runtime proposals need to
    // resume the model conversation with `approved: false` so the LLM
    // receives the rejection as a tool_result and can react (apologize,
    // pick a different tool, ask the admin what to do).
    const nativeState = pendingTurnStates.current.get(proposalId);
    if (nativeState) {
      pendingTurnStates.current.delete(proposalId);
      markProposalFailed(proposalId, reason ?? "Rejected by admin");
      await resumeNative(nativeState, false, reason);
      return;
    }
    // Legacy JSON-mode path: just mark the proposal as rejected. There's
    // no in-flight conversation to resume — the OODA loop will pick up
    // again on the admin's next message.
    markProposalFailed(proposalId, reason ?? "Rejected by admin");
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
