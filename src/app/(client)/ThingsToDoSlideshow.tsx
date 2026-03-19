"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ACTIVITIES = [
  {
    name: "Whale Watching",
    slug: "whale-watching",
    description: "Spot blue whales off Mirissa and Kalpitiya",
    imageUrl: "https://images.unsplash.com/photo-1559827260-dc66d43bef33?w=800&q=80",
    searchTerm: "Mirissa",
  },
  {
    name: "Hiking",
    slug: "hiking",
    description: "Trails to Little Adam's Peak, Ella Rock & more",
    imageUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
    searchTerm: "Ella",
  },
  {
    name: "Surfing",
    slug: "surfing",
    description: "Best waves at Arugam Bay and Hikkaduwa",
    imageUrl: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80",
    searchTerm: "Southern Coast",
  },
  {
    name: "Wildlife Safari",
    slug: "safari",
    description: "Leopards, elephants & birds in Yala & Udawalawe",
    imageUrl: "https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=800&q=80",
    searchTerm: "Yala",
  },
  {
    name: "Tea Plantation Tours",
    slug: "tea",
    description: "Nuwara Eliya, Ella & the Hill Country",
    imageUrl: "https://images.unsplash.com/photo-1569827156433-daf971e7d91a?w=800&q=80",
    searchTerm: "Tea Country",
  },
  {
    name: "Temple & Heritage",
    slug: "heritage",
    description: "Sigiriya, Dambulla, Temple of the Tooth",
    imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
    searchTerm: "Cultural Triangle",
  },
  {
    name: "Diving & Snorkeling",
    slug: "diving",
    description: "Pigeon Island, Unawatuna & Trincomalee",
    imageUrl: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800&q=80",
    searchTerm: "Eastern Province",
  },
  {
    name: "Scenic Train Rides",
    slug: "train",
    description: "Kandy–Ella & Colombo–Badulla railways",
    imageUrl: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80",
    searchTerm: "Tea Country",
  },
];

export function ThingsToDoSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % ACTIVITIES.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  const goPrev = () => setActiveIndex((i) => (i - 1 + ACTIVITIES.length) % ACTIVITIES.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % ACTIVITIES.length);

  return (
    <section className="rounded-2xl border border-white/50 bg-white/60 p-8 shadow-xl backdrop-blur-xl">
      <h2 className="text-2xl font-bold text-stone-900">
        Things to do in Sri Lanka
      </h2>
      <p className="mt-1 text-stone-600">
        Whale watching, hiking, surfing & more
      </p>

      {/* Slideshow */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-lg">
        <div className="relative aspect-[16/9] w-full">
          {ACTIVITIES.map((activity, i) => (
            <div
              key={activity.slug}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === activeIndex ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              <img
                src={activity.imageUrl}
                alt={activity.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-stone-900/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="text-xl font-bold sm:text-2xl">{activity.name}</h3>
                <p className="mt-1 text-sm text-stone-200">{activity.description}</p>
                <Link
                  href={`/packages?q=${encodeURIComponent(activity.searchTerm)}`}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition hover:bg-white/30"
                >
                  Find tours
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Nav buttons */}
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-2 text-stone-700 shadow-lg backdrop-blur-sm transition hover:bg-white"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={goNext}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-2 text-stone-700 shadow-lg backdrop-blur-sm transition hover:bg-white"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {ACTIVITIES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`h-2 w-2 rounded-full transition-all ${
                i === activeIndex
                  ? "w-6 bg-white"
                  : "bg-white/50 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {ACTIVITIES.map((activity, i) => (
          <button
            key={activity.slug}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition ring-2 ring-offset-2 ring-offset-white/60 ${
              i === activeIndex ? "ring-teal-500" : "ring-transparent hover:ring-teal-200"
            }`}
          >
            <img
              src={activity.imageUrl}
              alt={activity.name}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-stone-900/50 text-xs font-medium text-white">
              {activity.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
