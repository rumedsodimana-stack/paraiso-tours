import Link from "next/link";
import { Compass, Plus, Pencil, Trash2 } from "lucide-react";
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

  // Group activities by destination
  const grouped = new Map<string, typeof activities>();
  for (const act of activities) {
    const key = act.destinationId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(act);
  }

  const energyBadge = (energy: string) => {
    switch (energy) {
      case "active":
        return "bg-orange-100 text-orange-700";
      case "moderate":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-emerald-100 text-emerald-700";
    }
  };

  return (
    <div className="space-y-6">
      {deleted === "1" && (
        <SaveSuccessBanner message="Activity archived successfully" />
      )}
      {created === "1" && (
        <SaveSuccessBanner message="Activity created successfully" />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Planner Activities
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Manage activities for the trip builder destinations
          </p>
        </div>
        <Link
          href="/admin/activities/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Add Activity
        </Link>
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/40 bg-white/30 py-16 backdrop-blur-xl">
          <Compass className="h-12 w-12 text-stone-400" />
          <p className="mt-4 text-stone-600 dark:text-stone-400">
            No activities yet. Add your first activity for the trip builder.
          </p>
          <Link
            href="/admin/activities/new"
            className="mt-4 font-medium text-teal-600 hover:text-teal-700"
          >
            Add Activity
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([destId, acts]) => (
            <section key={destId}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-stone-800 dark:text-stone-100">
                <Compass className="h-5 w-5" />
                {destMap.get(destId) ?? destId}
              </h2>
              <div className="overflow-hidden rounded-xl border border-white/30 bg-white/50 shadow-sm backdrop-blur-sm">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead>
                    <tr className="bg-stone-50/80">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Energy
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {acts.map((act) => (
                      <tr
                        key={act.id}
                        className="transition hover:bg-white/70"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-stone-900">
                            {act.title}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500 line-clamp-1">
                            {act.summary}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600">
                          {act.durationLabel}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${energyBadge(act.energy)}`}
                          >
                            {act.energy}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-stone-700">
                          {act.estimatedPrice > 0
                            ? `$${act.estimatedPrice.toLocaleString()}`
                            : "Free"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/activities/${act.id}/edit`}
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:border-teal-300 hover:text-teal-700"
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
