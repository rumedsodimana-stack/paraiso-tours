"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Loader2,
  Plus,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { useAgentLoop } from "@/hooks/useAgentLoop";
import { AgentClarification } from "@/components/agent/AgentClarification";
import { AgentProposals } from "@/components/agent/AgentProposals";
import type { AgentMessage } from "@/stores/ai-agent.store";
import type { AgentNextAction } from "@/lib/agent-ooda";

interface RuntimeSummary {
  enabled: boolean;
  configured: boolean;
  providerLabel: string;
  baseUrl: string;
  model: string;
  simpleModel: string;
  defaultModel: string;
  heavyModel: string;
  superpowerEnabled: boolean;
  missingReason?: string;
}

function getTimeLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildPageContext(pathname: string) {
  const p = pathname.replace(/\/+$/, "") || pathname;
  const bookingMatch = p.match(/^\/admin\/bookings\/([^/]+)$/);
  const invoiceMatch = p.match(/^\/admin\/invoices\/([^/]+)$/);
  const paymentMatch = p.match(/^\/admin\/payments\/([^/]+)$/);
  const packageMatch = p.match(/^\/admin\/packages\/([^/]+)$/);
  const tourMatch = p.match(/^\/admin\/tours\/([^/]+)$/);

  if (bookingMatch) return {
    label: "Booking detail",
    details: [`Current admin page path: ${p}`, `Current page type: booking detail`, `Current booking id: ${bookingMatch[1]}`, `If staff says "this booking", use booking id ${bookingMatch[1]}.`],
    prompts: ["What's missing before this booking can move forward?", "Is this booking ready to schedule?", "Draft the next client update for this booking."],
  };
  if (invoiceMatch) return {
    label: "Invoice detail",
    details: [`Current admin page path: ${p}`, `Current page type: invoice detail`, `Current invoice id: ${invoiceMatch[1]}`],
    prompts: ["Summarize the status of this invoice.", "Is there a next finance action needed?", "Draft a payment reminder for this invoice."],
  };
  if (paymentMatch) return {
    label: "Payment detail",
    details: [`Current admin page path: ${p}`, `Current page type: payment detail`, `Current payment id: ${paymentMatch[1]}`],
    prompts: ["Explain the status of this payment.", "Should this trigger any next step?", "Summarize for finance handoff."],
  };
  if (packageMatch) return {
    label: "Package detail",
    details: [`Current admin page path: ${p}`, `Current page type: package detail`, `Current package id: ${packageMatch[1]}`],
    prompts: ["Summarize this package for the sales team.", "What gaps do you see in this package?", "Suggest a stronger sales angle."],
  };
  if (tourMatch) return {
    label: "Tour detail",
    details: [`Current admin page path: ${p}`, `Current page type: scheduled tour`, `Current tour id: ${tourMatch[1]}`],
    prompts: ["Summarize the operational status of this tour.", "What's the next best action here?", "Does anything look risky?"],
  };
  if (p === "/admin/bookings") return {
    label: "Bookings",
    details: [`Current admin page path: ${p}`, `Current page type: booking list`],
    prompts: ["What should I focus on in bookings right now?", "Which bookings look risky or incomplete?", "Summarize the latest booking workload."],
  };
  if (p === "/admin/payments") return {
    label: "Payments",
    details: [`Current admin page path: ${p}`, `Current page type: payments list`],
    prompts: ["Summarize payment status across the workspace.", "Which payments need attention?", "What finance follow-ups are missing?"],
  };
  return {
    label: "Admin workspace",
    details: [`Current admin page path: ${p}`, `Current page type: general admin workspace`],
    prompts: ["What should I focus on right now?", "Summarize the most important next actions.", "Explain how this part of the app works."],
  };
}

type ModelMode = "auto" | "simple" | "default" | "heavy";

/** Render AI text — handles bold (**text**), inline code (`code`), and newlines */
function RenderText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, li) => {
        if (line.trim() === "") return <div key={li} className="h-2" />;
        // Parse inline bold and code
        const parts: React.ReactNode[] = [];
        const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
        let last = 0;
        let match;
        let ki = 0;
        while ((match = regex.exec(line)) !== null) {
          if (match.index > last) parts.push(<span key={ki++}>{line.slice(last, match.index)}</span>);
          const raw = match[0];
          if (raw.startsWith("**")) {
            parts.push(<strong key={ki++} className="font-semibold">{raw.slice(2, -2)}</strong>);
          } else {
            parts.push(<code key={ki++} className="rounded bg-[#eae5de] px-1.5 py-0.5 font-mono text-[12px] text-[#5e7279]">{raw.slice(1, -1)}</code>);
          }
          last = match.index + raw.length;
        }
        if (last < line.length) parts.push(<span key={ki++}>{line.slice(last)}</span>);
        // Detect list items
        const isListItem = /^[-•*]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim());
        return (
          <p key={li} className={`text-sm leading-6 ${isListItem ? "pl-3" : ""}`}>
            {isListItem && <span className="mr-1 text-stone-400">·</span>}
            {parts}
          </p>
        );
      })}
    </div>
  );
}

