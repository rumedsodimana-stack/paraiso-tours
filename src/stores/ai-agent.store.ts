/**
 * AI-agent Zustand store — HITL + OODA framework.
 *
 * OODA cycle (John Boyd):
 *   observe  — ingest current state (messages, entity context, tool results)
 *   orient   — build mental model from observations + long-term memory
 *   decide   — pick one of: answer, propose-action, request-clarification
 *   act      — execute the action OR return the clarification request
 *
 * The store tracks:
 *   - the current OODA phase (so UI can show "orienting…", "deciding…")
 *   - the conversation messages (with role + tool-call metadata)
 *   - any pending clarification request (with 4 AI-generated suggestions +
 *     a free-text fallback; nothing executes until the human picks one)
 *   - pending proposals (actions the agent wants to take, awaiting admin
 *     sign-off — the HITL gate)
 *   - working memory: facts the agent has observed during this session
 *   - long-term memory: summarized learnings from past sessions
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { AgentNextAction } from "@/lib/agent-ooda";

// In-memory no-op storage used during SSR or when localStorage is absent.
const _agentMemoryBackstop: Record<string, string> = {};
const ssrSafeStorage: StateStorage = {
  getItem: (k) => _agentMemoryBackstop[k] ?? null,
  setItem: (k, v) => {
    _agentMemoryBackstop[k] = v;
  },
  removeItem: (k) => {
    delete _agentMemoryBackstop[k];
  },
};

// ── OODA phase ───────────────────────────────────────────────────────────

export type OodaPhase = "idle" | "observe" | "orient" | "decide" | "act";

// ── Messages ─────────────────────────────────────────────────────────────

export type AgentMessageRole = "user" | "assistant" | "system" | "tool";

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  /** For tool role: the tool name that produced this content. */
  toolName?: string;
  /** For assistant role: the action proposal or clarification request. */
  proposalId?: string;
  clarificationId?: string;
  /** Optional clickable next-action chips rendered under the bubble. */
  nextActions?: AgentNextAction[];
  createdAt: number;
}

// ── Clarification (HITL question) ────────────────────────────────────────

export interface ClarificationSuggestion {
  /** Short label for the button (≤ 60 chars). */
  label: string;
  /** Full value the agent will receive if picked. */
  value: string;
  /** Optional one-line rationale to show as tooltip / secondary text. */
  rationale?: string;
}

export interface ClarificationRequest {
  id: string;
  question: string;
  /** Exactly 4 AI-generated suggestions, best-first. */
  suggestions: ClarificationSuggestion[];
  /** When true the UI must also render a free-text input for custom replies. */
  allowCustomText: boolean;
  /** Optional placeholder for the custom input. */
  customPlaceholder?: string;
  createdAt: number;
  resolvedAt?: number;
  resolution?: {
    source: "suggestion" | "custom";
    value: string;
  };
}

// ── Proposal (HITL action gate) ──────────────────────────────────────────

export interface AgentProposal {
  id: string;
  title: string;
  summary: string;
  /** The server-side tool name + input payload needed to execute. */
  tool: string;
  input: unknown;
  /** Entity refs for the UI to render a rich confirmation card. */
  entityRefs?: Array<{ kind: string; id: string; label?: string }>;
  /** Confidence 0..1 the agent has in this being the right action. */
  confidence: number;
  createdAt: number;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  resolvedAt?: number;
  executionResult?: unknown;
  rejectionReason?: string;
}

// ── Memory ───────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  kind: "fact" | "preference" | "learning";
  text: string;
  /** When it was recorded so we can decay or age out. */
  at: number;
  /** Free-form tags — e.g. "guest", "pricing", "supplier:acme". */
  tags?: string[];
}

// ── Store ────────────────────────────────────────────────────────────────

interface AgentState {
  // OODA
  phase: OodaPhase;
  busy: boolean;

  // Dialogue
  messages: AgentMessage[];

  // HITL gates
  clarifications: Record<string, ClarificationRequest>;
  proposals: Record<string, AgentProposal>;

  // Memory
  workingMemory: MemoryEntry[];
  longTermMemory: MemoryEntry[];

  // ── mutators ──────────────────────────────────────────────────────────
  setPhase: (phase: OodaPhase) => void;
  setBusy: (busy: boolean) => void;

