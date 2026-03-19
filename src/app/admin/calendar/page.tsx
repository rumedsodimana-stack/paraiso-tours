import Link from "next/link";
import { Plus } from "lucide-react";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Scheduled Tours
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Manage tour schedules and movements
          </p>
        </div>
        <Link
          href="/admin/tours/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Schedule Tour
        </Link>
      </div>
      <CalendarView tours={tours} />
    </div>
  );
}
