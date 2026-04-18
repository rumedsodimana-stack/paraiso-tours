"use client";

import { useState } from "react";
import type { Employee } from "@/lib/types";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export function EmployeeForm({
  employee,
  action,
}: {
  employee?: Employee;
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; id?: string }>;
}) {
  const [error, setError] = useState<string>("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.success && result?.id && !employee) {
      window.location.href = `/admin/employees/${result.id}/edit?saved=1`;
      return;
    }
    if (employee && result && !result.error) {
      setSaved(true);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {saved && <SaveSuccessBanner message="Saved successfully" />}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[#11272b]">Name *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={employee?.name}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#11272b]">Email *</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={employee?.email}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-[#11272b]">Phone</label>
          <input
            id="phone"
            name="phone"
            type="text"
            defaultValue={employee?.phone}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-[#11272b]">Role *</label>
          <input
            id="role"
            name="role"
            type="text"
            required
            defaultValue={employee?.role}
            placeholder="e.g. Operations Manager"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-[#11272b]">Department</label>
          <input
            id="department"
            name="department"
            type="text"
            defaultValue={employee?.department}
            placeholder="e.g. Sales"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="payType" className="block text-sm font-medium text-[#11272b]">Pay Type</label>
          <select
            id="payType"
            name="payType"
            defaultValue={employee?.payType ?? "salary"}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            <option value="salary">Salary</option>
            <option value="commission">Commission</option>
            <option value="hourly">Hourly</option>
          </select>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="salary" className="block text-sm font-medium text-[#11272b]">Monthly Salary</label>
          <input
            id="salary"
            name="salary"
            type="number"
            step="0.01"
            min="0"
            defaultValue={employee?.salary}
            placeholder="For salary type"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="commissionPct" className="block text-sm font-medium text-[#11272b]">Commission %</label>
          <input
            id="commissionPct"
            name="commissionPct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={employee?.commissionPct}
            placeholder="For commission type"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="hourlyRate" className="block text-sm font-medium text-[#11272b]">Hourly Rate</label>
          <input
            id="hourlyRate"
            name="hourlyRate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={employee?.hourlyRate}
            placeholder="For hourly type"
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="taxPct" className="block text-sm font-medium text-[#11272b]">Tax %</label>
          <input
            id="taxPct"
            name="taxPct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={employee?.taxPct ?? 0}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="benefitsAmount" className="block text-sm font-medium text-[#11272b]">Benefits (per pay period)</label>
          <input
            id="benefitsAmount"
            name="benefitsAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={employee?.benefitsAmount ?? 0}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-[#11272b]">Status</label>
          <select
            id="status"
            name="status"
            defaultValue={employee?.status ?? "active"}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-[#11272b]">Start Date</label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={employee?.startDate}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-[#11272b]">Currency</label>
          <select
            id="currency"
            name="currency"
            defaultValue={employee?.currency ?? "USD"}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          >
            <option value="USD">USD</option>
            <option value="LKR">LKR</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="bankName" className="block text-sm font-medium text-[#11272b]">Bank Name</label>
          <input
            id="bankName"
            name="bankName"
            type="text"
            defaultValue={employee?.bankName}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
        <div>
          <label htmlFor="accountNumber" className="block text-sm font-medium text-[#11272b]">Account Number</label>
          <input
            id="accountNumber"
            name="accountNumber"
            type="text"
            defaultValue={employee?.accountNumber}
            className="mt-1 w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 focus:border-[#c9922f] focus:outline-none focus:ring-2 focus:ring-[#c9922f]/20"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-xl bg-[#12343b] px-6 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          {employee ? "Save Changes" : "Add Employee"}
        </button>
      </div>
    </form>
  );
}
