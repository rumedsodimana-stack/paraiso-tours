import { getTours } from "@/lib/db";
import { CalendarView } from "./CalendarView";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
}) {
  const allTours = await getTours();
  const tours = allTours.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const saved = params?.saved === "1";
  return (
    <div className="space-y-6">
      {saved && <SaveSuccessBanner message="Tour scheduled successfully" />}
      <div>
        <h1 className="text-2xl font-bold text-[#11272b]">Scheduled Tours</h1>
        <p className="mt-1 text-sm text-[#5e7279]">
          Active tour schedules. Click a tour to view full itinerary and mark as completed.
        </p>
      </div>
      <CalendarView tours={tours} />
    </div>
  );
}
