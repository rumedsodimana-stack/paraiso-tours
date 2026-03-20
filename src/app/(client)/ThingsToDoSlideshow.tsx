"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { destinationHighlights } from "./client-visuals";

export function ThingsToDoSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((index) => (index + 1) % destinationHighlights.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  const activeScene = destinationHighlights[activeIndex];

  return (
    <section className="rounded-[2rem] border border-[#ddc8b0] bg-white/68 p-6 shadow-[0_20px_48px_-34px_rgba(43,32,15,0.55)] backdrop-blur-sm sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#8c6a38]">
            Sri Lanka Scene Board
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            Visual shortcuts to the island&apos;s strongest moods
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#ddc8b0] bg-[#f7f1e7] px-3 py-2 text-xs uppercase tracking-[0.22em] text-stone-600">
          Swipe through routes
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#12343b] text-[#f7ead7] shadow-[0_24px_56px_-32px_rgba(18,52,59,0.95)]">
          <div className="absolute inset-0">
            <Image
              src={activeScene.imageUrl}
              alt={activeScene.title}
              fill
              unoptimized
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(11,33,38,0.9)_8%,rgba(11,33,38,0.58)_46%,rgba(11,33,38,0.22)_100%)]" />
          </div>

          <div className="relative flex min-h-[28rem] flex-col justify-between p-6 sm:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#e5c48e]">
                {activeScene.location}
              </p>
              <h3 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight">
                {activeScene.title}
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#e5dccd]">
                {activeScene.summary}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {activeScene.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/14 bg-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[#efe3d0]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <Link
                href={activeScene.href}
                className="inline-flex items-center gap-2 rounded-full bg-[#f2dfbf] px-5 py-3 text-sm font-semibold text-[#17343b] shadow-[0_16px_40px_-24px_rgba(239,214,174,0.95)] transition hover:bg-[#f7e8cf]"
              >
                Explore packages
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="absolute bottom-6 right-6 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveIndex(
                    (index) =>
                      (index - 1 + destinationHighlights.length) %
                      destinationHighlights.length
                  )
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/12 text-white backdrop-blur-sm transition hover:bg-white/18"
                aria-label="Previous scene"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveIndex(
                    (index) => (index + 1) % destinationHighlights.length
                  )
                }
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/12 text-white backdrop-blur-sm transition hover:bg-white/18"
                aria-label="Next scene"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {destinationHighlights.map((scene, index) => (
            <button
              key={scene.title}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`group grid overflow-hidden rounded-[1.35rem] border text-left transition sm:grid-cols-[116px_1fr] ${
                index === activeIndex
                  ? "border-[#12343b] bg-[#f7efe2] shadow-[0_16px_36px_-26px_rgba(18,52,59,0.55)]"
                  : "border-[#ddc8b0] bg-white/72 hover:border-[#b78c54]"
              }`}
            >
              <div className="relative h-32 overflow-hidden sm:h-full">
                <Image
                  src={scene.imageUrl}
                  alt={scene.title}
                  fill
                  unoptimized
                  className="object-cover transition duration-500 group-hover:scale-105"
                  sizes="100vw"
                />
              </div>
              <div className="flex flex-col justify-between gap-3 p-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#8c6a38]">
                    {scene.location}
                  </p>
                  <h4 className="mt-2 text-lg font-semibold tracking-tight text-stone-900">
                    {scene.title}
                  </h4>
                </div>
                <p className="text-sm leading-6 text-stone-600">
                  {scene.summary}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
