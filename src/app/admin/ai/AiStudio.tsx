"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Database,
  GraduationCap,
  Layers3,
  Loader2,
  Map,
  Package,
  Settings,
  Sparkles,
} from "lucide-react";
import { runAiToolAction, type AiToolActionState } from "@/app/actions/ai";
import {
  createAiKnowledgeDocumentAction,
  promoteAiInteractionToKnowledgeAction,
  saveAiInteractionFeedbackAction,
  type AiKnowledgeActionState,
} from "@/app/actions/ai-knowledge";

type AiTool =
  | "booking_brief"
  | "package_writer"
  | "journey_assistant"
  | "workspace_copilot";

type ModelMode = "auto" | "simple" | "default" | "heavy";

interface RuntimeSummary {
  enabled: boolean;
  configured: boolean;
  providerLabel: string;
  baseUrl: string;
  model: string;
  simpleModel: string;
  defaultModel: string;
  heavyModel: string;
  promptCacheEnabled: boolean;
  promptCacheTtl: "5m" | "1h";
  superpowerEnabled: boolean;
  missingReason?: string;
}

interface BookingOption {
  id: string;
  name: string;
  reference?: string;
  status: string;
  travelDate?: string;
}

interface PackageOptionItem {
  id: string;
  name: string;
  destination: string;
  duration: string;
  price: number;
  currency: string;
}

interface KnowledgeDocumentItem {
  id: string;
  title: string;
  sourceType: string;
  tags?: string[];
  updatedAt: string;
}

interface InteractionItem {
  id: string;
  tool: string;
  requestText: string;
  helpful?: boolean;
  promotedToKnowledge?: boolean;
  updatedAt: string;
}

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface WorkspaceArtifact {
  id: string;
  title: string;
  content: string;
  message: string;
  tool: AiTool;
  interactionId?: string;
}

const initialState: AiToolActionState = {
  ok: false,
  message: "",
};

const initialKnowledgeState: AiKnowledgeActionState = {
  ok: false,
  message: "",
};

const toolMeta: Record<
  AiTool,
  {
    label: string;
    description: string;
    icon: typeof ClipboardList;
    submitLabel: string;
  }
> = {
  booking_brief: {
    label: "Booking Brief",
    description:
      "Summarize a live booking, the gaps, the risks, and the next best ops move.",
    icon: ClipboardList,
    submitLabel: "Generate booking brief",
  },
  package_writer: {
    label: "Package Writer",
    description:
      "Turn raw package structure into cleaner sales-ready copy for the team.",
    icon: Package,
    submitLabel: "Rewrite package",
  },
  journey_assistant: {
    label: "Journey Assistant",
    description:
      "Draft route logic, hotel/meal guidance, and follow-up questions from a guest brief.",
    icon: Map,
    submitLabel: "Plan journey",
  },
  workspace_copilot: {
    label: "AI Coworker",
    description:
      "Answer app questions, operate on workspace data, and enter guarded app-build mode only when you explicitly arm Superpower.",
    icon: Layers3,
    submitLabel: "Run coworker",
  },
};

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <label className="text-sm font-medium text-stone-800">{label}</label>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildUserPromptSummary(input: {
  tool: AiTool;
  activeBooking?: BookingOption;
  activePackage?: PackageOptionItem;
  journeyRequest: string;
  workspaceRequest: string;
}) {
  switch (input.tool) {
    case "booking_brief":
      return input.activeBooking
        ? `Prepare an ops brief for ${input.activeBooking.reference || input.activeBooking.name}.`
        : "Prepare a booking brief.";
    case "package_writer":
      return input.activePackage
        ? `Rewrite the package copy for ${input.activePackage.name}.`
        : "Rewrite the package copy.";
    case "journey_assistant":
      return input.journeyRequest.trim();
    case "workspace_copilot":
      return input.workspaceRequest.trim();
    default:
      return "Run AI request.";
  }
}

