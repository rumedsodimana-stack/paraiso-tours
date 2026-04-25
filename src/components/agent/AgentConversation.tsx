/**
 * Unified agent conversation surface.
 *
 * Used by BOTH the canonical `/admin/ai` page (`<AgentSurface />`) and
 * the floating right-side admin drawer (`<GlobalAdminAiChat />`). The
 * two surfaces no longer have separate layouts — the drawer is a
 * portal/animation container; its inside is identical to /admin/ai.
 *
 * Workspace info (current view, focused entity, working / long-term
 * memory writes) flows *through the conversation itself* as small
 * inline `role: "system"` pills. The agent's awareness is visible
 * alongside the chat instead of in a parallel sidebar.
 *
 * Pre-conditions / assumptions:
 *   - Only ONE `<AgentConversation />` is mounted at a time per
 *     admin tab (the drawer is suppressed on /admin/ai). Two
 *     instances would still share the Zustand store, but parallel
 *     `setBusy` calls could thrash the OODA phase pill.
 *   - Context-change pills (focus/view transitions) are pushed by a
 *     separate `<AgentContextWatcher />` mounted once in
 *     `<AdminShell />`, NOT by this component. Memory pills are
 *     pushed inline by `useAgentLoop`'s `rememberWorkingAndAnnounce`.
 */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Eye,
  Loader2,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import {
  type AgentMessage,
  type OodaPhase,
} from "@/stores/ai-agent.store";
import type { AgentNextAction } from "@/lib/agent-ooda";
import { useAgentLoop, type PageContext } from "@/hooks/useAgentLoop";
import { AgentClarification } from "./AgentClarification";
import { AgentProposals } from "./AgentProposals";

interface RuntimeInfo {
  ready: boolean;
  missingReason?: string;
  defaultModel?: string;
}

interface AgentConversationProps {
  /** Optional page context — drawer passes this. /admin/ai surface
   *  passes its own static context for parity. Without it the agent
   *  still reads view/entity from the workspace store. */
  pageContext?: PageContext;
  /** Suggested empty-state prompts. Defaults to generic if absent. */
  suggestedPrompts?: string[];
  /** Runtime info — when ready=false a setup banner is shown and the
   *  composer is disabled. */
  runtime?: RuntimeInfo;
  /** Render a close (X) button in the header — drawer mode. */
  onClose?: () => void;
  /** Tighter padding for the drawer container. */
  compact?: boolean;
  /** Optional content to slot to the right of the close button (e.g. a
   *  drawer-specific "open in full page" link). */
  headerExtra?: ReactNode;
  /** Pre-fill the composer with this text (e.g. from `/admin/ai?seed=…`).
   *  Only applied when the conversation is empty — never overwrites a
   *  draft the admin is mid-typing. */
  initialDraft?: string;
}

