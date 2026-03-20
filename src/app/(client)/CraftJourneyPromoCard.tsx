import Link from "next/link";
import { ArrowRight, Bot, Route, Sparkles } from "lucide-react";

export function CraftJourneyPromoCard({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <Link
      href="/journey-builder"
      className={`group relative overflow-hidden rounded-[2rem] border border-[#12343b]/20 bg-[#12343b] text-[#f7ead7] shadow-[0_24px_60px_-34px_rgba(18,52,59,0.95)] ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 18%, rgba(220,184,123,0.3), transparent 24%), radial-gradient(circle at 82% 18%, rgba(98,162,172,0.28), transparent 22%), linear-gradient(135deg, rgba(18,52,59,0.98), rgba(18,52,59,0.82))",
        }}
      />

      <div className="relative flex h-full min-h-[22rem] flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-[#efd5aa]">
            <Sparkles className="h-3.5 w-3.5" />
            Build it your way
          </div>

          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Craft your own journey
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e3dacb] sm:text-base">
            Start with a blank route or prompt the AI concierge once. Pick the
            date, guest count, destinations, hotel style, transport, meal
            plan, and then review the full map and price before confirming.
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {[
              "Any travel date",
              "Guest count",
              "Car or no car",
              "Meal choice",
              "AI-drafted route",
            ].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-[#efe3d0]"
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.35rem] border border-white/12 bg-white/10 px-4 py-4">
              <Bot className="h-5 w-5 text-[#efd5aa]" />
              <p className="mt-3 text-sm font-medium">AI concierge</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/12 bg-white/10 px-4 py-4">
              <Route className="h-5 w-5 text-[#efd5aa]" />
              <p className="mt-3 text-sm font-medium">Live route map</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/12 bg-white/10 px-4 py-4">
              <Sparkles className="h-5 w-5 text-[#efd5aa]" />
              <p className="mt-3 text-sm font-medium">Review before send</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-[#f2dfbf] px-5 py-3 text-sm font-semibold text-[#17343b] transition group-hover:bg-[#f7e8cf]">
            {label}
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}
