import { Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/admin-session";
import { getSocialPostDrafts, getPackages, getTours } from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";
import { GenerateDraftsForm } from "./GenerateDraftsForm";
import { DraftCard } from "./DraftCard";
import { PlatformTabs } from "./PlatformTabs";
import { SuggestTopicsPanel } from "./SuggestTopicsPanel";

export const dynamic = "force-dynamic";

interface MarketingPageProps {
  searchParams?: Promise<{
    platform?: string;
    status?: string;
  }>;
}

export default async function MarketingPage({
  searchParams,
}: MarketingPageProps) {
  await requireAdmin();
  const sp = (await searchParams) ?? {};
  const platformFilter =
    sp.platform === "instagram" ||
    sp.platform === "facebook" ||
    sp.platform === "x" ||
    sp.platform === "linkedin"
      ? sp.platform
      : "all";
  const statusFilter =
    sp.status === "draft" ||
    sp.status === "approved" ||
    sp.status === "posted" ||
    sp.status === "archived"
      ? sp.status
      : "all";

  // Pull everything in parallel: drafts (filtered) + reference data
  // for the generate form's dropdowns. Lookup maps are built so the
  // draft cards can render the human-readable target name without
  // re-fetching per card.
  const [drafts, packages, destinationsRaw, tours] = await Promise.all([
    getSocialPostDrafts({
      platform: platformFilter === "all" ? undefined : platformFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 200,
    }),
    getPackages(),
    Promise.resolve(getPlannerDestinations()),
    getTours(),
  ]);

  const destinations = destinationsRaw.filter((d) => d.id !== "airport");

  // String-keyed maps so we can look up by the SocialPostDraft.targetId
  // (a free-form string) without fighting the PlannerDestinationId
  // union type. The label values are still type-safe.
  const packageById = new Map<string, string>(
    packages.map((p) => [p.id, p.name])
  );
  const destinationById = new Map<string, string>(
    destinations.map((d) => [d.id as string, d.name])
  );
  const tourById = new Map<string, string>(
    tours.map((t) => [t.id, `${t.packageName} (${t.startDate})`])
  );

  function targetLabel(kind: string, id?: string): string {
    if (!id) return kind === "generic" ? "Brand / general" : kind;
    if (kind === "package") return packageById.get(id) ?? "Package";
    if (kind === "destination") return destinationById.get(id) ?? "Destination";
    if (kind === "tour") return tourById.get(id) ?? "Tour";
    return kind;
  }

  // Counts for the platform tabs — computed pre-filter so the tab
  // chip shows the actual total per platform (otherwise filtering
  // to Instagram would zero out the Facebook chip).
  const allDraftsForCounts = await getSocialPostDrafts({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 1000,
  });
  const counts = {
    all: allDraftsForCounts.length,
    instagram: allDraftsForCounts.filter((d) => d.platform === "instagram").length,
    facebook: allDraftsForCounts.filter((d) => d.platform === "facebook").length,
    x: allDraftsForCounts.filter((d) => d.platform === "x").length,
    linkedin: allDraftsForCounts.filter((d) => d.platform === "linkedin").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="flex items-center gap-3 text-2xl font-bold text-[#11272b]">
          <Sparkles className="h-6 w-6 text-[#5e3aa3]" />
          Marketing
        </h1>
        <p className="text-sm text-[#5e7279]">
          AI-drafted social posts. Review, edit, copy-paste into each
          platform's app. Drafts persist between sessions.
        </p>
      </header>

      <SuggestTopicsPanel />

      <GenerateDraftsForm
        packages={packages.map((p) => ({ id: p.id, name: p.name }))}
        destinations={destinations.map((d) => ({
          id: d.id as string,
          name: d.name,
        }))}
        tours={tours.slice(0, 50).map((t) => ({
          id: t.id,
          label: `${t.packageName} (${t.startDate})`,
        }))}
      />

      <PlatformTabs
        platform={platformFilter}
        status={statusFilter}
        counts={counts}
      />

      {drafts.length === 0 ? (
        <div className="paraiso-card flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
          <Sparkles className="h-8 w-8 text-[#8a9ba1]" />
          <p className="text-sm text-[#5e7279]">
            {statusFilter === "all" && platformFilter === "all"
              ? "No drafts yet. Use the form above to generate the first batch."
              : "No drafts match the current filters."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              targetLabel={targetLabel(draft.targetKind, draft.targetId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
