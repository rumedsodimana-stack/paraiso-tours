"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Sparkles, Trash2, UtensilsCrossed, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createMealPlanAction, deleteMealPlanAction, updateMealPlanAction } from "@/app/actions/meal-plans";
import type { HotelMealPlan } from "@/lib/types";

const CURRENCIES = ["USD", "EUR", "GBP", "LKR"];

/**
 * Hospitality-standard meal plan codes. These are the five options every
 * hotel in the world prices rooms against, so we offer them as one-click
 * quick-add presets (admins still set the price themselves — defaults
 * are zero). Any of them can be edited, renamed, or removed after
 * creation; this list just saves the typing.
 */
const STANDARD_PLANS: { code: string; label: string; description: string }[] = [
  { code: "RO", label: "Room Only (RO)", description: "No meals included" },
  { code: "BB", label: "Bed & Breakfast (BB)", description: "Breakfast included" },
  { code: "HB", label: "Half Board (HB)", description: "Breakfast + dinner" },
  { code: "FB", label: "Full Board (FB)", description: "Breakfast + lunch + dinner" },
  { code: "AI", label: "All Inclusive (AI)", description: "All meals + selected drinks" },
];

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
  const [editingId, setEditingId] = useState<string | null>(null);
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

  function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateMealPlanAction(id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditingId(null);
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

  /**
   * One-click preset: creates a meal plan row with the standard label at
   * zero price. The admin then edits the price inline. Skips presets that
   * already exist (case-insensitive label match) so repeated clicks are
   * idempotent.
   */
  function handleQuickAdd(preset: (typeof STANDARD_PLANS)[number]) {
    const existing = initialMealPlans.some(
      (mp) => mp.label.toLowerCase().trim() === preset.label.toLowerCase().trim()
    );
    if (existing) return;
    const fd = new FormData();
    fd.set("hotelId", hotelId);
    fd.set("label", preset.label);
    fd.set("pricePerPerson", "0");
    fd.set("priceType", "per_person_per_day");
    fd.set("currency", hotelCurrency);
    fd.set("description", preset.description);
    setError(null);
    startTransition(async () => {
      const result = await createMealPlanAction(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const missingPresets = STANDARD_PLANS.filter(
    (p) =>
      !initialMealPlans.some(
        (mp) => mp.label.toLowerCase().trim() === p.label.toLowerCase().trim()
      )
  );

  const inputCls =
    "mt-1 w-full rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9922f]";
  const labelCls =
    "block text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]";

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

      {/* Standard hospitality presets (RO / BB / HB / FB / AI).
          Shown only when some are still missing — keeps the row from
          feeling noisy once the hotel is fully configured. */}
      {!showForm && missingPresets.length > 0 && (
        <div className="rounded-2xl border border-dashed border-[#ddd3c4] bg-[#faf6ef] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">
            <Sparkles className="h-3.5 w-3.5" />
            Quick-add standard plans
          </div>
          <p className="mt-1 text-xs text-[#5e7279]">
            Hotels typically price rooms against these five plans. One click seeds
            the row at zero; edit the price inline after.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingPresets.map((preset) => (
              <button
                key={preset.code}
                type="button"
                disabled={pending}
                onClick={() => handleQuickAdd(preset)}
                title={preset.description}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#ddc8b0] bg-white px-3 py-1.5 text-xs font-medium text-[#12343b] transition hover:border-[#12343b] hover:bg-[#f3e3c7] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-3 w-3" />
                {preset.code} — {preset.description}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="paraiso-card rounded-2xl p-4 space-y-3">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="priceType" value="per_person_per_day" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className={labelCls}>Plan Name *</label>
              <input
                name="label"
                required
                placeholder="e.g. Bed &amp; Breakfast"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Price / Person</label>
              <input
                name="pricePerPerson"
                type="number"
                min={0}
                step={0.01}
                defaultValue={0}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select name="currency" defaultValue={hotelCurrency} className={inputCls}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              name="description"
              placeholder="Optional notes"
              className={inputCls}
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
              {initialMealPlans.map((mp) =>
                editingId === mp.id ? (
                  /* ── Inline edit row ── */
                  <tr key={mp.id} className="bg-[#faf6ef]">
                    <td colSpan={4} className="px-5 py-4">
                      <form
                        onSubmit={(e) => handleUpdate(e, mp.id)}
                        className="flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="hotelId" value={hotelId} />
                        <input type="hidden" name="priceType" value="per_person_per_day" />
                        <div className="min-w-[160px] flex-1">
                          <label className={labelCls}>Plan Name *</label>
                          <input
                            name="label"
                            required
                            defaultValue={mp.label}
                            className={inputCls}
                          />
                        </div>
                        <div className="w-32">
                          <label className={labelCls}>Price / Person</label>
                          <input
                            name="pricePerPerson"
                            type="number"
                            min={0}
                            step={0.01}
                            defaultValue={mp.pricePerPerson}
                            className={inputCls}
                          />
                        </div>
                        <div className="w-24">
                          <label className={labelCls}>Currency</label>
                          <select name="currency" defaultValue={mp.currency} className={inputCls}>
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="min-w-[160px] flex-1">
                          <label className={labelCls}>Notes</label>
                          <input
                            name="description"
                            defaultValue={mp.description ?? ""}
                            placeholder="Optional"
                            className={inputCls}
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pb-0.5">
                          <button
                            type="submit"
                            disabled={pending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#12343b] px-3 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-60"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {pending ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingId(null); setError(null); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e4dd] px-3 py-2 text-sm font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  /* ── Normal display row ── */
                  <tr key={mp.id} className="transition hover:bg-[#faf6ef]">
                    <td className="px-5 py-3 font-medium text-[#11272b]">{mp.label}</td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-[#c9922f]">
                      {mp.pricePerPerson.toLocaleString()} {mp.currency}
                    </td>
                    <td className="px-5 py-3 text-sm text-[#8a9ba1]">
                      {mp.description ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => { setShowForm(false); setEditingId(mp.id); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] px-2.5 py-1.5 text-xs font-medium text-[#12343b] transition hover:bg-[#eef4f4] disabled:opacity-60"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleDelete(mp.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e0e4dd] px-2.5 py-1.5 text-xs font-medium text-[#7c3a24] transition hover:bg-red-50 disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
