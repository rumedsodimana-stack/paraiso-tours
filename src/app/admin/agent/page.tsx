import { Bot } from "lucide-react";
import { AgentSurface } from "./AgentSurface";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <Bot className="h-6 w-6 text-[#12343b]" />
          Agent workspace
        </h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Ask the agent anything about this business. It observes your current
          context, orients using session + long-term memory, decides, and
          proposes actions — no mutation happens without your explicit approval.
        </p>
      </div>
      <AgentSurface />
    </div>
  );
}
