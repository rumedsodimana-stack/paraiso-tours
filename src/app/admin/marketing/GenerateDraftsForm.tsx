"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { generateSocialPostDraftsAction } from "@/app/actions/marketing";

type Platform = "instagram" | "facebook" | "x" | "linkedin";
type TargetKind = "package" | "destination" | "tour" | "generic";

interface SelectOption {
  id: string;
  name?: string;
  label?: string;
}

interface Props {
  packages: { id: string; name: string }[];
  destinations: { id: string; name: string }[];
  tours: { id: string; label: string }[];
}

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram 📸",
  facebook: "Facebook 📘",
  x: "X 𝕏",
  linkedin: "LinkedIn 💼",
};

export function GenerateDraftsForm({ packages, destinations, tours }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    "instagram",
    "facebook",
  ]);
  const [targetKind, setTargetKind] = useState<TargetKind>("generic");
  const [targetId, setTargetId] = useState<string>("");
  const [brief, setBrief] = useState("");
  const [countPerPlatform, setCountPerPlatform] = useState(2);

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const targetOptions: SelectOption[] =
    targetKind === "package"
      ? packages
      : targetKind === "destination"
        ? destinations
        : targetKind === "tour"
          ? tours
          : [];

  const requiresTargetId = targetKind !== "generic";
  const targetIdValid = !requiresTargetId || targetId.length > 0;
  const canSubmit =
    selectedPlatforms.length > 0 &&
    targetIdValid &&
    !pending;

  const handleGenerate = () => {
    if (!canSubmit) return;
    setError(null);
    setWarnings([]);
    startTransition(async () => {
      try {
        const r = await generateSocialPostDraftsAction({
          platforms: selectedPlatforms,
          targetKind,
          targetId: targetId || undefined,
          brief: brief.trim() || undefined,
          countPerPlatform,
        });
        if (r.error) {
          setError(r.error);
          return;
        }
        if (r.warnings?.length) setWarnings(r.warnings);
        // Refresh the server-rendered list so new drafts appear.
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't reach the server. Please check your connection and try again."
        );
      }
    });
  };

  return (
    <section className="paraiso-card space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#5e3aa3]" />
        <h2 className="text-lg font-semibold text-[#11272b]">
          Generate post drafts
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
              Platforms
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => {
                const active = selectedPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      active
                        ? "border-[#5e3aa3] bg-[#5e3aa3] text-[#f6ead6]"
                        : "border-[#e0e4dd] bg-[#fffbf4] text-[#5e7279] hover:bg-[#f4ecdd]"
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
                Topic
              </label>
              <select
                value={targetKind}
                onChange={(e) => {
                  setTargetKind(e.target.value as TargetKind);
                  setTargetId("");
                }}
                className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#5e3aa3] focus:outline-none focus:ring-2 focus:ring-[#5e3aa3]/20"
              >
                <option value="generic">Brand / general</option>
                <option value="package">Specific package</option>
                <option value="destination">Destination</option>
                <option value="tour">Recent tour</option>
              </select>
            </div>

            {requiresTargetId && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
                  Pick one
                </label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#5e3aa3] focus:outline-none focus:ring-2 focus:ring-[#5e3aa3]/20"
                >
                  <option value="">Select…</option>
                  {targetOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name ?? opt.label ?? opt.id}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
              Brief (optional)
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. focus on adventure travelers, lean into the cultural depth angle, target corporate retreats…"
              maxLength={1000}
              rows={2}
              className="w-full resize-y rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#5e3aa3] focus:outline-none focus:ring-2 focus:ring-[#5e3aa3]/20"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#8a9ba1]">
              Per platform
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={countPerPlatform}
              onChange={(e) =>
                setCountPerPlatform(
                  Math.max(1, Math.min(5, Number(e.target.value) || 2))
                )
              }
              className="w-16 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#5e3aa3] focus:outline-none focus:ring-2 focus:ring-[#5e3aa3]/20"
            />
            <span className="text-xs text-[#8a9ba1]">
              ({selectedPlatforms.length * countPerPlatform} total drafts)
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end justify-end gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-[#5e3aa3] px-5 py-3 text-sm font-bold text-[#f6ead6] transition hover:bg-[#4a2e83] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {pending ? "Drafting…" : "Generate"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {warnings.map((w, i) => (
            <li key={i}>· {w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
