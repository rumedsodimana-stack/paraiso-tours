"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing, Database, Sparkles, X } from "lucide-react";
import { APP_RELEASE, APP_RELEASE_STORAGE_KEY } from "@/lib/app-release";

function subscribeToReleaseNotice(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getReleaseNoticeSnapshot() {
  try {
    return window.localStorage.getItem(APP_RELEASE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getReleaseNoticeServerSnapshot() {
  return "1";
}

export function AdminReleaseNotice() {
  const [dismissed, setDismissed] = useState(false);
  const seenValue = useSyncExternalStore(
    subscribeToReleaseNotice,
    getReleaseNoticeSnapshot,
    getReleaseNoticeServerSnapshot
  );
  const visible = !dismissed && seenValue !== "1";

  if (!visible) return null;

  return (
    <section className="mx-6 mt-5 overflow-hidden rounded-[1.8rem] border border-[#d7c29f] bg-[linear-gradient(135deg,rgba(252,247,236,0.98),rgba(255,255,255,0.9))] shadow-[0_24px_50px_-34px_rgba(51,40,16,0.45)]">
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div className="flex min-w-0 gap-4">
          <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#12343b] text-[#f7ead7] shadow-[0_18px_32px_-22px_rgba(18,52,59,0.9)]">
            <BellRing className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d7c29f] bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8c6a38]">
                <Sparkles className="h-3.5 w-3.5" />
                New Release
              </span>
              <span className="rounded-full bg-[#12343b] px-3 py-1 text-xs font-semibold text-[#f6ead6]">
                v{APP_RELEASE.version}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-stone-900">
              {APP_RELEASE.title}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-600">
              {APP_RELEASE.summary}
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-stone-700 lg:grid-cols-3">
              {APP_RELEASE.highlights.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-white/60 bg-white/75 px-4 py-3"
                >
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
              <Database className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{APP_RELEASE.dataNotice}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(APP_RELEASE_STORAGE_KEY, "1");
            } catch {
              // Ignore storage issues and still hide the banner in-session.
            }
            setDismissed(true);
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white hover:text-stone-900"
        >
          <X className="h-4 w-4" />
          Dismiss
        </button>
      </div>
    </section>
  );
}
