"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Loader2,
  Settings,
  Sparkles,
} from "lucide-react";
import { runBookingCopilotAction } from "@/app/actions/booking-ai";
import type { AiToolActionState } from "@/app/actions/ai";

type CopilotMode = "brief" | "copilot";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

const initialState: AiToolActionState = {
  ok: false,
  message: "",
};

const quickPrompts = [
  "What is missing before this booking can move forward?",
  "Is this booking ready to schedule now?",
  "What should the team do next for this booking?",
  "Create the best operational summary for this booking.",
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTrace(mode: CopilotMode, executeActions: boolean) {
  if (mode === "brief") {
    return {
      thinking:
        "I need the booking, package snapshot, invoice context, and any commercial gaps before I summarize the next steps.",
      tasks: [
        "Load booking context",
        "Review package and finance details",
        "Draft the internal booking brief",
      ],
    };
  }

  return {
    thinking:
      "I need to map the staff question to this booking, check live booking data, and decide whether to answer only or run one safe action.",
    tasks: [
      "Match this booking context",
      executeActions ? "Plan the safe next action" : "Plan the best answer",
      executeActions ? "Execute or fall back safely" : "Draft the final response",
    ],
  };
}

export function BookingCopilotPanel({
  leadId,
  leadName,
  leadReference,
  runtimeReady,
  missingReason,
}: {
  leadId: string;
  leadName: string;
  leadReference?: string;
  runtimeReady: boolean;
  missingReason?: string;
}) {
  const requestCounterRef = useRef(0);
  const [mode, setMode] = useState<CopilotMode>("brief");
  const [prompt, setPrompt] = useState("");
  const [executeActions, setExecuteActions] = useState(false);
  const [running, setRunning] = useState(false);
  const [thinkingSummary, setThinkingSummary] = useState("");
  const [activeTasks, setActiveTasks] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [latestResult, setLatestResult] = useState<AiToolActionState>(initialState);

  const canRun =
    runtimeReady &&
    !running &&
    (mode === "brief" || Boolean(prompt.trim()));

  async function handleRun() {
    if (!canRun) return;

    requestCounterRef.current += 1;
    const requestId = `booking_ai_${requestCounterRef.current}`;
    const userContent =
      mode === "brief"
        ? `Prepare a booking brief for ${leadReference || leadName}.`
        : prompt.trim();
    const trace = buildTrace(mode, executeActions);

    setLatestResult(initialState);
    setChatHistory((current) => [
      ...current,
      {
        id: `user_${requestId}`,
        role: "user",
        content: userContent,
        timestamp: getTimeLabel(),
      },
    ]);
    setRunning(true);
    setThinkingSummary(trace.thinking);
    setActiveTasks([]);

    const resultPromise = runBookingCopilotAction({
      leadId,
      mode,
      request: prompt,
      executeActions,
    });

    await wait(360);
    setThinkingSummary("");

    for (let index = 0; index < trace.tasks.length; index += 1) {
      setActiveTasks(trace.tasks.slice(index));
      await wait(index === trace.tasks.length - 1 ? 720 : 620);
    }

    setActiveTasks(["Finalize the booking response"]);
    const result = await resultPromise;
    setLatestResult(result);
    setRunning(false);
    setThinkingSummary("");
    setActiveTasks([]);
    setChatHistory((current) => [
      ...current,
      {
        id: `assistant_${requestId}`,
        role: "assistant",
        content: result.message,
        timestamp: getTimeLabel(),
      },
    ]);
  }

  return (
    <div className="space-y-5 xl:sticky xl:top-24">
      <section className="paraiso-card overflow-hidden rounded-[2rem]">
        <div className="border-b border-[#e0e4dd] bg-[#f4ecdd] px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#12343b] text-[#f6ead6]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#5e7279]">
                Booking AI
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#11272b]">
                Contextual booking copilot
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5e7279]">
                Ask about this booking, get a live ops brief, or let AI run one
                safe next action without leaving the booking page.
              </p>
            </div>
          </div>
        </div>

        {!runtimeReady ? (
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">AI runtime needs setup</p>
                  <p className="mt-1 leading-6">
                    {missingReason || "Enable and configure AI in admin settings first."}
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-3 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              <Settings className="h-4 w-4" />
              Open AI settings
            </Link>
          </div>
        ) : (
          <div className="space-y-5 px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("brief")}
                className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                  mode === "brief"
                    ? "border-[#c9922f] bg-[#f4ecdd]"
                    : "border-[#e0e4dd] bg-[#fffbf4] hover:bg-[#f4ecdd]"
                }`}
              >
                <ClipboardList className="h-5 w-5 text-[#12343b]" />
                <p className="mt-3 font-semibold text-[#11272b]">Booking brief</p>
                <p className="mt-1 text-sm leading-6 text-[#5e7279]">
                  Generate a booking-specific internal summary with gaps and next actions.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("copilot")}
                className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                  mode === "copilot"
                    ? "border-[#c9922f] bg-[#f4ecdd]"
                    : "border-[#e0e4dd] bg-[#fffbf4] hover:bg-[#f4ecdd]"
                }`}
              >
                <Layers3 className="h-5 w-5 text-[#12343b]" />
                <p className="mt-3 font-semibold text-[#11272b]">Ask AI</p>
                <p className="mt-1 text-sm leading-6 text-[#5e7279]">
                  Ask questions about this booking or let AI run one supported action.
                </p>
              </button>
            </div>

            {mode === "copilot" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {quickPrompts.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPrompt(item)}
                      className="rounded-full border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-xs font-medium text-[#11272b] transition hover:border-[#c9922f] hover:text-[#12343b]"
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-[#11272b]">
                    Ask about this booking
                  </span>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={5}
                    className="mt-1 w-full rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-3 text-sm text-[#11272b] outline-none transition focus:border-[#c9922f] focus:ring-2 focus:ring-[#c9922f]/20"
                    placeholder="Example: Is this booking ready to schedule now? Or: Create an invoice for this booking."
                  />
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-4 text-sm text-[#11272b]">
                  <input
                    type="checkbox"
                    checked={executeActions}
                    onChange={(event) => setExecuteActions(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#e0e4dd] text-[#12343b] focus:ring-[#c9922f]"
                  />
                  <span>
                    <span className="block font-medium text-[#11272b]">
                      Execute supported actions
                    </span>
                    <span className="mt-1 block leading-6 text-[#5e7279]">
                      AI can run one safe supported action for this booking if
                      the request is clear enough. Otherwise it will answer only.
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <div className="rounded-[1.4rem] border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-4 text-sm leading-6 text-[#5e7279]">
                AI will load this booking, package snapshot, invoice state, and
                commercial context, then return a focused internal handoff summary.
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/admin/ai?tool=booking_brief&leadId=${leadId}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#12343b]"
              >
                Open full AI workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={handleRun}
                disabled={!canRun}
                className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-5 py-3 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {mode === "brief" ? "Generate brief" : "Run booking AI"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="paraiso-card overflow-hidden rounded-[2rem]">
        <div className="border-b border-[#e0e4dd] px-5 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[#5e7279]">
            Booking AI activity
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[#11272b]">
            Live reasoning summary and final output
          </h3>
        </div>

        <div className="space-y-4 px-5 py-5">
          {chatHistory.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-[#e0e4dd] bg-[#f4ecdd] px-4 py-6 text-sm leading-6 text-[#5e7279]">
              Run a booking brief or ask a booking-specific question. The panel
              will show your request, AI thinking summary, active tasks, and the final result.
            </div>
          ) : null}

          {chatHistory.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-[1.4rem] px-4 py-4 ${
                entry.role === "user"
                  ? "ml-4 border border-[#12343b]/15 bg-[#12343b] text-[#f7ead7]"
                  : "mr-4 border border-[#e0e4dd] bg-[#fffbf4] text-[#11272b]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] opacity-70">
                  {entry.role === "user" ? "You" : "AI"}
                </p>
                <p className="text-xs opacity-70">{entry.timestamp}</p>
              </div>
              <p className="mt-3 text-sm leading-6">{entry.content}</p>
            </div>
          ))}

          {thinkingSummary ? (
            <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-900">
              <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                AI thinking
              </p>
              <p className="mt-3 leading-6">{thinkingSummary}</p>
            </div>
          ) : null}

          {activeTasks.length > 0 ? (
            <div className="rounded-[1.4rem] border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#5e7279]">
                Live task flow
              </p>
              <div className="mt-3 space-y-3">
                {activeTasks.map((task, index) => (
                  <div
                    key={`${task}_${index}`}
                    className={`rounded-xl px-3 py-3 text-sm ${
                      index === 0
                        ? "border border-[#c9922f] bg-[#fffbf4] text-[#11272b] shadow-sm"
                        : "border border-[#e0e4dd] bg-[#fffbf4] text-[#5e7279]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{task}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-[#8a9ba1]">
                        {index === 0 ? "Running" : "Queued"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {latestResult.message ? (
            <div
              className={`rounded-[1.4rem] border px-4 py-4 text-sm ${
                latestResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <div className="flex items-start gap-3">
                {latestResult.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  <p className="font-medium">{latestResult.message}</p>
                </div>
              </div>
            </div>
          ) : null}

          {latestResult.result ? (
            <div className="max-h-[26rem] overflow-auto rounded-[1.4rem] border border-[#e0e4dd] bg-[#fffbf4] px-4 py-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-[#11272b]">
                {latestResult.result}
              </pre>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
