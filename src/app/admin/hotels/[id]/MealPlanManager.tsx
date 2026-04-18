"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createMealPlanAction, deleteMealPlanAction } from "@/app/actions/meal-plans";
import type { HotelMealPlan } from "@/lib/types";

export function MealPlanManager({
  hotelId,
  hotelCurrency,
  initialMealPlans,
}: {
  hotelId: string;
  hotelCurrency: string;
  initialMealPlans: HotelMealPlan[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createMealPlanAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShowForm(false);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this meal plan?")) return;
    startTransition(async () => {
      const result = await deleteMealPlanAction(id, hotelId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[#11272b]">
          <UtensilsCrossed className="h-4 w-4 text-[#8a9ba1]" />
          Meal Plans ({initialMealPlans.length})
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-3 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
          >
            <Plus className="h-4 w-4" />
            Add Plan
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="paraiso-card rounded-2xl p-4 space-y-3">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="priceType" value="per_person_per_day" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
                Plan Name *
              </label>
              <input
                name="label"
                required
                placeholder="e.g. Bed &amp; Breakfast"
                className="mt-1 w-full rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9922f]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
                Price / Person
              </label>
              <input
                name="pricePerPerson"
                type="number"
                min={0}
                step={0.01}
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9922f]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
                Currency
              </label>
              <select
                name="currency"
                defaultValue={hotelCurrency}
                className="mt-1 w-full rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9922f]"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="LKR">LKR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
              Description
            </label>
            <input
              name="description"
              placeholder="Optional notes"
              className="mt-1 w-full rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9922f]"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {pending ? "Saving…" : "Save Plan"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e4dd] px-4 py-2 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {initialMealPlans.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] px-5 py-8 text-center">
          <UtensilsCrossed className="mx-auto h-8 w-8 text-[#8a9ba1]" />
          <p className="mt-2 text-sm text-[#5e7279]">
            No meal plans yet. Add plans that guests can choose when booking.
          </p>
        </div>
      ) : initialMealPlans.length > 0 ? (
        <div className="paraiso-card overflow-hidden rounded-2xl">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
                  Plan
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
                  Price / Person
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
                  Notes
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4dd]">
              {initialMealPlans.map((mp) => (
                <tr key={mp.id} className="transition hover:bg-[#faf6ef]">
                  <td className="px-5 py-3 font-medium text-[#11272b]">{mp.label}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-[#c9922f]">
                    {mp.pricePerPerson.toLocaleString()} {mp.currency}
                  </td>
                  <td className="px-5 py-3 text-sm text-[#8a9ba1]">
                    {mp.description ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(mp.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] px-2.5 py-1.5 text-xs font-medium text-[#7c3a24] transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