  addMessage: (msg: Omit<AgentMessage, "id" | "createdAt">) => AgentMessage;
  /** Append text to an existing message's `content`. Used by the
   *  streaming runtime to grow an assistant bubble character-by-
   *  character as text deltas arrive over SSE. No-op if the message
   *  doesn't exist (the bubble was reset between deltas). */
  appendToMessage: (id: string, text: string) => void;
  clearMessages: () => void;

  addClarification: (
    req: Omit<ClarificationRequest, "id" | "createdAt">
  ) => ClarificationRequest;
  resolveClarification: (
    id: string,
    resolution: { source: "suggestion" | "custom"; value: string }
  ) => void;

  addProposal: (
    proposal: Omit<AgentProposal, "id" | "createdAt" | "status">
  ) => AgentProposal;
  approveProposal: (id: string, executionResult?: unknown) => void;
  rejectProposal: (id: string, reason?: string) => void;
  markProposalExecuted: (id: string, executionResult: unknown) => void;
  markProposalFailed: (id: string, reason: string) => void;

  rememberWorking: (entry: Omit<MemoryEntry, "id" | "at">) => void;
  rememberLongTerm: (entry: Omit<MemoryEntry, "id" | "at">) => void;
  clearWorking: () => void;
  forget: (id: string) => void;

  /** Start a fresh chat: clears messages, clarifications, proposals,
   *  and working memory. Long-term memory is preserved so the agent
   *  keeps the admin's preferences across sessions. */
  resetConversation: () => void;
  resetAll: () => void;
}

const MAX_MESSAGES = 200;
const MAX_WORKING_MEMORY = 50;
const MAX_LONG_TERM = 200;
/** Proposals older than this (once resolved) are auto-swept on every
 *  addProposal. Keeps the Record<id, proposal> map from growing without
 *  bound across long-lived admin sessions. */
const PROPOSAL_TTL_MS = 6 * 60 * 60 * 1000; // 6h

/** Drop resolved (executed / rejected / failed / approved-but-done)
 *  proposals older than PROPOSAL_TTL_MS. Pending proposals are always
 *  kept — they belong to the live UI. */