function buildTrace(input: {
  tool: AiTool;
  activeBooking?: BookingOption;
  activePackage?: PackageOptionItem;
  executeActions: boolean;
  superpowerArmed: boolean;
}) {
  switch (input.tool) {
    case "booking_brief":
      return {
        thinking:
          "I need the booking, package snapshot, and invoice context before I can draft the staff handoff.",
        tasks: [
          `Load ${input.activeBooking?.reference || "booking"} context`,
          "Check package and invoice details",
          "Draft the operations brief",
        ],
      };
    case "package_writer":
      return {
        thinking:
          "I need the live package structure first, then I can reshape it into clearer sales copy.",
        tasks: [
          `Load ${input.activePackage?.name || "package"} details`,
          "Review route positioning and inclusions",
          "Write the refreshed package draft",
        ],
      };
    case "journey_assistant":
      return {
        thinking:
          "I need to understand the guest brief, then shape a realistic Sri Lanka route before drafting the reply.",
        tasks: [
          "Read the guest brief",
          "Check route comfort and destination flow",
          "Draft journey notes and next questions",
        ],
      };
    case "workspace_copilot":
      return {
        thinking:
          input.superpowerArmed
            ? "I need to decide whether this is a guarded app-build request or a workspace operation, then finish without overstepping the runtime."
            : "I need to match the request to live workspace data, decide whether it is informational or executable, and then finalize safely.",
        tasks: [
          "Match records and workspace data",
          input.superpowerArmed
            ? "Check guarded build mode"
            : input.executeActions
              ? "Plan the safe action"
              : "Plan the answer",
          input.superpowerArmed
            ? "Draft the cowork handoff"
            : input.executeActions
              ? "Execute or fall back safely"
              : "Draft the final answer",
        ],
      };
    default:
      return {
        thinking: "I am preparing the request.",
        tasks: ["Prepare", "Run", "Finalize"],
      };
  }
}

function buildResultTitle(result: AiToolActionState, tool: AiTool) {
  return result.title || toolMeta[tool].label;
}

function buildFormData(input: {
  tool: AiTool;
  leadId: string;
  packageId: string;
  journeyRequest: string;
  travelDate: string;
  pax: string;
  workspaceRequest: string;
  executeActions: boolean;
  modelMode: ModelMode;
  superpowerArmed: boolean;
}) {
  const formData = new FormData();
  formData.set("tool", input.tool);
  formData.set("modelMode", input.modelMode);

  if (input.tool === "booking_brief") {
    formData.set("leadId", input.leadId);
  }

  if (input.tool === "package_writer") {
    formData.set("packageId", input.packageId);
  }

  if (input.tool === "journey_assistant") {
    formData.set("journeyRequest", input.journeyRequest);
    formData.set("travelDate", input.travelDate);
    formData.set("pax", input.pax);
  }

  if (input.tool === "workspace_copilot") {
    formData.set("workspaceRequest", input.workspaceRequest);
    if (input.executeActions) {
      formData.set("executeActions", "on");
    }
    if (input.superpowerArmed) {
      formData.set("superpowerEnabled", "on");
    }
  }

  return formData;
}

