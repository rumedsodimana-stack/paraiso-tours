"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, MapPin, Users } from "lucide-react";
import type { Tour } from "@/lib/types";

const statusBadge: Record<Tour["status"], string> = {
  scheduled:     "bg-[#f3e8ce] text-[#7a5a17]",
  confirmed:     "bg-[#dce8dc] text-[#375a3f]",
  "in-progress": "bg-[#d6e2e5] text-[#294b55]",
  completed:     "bg-[#e2e3dd] text-[#545a54]",
  cancelled:     "bg-[#eed9cf] text-[#7c3a24]",
};

const statusLabel: Record<Tour["status"], string> = {
  scheduled:     "Tour Scheduled",
  confirmed:     "Confirmed",
  "in-progress": "In Progress",
  completed:     "Completed",
  cancelled:     "Cancelled",
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
      <div className="paraiso-card overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => setCalendarOpen(!calendarOpen)}
          className="flex w-full items-center justify-between border-b border-[#e0e4dd] px-6 py-4 text-left hover:bg-[#f4ecdd] transition-colors"
        >
          <h2 className="text-lg font-semibold text-[#11272b]">
            Calendar — {MONTHS[month]} {year}
          </h2>
          {calendarOpen ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-[#8a9ba1]" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-[#8a9ba1]" />
          )}
        </button>

        {calendarOpen && (
          <>
            <div className="flex items-center justify-end gap-2 border-b border-[#e0e4dd] px-6 py-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prevMonth(); }}
                className="rounded-lg p-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); nextMonth(); }}
                className="rounded-lg p-2 text-[#5e7279] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-7 gap-px bg-[#e0e4dd] rounded-xl overflow-hidden">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="bg-[#f4ecdd] px-2 py-2 text-center text-xs font-semibold text-[#8a9ba1]"
                  >
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, i) => (
                  <div
                    key={i}
                    className="min-h-[100px] bg-[#fffbf4] p-2"
                  >
                    {day !== null ? (
                      <>
                        <span className="text-sm font-medium text-[#5e7279]">{day}</span>
                        <div className="mt-1 space-y-1">
                          {getToursForDate(day).map((tour) => (
                            <Link
                              key={tour.id}
                              href={`/admin/tours/${tour.id}`}
                              className="block rounded-lg border-l-2 border-[#12343b] bg-[#eef4f4] px-2 py-1 text-xs transition hover:bg-[#d6e2e5]"
                            >
                              <div className="font-medium text-[#11272b]">{tour.clientName}</div>
                              <div className="text-[#5e7279]">{tour.packageName}</div>
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
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
          Upcoming Tours ({upcomingTours.length})
        </h3>
        <div className="space-y-3">
          {upcomingTours.length === 0 ? (
            <p className="text-sm text-[#8a9ba1]">No upcoming tours</p>
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
      className="paraiso-card flex flex-col gap-4 rounded-2xl p-5 transition hover:bg-[#f4ecdd] sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-bold text-[#11272b]">{tour.packageName}</h4>
          {tour.confirmationId && (
            <span className="rounded bg-[#eef4f4] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#12343b] ring-1 ring-[#d6e2e5]">
              {tour.confirmationId}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-[#5e7279]">{tour.clientName}</p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#8a9ba1]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {tour.startDate} → {tour.endDate}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {tour.pax} pax
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[tour.status]}`}>
          {statusLabel[tour.status]}
        </span>
        <span className="font-bold text-[#12343b]">
          {tour.totalValue.toLocaleString()} {tour.currency}
        </span>
      </div>
    </Link>
  );
}
