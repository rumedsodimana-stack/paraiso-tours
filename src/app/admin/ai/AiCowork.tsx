"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Calendar,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Database,
  FileText,
  Globe,
  Layers3,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  Moon,
  Package,
  Plug,
  Plus,
  Send,
  Sparkles,
  Sun,
  Users,
  Wallet,
  Receipt,
  Truck,
  CheckCircle2,
  XCircle,
  Brain,
  Zap,
  LayoutGrid,
  Settings,
  Map,
} from "lucide-react";
import { runAiToolAction, type AiToolActionState } from "@/app/actions/ai";
import type { AiInteraction, AiKnowledgeDocument } from "@/lib/types";
import type { ConnectorStatus } from "./page";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface PackageOption {
  id: string;
  name: string;
  destination: string;
  duration: string;
  price: number;
  currency: string;
}

type ReasoningStep = {
  label: string;
  status: "pending" | "active" | "done" | "error";
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  reasoning?: ReasoningStep[];
  actionResult?: { ok: boolean; message: string; details?: string };
  artifact?: { title: string; content: string };
  interactionId?: string;
}

interface Session {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

interface AiCoworkProps {
  runtime: RuntimeSummary;
  bookings: BookingOption[];
  packages: PackageOption[];
  knowledgeDocuments: AiKnowledgeDocument[];
  interactions: AiInteraction[];
  connectors: ConnectorStatus[];
}

type Theme = "light" | "dark";

// ─── Task Suggestions ────────────────────────────────────────────────────────

const TASK_SUGGESTIONS = [
  { icon: ClipboardList, label: "Create a booking", prompt: "Create a new booking for a client. Ask me for the details.", colorDark: "text-sky-400", colorLight: "text-sky-600" },
  { icon: Calendar, label: "Schedule a tour", prompt: "Show me pending bookings that need to be scheduled as tours.", colorDark: "text-emerald-400", colorLight: "text-emerald-600" },
  { icon: Receipt, label: "Generate an invoice", prompt: "Which bookings don't have invoices yet? List them with details.", colorDark: "text-amber-400", colorLight: "text-amber-600" },
  { icon: Package, label: "Review packages", prompt: "Give me a summary of all active tour packages with pricing.", colorDark: "text-violet-400", colorLight: "text-violet-600" },
  { icon: Wallet, label: "Financial overview", prompt: "Show me the current financial snapshot: revenue, pending payments, and receivables.", colorDark: "text-rose-400", colorLight: "text-rose-600" },
  { icon: Map, label: "Plan a journey", prompt: "Help me design a 7-day Sri Lanka tour covering Sigiriya, Kandy, Ella, and beach time.", colorDark: "text-teal-400", colorLight: "text-teal-600" },
  { icon: Truck, label: "Check suppliers", prompt: "Show me all suppliers with their booking status and availability.", colorDark: "text-orange-400", colorLight: "text-orange-600" },
  { icon: FileText, label: "Draft a quotation", prompt: "Help me prepare a corporate quotation for a group tour.", colorDark: "text-cyan-400", colorLight: "text-cyan-600" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sessionTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Session";
  return first.content.length > 40
    ? first.content.slice(0, 40) + "…"
    : first.content;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Connector icon map ──────────────────────────────────────────────────────

function connectorIcon(id: string) {
  switch (id) {
    case "ai": return Brain;
    case "email": return Mail;
    case "whatsapp": return MessageCircle;
    case "whatsapp_webhook": return Globe;
    case "database": return Database;
    default: return Circle;
  }
}

// ─── Theme tokens ────────────────────────────────────────────────────────────

function makeTheme(theme: Theme) {
  if (theme === "dark") {
    return {
      root: "fixed inset-0 z-50 flex bg-neutral-950 text-neutral-100",
      lSidebar: "flex flex-col border-r border-neutral-800 bg-neutral-900/80 transition-all",
      lHeader: "flex h-14 items-center justify-between border-b border-neutral-800 px-4",
      backBtn: "flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition",
      sectionLabel: "px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500",
      sessionActive: "bg-neutral-800 text-white",
      sessionInactive: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
      pastSession: "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-500",
      lFooter: "border-t border-neutral-800 px-4 py-3",
      providerText: "flex items-center gap-2 text-xs text-neutral-500",
      topBar: "flex h-14 items-center justify-between border-b border-neutral-800 px-4",
      topBarTitle: "font-semibold text-neutral-200",
      copilotBadge: "rounded-full bg-teal-900/50 px-2 py-0.5 text-[10px] font-medium text-teal-400",
      topBarBtn: "rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300",
      welcomeTitle: "text-2xl font-bold text-white",
      welcomeSub: "mt-2 text-sm text-neutral-400",
      taskCard: "group flex flex-col items-start gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-left transition hover:border-neutral-700 hover:bg-neutral-800/50",
      taskLabel: "text-sm font-medium text-neutral-300 group-hover:text-white",
      aiAvatar: "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800",
      botIcon: "h-4 w-4 text-teal-400",
      reasoning: "rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2",
      reasoningToggle: "flex w-full items-center gap-2 text-[11px] font-medium text-neutral-500 hover:text-neutral-300",
      reasoningActive: "text-teal-400",
      reasoningDone: "text-neutral-400",
      reasoningPending: "text-neutral-600",
      reasoningDot: "h-3 w-3 rounded-full border border-neutral-700",
      actionOk: "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-900/50 text-emerald-400",
      actionErr: "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-900/50 text-red-400",
      msgContent: "whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed",
      artifactInline: "inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-xs text-neutral-400",
      msgTime: "text-[10px] text-neutral-600",
      alertBanner: "mb-6 flex items-center gap-3 rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300",
      alertBtn: "ml-auto rounded-lg bg-amber-800/40 px-3 py-1 text-xs font-medium hover:bg-amber-800/60 transition",
      inputArea: "border-t border-neutral-800 px-4 py-4",
      inputBox: "relative flex items-end rounded-2xl border border-neutral-700 bg-neutral-900 focus-within:border-teal-600 transition",
      inputText: "flex-1 resize-none bg-transparent px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none",
      inputDisclaimer: "mt-2 text-center text-[10px] text-neutral-600",
      rSidebar: "flex flex-col border-l border-neutral-800 bg-neutral-900/80 transition-all",
      rSectionBorder: "border-b border-neutral-800",
      rSectionLabel: "text-xs font-semibold uppercase tracking-wider text-neutral-400",
      progressActive: "text-teal-400",
      progressDone: "text-neutral-400",
      progressPending: "text-neutral-600",
      progressDot: "h-3 w-3 rounded-full border border-neutral-700",
      noItems: "text-xs text-neutral-600",
      artifactBadge: "ml-auto rounded-full bg-violet-900/50 px-1.5 text-[10px] font-medium text-violet-400",
      artifactCard: "flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-800/30 px-3 py-2 text-xs text-neutral-300",
      ctxDivider: "mt-2 pt-2 border-t border-neutral-800",
      ctxRow: "flex items-center justify-between rounded-lg px-2 py-1 text-xs text-neutral-400",
      ctxCount: "text-neutral-600",
      ctxSettingsBtn: "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition",
      connectorOn: "text-emerald-400",
      connectorOff: "text-neutral-700",
      connectorLabel: "text-neutral-300",
      connectorDesc: "text-neutral-600",
    };
  }

  return {
    root: "fixed inset-0 z-50 flex bg-gradient-to-br from-amber-50 via-emerald-50 to-sky-50 text-stone-900",
    lSidebar: "flex flex-col border-r border-stone-200/60 bg-white/60 backdrop-blur-xl transition-all",
    lHeader: "flex h-14 items-center justify-between border-b border-stone-200/40 px-4",
    backBtn: "flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition",
    sectionLabel: "px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400",
    sessionActive: "bg-teal-50 text-teal-900 font-medium",
    sessionInactive: "text-stone-500 hover:bg-stone-100/80 hover:text-stone-800",
    pastSession: "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-400",
    lFooter: "border-t border-stone-200/40 px-4 py-3",
    providerText: "flex items-center gap-2 text-xs text-stone-400",
    topBar: "flex h-14 items-center justify-between border-b border-stone-200/40 bg-white/40 backdrop-blur-sm px-4",
    topBarTitle: "font-semibold text-stone-800",
    copilotBadge: "rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700",
    topBarBtn: "rounded-lg px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700",
    welcomeTitle: "text-2xl font-bold text-stone-900",
    welcomeSub: "mt-2 text-sm text-stone-500",
    taskCard: "group flex flex-col items-start gap-2 rounded-xl border border-stone-200/60 bg-white/50 backdrop-blur-sm p-4 text-left transition hover:border-stone-300 hover:bg-white/80 shadow-sm",
    taskLabel: "text-sm font-medium text-stone-700 group-hover:text-stone-900",
    aiAvatar: "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 shadow-sm",
    botIcon: "h-4 w-4 text-teal-600",
    reasoning: "rounded-lg border border-stone-200/60 bg-stone-50/60 backdrop-blur-sm px-3 py-2",
    reasoningToggle: "flex w-full items-center gap-2 text-[11px] font-medium text-stone-400 hover:text-stone-700",
    reasoningActive: "text-teal-600",
    reasoningDone: "text-stone-500",
    reasoningPending: "text-stone-300",
    reasoningDot: "h-3 w-3 rounded-full border border-stone-300",
    actionOk: "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700",
    actionErr: "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700",
    msgContent: "whitespace-pre-wrap text-sm text-stone-700 leading-relaxed",
    artifactInline: "inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500",
    msgTime: "text-[10px] text-stone-400",
    alertBanner: "mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700",
    alertBtn: "ml-auto rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 transition",
    inputArea: "border-t border-stone-200/40 bg-white/30 backdrop-blur-sm px-4 py-4",
    inputBox: "relative flex items-end rounded-2xl border border-stone-200 bg-white/80 backdrop-blur-sm focus-within:border-teal-500 shadow-sm transition",
    inputText: "flex-1 resize-none bg-transparent px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none",
    inputDisclaimer: "mt-2 text-center text-[10px] text-stone-400",
    rSidebar: "flex flex-col border-l border-stone-200/60 bg-white/60 backdrop-blur-xl transition-all",
    rSectionBorder: "border-b border-stone-200/40",
    rSectionLabel: "text-xs font-semibold uppercase tracking-wider text-stone-500",
    progressActive: "text-teal-600",
    progressDone: "text-stone-500",
    progressPending: "text-stone-300",
    progressDot: "h-3 w-3 rounded-full border border-stone-300",
    noItems: "text-xs text-stone-400",
    artifactBadge: "ml-auto rounded-full bg-violet-50 px-1.5 text-[10px] font-medium text-violet-700",
    artifactCard: "flex items-center gap-2 rounded-lg border border-stone-200 bg-white/60 px-3 py-2 text-xs text-stone-600",
    ctxDivider: "mt-2 pt-2 border-t border-stone-200/40",
    ctxRow: "flex items-center justify-between rounded-lg px-2 py-1 text-xs text-stone-500",
    ctxCount: "text-stone-400",
    ctxSettingsBtn: "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition",
    connectorOn: "text-emerald-500",
    connectorOff: "text-stone-300",
    connectorLabel: "text-stone-700",
    connectorDesc: "text-stone-400",
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AiCowork({
  runtime,
  bookings,
  packages,
  knowledgeDocuments,
  interactions,
  connectors,
}: AiCoworkProps) {
  const router = useRouter();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Theme
  const [theme, setTheme] = useState<Theme>("light");
  const T = makeTheme(theme);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([
    { id: genId(), title: "New Session", messages: [], createdAt: new Date().toISOString() },
  ]);
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Chat state
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reasoning, setReasoning] = useState<ReasoningStep[]>([]);

  // Artifacts collected during session
  const [artifacts, setArtifacts] = useState<{ title: string; content: string }[]>([]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages, reasoning]);

  // ─── Session management ──────────────────────────────────────────────────

  function createSession() {
    const s: Session = {
      id: genId(),
      title: "New Session",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setArtifacts([]);
    setInput("");
  }

  function switchSession(id: string) {
    setActiveSessionId(id);
    const session = sessions.find((s) => s.id === id);
    if (session) {
      setArtifacts(
        session.messages
          .filter((m) => m.artifact)
          .map((m) => m.artifact!)
      );
    }
    setInput("");
  }

  function addMessage(msg: ChatMessage) {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s;
        const msgs = [...s.messages, msg];
        return { ...s, messages: msgs, title: sessionTitle(msgs) };
      })
    );
  }

  // ─── Send message ────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput("");
    setLoading(true);

    const steps: ReasoningStep[] = [
      { label: "Analyzing your request", status: "active" },
      { label: "Searching app data", status: "pending" },
      { label: "Planning response", status: "pending" },
    ];
    setReasoning(steps);

    try {
      await new Promise((r) => setTimeout(r, 400));
      setReasoning((prev) =>
        prev.map((s, i) =>
          i === 0 ? { ...s, status: "done" } : i === 1 ? { ...s, status: "active" } : s
        )
      );

      await new Promise((r) => setTimeout(r, 300));
      setReasoning((prev) =>
        prev.map((s, i) =>
          i <= 1 ? { ...s, status: "done" } : i === 2 ? { ...s, status: "active" } : s
        )
      );

      const fd = new FormData();
      fd.set("tool", "workspace_copilot");
      fd.set("workspaceRequest", text.trim());
      fd.set("executeActions", "on");
      fd.set("modelMode", "auto");
      if (runtime.superpowerEnabled) fd.set("superpowerEnabled", "on");

      const result = await runAiToolAction(
        { ok: false, message: "" },
        fd
      );

      if (result.ok && result.message !== "No app action was executed." && result.message !== "Copilot response ready.") {
        setReasoning((prev) => [
          ...prev.map((s) => ({ ...s, status: "done" as const })),
          { label: `Executed: ${result.message}`, status: "done" },
        ]);
      } else {
        setReasoning((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      }

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: result.result ?? result.message,
        timestamp: new Date().toISOString(),
        reasoning: reasoning.map((s) => ({ ...s, status: "done" })),
        interactionId: result.interactionId,
      };

      if (result.ok && result.message !== "No app action was executed." && result.message !== "Copilot response ready." && result.message !== "AI coworker stayed in protected mode.") {
        assistantMsg.actionResult = {
          ok: result.ok,
          message: result.message,
        };
      }

      if (result.result && result.result.length > 200 && result.title) {
        const artifact = { title: result.title, content: result.result };
        assistantMsg.artifact = artifact;
        setArtifacts((prev) => [...prev, artifact]);
      }

      addMessage(assistantMsg);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Request failed"}`,
        timestamp: new Date().toISOString(),
        actionResult: { ok: false, message: err instanceof Error ? err.message : "Request failed" },
      };
      addMessage(errMsg);
      setReasoning((prev) =>
        prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
      );
    } finally {
      setLoading(false);
      setTimeout(() => setReasoning([]), 1000);
    }
  }, [loading, activeSessionId, runtime.superpowerEnabled]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const pastSessions = interactions
    .filter((i) => i.tool === "workspace_copilot")
    .slice(0, 10)
    .map((i) => ({
      id: i.id,
      title: i.requestText.length > 40 ? i.requestText.slice(0, 40) + "…" : i.requestText,
      time: formatTime(i.createdAt),
    }));

