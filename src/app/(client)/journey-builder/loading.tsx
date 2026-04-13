export default function Loading() {
  return (
    <div className="space-y-8 pb-10 animate-pulse">
      {/* Back link skeleton */}
      <div className="h-10 w-52 rounded-full border border-[#ddc8b0] bg-white/70" />

      {/* Journey planner skeleton */}
      <div className="space-y-6">
        {/* Header / step indicator */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-stone-200" />
          <div className="h-6 w-48 rounded bg-stone-200" />
        </div>

        {/* Map area */}
        <div className="h-72 rounded-2xl bg-stone-200" />

        {/* Day planner cards */}
        <div className="h-12 w-64 rounded-xl bg-stone-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-[#ddc8b0] bg-white/70 p-5">
            <div className="h-5 w-24 rounded bg-stone-200" />
            <div className="h-32 rounded-xl bg-stone-200/60" />
            <div className="h-10 rounded-xl bg-stone-200/40" />
          </div>
          <div className="space-y-3 rounded-2xl border border-[#ddc8b0] bg-white/70 p-5">
            <div className="h-5 w-24 rounded bg-stone-200" />
            <div className="h-32 rounded-xl bg-stone-200/60" />
            <div className="h-10 rounded-xl bg-stone-200/40" />
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex justify-end gap-3">
          <div className="h-11 w-28 rounded-full bg-stone-200" />
          <div className="h-11 w-36 rounded-full bg-stone-300" />
        </div>
      </div>
    </div>
  );
}
