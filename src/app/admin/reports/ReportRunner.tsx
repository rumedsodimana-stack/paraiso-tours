"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  type: string;
}

export function ReportRunner({
  kind,
  label,
  suppliers,
}: {
  kind: "pl" | "supplier_statement" | "booking_revenue" | "payroll_register";
  label: string;
  suppliers?: Supplier[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [supplierId, setSupplierId] = useState(suppliers?.[0]?.id ?? "");

  const build = () => {
    const params = new URLSearchParams({ kind });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (kind === "supplier_statement" && supplierId) params.set("supplierId", supplierId);
    return `/api/admin/reports?${params.toString()}`;
  };

  const disabled = kind === "supplier_statement" && !supplierId;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs font-medium text-[#5e7279]">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </label>
        <label className="flex flex-col text-xs font-medium text-[#5e7279]">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </label>
        {kind === "supplier_statement" && suppliers && (
          <label className="flex min-w-[220px] flex-1 flex-col text-xs font-medium text-[#5e7279]">
            Supplier
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm text-[#11272b] focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
            >
              {suppliers.length === 0 && <option value="">No suppliers</option>}
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <a
        href={build()}
        aria-disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <Download className="h-4 w-4" />
        {label}
      </a>
    </div>
  );
}
