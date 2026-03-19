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
}: {
  title: string;
  options: PackageOption[];
  onChange: (opts: PackageOption[]) => void;
  hotels?: HotelSupplier[];
  showSupplier?: boolean;
  supplierType?: "hotel" | "transport" | "meal";
  allowCustom?: boolean;
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
          <div
            key={opt.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-white/20 bg-white/50 p-2"
          >
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
                      const h = supplierList.find((x) => x.id === val);
                      if (!h) return;
                      update(i, buildOptionFromSupplier(h, supplierType, opt));
                    }
                  }}
                  className="w-36 rounded-lg border border-white/30 bg-white/60 px-2 py-1.5 text-sm"
                >
                  {allowCustom && <option value="__custom__">Custom</option>}
                  {!allowCustom && (
                    <option value="" disabled>
                      Select supplier
                    </option>
                  )}
                  {supplierList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                      {supplierType === "hotel" && h.starRating != null
                        ? ` (${h.starRating} ★)`
                        : ""}
                    </option>
                  ))}
                </select>
                {allowCustom && (opt.supplierId === "__custom__" || !opt.supplierId) && (
                  <input
                    placeholder="Custom name"
                    value={opt.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                    className="w-28 rounded-lg border border-white/30 bg-white/60 px-2 py-1.5 text-sm"
                  />
                )}
              </>
            ) : (
              <input
                placeholder="Label (e.g. BB, HB)"
                value={opt.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="w-28 flex-1 min-w-0 rounded-lg border border-white/30 bg-white/60 px-2 py-1.5 text-sm"
              />
            )}
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="Price"
              value={opt.price || ""}
              onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })}
              className="w-20 rounded-lg border border-white/30 bg-white/60 px-2 py-1.5 text-sm"
            />
            <select
              value={opt.priceType}
              onChange={(e) => update(i, { priceType: e.target.value as PriceType })}
              className="w-24 rounded-lg border border-white/30 bg-white/60 px-2 py-1.5 text-sm"
            >
              {PRICE_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
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
                update(i, { costPrice: e.target.value ? parseFloat(e.target.value) : undefined })
              }
              className="w-16 rounded-lg border border-white/30 bg-white/60 px-2 py-1.5 text-sm"
              title="Cost (for margin)"
            />
            <label className="flex shrink-0 items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={opt.isDefault ?? false}
                onChange={(e) => update(i, { isDefault: e.target.checked })}
              />
              Default
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
