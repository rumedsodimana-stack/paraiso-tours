import Link from "next/link";
import { Bot } from "lucide-react";
import { getAiRuntimeStatus } from "@/lib/ai";
import { AgentSurface } from "./AgentSurface";
import { ApprovalQueuePanel } from "./ApprovalQueuePanel";

export const dynamic = "force-dynamic";

/**
 * /admin/ai — AI Workspace
 *
 * Three sections, in this order:
 *   1. Title + setup banner (only if AI is not configured).
 *   2. <AgentSurface /> — the chat. This IS the workspace.
 *   3. <ApprovalQueuePanel /> — bookings still waiting for sign-off.
 *
 * Everything else (connector health, knowledge base, interaction log) lives
 * in /admin/settings → AI. Keeping this page focused on what the admin
 * actually does here (chat + approve) instead of decorating the chat with
 * dashboards.
 */
export default async function AdminAiPage() {
  const runtime = await getAiRuntimeStatus();
  const setupReady = runtime.enabled && runtime.configured;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <Bot className="h-6 w-6 text-[#12343b]" />
          AI Workspace
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          One chat controls the whole app. The agent observes your context,
          auto-runs reads, creates, edits, and sends, and only pauses for
          your approval before deleting anything.
        </p>
      </div>

      {!setupReady && (
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

      <AgentSurface />

      <ApprovalQueuePanel />
    </div>
  );
}
