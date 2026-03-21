"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Settings,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { runAiToolAction, type AiToolActionState } from "@/app/actions/ai";

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

type ModelMode = "auto" | "simple" | "default" | "heavy";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  ok?: boolean;
}

const initialState: AiToolActionState = { ok: false, message: "" };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
            parts.push(<code key={ki++} className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[12px] text-stone-700">{raw.slice(1, -1)}</code>);
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
          className="h-2 w-2 rounded-full bg-stone-400"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
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
  const requestCounterRef = useRef(0);
  const pageContext = useMemo(() => buildPageContext(pathname), [pathname]);
  const runtimeReady = runtime.enabled && runtime.configured;

  const [request, setRequest] = useState("");
  const [executeActions, setExecuteActions] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>("auto");
  const [superpowerArmed, setSuperpowerArmed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [runState, setRunState] = useState<AiToolActionState>(initialState);

  // Auto-scroll to bottom
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chatHistory, showThinking]);

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

  async function handleSubmit(text?: string) {
    const trimmed = (text ?? request).trim();
    if (!runtimeReady || running || !trimmed) return;

    requestCounterRef.current += 1;
    const requestId = `global_${requestCounterRef.current}`;
    const contextualRequest = [
      "Current admin page context:",
      ...pageContext.details,
      "",
      `Staff request: ${trimmed}`,
    ].join("\n");

    setRunState(initialState);
    setRequest("");
    setChatHistory((h) => [...h, { id: `user_${requestId}`, role: "user", content: trimmed, timestamp: getTimeLabel() }]);
    setRunning(true);
    setShowThinking(true);

    const formData = new FormData();
    formData.set("tool", "workspace_copilot");
    formData.set("workspaceRequest", contextualRequest);
    formData.set("modelMode", modelMode);
    if (executeActions) formData.set("executeActions", "on");
    if (superpowerArmed) formData.set("superpowerEnabled", "on");

    const resultPromise = runAiToolAction(initialState, formData);

    // Small delay so the thinking dots are visible
    await wait(600);

    const result = await resultPromise;
    setShowThinking(false);
    setRunning(false);
    setRunState(result);
    setChatHistory((h) => [
      ...h,
      {
        id: `assistant_${requestId}`,
        role: "assistant",
        content: result.result || result.message || "Done.",
        timestamp: getTimeLabel(),
        ok: result.ok,
      },
    ]);

    if (result.ok) {
      if (executeActions) router.refresh();
      onFinalize?.();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function clearChat() {
    setChatHistory([]);
    setRunState(initialState);
    setRequest("");
  }

  const canSend = runtimeReady && !running && request.trim().length > 0;

  const panel = (
    <div className="flex h-full flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-900 leading-none">AI Coworker</p>
            <p className="mt-0.5 text-xs text-stone-400 truncate">{pageContext.label}</p>
          </div>
          {/* Status pill */}
          <span
            className={`ml-1 flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              runtimeReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${runtimeReady ? "bg-emerald-500" : "bg-amber-400"}`} />
            {runtimeReady ? "Ready" : "Setup"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* New chat */}
          {chatHistory.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              title="New conversation"
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
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
              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <Settings className="h-4 w-4" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-9 z-30 w-64 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Model</p>
                <select
                  value={modelMode}
                  onChange={(e) => setModelMode(e.target.value as ModelMode)}
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="auto">Auto ({runtime.defaultModel})</option>
                  <option value="simple">Simple ({runtime.simpleModel})</option>
                  <option value="default">Default ({runtime.defaultModel})</option>
                  <option value="heavy">Heavy ({runtime.heavyModel})</option>
                </select>

                {runtime.superpowerEnabled && (
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={superpowerArmed}
                      onChange={(e) => setSuperpowerArmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-stone-900">Superpower</span>
                      <span className="mt-0.5 block text-xs text-stone-500">Guarded app-build mode</span>
                    </span>
                  </label>
                )}

                <div className="mt-3 border-t border-stone-100 pt-3">
                  <Link
                    href="/admin/ai"
                    onClick={() => setSettingsOpen(false)}
                    className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
                  >
                    Full AI workspace
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  {!runtimeReady && (
                    <Link
                      href="/admin/settings?section=ai"
                      onClick={() => setSettingsOpen(false)}
                      className="mt-1 flex items-center justify-between rounded-xl px-2 py-1.5 text-sm text-amber-700 transition hover:bg-amber-50"
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
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Not ready banner ───────────────────────────────── */}
      {!runtimeReady && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-medium">{runtime.missingReason || "AI not configured"}</p>
              <Link
                href="/admin/settings?section=ai"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 underline underline-offset-2"
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
        {chatHistory.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-full min-h-[12rem] gap-6 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-lg">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">How can I help?</p>
              <p className="mt-1 text-xs text-stone-400">{pageContext.label} · {runtime.defaultModel}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {pageContext.prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    if (!runtimeReady) return;
                    setRequest(prompt);
                    setTimeout(() => handleSubmit(prompt), 0);
                  }}
                  disabled={!runtimeReady}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-left text-sm text-stone-700 transition hover:border-stone-300 hover:bg-white hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {chatHistory.map((entry) =>
          entry.role === "user" ? (
            /* User bubble — right aligned, dark */
            <div key={entry.id} className="flex justify-end">
              <div className="max-w-[85%]">
                <div className="rounded-2xl rounded-br-sm bg-stone-900 px-4 py-3 text-white shadow-sm">
                  <p className="text-sm leading-6 whitespace-pre-wrap">{entry.content}</p>
                </div>
                <p className="mt-1 pr-1 text-right text-[10px] text-stone-400">{entry.timestamp}</p>
              </div>
            </div>
          ) : (
            /* AI bubble — left aligned, white card */
            <div key={entry.id} className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 mt-0.5">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`rounded-2xl rounded-tl-sm border px-4 py-3 shadow-sm ${
                    entry.ok === false && entry.content
                      ? "border-rose-200 bg-rose-50"
                      : "border-stone-100 bg-white"
                  }`}
                >
                  <div className={entry.ok === false ? "text-rose-700" : "text-stone-800"}>
                    <RenderText text={entry.content} />
                  </div>
                </div>
                <p className="mt-1 pl-1 text-[10px] text-stone-400">{entry.timestamp}</p>
              </div>
            </div>
          )
        )}

        {/* Thinking dots */}
        {showThinking && (
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-600 mt-0.5">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-stone-100 bg-white px-4 py-2 shadow-sm">
              <ThinkingDots />
            </div>
          </div>
        )}
      </div>

      {/* ── Input area ─────────────────────────────────────── */}
      <div className="shrink-0 border-t border-stone-100 bg-white px-4 py-3">

        {/* Execute actions toggle */}
        <label className="mb-2.5 flex cursor-pointer items-center gap-2 select-none">
          <div
            onClick={() => setExecuteActions((v) => !v)}
            className={`relative h-4 w-7 rounded-full transition-colors ${executeActions ? "bg-teal-600" : "bg-stone-200"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${executeActions ? "translate-x-3" : ""}`}
            />
          </div>
          <span className="flex items-center gap-1 text-xs text-stone-500">
            <Zap className={`h-3 w-3 ${executeActions ? "text-teal-600" : "text-stone-400"}`} />
            <span className={executeActions ? "text-teal-700 font-medium" : ""}>
              {executeActions ? "Actions enabled" : "Actions off"}
            </span>
          </span>
          {superpowerArmed && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-purple-600">
              <Sparkles className="h-3 w-3" />
              Superpower
            </span>
          )}
        </label>

        {/* Input container */}
        <div className={`flex items-end gap-2 rounded-2xl border bg-stone-50 px-3 py-2 transition-colors ${
          canSend ? "border-stone-300" : "border-stone-200"
        } focus-within:border-stone-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-stone-200`}>
          <textarea
            ref={textareaRef}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!runtimeReady || running}
            rows={1}
            placeholder={
              !runtimeReady
                ? "Set up AI in Settings first…"
                : `Message AI — ${pageContext.label.toLowerCase()}`
            }
            className="flex-1 resize-none bg-transparent py-1 text-sm text-stone-900 placeholder:text-stone-400 outline-none disabled:cursor-not-allowed"
            style={{ minHeight: "24px", maxHeight: "180px" }}
          />
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={!canSend}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
              canSend
                ? "bg-stone-900 text-white hover:bg-stone-700 shadow-sm"
                : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }`}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
                <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-1.5 text-center text-[10px] text-stone-300">
          Enter to send · Shift+Enter for new line
        </p>
      </div>

    </div>
  );

  return (
    <>
      {desktopOpen ? (
        <aside className="hidden h-[calc(100vh-0px)] w-[26rem] shrink-0 border-l border-stone-100 xl:block">
          {panel}
        </aside>
      ) : null}

      {mobileOpen ? (
        <div className="xl:hidden">
          <div
            className="fixed inset-0 z-40 bg-stone-950/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-sm shadow-2xl">
            {panel}
          </aside>
        </div>
      ) : null}
    </>
  );
}
