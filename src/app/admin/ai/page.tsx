import Link from "next/link";
import { Bot, CheckCircle2, Clock, Database, Mail, MessageCircle, Sparkles, XCircle, Zap } from "lucide-react";
import { getAiRuntimeStatus } from "@/lib/ai";
import { getAiInteractions, getAiKnowledgeDocuments } from "@/lib/db";
import { AgentSurface } from "./AgentSurface";
import { ApprovalQueuePanel } from "./ApprovalQueuePanel";

export const dynamic = "force-dynamic";

interface ConnectorStatus {
  id: string;
  label: string;
  description: string;
  connected: boolean;
  icon: React.ElementType;
}

function getConnectors(runtime: {
  configured: boolean;
  enabled: boolean;
  providerLabel: string;
}): ConnectorStatus[] {
  return [
    {
      id: "ai",
      label: runtime.providerLabel || "AI Provider",
      description: "Powers agent reasoning + tool proposals",
      connected: runtime.configured && runtime.enabled,
      icon: Sparkles,
    },
    {
      id: "email",
      label: "Email (Resend)",
      description: "Guest + supplier email dispatch",
      connected: !!process.env.RESEND_API_KEY?.trim(),
      icon: Mail,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      description: "Meta Cloud API (outbound messages)",
      connected: !!(
        process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      ),
      icon: MessageCircle,
    },
    {
      id: "database",
      label: "Supabase",
      description: "Primary data store",
      connected: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ),
      icon: Database,
    },
  ];
}

function timeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return iso;
  }
}

export default async function AdminAiPage() {
  const [runtime, knowledgeDocuments, interactions] = await Promise.all([
    getAiRuntimeStatus(),
    getAiKnowledgeDocuments(),
    getAiInteractions(8),
  ]);

  const connectors = getConnectors(runtime);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <Bot className="h-6 w-6 text-[#12343b]" />
          AI Workspace
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          One chat controls the whole app. The agent observes your context,
          auto-executes reads, creates, edits, and sends, and only pauses for
          your approval before deleting anything.
        </p>
      </div>

      {/* Runtime warning if AI is disabled / unconfigured */}
      {(!runtime.enabled || !runtime.configured) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">AI is not ready yet</p>
          <p className="mt-1 leading-6">
            {runtime.missingReason ||
              "Open Settings → AI to enable the provider and add an API key."}
          </p>
          <Link
            href="/admin/settings?section=ai"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#12343b] px-4 py-2 text-xs font-semibold text-[#f6ead6] transition hover:bg-[#1a474f]"
          >
            Open AI settings
          </Link>
        </div>
      )}

      {/* Agent chat — the main surface */}
      <AgentSurface />

      {/* Pending approvals — bookings + agent edits awaiting sign-off */}
      <ApprovalQueuePanel />

      {/* Diagnostics panel — connectors + recent interactions + knowledge */}
      <section className="paraiso-card rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#c9922f]" />
          <h2 className="text-lg font-semibold text-[#11272b]">
            Workspace diagnostics
          </h2>
          <span className="ml-auto text-xs text-[#8a9ba1]">
            {connectors.filter((c) => c.connected).length}/{connectors.length} connectors online
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {connectors.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.id}
                className={`rounded-xl border px-4 py-3 ${
                  c.connected
                    ? "border-[#dce8dc] bg-[#ebf4ea]"
                    : "border-[#eed9cf] bg-[#fdf2ee]"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      c.connected ? "text-[#375a3f]" : "text-[#7c3a24]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-semibold text-[#11272b]">
                      {c.label}
                      {c.connected ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#375a3f]" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-[#7c3a24]" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-[#5e7279]">
                      {c.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Recent AI interactions */}
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#8a9ba1]">
              Recent AI interactions
            </h3>
            {interactions.length === 0 ? (
              <p className="text-sm text-[#5e7279]">
                No interactions yet. Chat above to get started.
              </p>
            ) : (
              <ul className="space-y-2">
                {interactions.slice(0, 6).map((i) => (
                  <li
                    key={i.id}
                    className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#eef4f4] px-2 py-0.5 font-semibold text-[#12343b]">
                        {i.tool}
                      </span>
                      <span className="text-[#8a9ba1]">
                        <Clock className="inline h-3 w-3 mr-0.5" />
                        {timeAgo(i.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#11272b]">
                      {(i.requestText ?? "").slice(0, 120)}
                      {(i.requestText ?? "").length > 120 ? "…" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Knowledge base */}
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[#8a9ba1]">
              Knowledge documents ({knowledgeDocuments.length})
            </h3>
            {knowledgeDocuments.length === 0 ? (
              <p className="text-sm text-[#5e7279]">
                Nothing curated yet. Promote useful AI responses into knowledge
                as you go.
              </p>
            ) : (
              <ul className="space-y-2">
                {knowledgeDocuments.slice(0, 6).map((k) => (
                  <li
                    key={k.id}
                    className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-[#11272b]">{k.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#5e7279]">
                      {(k.content ?? "").slice(0, 120)}
                      {(k.content ?? "").length > 120 ? "…" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
