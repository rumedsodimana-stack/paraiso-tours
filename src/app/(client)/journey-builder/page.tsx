import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAppSettings } from "@/lib/app-config";
import { getAiRuntimeStatus } from "@/lib/ai";
import { getHotels, getPackagesForClient } from "@/lib/db";
import { JourneyPlanner } from "./JourneyPlanner";
import { PortalShell } from "../_ui";

/**
 * Journey-builder shell.
 *
 * The multi-step wizard inside <JourneyPlanner> owns its own state
 * machinery and visual language — this file only provides the page
 * wrapper and the back-to-portal affordance. Touching the wizard is
 * explicitly out of scope for the portal redesign.
 */
export default async function JourneyBuilderPage() {
  const [hotels, packages, settings, aiRuntime] = await Promise.all([
    getHotels(),
    getPackagesForClient(),
    getAppSettings(),
    getAiRuntimeStatus(),
  ]);

  return (
    <PortalShell spacing="tight" className="pb-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-[var(--portal-ink)]"
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
    </PortalShell>
  );
}
