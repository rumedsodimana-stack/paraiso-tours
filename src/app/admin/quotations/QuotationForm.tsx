"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import type { Quotation, QuotationLineItem, ItineraryDay } from "@/lib/types";

interface QuotationFormProps {
  mode: "create" | "edit";
  initial?: Partial<Quotation>;
  action: (formData: FormData) => Promise<{ error?: string } | undefined>;
}

const CURRENCIES = ["USD", "EUR", "GBP", "LKR", "AUD", "SGD"];

function newLineItem(): QuotationLineItem {
  return {
    id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: "",
    quantity: 1,
    unitPrice: 0,
    total: 0,
  };
}

function newDay(dayNumber: number): ItineraryDay {
  return { day: dayNumber, title: "", description: "" };
}

export function QuotationForm({ mode, initial, action }: QuotationFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [lineItems, setLineItems] = useState<QuotationLineItem[]>(
    initial?.lineItems?.length ? initial.lineItems : [newLineItem()]
  );
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(
    initial?.itinerary?.length ? initial.itinerary : [newDay(1)]
  );
  const [discountAmount, setDiscountAmount] = useState(initial?.discountAmount ?? 0);
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    client: true,
    trip: true,
    itinerary: true,
    pricing: true,
    inclusions: false,
    terms: false,
  });

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // Computed totals
  const subtotal = lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const total = Math.max(0, subtotal - discountAmount);

  function updateLineItem(idx: number, patch: Partial<QuotationLineItem>) {
    setLineItems((prev) =>
      prev.map((li, i) => {
        if (i !== idx) return li;
        const merged = { ...li, ...patch };
        merged.total = merged.quantity * merged.unitPrice;
        return merged;
      })
    );
  }

  function removeLineItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, newLineItem()]);
  }

  function updateDay(idx: number, patch: Partial<ItineraryDay>) {
    setItinerary((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d))
    );
  }

  function removeDay(idx: number) {
    setItinerary((prev) =>
      prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day: i + 1 }))
    );
  }

  function addDay() {
    setItinerary((prev) => [...prev, newDay(prev.length + 1)]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    // Inject line items
    lineItems.forEach((li, idx) => {
      formData.set(`lineItems[${idx}][label]`, li.label);
      formData.set(`lineItems[${idx}][quantity]`, String(li.quantity));
      formData.set(`lineItems[${idx}][unitPrice]`, String(li.unitPrice));
      if (li.notes) formData.set(`lineItems[${idx}][notes]`, li.notes);
    });

    // Inject itinerary
    itinerary.forEach((day, idx) => {
      formData.set(`itinerary[${idx}][title]`, day.title);
      formData.set(`itinerary[${idx}][description]`, day.description);
      if (day.accommodation) formData.set(`itinerary[${idx}][accommodation]`, day.accommodation);
    });

    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Client Details */}
      <Section
        title="Client / Company"
        open={openSections.client}
        onToggle={() => toggleSection("client")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company Name" name="companyName" defaultValue={initial?.companyName} placeholder="Acme Corp (optional)" />
          <Field label="Contact Name *" name="contactName" defaultValue={initial?.contactName} required placeholder="Jane Smith" />
          <Field label="Contact Email *" name="contactEmail" type="email" defaultValue={initial?.contactEmail} required placeholder="jane@acme.com" />
          <Field label="Contact Phone" name="contactPhone" type="tel" defaultValue={initial?.contactPhone} placeholder="+1 555 000 0000" />
        </div>
      </Section>

      {/* Trip Details */}
      <Section
        title="Trip Details"
        open={openSections.trip}
        onToggle={() => toggleSection("trip")}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Quotation Title" name="title" defaultValue={initial?.title} placeholder="Sri Lanka Heritage & Wildlife Tour" />
          <Field label="Destination" name="destination" defaultValue={initial?.destination} placeholder="Sri Lanka" />
          <Field label="Travel Date" name="travelDate" type="date" defaultValue={initial?.travelDate} />
          <Field label="Duration" name="duration" defaultValue={initial?.duration} placeholder="8 Nights / 9 Days" />
          <Field label="Pax (guests)" name="pax" type="number" min="1" defaultValue={String(initial?.pax ?? 2)} required />
          <Field label="Valid Until" name="validUntil" type="date" defaultValue={initial?.validUntil} />
        </div>
        <Field label="Internal Notes" name="notes" as="textarea" defaultValue={initial?.notes} placeholder="Operational notes visible to staff only…" rows={2} />
      </Section>

      {/* Day-by-Day Itinerary */}
      <Section
        title={`Itinerary (${itinerary.length} day${itinerary.length !== 1 ? "s" : ""})`}
        open={openSections.itinerary}
        onToggle={() => toggleSection("itinerary")}
      >
        <div className="space-y-3">
          {itinerary.map((day, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-stone-200 bg-stone-50/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-teal-700">
                  <GripVertical className="h-4 w-4 text-stone-400" />
                  Day {day.day}
                </span>
                {itinerary.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDay(idx)}
                    className="text-stone-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-600">Title *</label>
                  <input
                    type="text"
                    value={day.title}
                    onChange={(e) => updateDay(idx, { title: e.target.value })}
                    placeholder="Arrival & Colombo City Tour"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-600">Accommodation</label>
                  <input
                    type="text"
                    value={day.accommodation ?? ""}
                    onChange={(e) => updateDay(idx, { accommodation: e.target.value || undefined })}
                    placeholder="Cinnamon Grand Colombo"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-stone-600">Description</label>
                  <textarea
                    value={day.description}
                    onChange={(e) => updateDay(idx, { description: e.target.value })}
                    rows={2}
                    placeholder="Activities, transfers, meals included…"
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addDay}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 py-2.5 text-sm text-stone-500 transition hover:border-teal-400 hover:text-teal-600"
          >
            <Plus className="h-4 w-4" />
            Add Day
          </button>
        </div>
      </Section>

      {/* Pricing */}
      <Section
        title="Pricing"
        open={openSections.pricing}
        onToggle={() => toggleSection("pricing")}
      >
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-stone-600">Currency</label>
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-stone-500">
            <span className="col-span-5">Description</span>
            <span className="col-span-2 text-right">Qty</span>
            <span className="col-span-2 text-right">Unit Price</span>
            <span className="col-span-2 text-right">Total</span>
            <span className="col-span-1" />
          </div>

          {lineItems.map((li, idx) => (
            <div key={li.id} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-5">
                <input
                  type="text"
                  value={li.label}
                  onChange={(e) => updateLineItem(idx, { label: e.target.value })}
                  placeholder="Accommodation (hotel)"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={li.quantity}
                  min="1"
                  step="0.5"
                  onChange={(e) => updateLineItem(idx, { quantity: parseFloat(e.target.value) || 1 })}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={li.unitPrice}
                  min="0"
                  step="0.01"
                  onChange={(e) => updateLineItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="col-span-2 text-right text-sm font-medium text-stone-700">
                {(li.quantity * li.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="col-span-1 flex justify-end">
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="text-stone-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
          >
            <Plus className="h-4 w-4" />
            Add line item
          </button>
        </div>

        {/* Totals */}
        <div className="mt-4 space-y-1 border-t border-stone-200 pt-4">
          <div className="flex justify-between text-sm text-stone-600">
            <span>Subtotal</span>
            <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-stone-600">Discount</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="discountAmount"
                value={discountAmount}
                min="0"
                step="0.01"
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-32 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-sm text-stone-500">{currency}</span>
            </div>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1 text-base font-semibold text-stone-900">
            <span>Total</span>
            <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}</span>
          </div>
        </div>
      </Section>

      {/* Inclusions / Exclusions */}
      <Section
        title="Inclusions & Exclusions"
        open={openSections.inclusions}
        onToggle={() => toggleSection("inclusions")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Inclusions (one per line)</label>
            <textarea
              name="inclusions"
              rows={5}
              defaultValue={initial?.inclusions?.join("\n")}
              placeholder="Airport transfers&#10;All accommodation&#10;Breakfast daily&#10;English-speaking guide&#10;Government taxes"
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Exclusions (one per line)</label>
            <textarea
              name="exclusions"
              rows={5}
              defaultValue={initial?.exclusions?.join("\n")}
              placeholder="International flights&#10;Travel insurance&#10;Personal expenses&#10;Optional activities"
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </Section>

      {/* Terms */}
      <Section
        title="Terms & Conditions"
        open={openSections.terms}
        onToggle={() => toggleSection("terms")}
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Terms and Conditions</label>
          <textarea
            name="termsAndConditions"
            rows={5}
            defaultValue={initial?.termsAndConditions}
            placeholder="Payment terms, cancellation policy, etc…"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </Section>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "create" ? "Create Quotation" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/30 bg-white/50 shadow-sm backdrop-blur-xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-stone-900">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-stone-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-400" />
        )}
      </button>
      {/* Always render children so uncontrolled inputs (inclusions, terms) stay in DOM when collapsed */}
      <div className={`border-t border-stone-100 px-5 pb-5 pt-4${open ? "" : " hidden"}`}>{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  min,
  as,
  rows,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  as?: "textarea";
  rows?: number;
  [key: string]: unknown;
}) {
  const cls =
    "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-600">{label}</label>
      {as === "textarea" ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={rows ?? 3}
          className={cls}
        />
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          min={min}
          className={cls}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </div>
  );
}
