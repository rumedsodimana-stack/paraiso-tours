"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

const CITIES: { name: string; timeZone: string; flag: string }[] = [
  { name: "Colombo", timeZone: "Asia/Colombo", flag: "🇱🇰" },
  { name: "London", timeZone: "Europe/London", flag: "🇬🇧" },
  { name: "Dubai", timeZone: "Asia/Dubai", flag: "🇦🇪" },
  { name: "Singapore", timeZone: "Asia/Singapore", flag: "🇸🇬" },
  { name: "New York", timeZone: "America/New_York", flag: "🇺🇸" },
  { name: "Frankfurt", timeZone: "Europe/Berlin", flag: "🇩🇪" },
];

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDateShort(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function WorldClockWidget() {
  const [now, setNow] = useState<Date | null>(() => new Date());

  useEffect(() => {
    const tid = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tid);
  }, []);

  // Render placeholder until mounted to avoid hydration mismatch
  if (!now) {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/40 p-5 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
        <div className="flex items-center gap-2 pb-3 border-b border-white/30">
          <Clock className="h-5 w-5 text-teal-600" />
          <h3 className="font-semibold text-slate-900">World Clock</h3>
        </div>
        <div className="mt-4 space-y-3">
          {CITIES.map(({ name, timeZone, flag }) => (
            <div key={timeZone} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{flag}</span>
                <div>
                  <p className="font-medium text-slate-900">{name}</p>
                  <p className="text-xs text-slate-500">—</p>
                </div>
              </div>
              <span className="font-mono font-semibold text-slate-800 tabular-nums">--:--:--</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/20 bg-white/40 p-5 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
      <div className="flex items-center gap-2 pb-3 border-b border-white/30">
        <Clock className="h-5 w-5 text-teal-600" />
        <h3 className="font-semibold text-slate-900">World Clock</h3>
      </div>
      <div className="mt-4 space-y-3">
        {CITIES.map(({ name, timeZone, flag }) => (
          <div
            key={timeZone}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{flag}</span>
              <div>
                <p className="font-medium text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">
                  {formatDateShort(now, timeZone)}
                </p>
              </div>
            </div>
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              {formatTime(now, timeZone)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
