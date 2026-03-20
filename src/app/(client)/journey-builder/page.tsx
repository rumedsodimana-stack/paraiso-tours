import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAppSettings } from "@/lib/app-config";
import { getAiRuntimeStatus } from "@/lib/ai";
import { getHotels, getPackagesForClient } from "@/lib/db";
import { JourneyPlanner } from "./JourneyPlanner";

export default async function JourneyBuilderPage() {
  const [hotels, packages, settings, aiRuntime] = await Promise.all([
    getHotels(),
    getPackagesForClient(),
    getAppSettings(),
    getAiRuntimeStatus(),
  ]);

  return (
    <div className="space-y-8 pb-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 backdrop-blur-sm transition hover:text-[#12343b]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to client portal
      </Link>

      <JourneyPlanner
        hotels={hotels}
        packages={packages}
        guidanceFee={settings.portal.customJourneyGuidanceFee}
        guidanceLabel={settings.portal.customJourneyGuidanceLabel}
        aiConciergeEnabled={
          settings.ai.clientConciergeEnabled &&
          aiRuntime.enabled &&
          aiRuntime.configured
        }
      />
    </div>
  );
}
