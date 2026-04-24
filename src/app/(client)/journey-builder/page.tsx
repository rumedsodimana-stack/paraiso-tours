import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getAppSettings } from "@/lib/app-config";
import { getAiRuntimeStatus } from "@/lib/ai";
import { getAllMealPlans, getHotels, getPackagesForClient } from "@/lib/db";
import type { HotelMealPlan } from "@/lib/types";
import { JourneyPlanner } from "./JourneyPlanner";

/**
 * Journey-builder shell.
 *
 * The multi-step wizard inside <JourneyPlanner> owns its own state
 * machinery and now shares the same viewport-fit WizardShell +
 * WizardPriceBar scaffold as the package booking flow. This page
 * provides the compact header strip (back link, eyebrow, title) and
 * cancels the (client) layout's outer padding with negative margins so
 * the wizard owns the 100svh viewport.
 */
export default async function JourneyBuilderPage() {
  const [hotels, packages, settings, aiRuntime, allMealPlans] = await Promise.all([
    getHotels(),
    getPackagesForClient(),
    getAppSettings(),
    getAiRuntimeStatus(),
    // Pull the full meal-plan catalog and group by hotelId so the planner
    // can render the right plans the moment a guest picks a day's hotel.
    // Same shape the booking wizard consumes — keeps behaviour consistent
    // across both flows (booking form and journey-builder) per the
    // "meal plan pops up the same step as the hotel" directive.
    getAllMealPlans(),
  ]);

  const mealPlansByHotelId: Record<string, HotelMealPlan[]> = {};
  for (const mp of allMealPlans) {
    if (!mp.active) continue;
    (mealPlansByHotelId[mp.hotelId] ??= []).push(mp);
  }

  return (
    <div className="-mx-4 -my-8 sm:-mx-6 sm:-my-12">
      <div className="border-b border-[var(--portal-border)]/60 bg-[var(--portal-paper)]/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:text-[var(--portal-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--portal-eyebrow)]">
              Custom journey
            </p>
            <h1 className="portal-display truncate text-base font-semibold tracking-tight text-[var(--portal-ink)] sm:text-lg">
              Build my own trip
            </h1>
          </div>
          <span className="hidden items-center gap-1 rounded-full border border-[var(--portal-border)] bg-white/70 px-2.5 py-1 text-xs text-[var(--portal-gold-deep)] sm:inline-flex">
            <Sparkles className="h-3 w-3" />
            Day-by-day
          </span>
        </div>
      </div>

      <JourneyPlanner
        hotels={hotels}
        packages={packages}
        mealPlansByHotelId={mealPlansByHotelId}
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