function prunedProposals(
  proposals: Record<string, AgentProposal>
): Record<string, AgentProposal> {
  const cutoff = Date.now() - PROPOSAL_TTL_MS;
  const next: Record<string, AgentProposal> = {};
  for (const [id, p] of Object.entries(proposals)) {
    if (p.status === "pending") {
      next[id] = p;
      continue;
    }
    const ts = p.resolvedAt ?? p.createdAt;
    if (ts >= cutoff) next[id] = p;
  }
  return next;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useAgent = create<AgentState>()(
  persist(
    (set) => ({
      phase: "idle",
      busy: false,
      messages: [],
      clarifications: {},
      proposals: {},
      workingMemory: [],
      longTermMemory: [],

      setPhase: (phase) => set({ phase }),
      setBusy: (busy) => set({ busy }),

      addMessage: (msg) => {
        const full: AgentMessage = {
          ...msg,
          id: makeId("msg"),
          createdAt: Date.now(),
        };
        set((s) => ({
          messages: [...s.messages, full].slice(-MAX_MESSAGES),
        }));
        return full;
      },
      appendToMessage: (id, text) =>
        set((s) => {
          if (!text) return s;
          const idx = s.messages.findIndex((m) => m.id === id);
          if (idx < 0) return s;
          const next = s.messages.slice();
          next[idx] = { ...next[idx], content: next[idx].content + text };
          return { messages: next };
        }),
      clearMessages: () => set({ messages: [] }),

      addClarification: (req) => {
        const full: ClarificationRequest = {
          ...req,
          id: makeId("clar"),
          createdAt: Date.now(),
        };
        set((s) => ({
          clarifications: { ...s.clarifications, [full.id]: full },
        }));
        return full;
      },
      resolveClarification: (id, resolution) =>
        set((s) => {
          const existing = s.clarifications[id];
          if (!existing || existing.resolvedAt) return s;
          return {
            clarifications: {
              ...s.clarifications,
              [id]: {
                ...existing,
                resolvedAt: Date.now(),
                resolution,
              },
            },
          };
        }),

      addProposal: (proposal) => {
        const full: AgentProposal = {
          ...proposal,
          id: makeId("prop"),
          status: "pending",
          createdAt: Date.now(),
        };
        set((s) => ({
          proposals: { ...prunedProposals(s.proposals), [full.id]: full },
        }));
        return full;
      },
      approveProposal: (id, executionResult) =>
        set((s) => {
          const existing = s.proposals[id];
          if (!existing) return s;
          return {
            proposals: {
              ...s.proposals,
              [id]: {
                ...existing,
                status: "approved",
                resolvedAt: Date.now(),
                executionResult,
              },
            },
          };
        }),
      rejectProposal: (id, reason) =>
        set((s) => {
          const existing = s.proposals[id];
          if (!existing) return s;
          return {
            proposals: {
              ...s.proposals,
              [id]: {
                ...existing,
                status: "rejected",
                resolvedAt: Date.now(),
                rejectionReason: reason,
              },
            },
          };
        }),
      markProposalExecuted: (id, executionResult) =>
        set((s) => {
          const existing = s.proposals[id];
          if (!existing) return s;
          return {
            proposals: {
              ...s.proposals,
              [id]: {
                ...existing,
                status: "executed",
                resolvedAt: Date.now(),
                executionResult,
              },
            },
          };
        }),
      markProposalFailed: (id, reason) =>
        set((s) => {
          const existing = s.proposals[id];
          if (!existing) return s;
          return {
            proposals: {
              ...s.proposals,
              [id]: {
                ...existing,
                status: "failed",
                resolvedAt: Date.now(),
                rejectionReason: reason,
              },
            },
          };
        }),

      rememberWorking: (entry) => {
        const full: MemoryEntry = {
          ...entry,
          id: makeId("mw"),
          at: Date.now(),
        };
        set((s) => ({
          workingMemory: [full, ...s.workingMemory].slice(0, MAX_WORKING_MEMORY),
        }));
      },
      rememberLongTerm: (entry) => {
        const full: MemoryEntry = {
          ...entry,
          id: makeId("ml"),
          at: Date.now(),
        };
        set((s) => ({
          longTermMemory: [full, ...s.longTermMemory].slice(0, MAX_LONG_TERM),
        }));
      },
      clearWorking: () => set({ workingMemory: [] }),
      forget: (id) =>
        set((s) => ({
          workingMemory: s.workingMemory.filter((e) => e.id !== id),
          longTermMemory: s.longTermMemory.filter((e) => e.id !== id),
        })),

      resetConversation: () =>
        set({
          phase: "idle",
          busy: false,
          messages: [],
          clarifications: {},
          proposals: {},
          workingMemory: [],
          // Long-term memory preserved intentionally.
        }),
      resetAll: () =>
        set({
          phase: "idle",
          busy: false,
          messages: [],
          clarifications: {},
          proposals: {},
          workingMemory: [],
          // NOTE: long-term memory is NOT cleared by resetAll — that's the
          // point. Conversations end, but the agent remembers across them.
        }),
    }),
    {
      name: "paraiso.ai-agent.v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : ssrSafeStorage
      ),
      partialize: (state) => ({
        // Persist long-term memory across sessions; the rest is session-scoped
        // but we keep working memory + last 50 messages for continuity on
        // accidental reloads.
        //
        // ⚠️  System-role messages (the inline context/memory pills the
        // unified `<AgentConversation />` renders) describe live workspace
        // state — view, focused entity, "Ran X". Replaying them on reload
        // would be misleading because the world they describe may have
        // moved on. Keep only real dialogue + tool messages.
        longTermMemory: state.longTermMemory,
        workingMemory: state.workingMemory.slice(0, 20),
        messages: state.messages
          .filter((m) => m.role !== "system")
          .slice(-50),
      }),
      version: 1,
    }
  )
);

// ── Selectors (derived state, memoized by Zustand) ───────────────────────

export const selectPendingClarification = (s: AgentState) =>
  Object.values(s.clarifications).find((c) => !c.resolvedAt) ?? null;

export const selectPendingProposals = (s: AgentState) =>
  Object.values(s.proposals)
    .filter((p) => p.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);

export const selectRecentMessages = (limit: number) => (s: AgentState) =>
  s.messages.slice(-limit);
