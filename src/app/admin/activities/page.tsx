import Link from "next/link";
import { Compass, Plus, Pencil } from "lucide-react";
import { getPlannerActivityRecords } from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";
import { SaveSuccessBanner } from "../SaveSuccessBanner";
import { DeleteActivityButton } from "./DeleteActivityButton";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ deleted?: string; created?: string }>;
}) {
  const { deleted, created } = searchParams ? await searchParams : {};
  const [activities, destinations] = await Promise.all([
    getPlannerActivityRecords(),
    Promise.resolve(getPlannerDestinations()),
  ]);

  const destMap = new Map<string, string>(
    destinations.map((d) => [d.id, d.name])
  );

  const grouped = new Map<string, typeof activities>();
  for (const act of activities) {
    const key = act.destinationId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(act);
  }

  function energyBadge(energy: string) {
    switch (energy) {
      case "active":   return "bg-[#eed9cf] text-[#7c3a24]";
      case "moderate": return "bg-[#f3e8ce] text-[#7a5a17]";
      default:         return "bg-[#dce8dc] text-[#375a3f]";
    }
  }

  return (
    <div className="space-y-6">
      {deleted === "1" && <SaveSuccessBanner message="Activity archived successfully" />}
      {created === "1" && <SaveSuccessBanner message="Activity created successfully" />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Planner Activities</h1>
          <p className="mt-1 text-sm text-[#5e7279]">
            Manage activities for the trip builder destinations
          </p>
        </div>
        <Link
          href="/admin/activities/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          <Plus className="h-4 w-4" />
          Add Activity
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] py-16">
          <Compass className="h-10 w-10 text-[#8a9ba1]" />
          <p className="mt-4 text-[#5e7279]">
            No activities yet. Add your first activity for the trip builder.
          </p>
          <Link href="/admin/activities/new" className="mt-4 font-medium text-[#12343b] hover:underline">
            Add Activity
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([destId, acts]) => (
            <section key={destId}>
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#11272b]">
                <Compass className="h-4 w-4 text-[#8a9ba1]" />
                {destMap.get(destId) ?? destId}
              </h2>
              <div className="paraiso-card rounded-2xl overflow-hidden">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Title</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Duration</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Energy</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Price</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e0e4dd]">
                    {acts.map((act) => (
                      <tr key={act.id} className="transition hover:bg-[#faf6ef]">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-[#11272b]">{act.title}</p>
                          <p className="mt-0.5 text-xs text-[#8a9ba1] line-clamp-1">{act.summary}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-[#5e7279]">{act.durationLabel}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${energyBadge(act.energy)}`}>
                            {act.energy}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-medium text-[#11272b]">
                          {act.estimatedPrice > 0 ? `$${act.estimatedPrice.toLocaleString()}` : "Free"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/activities/${act.id}/edit`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Link>
                            <DeleteActivityButton activityId={act.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
