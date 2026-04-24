import type { ReactNode } from "react";

export type StatItem = {
  label: string;
  value: ReactNode;
  hint?: string;
};

/**
 * StatRow — the three-up stat tile pattern used in the hero, in package
 * detail ("7 days · 6 nights · From $1,840"), and in the booking view
 * ("Total · Travel date · Travellers").
 *
 * Tones:
 *   "dark"  : white/translucent on dark hero imagery (default)
 *   "light" : paper on cream, editorial
 *   "bare"  : <dl> without card chrome (for data-dense contexts)
 */
export function StatRow({
  stats,
  tone = "dark",
  className = "",
}: {
  stats: StatItem[];
  tone?: "dark" | "light" | "bare";
  className?: string;
}) {
  if (tone === "bare") {
    return (
      <dl
        className={`grid grid-cols-2 gap-6 border-t border-[var(--portal-border)]/60 pt-6 sm:grid-cols-${Math.min(
          stats.length,
          4
        )} ${className}`.trim()}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] uppercase tracking-wide text-stone-500">
              {s.label}
            </dt>
            <dd className="mt-1 text-xl font-semibold tracking-tight text-stone-900">
              {s.value}
            </dd>
            {s.hint ? (
              <p className="mt-1 text-xs text-stone-500">{s.hint}</p>
            ) : null}
          </div>
        ))}
      </dl>
    );
  }

  const tile =
    tone === "dark"
      ? "border border-white/12 bg-white/8 text-white backdrop-blur-md"
      : "border border-[var(--portal-border)]/60 bg-[var(--portal-paper)] text-stone-900";
  const labelTone =
    tone === "dark" ? "text-[var(--portal-gold)]" : "text-[var(--portal-eyebrow)]";
  const valueTone = tone === "dark" ? "text-white" : "text-stone-900";

  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${className}`.trim()}>
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-[var(--portal-radius-md)] px-5 py-4 ${tile}`}
        >
          <p
            className={`text-[11px] font-medium uppercase tracking-[0.28em] ${labelTone}`}
          >
            {s.label}
          </p>
          <p
            className={`portal-display mt-2 text-xl font-semibold sm:text-2xl ${valueTone}`}
          >
            {s.value}
          </p>
          {s.hint ? (
            <p
              className={`mt-1 text-xs ${
                tone === "dark"
                  ? "text-[var(--portal-sand-warm)]/80"
                  : "text-stone-500"
              }`}
            >
              {s.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
