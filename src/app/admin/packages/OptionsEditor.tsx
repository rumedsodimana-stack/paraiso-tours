"use client";

import { Plus, Trash2 } from "lucide-react";
import type { PackageOption, HotelSupplier, HotelMealPlan, PriceType } from "@/lib/types";

export type MealPlanEntry = HotelMealPlan & { hotelName: string };

const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: "per_person_total", label: "Per person (trip)" },
  { value: "per_person_per_night", label: "Per person / night" },
  { value: "per_person_per_day", label: "Per person / day" },
  { value: "per_room_per_night", label: "Per room / night" },
  { value: "per_vehicle_per_day", label: "Per vehicle / day" },
  { value: "per_person", label: "Legacy: per person" },
  { value: "per_night", label: "Legacy: per night" },
  { value: "per_day", label: "Legacy: per day" },
  { value: "total", label: "Total" },
];

const FIELD =
  "rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm text-[#11272b] placeholder-[#b0bdc2] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20";

function genId() {
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getPriceTypeForSupplierType(
  supplierType: "hotel" | "transport" | "meal"
): PriceType {
  return supplierType === "transport"
    ? "per_vehicle_per_day"
    : supplierType === "meal"
      ? "per_person_per_night"
      : "per_room_per_night";
}

function getDefaultCapacityForSupplierType(
  supplierType: "hotel" | "transport" | "meal"
): number | undefined {
  return supplierType === "hotel"
    ? 2
    : supplierType === "transport"
      ? 6
      : undefined;
}

function usesCapacityField(priceType: PriceType): boolean {
  return (
    priceType === "per_room_per_night" ||
    priceType === "per_vehicle_per_day"
  );
}

function buildOptionFromMealPlan(mp: MealPlanEntry, existing?: PackageOption): PackageOption {
  return {
    id: existing?.id ?? genId(),
    label: `${mp.hotelName} — ${mp.label}`,
    supplierId: mp.hotelId,
    price: mp.pricePerPerson,
    costPrice: mp.pricePerPerson,
    priceType: "per_person_per_night",
    isDefault: existing?.isDefault ?? false,
  };
}

function buildOptionFromSupplier(
  supplier: HotelSupplier,
  supplierType: "hotel" | "transport" | "meal",
  existing?: PackageOption
): PackageOption {
  const supplierRate = supplier.defaultPricePerNight ?? 0;
  return {
    id: existing?.id ?? genId(),
    label: supplier.name,
    supplierId: supplier.id,
    price: supplierRate,
    costPrice: supplierRate,
    priceType: getPriceTypeForSupplierType(supplierType),
    capacity: existing?.capacity ?? getDefaultCapacityForSupplierType(supplierType),
    isDefault: existing?.isDefault ?? false,
  };
}

export function OptionsEditor({
  title,
  options,
  onChange,
  hotels,
  showSupplier,
  supplierType = "hotel",
  allowCustom = true,
  packageCurrency,
  destinationId,
  mealPlans,
}: {
  title: string;
  options: PackageOption[];
  onChange: (opts: PackageOption[]) => void;
  hotels?: HotelSupplier[];
  showSupplier?: boolean;
  supplierType?: "hotel" | "transport" | "meal";
  allowCustom?: boolean;
  packageCurrency?: string;
  destinationId?: string;
  mealPlans?: MealPlanEntry[];
}) {
  const defaultPriceType: PriceType = showSupplier
    ? getPriceTypeForSupplierType(supplierType)
    : "per_person";

  const supplierList = (hotels?.filter((h) => {
    if (h.type !== supplierType) return false;
    if (supplierType === "hotel" && destinationId) {
      return h.destinationId === destinationId;
    }
    return true;
  }) ?? []);

  const useMealPlanCatalog = supplierType === "meal" && mealPlans !== undefined;

  function add() {
    if (useMealPlanCatalog && mealPlans!.length > 0) {
      onChange([...options, buildOptionFromMealPlan(mealPlans![0])]);
      return;
    }
    if (showSupplier && supplierList.length > 0 && !allowCustom) {
      onChange([...options, buildOptionFromSupplier(supplierList[0], supplierType)]);
      return;
    }
    onChange([...options, { id: genId(), label: "", price: 0, priceType: defaultPriceType }]);
  }

  function remove(i: number) {
    onChange(options.filter((_, j) => j !== i));
  }

  function update(i: number, patch: Partial<PackageOption>) {
    onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }

  return (
    <div className="rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#11272b]">{title}</span>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1 text-xs font-medium text-[#12343b] transition hover:bg-[#eaded0] active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {/* Hint */}
      {showSupplier && !useMealPlanCatalog ? (
        <p className="mb-3 text-xs text-[#8a9ba1]">
          Pick a supplier to copy its saved default rate — adjust the package price if needed.
        </p>
      ) : useMealPlanCatalog ? (
        <p className="mb-3 text-xs text-[#8a9ba1]">
          Select a meal plan from the hotel catalog. Price is copied automatically.
        </p>
      ) : null}

      {/* Empty state */}
      {options.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#ddd3c4] py-3 text-center text-xs text-[#8a9ba1]">
          No options yet — click Add to start.
        </div>
      )}

      {/* Option rows */}
      <div className="space-y-2">
        {options.map((opt, i) =>
          (() => {
            const linkedSupplier = opt.supplierId
              ? supplierList.find((s) => s.id === opt.supplierId)
              : undefined;
            const supplierRate = linkedSupplier?.defaultPricePerNight;
            const currentCost = opt.costPrice ?? opt.price;
            const isSynced =
              linkedSupplier &&
              supplierRate != null &&
              opt.price === supplierRate &&
              currentCost === supplierRate;
            const hasCurrencyMismatch =
              linkedSupplier && packageCurrency && linkedSupplier.currency !== packageCurrency;

            return (
              <div key={opt.id} className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-3">
                {/* Row 1 — supplier/label selector + delete */}
                <div className="flex flex-wrap items-center gap-2">
                  {useMealPlanCatalog && mealPlans!.length > 0 ? (
                    <select
                      value={opt.supplierId && opt.label ? `${opt.supplierId}|||${opt.label}` : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const [hotelId, label] = val.split("|||");
                        const mp = mealPlans!.find(
                          (m) => m.hotelId === hotelId && `${m.hotelName} — ${m.label}` === label
                        );
                        if (!mp) return;
                        update(i, buildOptionFromMealPlan(mp, opt));
                      }}
                      className={`min-w-[240px] ${FIELD}`}
                    >
                      <option value="">Select meal plan…</option>
                      {Array.from(new Set(mealPlans!.map((m) => m.hotelName))).map((hotelName) => (
                        <optgroup key={hotelName} label={hotelName}>
                          {mealPlans!
                            .filter((m) => m.hotelName === hotelName)
                            .map((m) => (
                              <option key={m.id} value={`${m.hotelId}|||${m.hotelName} — ${m.label}`}>
                                {m.label} — {m.pricePerPerson.toLocaleString()} {m.currency}/person
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : showSupplier && supplierList.length > 0 ? (
                    <>
                      <select
                        value={opt.supplierId ?? (allowCustom ? "__custom__" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (allowCustom && val === "__custom__") {
                            update(i, { supplierId: undefined, label: "", price: 0, costPrice: undefined, priceType: defaultPriceType });
                          } else {
                            const supplier = supplierList.find((s) => s.id === val);
                            if (!supplier) return;
                            update(i, buildOptionFromSupplier(supplier, supplierType, opt));
                          }
                        }}
                        className={`min-w-[200px] ${FIELD}`}
                      >
                        {allowCustom ? <option value="__custom__">Custom</option> : null}
                        {!allowCustom ? <option value="" disabled>Select supplier</option> : null}
                        {supplierList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}{supplierType === "hotel" && s.starRating != null ? ` (${s.starRating}★)` : ""}
                          </option>
                        ))}
                      </select>
                      {allowCustom && (opt.supplierId === "__custom__" || !opt.supplierId) ? (
                        <input
                          placeholder="Custom name"
                          value={opt.label}
                          onChange={(e) => update(i, { label: e.target.value })}
                          className={`min-w-[160px] flex-1 ${FIELD}`}
                        />
                      ) : null}
                    </>
                  ) : (
                    <input
                      placeholder="Label (e.g. BB, HB)"
                      value={opt.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      className={`min-w-[200px] flex-1 ${FIELD}`}
                    />
                  )}

                  {/* Price */}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Price"
                    value={opt.price || ""}
                    onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })}
                    className={`w-28 ${FIELD}`}
                  />

                  {/* Price type */}
                  <select
                    value={opt.priceType}
                    onChange={(e) =>
                      update(i, {
                        priceType: e.target.value as PriceType,
                        capacity: usesCapacityField(e.target.value as PriceType)
                          ? opt.capacity ?? getDefaultCapacityForSupplierType(supplierType)
                          : undefined,
                      })
                    }
                    className={`w-36 ${FIELD}`}
                  >
                    {PRICE_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>

                  {/* Cost */}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Cost"
                    title="Your cost (for margin tracking)"
                    value={opt.costPrice ?? ""}
                    onChange={(e) =>
                      update(i, { costPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                    }
                    className={`w-28 ${FIELD}`}
                  />

                  {/* Capacity */}
                  {usesCapacityField(opt.priceType) ? (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder={opt.priceType === "per_room_per_night" ? "Pax/room" : "Pax/vehicle"}
                      title="People covered by one unit"
                      value={opt.capacity ?? ""}
                      onChange={(e) =>
                        update(i, { capacity: e.target.value ? Math.max(1, parseInt(e.target.value, 10) || 1) : undefined })
                      }
                      className={`w-28 ${FIELD}`}
                    />
                  ) : null}

                  {/* Default toggle */}
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e4dd] bg-[#f4ecdd] px-3 py-2 text-xs font-medium text-[#11272b] transition hover:bg-[#eaded0]">
                    <input
                      type="checkbox"
                      checked={opt.isDefault ?? false}
                      onChange={(e) => update(i, { isDefault: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-[#c0b8ae] text-[#12343b] focus:ring-[#c9922f]"
                    />
                    Default
                  </label>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded-lg p-2 text-[#8a9ba1] transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Supplier rate badge row */}
                {!useMealPlanCatalog && linkedSupplier ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-[#e0e4dd] bg-[#f4ecdd] px-3 py-2 text-xs text-[#5e7279]">
                    <span>
                      Supplier rate:{" "}
                      <strong className="text-[#11272b]">
                        {supplierRate != null
                          ? `${supplierRate.toLocaleString()} ${linkedSupplier.currency}`
                          : `0 ${linkedSupplier.currency}`}
                      </strong>
                    </span>
                    {isSynced ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                        Synced
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => update(i, buildOptionFromSupplier(linkedSupplier, supplierType, opt))}
                        className="rounded-full bg-[#12343b]/10 px-2 py-0.5 font-semibold text-[#12343b] transition hover:bg-[#12343b]/20"
                      >
                        Reset to supplier rate
                      </button>
                    )}
                    {hasCurrencyMismatch ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                        Supplier: {linkedSupplier.currency} · Package: {packageCurrency}
                      </span>
                    ) : null}
                    {usesCapacityField(opt.priceType) ? (
                      <span className="rounded-full bg-[#e0e4dd] px-2 py-0.5 font-medium text-[#5e7279]">
                        {opt.priceType === "per_room_per_night"
                          ? `${opt.capacity ?? 1} pax/room`
                          : `${opt.capacity ?? 1} pax/vehicle`}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
