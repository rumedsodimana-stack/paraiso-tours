"use client";

import { Plus, Trash2 } from "lucide-react";
import type { PackageOption, HotelSupplier, PriceType } from "@/lib/types";

const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: "per_person", label: "Per person" },
  { value: "per_night", label: "Per night" },
  { value: "per_day", label: "Per day" },
  { value: "total", label: "Total" },
];

function genId() {
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getPriceTypeForSupplierType(
  supplierType: "hotel" | "transport" | "meal"
): PriceType {
  return supplierType === "transport"
    ? "per_day"
    : supplierType === "meal"
      ? "per_person"
      : "per_night";
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
}: {
  title: string;
  options: PackageOption[];
  onChange: (opts: PackageOption[]) => void;
  hotels?: HotelSupplier[];
  showSupplier?: boolean;
  supplierType?: "hotel" | "transport" | "meal";
  allowCustom?: boolean;
  packageCurrency?: string;
}) {
  const defaultPriceType: PriceType =
    showSupplier
      ? getPriceTypeForSupplierType(supplierType)
      : "per_person";

  const supplierList = hotels?.filter((h) => h.type === supplierType) ?? [];

  function add() {
    if (showSupplier && supplierList.length > 0 && !allowCustom) {
      onChange([...options, buildOptionFromSupplier(supplierList[0], supplierType)]);
      return;
    }

    onChange([
      ...options,
      { id: genId(), label: "", price: 0, priceType: defaultPriceType },
    ]);
  }

  function remove(i: number) {
    onChange(options.filter((_, j) => j !== i));
  }

  function update(i: number, patch: Partial<PackageOption>) {
    onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  }

  return (
    <div className="rounded-xl border border-white/30 bg-white/40 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">{title}</span>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm text-teal-600 hover:bg-teal-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>
      {showSupplier ? (
        <p className="mb-3 text-xs text-stone-500">
          Selecting a supplier copies its saved default rate into the option.
          You can then adjust the package price if needed.
        </p>
      ) : null}
      <div className="space-y-2">
        {options.map((opt, i) => (
          (() => {
            const linkedSupplier = opt.supplierId
              ? supplierList.find((supplier) => supplier.id === opt.supplierId)
              : undefined;
            const supplierRate = linkedSupplier?.defaultPricePerNight;
            const currentCost = opt.costPrice ?? opt.price;
            const isSyncedToSupplier =
              linkedSupplier &&
              supplierRate != null &&
              opt.price === supplierRate &&
              currentCost === supplierRate;
            const hasCurrencyMismatch =
              linkedSupplier &&
              packageCurrency &&
              linkedSupplier.currency !== packageCurrency;

            return (
              <div
                key={opt.id}
                className="rounded-xl border border-white/30 bg-white/55 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {showSupplier && supplierList.length > 0 ? (
                    <>
                      <select
                        value={opt.supplierId ?? (allowCustom ? "__custom__" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (allowCustom && val === "__custom__") {
                            update(i, {
                              supplierId: undefined,
                              label: "",
                              price: 0,
                              costPrice: undefined,
                              priceType: defaultPriceType,
                            });
                          } else {
                            const supplier = supplierList.find(
                              (item) => item.id === val
                            );
                            if (!supplier) return;
                            update(
                              i,
                              buildOptionFromSupplier(supplier, supplierType, opt)
                            );
                          }
                        }}
                        className="min-w-[210px] rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-sm"
                      >
                        {allowCustom ? <option value="__custom__">Custom</option> : null}
                        {!allowCustom ? (
                          <option value="" disabled>
                            Select supplier
                          </option>
                        ) : null}
                        {supplierList.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                            {supplierType === "hotel" &&
                            supplier.starRating != null
                              ? ` (${supplier.starRating} ★)`
                              : ""}
                          </option>
                        ))}
                      </select>
                      {allowCustom &&
                      (opt.supplierId === "__custom__" || !opt.supplierId) ? (
                        <input
                          placeholder="Custom name"
                          value={opt.label}
                          onChange={(e) =>
                            update(i, { label: e.target.value })
                          }
                          className="min-w-[180px] flex-1 rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-sm"
                        />
                      ) : null}
                    </>
                  ) : (
                    <input
                      placeholder="Label (e.g. BB, HB)"
                      value={opt.label}
                      onChange={(e) => update(i, { label: e.target.value })}
                      className="min-w-[220px] flex-1 rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-sm"
                    />
                  )}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Price"
                    value={opt.price || ""}
                    onChange={(e) =>
                      update(i, { price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-28 rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-sm"
                  />
                  <select
                    value={opt.priceType}
                    onChange={(e) =>
                      update(i, { priceType: e.target.value as PriceType })
                    }
                    className="w-32 rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-sm"
                  >
                    {PRICE_TYPES.map((priceType) => (
                      <option key={priceType.value} value={priceType.value}>
                        {priceType.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Cost"
                    value={opt.costPrice ?? ""}
                    onChange={(e) =>
                      update(i, {
                        costPrice: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-28 rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-sm"
                    title="Cost (for margin)"
                  />
                  <label className="flex shrink-0 items-center gap-1 rounded-lg border border-white/30 bg-white/70 px-3 py-2 text-xs font-medium text-stone-600">
                    <input
                      type="checkbox"
                      checked={opt.isDefault ?? false}
                      onChange={(e) =>
                        update(i, { isDefault: e.target.checked })
                      }
                    />
                    Default
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {linkedSupplier ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50/80 px-3 py-2 text-xs text-stone-600">
                    <span>
                      Saved supplier rate:{" "}
                      <strong>
                        {supplierRate != null
                          ? `${supplierRate.toLocaleString()} ${linkedSupplier.currency}`
                          : `0 ${linkedSupplier.currency}`}
                      </strong>
                    </span>
                    {isSyncedToSupplier ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700">
                        Synced
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          update(
                            i,
                            buildOptionFromSupplier(
                              linkedSupplier,
                              supplierType,
                              opt
                            )
                          )
                        }
                        className="rounded-full bg-teal-100 px-2 py-1 font-medium text-teal-700 transition hover:bg-teal-200"
                      >
                        Reset to supplier rate
                      </button>
                    )}
                    {hasCurrencyMismatch ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">
                        Supplier is in {linkedSupplier.currency}, package is in{" "}
                        {packageCurrency}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}
