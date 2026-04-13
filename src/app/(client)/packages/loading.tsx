export default function Loading() {
  return (
    <div className="space-y-8 pb-10 animate-pulse">
      {/* Hero banner skeleton */}
      <div className="rounded-[2rem] border border-white/20 bg-stone-200 p-6 sm:p-8 lg:p-10">
        <div className="h-3 w-28 rounded bg-stone-300" />
        <div className="mt-3 h-10 w-3/4 rounded bg-stone-300" />
        <div className="mt-4 h-4 w-1/2 rounded bg-stone-300/60" />
        <div className="mt-6 h-14 rounded-[1.25rem] bg-stone-300/40" />
        <div className="mt-6 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-24 rounded-full bg-stone-300/50" />
          ))}
        </div>
      </div>

      {/* Destination highlights skeleton */}
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[1.6rem] border border-[#ddc8b0] bg-white/70"
          >
            <div className="aspect-[5/4] bg-stone-200" />
            <div className="p-5">
              <div className="h-3 w-20 rounded bg-stone-200" />
              <div className="mt-2 h-6 w-3/4 rounded bg-stone-200" />
            </div>
          </div>
        ))}
      </div>

      {/* Package cards skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="min-h-[26rem] rounded-[2rem] border border-white/25 bg-stone-200 p-6 sm:p-8"
          >
            <div className="h-3 w-24 rounded bg-stone-300" />
            <div className="mt-3 h-8 w-2/3 rounded bg-stone-300" />
            <div className="mt-4 flex gap-4">
              <div className="h-4 w-20 rounded bg-stone-300/60" />
              <div className="h-4 w-16 rounded bg-stone-300/60" />
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-4 w-full rounded bg-stone-300/40" />
              <div className="h-4 w-5/6 rounded bg-stone-300/40" />
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-7 w-20 rounded-full bg-stone-300/50" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
