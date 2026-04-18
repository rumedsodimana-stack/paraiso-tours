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
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Activities
      </Link>
      <div className="paraiso-card rounded-2xl p-6">
        <h1 className="mb-6 text-xl font-semibold text-[#11272b]">
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
