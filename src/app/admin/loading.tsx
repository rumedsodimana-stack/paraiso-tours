export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 w-64 rounded bg-stone-200" />
        <div className="mt-2 h-4 w-96 rounded bg-stone-100" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/20 bg-white/40 p-5 h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/20 bg-white/40 p-5 h-64" />
        <div className="rounded-2xl border border-white/20 bg-white/40 p-5 h-64" />
      </div>
    </div>
  );
}
