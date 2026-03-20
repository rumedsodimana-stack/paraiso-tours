"use client";

import { Check, Palette } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { defaultThemeId } from "@/components/theme/theme-config";

export function ThemeSelector() {
  const { ready, setTheme, theme, themes } = useTheme();

  return (
    <section className="rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            <Palette className="h-3.5 w-3.5" />
            Appearance
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-stone-900">Theme</h2>
        </div>
        <div className="rounded-2xl border border-white/30 bg-white/60 px-4 py-3 text-sm text-stone-600">
          <span className="font-semibold text-stone-900">{themes.length}</span>{" "}
          themes
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {themes.map((option) => {
          const isActive = option.id === theme;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              className={`group rounded-[1.6rem] border p-3 text-left transition-all ${
                isActive
                  ? "border-teal-400 bg-white/80 shadow-xl shadow-stone-200/50"
                  : "border-white/25 bg-white/45 hover:border-white/40 hover:bg-white/60"
              }`}
            >
              <div
                className="relative h-28 overflow-hidden rounded-[1.2rem] border border-white/30"
                style={{
                  background: `linear-gradient(135deg, ${option.preview[0]} 0%, ${option.preview[1]} 48%, ${option.preview[2]} 100%)`,
                }}
              >
                <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                  <span className="rounded-full border border-white/50 bg-white/75 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-700 backdrop-blur-md">
                    {option.id === defaultThemeId ? "Current Look" : "Theme"}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md ${
                      isActive
                        ? "border-white/60 bg-white/85 text-stone-900"
                        : "border-white/40 bg-white/50 text-transparent"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-2">
                  <span className="h-9 rounded-xl border border-white/40 bg-white/45 backdrop-blur-md" />
                  <span className="h-9 rounded-xl border border-white/40 bg-white/25 backdrop-blur-md" />
                  <span className="h-9 rounded-xl border border-white/40 bg-white/60 backdrop-blur-md" />
                </div>
              </div>

              <div className="mt-4 flex items-start justify-between gap-4">
                <h3 className="text-base font-semibold text-stone-900">
                  {option.name}
                </h3>
                <span className="rounded-full border border-white/30 bg-white/65 px-3 py-1 text-xs font-medium text-stone-500">
                  {isActive ? "Active" : "Apply"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-stone-500">
        {ready
          ? "Theme changes are saved locally for this browser."
          : "Loading your saved theme..."}
      </p>
    </section>
  );
}
