"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Mail,
  Phone,
  Calendar,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Link2,
  Copy,
} from "lucide-react";
import type { Lead, LeadStatus } from "@/lib/types";
import {
  updateLeadStatusAction,
  deleteLeadAction,
} from "@/app/actions/leads";

const statusColors: Record<string, string> = {
  new:       "bg-[#f3e8ce] text-[#7a5a17]",
  hold:      "bg-[#d6e2e5] text-[#294b55]",
  cancelled: "bg-[#eed9cf] text-[#7c3a24]",
  won:       "bg-[#12343b] text-[#f6ead6]",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  hold: "On Hold",
  cancelled: "Cancelled",
  won: "Scheduled",
};

const STATUSES: LeadStatus[] = ["new", "hold", "cancelled"];

export function LeadsTable({
  initialLeads,
  packageNames = {},
  initialSearch,
}: {
  initialLeads: Lead[];
  packageNames?: Record<string, string>;
  initialSearch?: string;
}) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [leads, setLeads] = useState(initialLeads);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copyClientLink(lead: Lead) {
    const ref = lead.reference ?? lead.id;
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/booking/${encodeURIComponent(ref)}${lead.email ? `?email=${encodeURIComponent(lead.email)}` : ""}`
      : "";
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(lead.id);
      setTimeout(() => setCopied(null), 2000);
      setOpenMenu(null);
    });
  }

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      (lead.reference?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleStatusChange(leadId: string, status: LeadStatus) {
    const result = await updateLeadStatusAction(leadId, status);
    if (result?.success) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    }
    setOpenMenu(null);
  }

  async function handleDelete(leadId: string) {
    if (!confirm("Archive this booking? It will be removed from the active pipeline.")) return;
    setDeleting(leadId);
    const result = await deleteLeadAction(leadId);
    if (result?.success) {
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
    }
    setDeleting(null);
    setOpenMenu(null);
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#11272b]">Booking Management</h1>
          <p className="mt-1 text-sm text-[#5e7279]">
            Track and manage client inquiries across the sales cycle
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2.5 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
        >
          <Plus className="h-4 w-4" />
          Add Booking
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ba1]" />
          <input
            type="text"
            placeholder="Search by name, email or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#e0e4dd] bg-[#fffbf4] py-2.5 pl-10 pr-4 text-[#11272b] placeholder-[#8a9ba1] focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
          className="rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2.5 text-[#5e7279] focus:border-[#12343b] focus:outline-none focus:ring-2 focus:ring-[#12343b]/20"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="paraiso-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[#e0e4dd] bg-[#f4ecdd]">
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Client</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Reference</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Contact</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Trip</th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.1em] text-[#8a9ba1]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0e4dd]">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#8a9ba1]">
                    No bookings found.{" "}
                    <Link href="/admin/bookings/new" className="font-medium text-[#12343b] hover:underline">
                      Add your first booking
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="transition hover:bg-[#faf6ef]">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/bookings/${lead.id}`}
                        className="block font-medium text-[#11272b] hover:text-[#12343b] transition"
                      >
                        {lead.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-[#8a9ba1]">
                        via {lead.source}
                        {lead.packageId && packageNames[lead.packageId] && (
                          <span className="ml-1.5 inline-flex items-center rounded bg-[#eef4f4] px-2 py-0.5 text-xs text-[#12343b]">
                            {packageNames[lead.packageId]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="min-w-[140px] px-6 py-4">
                      {lead.reference ? (
                        <Link
                          href={`/admin/bookings/${lead.id}`}
                          className="font-mono text-sm font-semibold text-[#12343b] hover:text-[#1a474f] transition"
                        >
                          {lead.reference}
                        </Link>
                      ) : (
                        <span className="text-[#8a9ba1]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm text-[#5e7279]">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-[#8a9ba1]" />
                          {lead.email}
                        </div>
                        {lead.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-[#8a9ba1]" />
                            {lead.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lead.status === "won" ? (
                        <span className="rounded-full px-3 py-1 text-xs font-semibold bg-[#12343b] text-[#f6ead6]">
                          Scheduled
                        </span>
                      ) : (
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                          className={`cursor-pointer appearance-none rounded-full border-0 px-3 py-1 text-xs font-semibold pr-6 focus:ring-2 focus:ring-[#12343b]/30 ${statusColors[lead.status] ?? "bg-[#e2e3dd] text-[#545a54]"}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm text-[#5e7279]">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-[#8a9ba1]" />
                          {lead.travelDate || "TBD"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 shrink-0 text-[#8a9ba1]" />
                          {lead.pax ?? "-"} pax
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setOpenMenu(openMenu === lead.id ? null : lead.id)}
                          className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenu === lead.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] py-1 shadow-xl">
                              <Link
                                href={`/admin/bookings/${lead.id}`}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#12343b] hover:bg-[#eef4f4]"
                                onClick={() => setOpenMenu(null)}
                              >
                                View itinerary
                              </Link>
                              <button
                                type="button"
                                onClick={() => copyClientLink(lead)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#5e7279] hover:bg-[#faf6ef]"
                              >
                                {copied === lead.id
                                  ? <Copy className="h-4 w-4 text-[#375a3f]" />
                                  : <Link2 className="h-4 w-4" />}
                                {copied === lead.id ? "Copied!" : "Copy client link"}
                              </button>
                              <Link
                                href={`/admin/bookings/${lead.id}/edit`}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#5e7279] hover:bg-[#faf6ef]"
                                onClick={() => setOpenMenu(null)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(lead.id)}
                                disabled={deleting === lead.id}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                {deleting === lead.id ? "Archiving…" : "Archive"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
