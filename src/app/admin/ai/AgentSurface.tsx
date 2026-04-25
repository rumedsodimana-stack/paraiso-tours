"use client";

/**
 * /admin/ai canonical surface.
 *
 * Thin wrapper around `<AgentConversation />` — the shared
 * conversation component. The right-side floating drawer
 * (`<GlobalAdminAiChat />`) renders the same component, so the
 * experience is identical regardless of where the admin opens it.
 *
 * Workspace context (current view, focused entity, recent items) and
 * memory writes flow inline into the conversation as `role: "system"`
 * pills, so this surface no longer needs a parallel sidebar. The
 * `<AgentContextWatcher />` mounted in `<AdminShell />` handles
 * context-change pills; `useAgentLoop` handles memory pills.
 *
 * Deep-linkable seed:
 *   /admin/ai?seed=<urlencoded prompt>
 *   The "AI brief" buttons on detail pages use this so clicking from a
 *   booking lands here with the prompt pre-filled. The user just hits
 *   Enter — Cowork-style "act, don't ask".
 */

import { useSearchParams } from "next/navigation";
import { AgentConversation } from "@/components/agent/AgentConversation";
import { type AgentProposal } from "@/stores/ai-agent.store";

export function AgentSurface() {
  const searchParams = useSearchParams();
  const seed = searchParams.get("seed") ?? undefined;

  return (
    <div className="mx-auto w-full max-w-3xl h-[calc(100vh-14rem)] min-h-[560px] max-h-[820px]">
      <AgentConversation
        pageContext={{
          path: "/admin/ai",
          label: "AI Workspace",
          details: [
            "Current admin page path: /admin/ai",
            "Current page type: AI workspace",
          ],
        }}
        initialDraft={seed}
      />
    </div>
  );
}

// Re-exported for any external callers still importing the type from here.
export type { AgentProposal };
