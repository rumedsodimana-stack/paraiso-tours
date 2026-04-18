"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { runPayrollAction } from "@/app/actions/payroll";

export function RunPayrollForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await runPayrollAction(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    if (result?.id) {
      window.location.href = `/admin/payroll/${result.id}`;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] p-4">
      {error && (
        <div className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      <div>
        <label htmlFor="periodStart" className="block text-xs font-medium text-[#5e7279]">Period Start</label>
        <input
          id="periodStart"
          name="periodStart"
          type="date"
          required
          className="mt-0.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#c9922f] focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="periodEnd" className="block text-xs font-medium text-[#5e7279]">Period End</label>
        <input
          id="periodEnd"
          name="periodEnd"
          type="date"
          required
          className="mt-0.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#c9922f] focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="payDate" className="block text-xs font-medium text-[#5e7279]">Pay Date</label>
        <input
          id="payDate"
          name="payDate"
          type="date"
          required
          className="mt-0.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-2 text-sm focus:border-[#c9922f] focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f] disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {loading ? "Creating…" : "Run Payroll"}
      </button>
    </form>
  );
}