export function AgentConversation({
  pageContext,
  suggestedPrompts,
  runtime,
  onClose,
  compact = false,
  headerExtra,
  initialDraft,
}: AgentConversationProps) {
  const {
    phase,
    busy,
    messages,
    pendingClarification,
    pendingProposals,
    sendText,
    handleChipClick,
    handleProposalApprove,
    handleProposalReject,
    resetConversation,
  } = useAgentLoop(pageContext);

  const [input, setInput] = useState(initialDraft ?? "");
  const seedAppliedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // If `initialDraft` arrives after mount (search params resolving on
  // the client) and the admin hasn't typed anything, apply it once.
  useEffect(() => {
    if (seedAppliedRef.current) return;
    if (!initialDraft) return;
    if (input.length > 0) return;
    if (messages.length > 0) return;
    setInput(initialDraft);
    seedAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft]);

  const runtimeReady = runtime ? runtime.ready : true;
  const headerLabel = pageContext?.label ?? "Admin workspace";
  const pendingProposalsCount = pendingProposals.length;
  const px = compact ? "px-4" : "px-5";

  // Auto-scroll on stream changes
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy, pendingClarification, pendingProposalsCount]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);
  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const handleSubmit = (text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!runtimeReady || busy || !trimmed) return;
    setInput("");
    sendText(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClearChat = () => {
    if (busy || messages.length === 0) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Start a fresh conversation? Long-term memory is kept."
      )
    ) {
      return;
    }
    resetConversation();
    setInput("");
  };

  const canSend = runtimeReady && !busy && input.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fffbf4]">
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className={`flex shrink-0 items-center justify-between gap-3 border-b border-[#e0e4dd] ${px} py-3`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#12343b] text-[#f6ead6]">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none text-[#11272b]">
              AI Coworker
            </p>
            <p className="mt-0.5 truncate text-xs text-[#8a9ba1]">
              {headerLabel}
            </p>
          </div>
          <OodaPhasePill phase={phase} busy={busy} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {headerExtra}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              disabled={busy}
              title="New conversation"
              className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* ── Setup banner ───────────────────────────────────── */}
      {runtime && !runtime.ready && (
        <div
          className={`shrink-0 border-b border-[#f3e8ce] bg-[#f9f2e3] ${px} py-3`}
        >
          <div className="flex items-start gap-2 text-sm text-[#7a5a17]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c9922f]" />
            <div>
              <p className="font-medium">
                {runtime.missingReason ?? "AI not configured"}
              </p>
              <Link
                href="/admin/settings?section=ai"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#7a5a17] underline underline-offset-2"
              >
                Open AI settings →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Stream ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto overscroll-contain ${px} py-4 space-y-4`}
      >
        {messages.length === 0 && !busy ? (
          <EmptyState
            label={headerLabel}
            modelLabel={runtime?.defaultModel}
            suggestions={suggestedPrompts}
            onPick={(p) => handleSubmit(p)}
            disabled={!runtimeReady}
          />
        ) : (
          <>
            {messages.map((m) =>
              m.role === "system" ? (
                <SystemPill key={m.id} content={m.content} />
              ) : (
                <ConversationBubble
                  key={m.id}
                  message={m}
                  onChip={handleChipClick}
                  disabled={busy}
                />
              )
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
            {busy && (
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#eef4f4] text-[#12343b]">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 shadow-sm">
                  <ThinkingDots />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Composer ───────────────────────────────────────── */}
      <div
        className={`shrink-0 border-t border-[#e0e4dd] bg-[#fffbf4] ${px} py-3`}
      >
        <div className="mb-2.5 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-[#12343b]" />
          <span className="text-xs font-medium text-[#12343b]">
            Most actions run instantly · only deletes ask first
          </span>
        </div>
        <div
          className={`flex items-end gap-2 rounded-2xl border bg-[#faf6ef] px-3 py-2 transition-colors ${
            canSend ? "border-[#c5cdd0]" : "border-[#e0e4dd]"
          } focus-within:border-[#12343b] focus-within:bg-[#fffbf4] focus-within:ring-2 focus-within:ring-[#12343b]/10`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!runtimeReady || busy}
            rows={1}
            placeholder={
              !runtimeReady
                ? "Set up AI in Settings first…"
                : `Message AI — ${headerLabel.toLowerCase()}`
            }
            className="flex-1 resize-none bg-transparent py-1 text-sm text-[#11272b] outline-none placeholder:text-[#8a9ba1] disabled:cursor-not-allowed"
            style={{ minHeight: "24px", maxHeight: "180px" }}
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSend}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
              canSend
                ? "bg-[#12343b] text-[#f6ead6] shadow-sm hover:bg-[#0f2b31]"
                : "cursor-not-allowed bg-[#e0e4dd] text-[#8a9ba1]"
            }`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="currentColor"
              >
                <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[#c5cdd0]">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function OodaPhasePill({
  phase,
  busy,
}: {
  phase: OodaPhase;
  busy: boolean;
}) {
  const label =
    phase === "idle" ? "Idle" : phase.charAt(0).toUpperCase() + phase.slice(1);
  const map: Record<
    OodaPhase,
    { bg: string; text: string; Icon: React.ElementType }
  > = {
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
      className={`ml-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="h-3 w-3" />
      {busy ? `${label}…` : label}
    </span>
  );
}