export function AiStudio({
  runtime,
  bookings,
  packages,
  knowledgeDocuments,
  interactions,
  initialTool,
  initialLeadId,
  initialPackageId,
}: {
  runtime: RuntimeSummary;
  bookings: BookingOption[];
  packages: PackageOptionItem[];
  knowledgeDocuments: KnowledgeDocumentItem[];
  interactions: InteractionItem[];
  initialTool: AiTool;
  initialLeadId?: string;
  initialPackageId?: string;
}) {
  const [knowledgeState, knowledgeFormAction, knowledgePending] =
    useActionState(createAiKnowledgeDocumentAction, initialKnowledgeState);
  const [feedbackState, feedbackFormAction, feedbackPending] = useActionState(
    saveAiInteractionFeedbackAction,
    initialKnowledgeState
  );
  const [promoteState, promoteFormAction, promotePending] = useActionState(
    promoteAiInteractionToKnowledgeAction,
    initialKnowledgeState
  );

  const [tool, setTool] = useState<AiTool>(initialTool);
  const [leadId, setLeadId] = useState(initialLeadId ?? bookings[0]?.id ?? "");
  const [packageId, setPackageId] = useState(
    initialPackageId ?? packages[0]?.id ?? ""
  );
  const [journeyRequest, setJourneyRequest] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [pax, setPax] = useState("2");
  const [workspaceRequest, setWorkspaceRequest] = useState("");
  const [executeActions, setExecuteActions] = useState(false);
  const [modelMode, setModelMode] = useState<ModelMode>("auto");
  const [superpowerArmed, setSuperpowerArmed] = useState(false);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [thinkingSummary, setThinkingSummary] = useState("");
  const [activeTasks, setActiveTasks] = useState<string[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [runState, setRunState] = useState<AiToolActionState>(initialState);
  const [workspaceArtifact, setWorkspaceArtifact] =
    useState<WorkspaceArtifact | null>(null);
  const [workspaceGlow, setWorkspaceGlow] = useState(false);
  const requestCounterRef = useRef(0);
  const glowTimeoutRef = useRef<number | null>(null);

  const activeMeta = toolMeta[tool];
  const ActiveToolIcon = activeMeta.icon;
  const activeBooking = bookings.find((item) => item.id === leadId);
  const activePackage = packages.find((item) => item.id === packageId);
  const runtimeReady = runtime.enabled && runtime.configured;
  const canSubmit =
    runtimeReady &&
    !running &&
    ((tool === "booking_brief" && Boolean(leadId)) ||
      (tool === "package_writer" && Boolean(packageId)) ||
      (tool === "journey_assistant" && Boolean(journeyRequest.trim())) ||
      (tool === "workspace_copilot" && Boolean(workspaceRequest.trim())));

  async function handleAgentRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const requestSummary = buildUserPromptSummary({
      tool,
      activeBooking,
      activePackage,
      journeyRequest,
      workspaceRequest,
    });
    const trace = buildTrace({
      tool,
      activeBooking,
      activePackage,
      executeActions,
      superpowerArmed,
    });

    requestCounterRef.current += 1;
    const requestId = `run_${requestCounterRef.current}`;
    setRunState(initialState);
    setChatHistory((current) => [
      ...current,
      {
        id: `user_${requestId}`,
        role: "user",
        content: requestSummary,
        timestamp: getTimeLabel(),
      },
    ]);
    setRunning(true);
    setThinkingSummary(trace.thinking);
    setActiveTasks([]);

    const resultPromise = runAiToolAction(
      initialState,
      buildFormData({
        tool,
        leadId,
        packageId,
        journeyRequest,
        travelDate,
        pax,
        workspaceRequest,
        executeActions,
        modelMode,
        superpowerArmed,
      })
    );

    await wait(420);
    setThinkingSummary("");

    for (let index = 0; index < trace.tasks.length; index += 1) {
      setActiveTasks(trace.tasks.slice(index));
      await wait(index === trace.tasks.length - 1 ? 760 : 680);
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
        content: result.message,
        timestamp: getTimeLabel(),
      },
    ]);

    if (result.ok && result.result) {
      setWorkspaceArtifact({
        id: requestId,
        title: buildResultTitle(result, tool),
        content: result.result,
        message: result.message,
        tool,
        interactionId: result.interactionId,
      });
      if (glowTimeoutRef.current) {
        window.clearTimeout(glowTimeoutRef.current);
      }
      setWorkspaceGlow(true);
      glowTimeoutRef.current = window.setTimeout(() => {
        setWorkspaceGlow(false);
        glowTimeoutRef.current = null;
      }, 4200);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              <Bot className="h-3.5 w-3.5" />
              Agent Workspace
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-stone-900">
              One admin screen, split into workspace and AI chat
            </h1>
            <p className="mt-3 text-stone-600">
              The center workspace only shows finalized output. The AI chat on
              the right shows the live thinking summary and task progression
              before the finished result lands in the workspace.
            </p>
          </div>

          <div
            className={`max-w-md rounded-2xl border px-4 py-4 ${
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
              <div className="text-sm">
                <p className="font-semibold text-stone-900">
                  {runtimeReady ? "AI runtime ready" : "AI runtime needs setup"}
                </p>
                <p className="mt-1 text-stone-600">
                  {runtime.providerLabel} · {runtime.model}
                </p>
                {!runtimeReady && runtime.missingReason ? (
                  <p className="mt-2 text-amber-800">{runtime.missingReason}</p>
                ) : null}
              </div>
            </div>
            {!runtimeReady ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/admin/settings?section=ai"
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
                >
                  <Settings className="h-4 w-4" />
                  Open AI settings
                </Link>
                <p className="w-full text-xs leading-5 text-amber-800">
                  Checklist:{" "}
                  <strong>1)</strong> Paste your API key &nbsp;
                  <strong>2)</strong> Toggle &ldquo;Enable AI features&rdquo; ON &nbsp;
                  <strong>3)</strong> Click &ldquo;Save AI settings&rdquo; &nbsp;
                  <strong>4)</strong> Come back here
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/45 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                <ActiveToolIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  Workspace setup
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-900">
                  {activeMeta.label}
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {activeMeta.description}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 xl:grid-cols-4">
              {(Object.entries(toolMeta) as [AiTool, (typeof toolMeta)[AiTool]][]).map(
                ([key, meta]) => {
                  const Icon = meta.icon;
                  const isActive = key === tool;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTool(key)}
                      className={`rounded-[1.5rem] border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-teal-300 bg-teal-50/80 shadow-sm"
                          : "border-white/30 bg-white/50 hover:bg-white/70"
                      }`}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-teal-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-semibold text-stone-900">
                        {meta.label}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-stone-600">
                        {meta.description}
                      </p>
                    </button>
                  );
                }
              )}
            </div>

            <div className="mt-6 space-y-5">
              {tool === "booking_brief" ? (
                <div>
                  <FieldLabel
                    label="Booking"
                    hint="Choose the live booking that the AI should summarize for the ops team."
                  />
                  <select
                    value={leadId}
                    onChange={(event) => setLeadId(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">Select booking</option>
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.reference || booking.name} · {booking.name}
                      </option>
                    ))}
                  </select>
                  {activeBooking ? (
                    <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-700">
                      <p className="font-semibold text-stone-900">
                        {activeBooking.reference || activeBooking.name}
                      </p>
                      <p className="mt-1">
                        Status: {activeBooking.status} · Travel date:{" "}
                        {activeBooking.travelDate || "Not set"}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tool === "package_writer" ? (
                <div>
                  <FieldLabel
                    label="Package"
                    hint="Choose the package that needs refreshed customer-facing copy."
                  />
                  <select
                    value={packageId}
                    onChange={(event) => setPackageId(event.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">Select package</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} · {pkg.destination}
                      </option>
                    ))}
                  </select>
                  {activePackage ? (
                    <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-700">
                      <p className="font-semibold text-stone-900">
                        {activePackage.name}
                      </p>
                      <p className="mt-1">
                        {activePackage.destination} · {activePackage.duration} ·{" "}
                        {activePackage.price.toLocaleString()} {activePackage.currency}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tool === "journey_assistant" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel label="Travel date" />
                    <input
                      type="date"
                      value={travelDate}
                      onChange={(event) => setTravelDate(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <FieldLabel label="Guest count" />
                    <input
                      type="number"
                      min="1"
                      value={pax}
                      onChange={(event) => setPax(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>
              ) : null}

              {tool === "workspace_copilot" ? (
                <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={executeActions}
                    onChange={(event) => setExecuteActions(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    <span className="block font-medium text-stone-900">
                      Execute supported actions
                    </span>
                    <span className="mt-1 block leading-6 text-stone-500">
                      The AI can execute one safe supported admin action when
                      the request is clear. Otherwise it falls back to guidance.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
          </div>

          <div
            className={`rounded-[2rem] p-[1.5px] transition duration-500 ${
              workspaceGlow
                ? "bg-[linear-gradient(135deg,#38bdf8,#34d399,#f59e0b,#a78bfa)] shadow-[0_0_42px_rgba(56,189,248,0.35)]"
                : "bg-transparent"
            }`}
          >
            <div className="overflow-hidden rounded-[calc(2rem-2px)] border border-white/20 bg-white/55 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                    Workspace
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-stone-900">
                    Finalized output only
                  </h2>
                </div>
                {workspaceArtifact ? (
                  <div className="rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700">
                    Finalized by AI
                  </div>
                ) : null}
              </div>

              {workspaceArtifact ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.4rem] border border-stone-200 bg-white/85 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                      {workspaceArtifact.title}
                    </p>
                    <p className="mt-2 text-sm text-stone-500">
                      {workspaceArtifact.message}
                    </p>
                  </div>
                  <div className="max-h-[36rem] overflow-auto rounded-[1.5rem] border border-stone-200 bg-white px-4 py-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-stone-800">
                      {workspaceArtifact.content}
                    </pre>
                  </div>

                  {workspaceArtifact.interactionId ? (
                    <div className="grid gap-3">
                      {feedbackState.message ? (
                        <div
                          className={`rounded-xl border px-4 py-3 text-sm ${
                            feedbackState.ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {feedbackState.message}
                        </div>
                      ) : null}
                      {promoteState.message ? (
                        <div
                          className={`rounded-xl border px-4 py-3 text-sm ${
                            promoteState.ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {promoteState.message}
                        </div>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-2">
                        <form action={feedbackFormAction}>
                          <input
                            type="hidden"
                            name="interactionId"
                            value={workspaceArtifact.interactionId}
                          />
                          <input type="hidden" name="helpful" value="true" />
                          <button
                            type="submit"
                            disabled={feedbackPending}
                            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                          >
                            Mark useful
                          </button>
                        </form>
                        <form action={feedbackFormAction}>
                          <input
                            type="hidden"
                            name="interactionId"
                            value={workspaceArtifact.interactionId}
                          />
                          <input type="hidden" name="helpful" value="false" />
                          <button
                            type="submit"
                            disabled={feedbackPending}
                            className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          >
                            Mark not useful
                          </button>
                        </form>
                      </div>
                      <form action={promoteFormAction}>
                        <input
                          type="hidden"
                          name="interactionId"
                          value={workspaceArtifact.interactionId}
                        />
                        <input
                          type="hidden"
                          name="title"
                          value={workspaceArtifact.title}
                        />
                        <input
                          type="hidden"
                          name="tags"
                          value={workspaceArtifact.tool}
                        />
                        <button
                          type="submit"
                          disabled={promotePending}
                          className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-60"
                        >
                          <GraduationCap className="h-4 w-4" />
                          Save to knowledge base
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50/80 px-4 py-10 text-sm leading-6 text-stone-500">
                  The workspace stays clean until AI finishes. Run a request
                  from the chat and the finalized output will land here with a
                  short glow so you can spot the new result immediately.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/50 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
          <div className="border-b border-stone-200/70 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                    AI chat
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-stone-900">
                    Visible plan and live task flow
                  </h2>
                </div>
              </div>
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
                            Guarded app-build mode. It prepares a coding
                            handoff only when you explicitly arm it.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex h-[48rem] flex-col">
            <div className="flex-1 space-y-4 overflow-auto px-5 py-5">
              {chatHistory.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50/80 px-4 py-8 text-sm leading-6 text-stone-500">
                  Prompts live here. The chat will show your message first, then
                  a short AI thinking summary, then the active task list, and
                  finally the reply after the workspace is updated.
                </div>
              ) : null}

              {chatHistory.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-[1.5rem] px-4 py-4 ${
                    entry.role === "user"
                      ? "ml-6 border border-[#12343b]/15 bg-[#12343b] text-[#f7ead7]"
                      : "mr-6 border border-stone-200 bg-white text-stone-800"
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
                <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm text-amber-900">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-700">
                    AI thinking
                  </p>
                  <p className="mt-3 leading-6">{thinkingSummary}</p>
                </div>
              ) : null}

              {activeTasks.length > 0 ? (
                <div className="rounded-[1.5rem] border border-teal-200 bg-teal-50/80 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-teal-700">
                    Live task flow
                  </p>
                  <div className="mt-3 space-y-3">
                    {activeTasks.map((task, index) => (
                      <div
                        key={`${task}_${index}`}
                        className={`rounded-xl px-3 py-3 text-sm ${
                          index === 0
                            ? "border border-teal-300 bg-white text-teal-900 shadow-sm"
                            : "border border-teal-100 bg-white/70 text-stone-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span>{task}</span>
                          <span className="text-xs uppercase tracking-[0.18em] text-teal-700">
                            {index === 0 ? "Running" : "Queued"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {runState.message && !runState.ok ? (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50/90 px-4 py-4 text-sm text-rose-700">
                  {runState.message}
                </div>
              ) : null}
            </div>

            <form
              onSubmit={handleAgentRun}
              className="border-t border-stone-200/70 bg-white/70 px-5 py-5"
            >
              {tool === "journey_assistant" ? (
                <div>
                  <FieldLabel
                    label="Prompt the AI"
                    hint="Describe the guest request in normal language."
                  />
                  <textarea
                    value={journeyRequest}
                    onChange={(event) => setJourneyRequest(event.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Example: Couple arriving in July for 8 nights, scenic hill country, one safari, finish on the south coast, comfortable hotels, private car."
                  />
                </div>
              ) : null}

              {tool === "workspace_copilot" ? (
                <div>
                  <FieldLabel
                    label="Prompt the AI"
                    hint="Ask a question, request one safe admin action, or arm Superpower and ask for a guarded app-build handoff."
                  />
                  <textarea
                    value={workspaceRequest}
                    onChange={(event) => setWorkspaceRequest(event.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Example: Explain how package snapshots work. Or: Mark invoice INV-0005 as paid. Or, with Superpower armed: add sidebar menu 'Deals'."
                  />
                </div>
              ) : null}

              {tool === "booking_brief" ? (
                <div className="rounded-[1.35rem] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-700">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Prompt preview
                  </p>
                  <p className="mt-2 leading-6">
                    {activeBooking
                      ? `Prepare a structured operations brief for ${activeBooking.reference || activeBooking.name}.`
                      : "Choose a booking in the workspace first."}
                  </p>
                </div>
              ) : null}

              {tool === "package_writer" ? (
                <div className="rounded-[1.35rem] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm text-stone-700">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Prompt preview
                  </p>
                  <p className="mt-2 leading-6">
                    {activePackage
                      ? `Rewrite the customer-facing copy for ${activePackage.name}.`
                      : "Choose a package in the workspace first."}
                  </p>
                </div>
              ) : null}

              {/* ── Why is the button disabled? ── */}
              {!canSubmit && !running ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {!runtimeReady ? (
                    <span>
                      <strong>AI not ready —</strong>{" "}
                      {runtime.missingReason ||
                        "Check AI settings."}{" "}
                      <Link
                        href="/admin/settings?section=ai"
                        className="font-semibold underline underline-offset-2 hover:text-amber-900"
                      >
                        Open AI settings →
                      </Link>
                    </span>
                  ) : tool === "booking_brief" && !leadId ? (
                    "Select a booking from the dropdown above first."
                  ) : tool === "package_writer" && !packageId ? (
                    "Select a package from the dropdown above first."
                  ) : tool === "journey_assistant" ? (
                    "Type your guest request in the prompt box above."
                  ) : (
                    "Type a prompt in the box above to get started."
                  )}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-sm text-stone-500">
                  <p>The workspace updates only after the AI fully finishes.</p>
                  {tool === "workspace_copilot" ? (
                    <p>
                      Route:{" "}
                      <span className="font-medium text-stone-700">
                        {modelMode === "auto"
                          ? `Auto (${runtime.defaultModel})`
                          : modelMode}
                      </span>
                      {superpowerArmed ? " · Superpower armed" : ""}
                    </p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {activeMeta.submitLabel}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                Knowledge Base
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Add reusable process notes and company rules for retrieval.
              </p>
            </div>
          </div>

          <form action={knowledgeFormAction} className="mt-5 space-y-3">
            <div>
              <FieldLabel label="Title" />
              <input
                name="title"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder="Supplier escalation checklist"
              />
            </div>
            <div>
              <FieldLabel
                label="Content"
                hint="Paste SOPs, response standards, supplier rules, or operating notes."
              />
              <textarea
                name="content"
                rows={6}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder="Write the knowledge note here..."
              />
            </div>
            <div>
              <FieldLabel label="Tags" hint="Comma-separated. Example: supplier, email, finance" />
              <input
                name="tags"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder="supplier, customer care, finance"
              />
            </div>
            {knowledgeState.message ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  knowledgeState.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {knowledgeState.message}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={knowledgePending}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {knowledgePending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Add knowledge note"
              )}
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                Recent memory
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Useful interactions and stored notes keep improving retrieval quality.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-stone-900">
                Recent knowledge documents
              </p>
              {knowledgeDocuments.length > 0 ? (
                knowledgeDocuments.slice(0, 4).map((document) => (
                  <div
                    key={document.id}
                    className="rounded-2xl border border-stone-200 bg-white/70 px-4 py-3"
                  >
                    <p className="font-medium text-stone-900">{document.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                      {document.sourceType}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {(document.tags ?? []).join(", ") || "No tags"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-500">
                  No stored knowledge documents yet.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-stone-900">
                Learning loop memory
              </p>
              {interactions.length > 0 ? (
                interactions.slice(0, 4).map((interaction) => (
                  <div
                    key={interaction.id}
                    className="rounded-2xl border border-stone-200 bg-white/70 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-stone-900">
                      {interaction.tool.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-stone-600">
                      {interaction.requestText}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {interaction.helpful === true
                        ? "Marked useful"
                        : interaction.helpful === false
                          ? "Marked not useful"
                          : "Awaiting feedback"}
                      {interaction.promotedToKnowledge
                        ? " · Added to knowledge"
                        : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-stone-500">
                  No interaction memory yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
