"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { TourPackage, ItineraryDay } from "@/lib/types";

export function PackageForm({
  pkg,
  onSubmit,
}: {
  pkg?: TourPackage;
  onSubmit: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const [error, setError] = useState<string>("");
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(
    pkg?.itinerary?.length
      ? pkg.itinerary
      : [{ day: 1, title: "", description: "", accommodation: "" }]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const formData = new FormData(form);

    // Append itinerary
    itinerary.forEach((day, i) => {
      if (day.title || day.description) {
        formData.set(`itinerary_${i}_title`, day.title);
        formData.set(`itinerary_${i}_description`, day.description);
        formData.set(`itinerary_${i}_accommodation`, day.accommodation || "");
      }
    });

    const result = await onSubmit(formData);
    if (result && "error" in result && result.error) {
      setError(result.error);
    }
  }

  function addDay() {
    setItinerary((prev) => [
      ...prev,
      { day: prev.length + 1, title: "", description: "", accommodation: "" },
    ]);
  }

  function removeDay(i: number) {
    setItinerary((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-stone-700">
            Package Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={pkg?.name}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="Ceylon Heritage & Wildlife"
          />
        </div>
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-stone-700">
            Destination *
          </label>
          <input
            id="destination"
            name="destination"
            type="text"
            required
            defaultValue={pkg?.destination}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="Sri Lanka"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-stone-700">
            Duration
          </label>
          <input
            id="duration"
            name="duration"
            type="text"
            defaultValue={pkg?.duration}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="8 Days / 7 Nights"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-stone-700">
              Price *
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step={0.01}
              required
              defaultValue={pkg?.price}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-stone-700">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue={pkg?.currency ?? "USD"}
              className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="LKR">LKR</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={pkg?.description}
          className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          placeholder="Package overview..."
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-stone-700">Itinerary</label>
          <button
            type="button"
            onClick={addDay}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50"
          >
            <Plus className="h-4 w-4" />
            Add Day
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {itinerary.map((day, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/30 bg-white/40 p-4 backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-500">Day {i + 1}</span>
                {itinerary.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDay(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={day.title}
                  onChange={(e) =>
                    setItinerary((prev) =>
                      prev.map((d, j) =>
                        j === i ? { ...d, title: e.target.value } : d
                      )
                    )
                  }
                  placeholder="Title"
                  className="w-full rounded-lg border border-white/30 bg-white/60 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={day.description}
                  onChange={(e) =>
                    setItinerary((prev) =>
                      prev.map((d, j) =>
                        j === i ? { ...d, description: e.target.value } : d
                      )
                    )
                  }
                  placeholder="Description"
                  className="w-full rounded-lg border border-white/30 bg-white/60 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={day.accommodation || ""}
                  onChange={(e) =>
                    setItinerary((prev) =>
                      prev.map((d, j) =>
                        j === i ? { ...d, accommodation: e.target.value } : d
                      )
                    )
                  }
                  placeholder="Accommodation (optional)"
                  className="w-full rounded-lg border border-white/30 bg-white/60 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="inclusions" className="block text-sm font-medium text-stone-700">
            Inclusions
          </label>
          <textarea
            id="inclusions"
            name="inclusions"
            rows={4}
            defaultValue={pkg?.inclusions?.join("\n")}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="One per line&#10;All accommodation&#10;Meals as specified"
          />
        </div>
        <div>
          <label htmlFor="exclusions" className="block text-sm font-medium text-stone-700">
            Exclusions
          </label>
          <textarea
            id="exclusions"
            name="exclusions"
            rows={4}
            defaultValue={pkg?.exclusions?.join("\n")}
            className="mt-1 w-full rounded-xl border border-white/30 bg-white/60 px-4 py-2.5 backdrop-blur-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
            placeholder="One per line&#10;International flights&#10;Travel insurance"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          {pkg ? "Update Package" : "Create Package"}
        </button>
      </div>
    </form>
  );
}
