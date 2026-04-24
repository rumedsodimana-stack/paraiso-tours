/**
 * Journey-builder loading skeleton — mirrors the real shell so the
 * transition into the wizard feels quiet instead of jarring.
 */
export default function Loading() {
  return (
    <div className="space-y-8 pb-10 animate-pulse">
      {/* Back link skeleton */}
      <div className="h-5 w-48 rounded bg-stone-200/70" />

      {/* Header / step indicator */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-stone-200" />
        <div className="h-6 w-48 rounded bg-stone-200" />
      </div>

      {/* Map area */}
      <div className="h-72 rounded-[var(--portal-radius-lg)] border border-[var(--portal-border)]/60 bg-stone-200/70" />

      {/* Day planner cards */}
      <div className="h-10 w-64 rounded-full bg-stone-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-[var(--portal-radius-lg)] border border-[var(--portal-border)]/60 bg-[var(--portal-paper)] p-6">
          <div className="h-5 w-24 rounded bg-stone-200" />
          <div className="h-32 rounded-[var(--portal-radius-md)] bg-stone-200/60" />
          <div className="h-10 rounded-full bg-stone-200/40" />
        </div>
        <div className="space-y-3 rounded-[var(--portal-radius-lg)] border border-[var(--portal-border)]/60 bg-[var(--portal-paper)] p-6">
          <div className="h-5 w-24 rounded bg-stone-200" />
          <div className="h-32 rounded-[var(--portal-radius-md)] bg-stone-200/60" />
          <div className="h-10 rounded-full bg-stone-200/40" />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex justify-end gap-3">
        <div className="h-11 w-28 rounded-full bg-stone-200" />
        <div className="h-11 w-36 rounded-full bg-stone-300" />
      </div>
    </div>
  );
}