function EmptyState({
  label,
  modelLabel,
  suggestions,
  onPick,
  disabled,
}: {
  label: string;
  modelLabel?: string;
  suggestions?: string[];
  onPick: (s: string) => void;
  disabled: boolean;
}) {
  const finalSuggestions =
    suggestions && suggestions.length > 0
      ? suggestions
      : [
          "What should I focus on right now?",
          "Summarize the most important next actions.",
          "Explain how this part of the app works.",
        ];
  return (
    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#12343b] text-[#f6ead6] shadow-lg">
        <Sparkles className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#11272b]">How can I help?</p>
        <p className="mt-1 text-xs text-[#8a9ba1]">
          {label}
          {modelLabel ? ` · ${modelLabel}` : ""}
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-2">
        {finalSuggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            disabled={disabled}
            className="w-full rounded-xl border border-[#e0e4dd] bg-[#faf6ef] px-4 py-2.5 text-left text-sm text-[#5e7279] transition hover:border-[#e0d4bc] hover:bg-[#f4ecdd] hover:text-[#11272b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationBubble({
  message,
  onChip,
  disabled,
}: {
  // System messages are rendered as <SystemPill /> by the parent map;
  // this bubble handles user/assistant/tool roles. Hooks below run in
  // a single linear path so the order stays stable.
  message: AgentMessage;
  onChip: (chip: AgentNextAction) => void;
  disabled: boolean;
}) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const chips = !isUser && message.nextActions ? message.nextActions : [];
  const time = useMemo(() => {
    try {
      return new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [message.createdAt]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-br-sm bg-[#12343b] px-4 py-3 text-[#f6ead6] shadow-sm">
            <p className="whitespace-pre-wrap text-sm leading-6">
              {message.content}
            </p>
          </div>
          <p className="mt-1 pr-1 text-right text-[10px] text-[#8a9ba1]">
            {time}
          </p>
        </div>
      </div>
    );
  }

  if (isTool) {
    return (
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#dce8dc] text-[#375a3f]">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl rounded-tl-sm border border-[#b8d6b8] bg-[#eef4ee] px-4 py-2.5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#375a3f]">
              {message.toolName ?? "tool"}
            </p>
            <div className="mt-1 text-[#375a3f]">
              <RenderText text={message.content} />
            </div>
          </div>
          <p className="mt-1 pl-1 text-[10px] text-[#8a9ba1]">{time}</p>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#eef4f4] text-[#12343b]">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-sm border border-[#e0e4dd] bg-[#fffbf4] px-4 py-3 shadow-sm">
          <div className="text-[#5e7279]">
            <RenderText text={message.content} />
          </div>
        </div>
        {chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
            {chips.map((chip, i) => (
              <button
                key={`${message.id}-chip-${i}`}
                type="button"
                onClick={() => onChip(chip)}
                disabled={disabled}
                title={chip.send ?? chip.label}
                className="rounded-full border border-[#c9922f]/40 bg-[#f4ecdd] px-2.5 py-1 text-[11px] font-medium text-[#7a5a17] transition hover:border-[#c9922f] hover:bg-[#f3e8ce] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        <p className="mt-1 pl-1 text-[10px] text-[#8a9ba1]">{time}</p>
      </div>
    </div>
  );
}

/**
 * Inline workspace-context pill. Used for context transitions ("Now
 * focusing on booking: lead_X") and memory writes ("✓ Ran
 * list_tours"). Visually distinct from chat bubbles — small, centered,
 * no avatar.
 */
function SystemPill({ content }: { content: string }) {
  return (
    <div className="flex justify-center py-0.5">
      <div className="max-w-[80%] rounded-full border border-[#e0e4dd] bg-[#faf6ef] px-3 py-1 text-center text-[11px] text-[#8a9ba1]">
        {content}
      </div>
    </div>
  );
}

function RenderText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, li) => {
        if (line.trim() === "") return <div key={li} className="h-2" />;
        const parts: React.ReactNode[] = [];
        const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
        let last = 0;
        let match;
        let ki = 0;
        while ((match = regex.exec(line)) !== null) {
          if (match.index > last)
            parts.push(<span key={ki++}>{line.slice(last, match.index)}</span>);
          const raw = match[0];
          if (raw.startsWith("**")) {
            parts.push(
              <strong key={ki++} className="font-semibold">
                {raw.slice(2, -2)}
              </strong>
            );
          } else {
            parts.push(
              <code
                key={ki++}
                className="rounded bg-[#eae5de] px-1.5 py-0.5 font-mono text-[12px] text-[#5e7279]"
              >
                {raw.slice(1, -1)}
              </code>
            );
          }
          last = match.index + raw.length;
        }
        if (last < line.length)
          parts.push(<span key={ki++}>{line.slice(last)}</span>);
        const isListItem =
          /^[-•*]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim());
        return (
          <p
            key={li}
            className={`text-sm leading-6 ${isListItem ? "pl-3" : ""}`}
          >
            {isListItem && <span className="mr-1 text-stone-400">·</span>}
            {parts}
          </p>
        );
      })}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[#8a9ba1]"
          style={{
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}
