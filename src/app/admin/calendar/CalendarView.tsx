"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, MapPin, Users } from "lucide-react";
import type { Tour } from "@/lib/types";

const statusColors: Record<Tour["status"], string> = {
  scheduled: "bg-sky-100 text-sky-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-amber-100 text-amber-800",
  completed: "bg-stone-100 text-stone-600",
  cancelled: "bg-red-100 text-red-800",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView({ tours }: { tours: Tour[] }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getToursForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tours.filter(
      (t) =>
        t.startDate === dateStr ||
        t.endDate === dateStr ||
        (t.startDate <= dateStr && t.endDate >= dateStr)
    );
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));

  const today = new Date().toISOString().slice(0, 10);
  const upcomingTours = tours
    .filter((t) => t.status !== "cancelled" && t.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/40 shadow-xl shadow-stone-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/40">
        <button
          type="button"
          onClick={() => setCalendarOpen(!calendarOpen)}
          className="flex w-full items-center justify-between border-b border-white/20 px-6 py-4 text-left dark:border-white/10 hover:bg-white/30 dark:hover:bg-stone-800/30 transition-colors"
        >
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
            Calendar — {MONTHS[month]} {year}
          </h2>
          {calendarOpen ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-stone-500" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-stone-500" />
          )}
        </button>

        {calendarOpen && (
          <>
            <div className="flex items-center justify-end gap-2 border-b border-white/20 px-6 py-2 dark:border-white/10">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prevMonth(); }}
                className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-700 dark:hover:text-stone-300"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); nextMonth(); }}
                className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-700 dark:hover:text-stone-300"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-7 gap-px rounded-lg bg-white/30 dark:bg-stone-800/50">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-white/60 px-2 py-2 text-center text-xs font-medium text-stone-600 backdrop-blur-sm dark:bg-stone-800/60 dark:text-stone-400"
              >
                {day}
              </div>
            ))}
            {calendarDays.map((day, i) => (
              <div
                key={i}
                className="min-h-[100px] bg-white/50 p-2 backdrop-blur-sm dark:bg-stone-800/30"
              >
                {day !== null ? (
                  <>
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                      {day}
                    </span>
                    <div className="mt-1 space-y-1">
                      {getToursForDate(day).map((tour) => (
                        <Link
                          key={tour.id}
                          href={`/admin/tours/${tour.id}`}
                          className="block rounded border-l-4 border-teal-500 bg-teal-400/20 px-2 py-1 text-xs backdrop-blur-sm dark:bg-teal-500/20 transition hover:bg-teal-400/30 dark:hover:bg-teal-500/30"
                        >
                          <div className="font-medium text-stone-900 dark:text-stone-100">
                            {tour.clientName}
                          </div>
                          <div className="text-stone-600 dark:text-stone-400">
                            {tour.packageName}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
          </>
        )}
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-stone-700 dark:text-stone-300">
          Upcoming Tours
        </h3>
        <div className="space-y-3">
          {upcomingTours.length === 0 ? (
            <p className="text-stone-500">No upcoming tours</p>
          ) : (
            upcomingTours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function TourCard({ tour }: { tour: Tour }) {
  return (
    <Link
      href={`/admin/tours/${tour.id}`}
      className="flex flex-col gap-4 rounded-2xl border border-white/20 bg-white/40 p-4 shadow-lg shadow-stone-900/5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-stone-900/40 transition hover:bg-white/50 dark:hover:bg-stone-800/50"
    >
      <div>
        <h4 className="font-semibold text-stone-900 dark:text-stone-50">
          {tour.packageName}
        </h4>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {tour.clientName}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {tour.startDate} → {tour.endDate}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {tour.pax} pax
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[tour.status]}`}
        >
          {tour.status}
        </span>
        <span className="font-medium text-teal-600 dark:text-teal-400">
          {tour.totalValue.toLocaleString()} {tour.currency}
        </span>
      </div>
    </Link>
  );
}
