import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPlannerActivityRecords } from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";
import { updateActivityAction } from "@/app/actions/planner-activities";
import { ActivityForm } from "../../ActivityForm";

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activities = await getPlannerActivityRecords();
  const activity = activities.find((a) => a.id === id);

  if (!activity) notFound();

  const destinations = getPlannerDestinations().filter(
    (d) => d.id !== "airport"
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/activities"
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-stone-600 transition hover:bg-white/50 hover:text-stone-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Activities
      </Link>
      <div className="rounded-2xl border border-white/30 bg-white/50 p-6 shadow-lg backdrop-blur-xl">
        <h1 className="mb-6 text-xl font-semibold text-stone-900 dark:text-stone-50">
          Edit Activity
        </h1>
        <ActivityForm
          destinations={destinations.map((d) => ({
            id: d.id,
            name: d.name,
          }))}
          activity={activity}
          updateAction={updateActivityAction}
        />
      </div>
    </div>
  );
}