  const notConfigured = !runtime.enabled || !runtime.configured;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={T.root}>
      {/* ─── Left Sidebar: Sessions ──────────────────────────────────────── */}
      <div
        className={`${T.lSidebar} ${leftOpen ? "w-64" : "w-0 overflow-hidden"}`}
      >
        <div className={T.lHeader}>
          <button onClick={() => router.push("/admin")} className={T.backBtn}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            onClick={createSession}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-500 transition"
            title="New session"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <p className={T.sectionLabel}>Sessions</p>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => switchSession(s.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                s.id === activeSessionId ? T.sessionActive : T.sessionInactive
              }`}
            >
              <MessageSquarePlus className="h-4 w-4 shrink-0" />
              <span className="truncate">{s.title}</span>
            </button>
          ))}

          {pastSessions.length > 0 && (
            <>
              <p className={`mt-4 ${T.sectionLabel}`}>Recent</p>
              {pastSessions.map((ps) => (
                <div key={ps.id} className={T.pastSession}>
                  <Bot className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-xs">{ps.title}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className={T.lFooter}>
          <div className={T.providerText}>
            <Zap className="h-3 w-3 text-teal-500" />
            <span className="truncate">{runtime.providerLabel}</span>
          </div>
        </div>
      </div>

      {/* ─── Center: Chat Panel ──────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className={T.topBar}>
          <div className="flex items-center gap-3">
            {!leftOpen && (
              <button
                onClick={() => setLeftOpen(true)}
                className={`mr-2 ${T.topBarBtn}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <Bot className="h-5 w-5 text-teal-500" />
            <span className={T.topBarTitle}>AI Workspace</span>
            <span className={T.copilotBadge}>Copilot</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              className={`${T.topBarBtn} flex items-center gap-1.5`}
              title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              {theme === "light" ? (
                <Moon className="h-3.5 w-3.5" />
              ) : (
                <Sun className="h-3.5 w-3.5" />
              )}
            </button>
            <button onClick={() => setLeftOpen((v) => !v)} className={T.topBarBtn}>
              Sessions
            </button>
            <button onClick={() => setRightOpen((v) => !v)} className={T.topBarBtn}>
              Insights
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {notConfigured && (
              <div className={T.alertBanner}>
                <Settings className="h-4 w-4 shrink-0" />
                <span>AI provider not configured.</span>
                <button
                  onClick={() => router.push("/admin/settings")}
                  className={T.alertBtn}
                >
                  Settings
                </button>
              </div>
            )}

