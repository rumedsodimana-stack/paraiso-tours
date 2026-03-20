"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Loader2,
  Settings,
  Sparkles,
  X,
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
}

const initialState: AiToolActionState = {
  ok: false,
  message: "",
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPageContext(pathname: string) {
  const cleanPath = pathname.replace(/\/+$/, "") || pathname;
  const bookingMatch = cleanPath.match(/^\/admin\/bookings\/([^/]+)$/);
  const invoiceMatch = cleanPath.match(/^\/admin\/invoices\/([^/]+)$/);
  const paymentMatch = cleanPath.match(/^\/admin\/payments\/([^/]+)$/);
  const packageMatch = cleanPath.match(/^\/admin\/packages\/([^/]+)$/);
  const tourMatch = cleanPath.match(/^\/admin\/tours\/([^/]+)$/);

  if (bookingMatch) {
    return {
      label: "Booking detail",
      details: [
        `Current admin page path: ${cleanPath}`,
        `Current page type: booking detail`,
        `Current booking query: ${bookingMatch[1]}`,
        `If the staff says "this booking" or "current booking", use booking query ${bookingMatch[1]}.`,
      ],
      prompts: [
        "What is missing before this booking can move forward?",
        "Is this booking ready to schedule?",
        "Draft the next client update for this booking.",
      ],
    };
  }

  if (invoiceMatch) {
    return {
      label: "Invoice detail",
      details: [
        `Current admin page path: ${cleanPath}`,
        `Current page type: invoice detail`,
        `Current invoice query: ${invoiceMatch[1]}`,
        `If the staff says "this invoice" or "current invoice", use invoice query ${invoiceMatch[1]}.`,
      ],
      prompts: [
        "Summarize the status of this invoice.",
        "Is there any next finance action needed here?",
        "Draft a payment reminder for this invoice.",
      ],
    };
  }

  if (paymentMatch) {
    return {
      label: "Payment detail",
      details: [
        `Current admin page path: ${cleanPath}`,
        `Current page type: payment detail`,
        `Current payment query: ${paymentMatch[1]}`,
        `If the staff says "this payment" or "current payment", use payment query ${paymentMatch[1]}.`,
      ],
      prompts: [
        "Explain the status of this payment.",
        "Should this payment trigger any next step?",
        "Summarize this payment for finance handoff.",
      ],
    };
  }

  if (packageMatch) {
    return {
      label: "Package detail",
      details: [
        `Current admin page path: ${cleanPath}`,
        `Current page type: package detail`,
        `Current package id: ${packageMatch[1]}`,
      ],
      prompts: [
        "Summarize this package for the sales team.",
        "What weak spots or gaps do you see in this package?",
        "Suggest a stronger sales angle for this package.",
      ],
    };
  }

  if (tourMatch) {
    return {
      label: "Tour detail",
      details: [
        `Current admin page path: ${cleanPath}`,
        `Current page type: scheduled tour detail`,
        `Current tour id: ${tourMatch[1]}`,
      ],
      prompts: [
        "Summarize the operational status of this tour.",
        "What is the next best action on this tour?",
        "Check if anything looks risky for this tour.",
      ],
    };
  }

  if (cleanPath === "/admin/bookings") {
    return {
      label: "Bookings list",
      details: [
        `Current admin page path: ${cleanPath}`,
        `Current page type: booking list`,
      ],
      prompts: [
        "What should I focus on in bookings right now?",
        "Which bookings look risky or incomplete?",
        "Summarize the latest booking workload.",
      ],
    };
  }

  if (cleanPath === "/admin/payments") {
    return {
      label: "Payments list",
      details: [
        `Current admin page path: ${cleanPath}`,
        `Current page type: payments list`,
      ],
      prompts: [
        "Summarize the payment status across the workspace.",
        "Which payments need attention first?",
        "What finance follow-ups are missing?",
      ],
    };
  }

  return {
    label: "Admin workspace",
    details: [
      `Current admin page path: ${cleanPath}`,
      `Current page type: general admin workspace`,
    ],
    prompts: [
      "What should I focus on from this screen?",
      "Summarize the most important next actions.",
      "Explain how to use this part of the app.",
    ],
  };
}

function buildTrace(executeActions: boolean, superpowerArmed: boolean) {
  return {
    thinking:
      superpowerArmed
        ? "Checking page context before guarded build mode."
        : "Checking page context and live workspace data.",
    tasks: [
      "Read the current page context",
      "Match live workspace data",
      superpowerArmed
        ? "Draft the cowork handoff"
        : executeActions
          ? "Plan and run the safe action"
          : "Draft the final answer",
    ],
  };
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
  const requestCounterRef = useRef(0);
  const pageContext = useMemo(() => buildPageContext(pathname), [pathname]);
  const runtimeReady = runtime.enabled && runtime.configured;

  const [request, setRequest] = useState("");
  const [executeActions, setExecuteActions] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>("auto");
  const [superpowerArmed, setSuperpowerArmed] = useState(false);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [thinkingSummary, setThinkingSummary] = useState("");
  const [activeTasks, setActiveTasks] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [runState, setRunState] = useState<AiToolActionState>(initialState);

  useEffect(() => {
    if (!desktopOpen && !mobileOpen) return;
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [desktopOpen, mobileOpen, chatHistory, thinkingSummary, activeTasks]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedRequest = request.trim();
    if (!runtimeReady || running || !trimmedRequest) return;

    requestCounterRef.current += 1;
    const requestId = `global_${requestCounterRef.current}`;
    const trace = buildTrace(executeActions, superpowerArmed);
    const contextualRequest = [
      "Current admin page context:",
      ...pageContext.details,
      "",
      `Staff request: ${trimmedRequest}`,
    ].join("\n");

    setRunState(initialState);
    setRequest("");
    setChatHistory((current) => [
      ...current,
      {
        id: `user_${requestId}`,
        role: "user",
        content: trimmedRequest,
        timestamp: getTimeLabel(),
      },
    ]);
    setRunning(true);
    setThinkingSummary(trace.thinking);
    setActiveTasks([]);

    const formData = new FormData();
    formData.set("tool", "workspace_copilot");
    formData.set("workspaceRequest", contextualRequest);
    formData.set("modelMode", modelMode);
    if (executeActions) {
      formData.set("executeActions", "on");
    }
    if (superpowerArmed) {
      formData.set("superpowerEnabled", "on");
    }

    const resultPromise = runAiToolAction(initialState, formData);

    await wait(340);
    setThinkingSummary("");

    for (let index = 0; index < trace.tasks.length; index += 1) {
      setActiveTasks(trace.tasks.slice(index));
      await wait(index === trace.tasks.length - 1 ? 720 : 620);
    }

    setActiveTasks(["Finalize the response"]);

    const result = await resultPromise;
    setRunState(result);
    setRunning(false);
    setThinkingSummary("");
    setActiveTasks([]);
    setChatHistory((current) => [
      ...current,
      {
        id: `assistant_${requestId}`,
        role: "assistant",
        content: result.result || result.message,
        timestamp: getTimeLabel(),
      },
    ]);

    if (result.ok) {
      if (executeActions) {
        router.refresh();
      }
      onFinalize?.();
    }
  }

  const panel = (
    <div className="flex h-full flex-col overflow-hidden border-l border-white/20 bg-white/65 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/20 px-5 py-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
            <Bot className="h-3.5 w-3.5" />
            AI Chat
          </div>
          <h2 className="mt-2 text-lg font-semibold text-stone-900">
            AI
          </h2>
          <p className="mt-1 text-xs text-stone-500">{pageContext.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setChatSettingsOpen((open) => !open)}
              className="rounded-xl border border-white/40 bg-white/80 p-2 text-stone-500 transition hover:bg-white hover:text-stone-800"
              aria-label="Open AI cowork settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            {chatSettingsOpen ? (
              <div className="absolute right-0 top-12 z-20 w-72 rounded-[1.35rem] border border-stone-200 bg-white p-4 shadow-xl">
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  Cowork settings
                </p>
                <div className="mt-3 space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-stone-800">
                      Model route
                    </span>
                    <select
                      value={modelMode}
                      onChange={(event) =>
                        setModelMode(event.target.value as ModelMode)
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="auto">
                        Auto route ({runtime.defaultModel})
                      </option>
                      <option value="simple">
                        Simple ({runtime.simpleModel})
                      </option>
                      <option value="default">
                        Default ({runtime.defaultModel})
                      </option>
                      <option value="heavy">
                        Heavy ({runtime.heavyModel})
                      </option>
                    </select>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={superpowerArmed}
                      disabled={!runtime.superpowerEnabled}
                      onChange={(event) =>
                        setSuperpowerArmed(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      <span className="block text-sm font-medium text-stone-900">
                        Superpower
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">
                        Guarded app-build mode.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/40 bg-white/70 p-2 text-stone-500 transition hover:bg-white hover:text-stone-800"
            aria-label="Close AI chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-white/20 px-5 py-4">
        <div
          className={`rounded-2xl border px-4 py-4 ${
            runtimeReady
              ? "border-emerald-200 bg-emerald-50/80"
              : "border-amber-200 bg-amber-50/80"
          }`}
        >
          <div className="flex items-start gap-3">
            {runtimeReady ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            )}
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-stone-900">
                {runtimeReady ? "Ready" : "Needs setup"}
              </p>
              <p className="mt-1 truncate text-stone-600">
                {runtime.providerLabel} · {runtime.model}
              </p>
              {!runtimeReady && runtime.missingReason ? (
                <p className="mt-2 text-amber-800">{runtime.missingReason}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/ai"
              className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-white/80 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-white"
            >
              Full AI workspace
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            {!runtimeReady ? (
              <Link
                href="/admin/settings"
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {chatHistory.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-stone-200 bg-white/70 px-4 py-5 text-sm text-stone-500">
            Ask about this page or tell AI what to do.
          </div>
        ) : null}

        {chatHistory.map((entry) => (
          <div
            key={entry.id}
            className={`rounded-[1.5rem] px-4 py-4 shadow-sm ${
              entry.role === "user"
                ? "ml-8 border border-stone-200 bg-stone-900 text-white"
                : "mr-8 border border-white/40 bg-white/90 text-stone-800"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-current/70">
                {entry.role === "user" ? "You" : "AI"}
              </p>
              <span className="text-[11px] text-current/60">{entry.timestamp}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
              {entry.content}
            </p>
          </div>
        ))}

        {thinkingSummary ? (
          <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50/80 px-4 py-4 text-sm text-sky-900">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4" />
              AI thinking
            </div>
            <p className="mt-2 leading-6">{thinkingSummary}</p>
          </div>
        ) : null}

        {activeTasks.length > 0 ? (
          <div className="rounded-[1.5rem] border border-teal-200 bg-teal-50/80 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
              <Loader2 className="h-4 w-4 animate-spin" />
              Active tasks
            </div>
            <div className="mt-3 space-y-2">
              {activeTasks.map((task, index) => (
                <div
                  key={`${task}_${index}`}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    index === 0
                      ? "bg-teal-600 text-white"
                      : "bg-white/80 text-teal-800"
                  }`}
                >
                  {task}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!running && runState.message ? (
          <div
            className={`rounded-[1.5rem] border px-4 py-4 text-sm ${
              runState.ok
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                : "border-rose-200 bg-rose-50/80 text-rose-700"
            }`}
          >
            {runState.message}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/20 px-5 py-4">
        <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={executeActions}
            onChange={(event) => setExecuteActions(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
          />
            <span>
              <span className="block font-medium text-stone-900">
                Let AI execute supported actions
              </span>
            <span className="mt-1 block leading-6 text-stone-500">One safe admin action.</span>
            </span>
        </label>

        <textarea
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          rows={4}
          placeholder={`Ask about ${pageContext.label.toLowerCase()} or tell AI what to do next.`}
          className="mt-4 w-full resize-none rounded-[1.5rem] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="space-y-1 text-xs leading-5 text-stone-500">
            <p>
              Route: {modelMode === "auto" ? `Auto (${runtime.defaultModel})` : modelMode}
              {superpowerArmed ? " · Superpower armed" : ""}
            </p>
          </div>
          <button
            type="submit"
            disabled={!runtimeReady || running || !request.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {running ? "Working" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      {desktopOpen ? (
        <aside className="hidden h-[calc(100vh-0px)] w-[25rem] shrink-0 xl:block">
          {panel}
        </aside>
      ) : null}

      {mobileOpen ? (
        <div className="xl:hidden">
          <div
            className="fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md">
            {panel}
          </aside>
        </div>
      ) : null}
    </>
  );
}