/** Animated thinking dots */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-[#8a9ba1]"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}

function FloatingMessageBubble({
  message,
  onChip,
  disabled,
}: {
  message: AgentMessage;
  onChip: (chip: AgentNextAction) => void;
  disabled: boolean;
}) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const chips = !isUser && message.nextActions ? message.nextActions : [];
  const time = useMemo(() => {
    try {
      return new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [message.createdAt]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-br-sm bg-[#12343b] px-4 py-3 text-[#f6ead6] shadow-sm">
            <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="mt-1 pr-1 text-right text-[10px] text-[#8a9ba1]">{time}</p>
        </div>
      </div>
    );
  }

  if (isTool) {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#dce8dc] text-[#375a3f] mt-0.5">
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
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#eef4f4] text-[#12343b] mt-0.5">
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

export function GlobalAdminAiChat({
  runtime,
  desktopOpen,
  mobileOpen,
  onClose,
  onFinalize,
}: {
  runtime: RuntimeSummary;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onFinalize?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wasBusyRef = useRef(false);

  const pageContext = useMemo(() => buildPageContext(pathname), [pathname]);
  const runtimeReady = runtime.enabled && runtime.configured;

  // Same OODA brain as /admin/ai. Conversation persists across surfaces.
  const {
    messages,
    busy,
    pendingClarification,
    pendingProposals,
    sendText,
    handleChipClick,
    handleProposalApprove,
    handleProposalReject,
    resetConversation,
  } = useAgentLoop({
    path: pathname,
    label: pageContext.label,
    details: pageContext.details,
  });

  const [request, setRequest] = useState("");
  const [modelMode, setModelMode] = useState<ModelMode>("auto");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pendingProposalsCount = pendingProposals.length;

  // Auto-scroll to bottom whenever messages, proposals, or clarifications update
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
  }, [request, resizeTextarea]);

  // Focus textarea when panel opens
  useEffect(() => {
    if ((desktopOpen || mobileOpen) && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [desktopOpen, mobileOpen]);

  // After every OODA round (busy → idle), refresh the route so any
  // server-side data the tool just mutated re-renders.
  useEffect(() => {
    if (busy) {
      wasBusyRef.current = true;
      return;
    }
    if (wasBusyRef.current) {
      wasBusyRef.current = false;
      router.refresh();
      onFinalize?.();
    }
  }, [busy, router, onFinalize]);

  function handleSubmit(text?: string) {
    const trimmed = (text ?? request).trim();
    if (!runtimeReady || busy || !trimmed) return;
    setRequest("");
    sendText(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function clearChat() {
    if (busy) return;
    if (
      typeof window !== "undefined" &&
      messages.length > 0 &&
      !window.confirm("Start a fresh conversation? Long-term memory is kept.")
    ) {
      return;
    }
    resetConversation();
    setRequest("");
  }

  const canSend = runtimeReady && !busy && request.trim().length > 0;

  const panel = (
    <div className="flex h-full flex-col bg-[#fffbf4] overflow-hidden">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e0e4dd] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#12343b] text-[#f6ead6]">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#11272b] leading-none">AI Coworker</p>
            <p className="mt-0.5 text-xs text-[#8a9ba1] truncate">{pageContext.label}</p>
          </div>
          {/* Status pill */}
          <span
            className={`ml-1 flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              runtimeReady
                ? "border-[#b8d6b8] bg-[#dce8dc] text-[#375a3f]"
                : "border-[#f3e8ce] bg-[#f9f2e3] text-[#7a5a17]"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${runtimeReady ? "bg-[#375a3f]" : "bg-[#c9922f]"}`} />
            {runtimeReady ? "Ready" : "Setup"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* New chat */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              disabled={busy}
              title="New conversation"
              className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          {/* Settings dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              title="Settings"
              className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
            >
              <Settings className="h-4 w-4" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-9 z-30 w-64 rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] p-4 shadow-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a9ba1]">Model</p>
                <select
                  value={modelMode}
                  onChange={(e) => setModelMode(e.target.value as ModelMode)}
                  className="mt-2 w-full rounded-xl border border-[#e0e4dd] bg-[#faf6ef] px-3 py-2 text-sm text-[#11272b] outline-none focus:border-[#12343b] focus:ring-2 focus:ring-[#12343b]/20"
                >
                  <option value="auto">Auto ({runtime.defaultModel})</option>
                  <option value="simple">Simple ({runtime.simpleModel})</option>
                  <option value="default">Default ({runtime.defaultModel})</option>
                  <option value="heavy">Heavy ({runtime.heavyModel})</option>
                </select>

                <div className="mt-3 rounded-xl border border-[#b8d6b8] bg-[#dce8dc] px-3 py-2.5">
                  <span className="block text-sm font-medium text-[#375a3f]">OODA agent active</span>
                  <span className="mt-0.5 block text-xs text-[#375a3f]/80">Reads auto-execute. Edits/deletes need your approval.</span>
                </div>

                <div className="mt-3 border-t border-[#e0e4dd] pt-3">
                  <Link
                    href="/admin/ai"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
                  >
                    Full AI workspace
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  {!runtimeReady && (
                    <Link
                      href="/admin/settings?section=ai"
                      onClick={() => setSettingsOpen(false)}
                      className="mt-1 flex items-center justify-between rounded-xl px-2 py-1.5 text-sm text-[#7a5a17] transition hover:bg-[#f9f2e3]"
                    >
                      Fix AI settings
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Not ready banner ───────────────────────────────── */}
      {!runtimeReady && (
        <div className="shrink-0 border-b border-[#f3e8ce] bg-[#f9f2e3] px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-[#7a5a17]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c9922f]" />
            <div>
              <p className="font-medium">{runtime.missingReason || "AI not configured"}</p>
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

      {/* ── Messages ───────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4"
      >
        {/* Empty state — suggestion chips */}
        {messages.length === 0 && !busy && (
          <div className="flex flex-col items-center justify-center h-full min-h-[12rem] gap-6 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#12343b] text-[#f6ead6] shadow-lg">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#11272b]">How can I help?</p>
              <p className="mt-1 text-xs text-[#8a9ba1]">{pageContext.label} · {runtime.defaultModel}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {pageContext.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    if (!runtimeReady) return;
                    handleSubmit(prompt);
                  }}
                  disabled={!runtimeReady}
                  className="w-full rounded-xl border border-[#e0e4dd] bg-[#faf6ef] px-4 py-2.5 text-left text-sm text-[#5e7279] transition hover:border-[#e0d4bc] hover:bg-[#f4ecdd] hover:text-[#11272b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((m) => (
          <FloatingMessageBubble
            key={m.id}
            message={m}
            onChip={handleChipClick}
            disabled={busy}
          />
        ))}

        {/* HITL clarification — feeds the answer back as a new turn */}
        {pendingClarification && (
          <AgentClarification
            clarification={pendingClarification}
            onResolve={(value) => sendText(value)}
          />
        )}

        {/* HITL approval card for update/delete proposals */}
        {pendingProposalsCount > 0 && (
          <AgentProposals
            onApprove={handleProposalApprove}
            onReject={handleProposalReject}
          />
        )}

        {/* Thinking dots */}
        {busy && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#eef4f4] text-[#12343b] mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 shadow-sm">
              <ThinkingDots />
            </div>
          </div>
        )}
      </div>

      {/* ── Input area ─────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[#e0e4dd] bg-[#fffbf4] px-4 py-3">

        {/* Always-on execution indicator */}
        <div className="mb-2.5 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-[#12343b]" />
          <span className="text-xs font-medium text-[#12343b]">
            Reads run instantly · edits ask for approval
          </span>
        </div>

        {/* Input container */}
        <div className={`flex items-end gap-2 rounded-2xl border bg-[#faf6ef] px-3 py-2 transition-colors ${
          canSend ? "border-[#c5cdd0]" : "border-[#e0e4dd]"
        } focus-within:border-[#12343b] focus-within:bg-[#fffbf4] focus-within:ring-2 focus-within:ring-[#12343b]/10`}>
          <textarea
            ref={textareaRef}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!runtimeReady || busy}
            rows={1}
            placeholder={
              !runtimeReady
                ? "Set up AI in Settings first…"
                : `Message AI — ${pageContext.label.toLowerCase()}`
            }
            className="flex-1 resize-none bg-transparent py-1 text-sm text-[#11272b] placeholder:text-[#8a9ba1] outline-none disabled:cursor-not-allowed"
            style={{ minHeight: "24px", maxHeight: "180px" }}
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSend}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
              canSend
                ? "bg-[#12343b] text-[#f6ead6] hover:bg-[#0f2b31] shadow-sm"
                : "bg-[#e0e4dd] text-[#8a9ba1] cursor-not-allowed"
            }`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-[#c5cdd0]">
          Enter to send · Shift+Enter for new line · Same brain as <Link href="/admin/ai" className="underline underline-offset-2 hover:text-[#8a9ba1]">/admin/ai</Link>
        </p>
      </div>

    </div>
  );

  const isOpen = desktopOpen || mobileOpen;

  // getTimeLabel kept for callers that still import it; mark as used to
  // satisfy the lint when the runtime tree-shakes it.
  void getTimeLabel;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-[#11272b]/20 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer — slides in from the right */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {panel}
      </aside>
    </>
  );
}