            {activeSession.messages.length === 0 && !loading ? (
              /* ─── Welcome / Task Suggestions ─────────────────────────── */
              <div className="flex flex-col items-center pt-12">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className={T.welcomeTitle}>What would you like to do?</h2>
                <p className={T.welcomeSub}>
                  I can manage bookings, schedule tours, generate invoices, plan journeys, and more.
                </p>

                <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                  {TASK_SUGGESTIONS.map((task) => {
                    const Icon = task.icon;
                    const iconColor = theme === "dark" ? task.colorDark : task.colorLight;
                    return (
                      <button
                        key={task.label}
                        onClick={() => {
                          setInput(task.prompt);
                          inputRef.current?.focus();
                        }}
                        className={T.taskCard}
                      >
                        <Icon className={`h-5 w-5 ${iconColor} transition group-hover:scale-110`} />
                        <span className={T.taskLabel}>{task.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ─── Message List ────────────────────────────────────────── */
              <div className="space-y-6">
                {activeSession.messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-teal-600 px-4 py-3 text-sm text-white">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <div className={T.aiAvatar}>
                          <Bot className={T.botIcon} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          {msg.reasoning && msg.reasoning.length > 0 && (
                            <ReasoningDisplay steps={msg.reasoning} collapsed T={T} />
                          )}

                          {msg.actionResult && (
                            <div className={msg.actionResult.ok ? T.actionOk : T.actionErr}>
                              {msg.actionResult.ok ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              {msg.actionResult.message}
                            </div>
                          )}

                          <div className={T.msgContent}>{msg.content}</div>

                          {msg.artifact && (
                            <div className={T.artifactInline}>
                              <FileText className="h-3.5 w-3.5 text-teal-500" />
                              Saved to Artifacts: {msg.artifact.title}
                            </div>
                          )}

                          <p className={T.msgTime}>{formatTime(msg.timestamp)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {loading && reasoning.length > 0 && (
                  <div className="flex gap-3">
                    <div className={T.aiAvatar}>
                      <Loader2 className={`h-4 w-4 animate-spin ${theme === "dark" ? "text-teal-400" : "text-teal-600"}`} />
                    </div>
                    <ReasoningDisplay steps={reasoning} collapsed={false} T={T} />
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className={T.inputArea}>
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className={T.inputBox}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything — manage bookings, schedule tours, check finances…"
                rows={1}
                className={T.inputText}
                style={{ maxHeight: "120px" }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="m-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white transition hover:bg-teal-500 disabled:opacity-30 disabled:hover:bg-teal-600"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className={T.inputDisclaimer}>
              AI may make mistakes. Verify actions in the app.
            </p>
          </form>
        </div>
      </div>

      {/* ─── Right Sidebar: Insights ─────────────────────────────────────── */}
      <div
        className={`${T.rSidebar} ${rightOpen ? "w-72" : "w-0 overflow-hidden"}`}
      >
        {/* Progress */}
        <div className={T.rSectionBorder}>
          <div className="flex items-center gap-2 px-4 py-3">
            <ClipboardList className="h-4 w-4 text-teal-500" />
            <span className={T.rSectionLabel}>Progress</span>
          </div>
          <div className="px-4 pb-3">
            {loading && reasoning.length > 0 ? (
              <div className="space-y-1.5">
                {reasoning.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {step.status === "active" ? (
                      <Loader2 className={`h-3 w-3 animate-spin ${theme === "dark" ? "text-teal-400" : "text-teal-600"}`} />
                    ) : step.status === "done" ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : step.status === "error" ? (
                      <XCircle className="h-3 w-3 text-red-500" />
                    ) : (
                      <div className={T.progressDot} />
                    )}
                    <span
                      className={
                        step.status === "active"
                          ? T.progressActive
                          : step.status === "done"
                          ? T.progressDone
                          : T.progressPending
                      }
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={T.noItems}>No active tasks</p>
            )}
          </div>
        </div>

        {/* Artifacts */}
        <div className={`flex-1 overflow-y-auto ${T.rSectionBorder}`}>
          <div className="flex items-center gap-2 px-4 py-3">
            <Layers3 className="h-4 w-4 text-violet-500" />
            <span className={T.rSectionLabel}>Artifacts</span>
            {artifacts.length > 0 && (
              <span className={T.artifactBadge}>{artifacts.length}</span>
            )}
          </div>
          <div className="px-4 pb-3">
            {artifacts.length === 0 ? (
              <p className={T.noItems}>Generated content will appear here</p>
            ) : (
              <div className="space-y-2">
                {artifacts.map((a, i) => (
                  <div key={i} className={T.artifactCard}>
                    <FileText className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                    <span className="truncate">{a.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Context */}
        <div className={`shrink-0 ${T.rSectionBorder}`}>
          <div className="flex items-center gap-2 px-4 py-3">
            <Database className="h-4 w-4 text-amber-500" />
            <span className={T.rSectionLabel}>Context</span>
          </div>
          <div className="space-y-1 px-4 pb-3">
            <div className={T.ctxRow}>
              <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />Bookings</span>
              <span className={T.ctxCount}>{bookings.length}</span>
            </div>
            <div className={T.ctxRow}>
              <span className="flex items-center gap-2"><Package className="h-3.5 w-3.5" />Packages</span>
              <span className={T.ctxCount}>{packages.length}</span>
            </div>
            <div className={T.ctxRow}>
              <span className="flex items-center gap-2"><Brain className="h-3.5 w-3.5" />Knowledge</span>
              <span className={T.ctxCount}>{knowledgeDocuments.length}</span>
            </div>
            <div className={T.ctxRow}>
              <span className="flex items-center gap-2"><LayoutGrid className="h-3.5 w-3.5" />Actions</span>
              <span className={T.ctxCount}>11</span>
            </div>
            <div className={T.ctxDivider}>
              <button
                onClick={() => router.push("/admin/settings")}
                className={T.ctxSettingsBtn}
              >
                <Settings className="h-3.5 w-3.5" />
                AI Settings
              </button>
            </div>
          </div>
        </div>

        {/* Connectors */}
        <div className="shrink-0">
          <div className="flex items-center gap-2 px-4 py-3">
            <Plug className="h-4 w-4 text-sky-500" />
            <span className={T.rSectionLabel}>Connectors</span>
            <span className={`ml-auto text-[10px] font-medium ${T.connectorDesc}`}>
              {connectors.filter((c) => c.connected).length}/{connectors.length}
            </span>
          </div>
          <div className="space-y-2 px-4 pb-4">
            {connectors.map((c) => {
              const Icon = connectorIcon(c.id);
              return (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.connected ? T.connectorOn : T.connectorOff}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium leading-tight ${T.connectorLabel}`}>
                      {c.label}
                    </p>
                    <p className={`text-[10px] ${T.connectorDesc}`}>{c.description}</p>
                  </div>
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      c.connected
                        ? theme === "dark"
                          ? "bg-emerald-900/60 text-emerald-400"
                          : "bg-emerald-100 text-emerald-700"
                        : theme === "dark"
                          ? "bg-neutral-800 text-neutral-500"
                          : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {c.connected ? "On" : "Off"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

type ThemeTokens = ReturnType<typeof makeTheme>;

function ReasoningDisplay({
  steps,
  collapsed: initialCollapsed,
  T,
}: {
  steps: ReasoningStep[];
  collapsed: boolean;
  T: ThemeTokens;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <div className={T.reasoning}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className={T.reasoningToggle}
      >
        <Brain className="h-3 w-3 text-teal-500" />
        Reasoning ({steps.length} steps)
        <ChevronDown
          className={`ml-auto h-3 w-3 transition ${collapsed ? "" : "rotate-180"}`}
        />
      </button>
      {!collapsed && (
        <div className="mt-2 space-y-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {step.status === "active" ? (
                <Loader2 className={`h-3 w-3 animate-spin ${T.reasoningActive}`} />
              ) : step.status === "done" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : step.status === "error" ? (
                <XCircle className="h-3 w-3 text-red-500" />
              ) : (
                <div className={T.reasoningDot} />
              )}
              <span
                className={
                  step.status === "active"
                    ? T.reasoningActive
                    : step.status === "done"
                    ? T.reasoningDone
                    : T.reasoningPending
                }
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
