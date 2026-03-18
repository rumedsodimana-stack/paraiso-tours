import Link from "next/link";
import { Plus } from "lucide-react";
import { getTours } from "@/lib/db";
import { CalendarView } from "./CalendarView";

export default async function CalendarPage() {
  const tours = await getTours();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Tour Calendar
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Manage tour schedules and movements
          </p>
        </div>
        <Link
          href="/tours/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Create Tour
        </Link>
      </div>
      <CalendarView tours={tours} />
    </div>
  );
}
