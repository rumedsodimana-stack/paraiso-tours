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

const statusColors: Record<LeadStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  contacted: "bg-sky-100 text-sky-800",
  quoted: "bg-violet-100 text-violet-800",
  negotiating: "bg-orange-100 text-orange-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-stone-100 text-stone-600",
};

const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "quoted",
  "negotiating",
  "won",
  "lost",
];

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
    const url = typeof window !== "undefined" ? `${window.location.origin}/booking/${encodeURIComponent(ref)}${lead.email ? `?email=${encodeURIComponent(lead.email)}` : ""}` : "";
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
    const matchesStatus =
      statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  async function handleStatusChange(leadId: string, status: LeadStatus) {
    const result = await updateLeadStatusAction(leadId, status);
    if (result?.success) {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status } : l))
      );
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
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
            Booking Management
          </h1>
          <p className="mt-1 text-stone-600 dark:text-stone-400">
            Track and manage client inquiries across the sales cycle
          </p>
        </div>
        <Link
          href="/admin/bookings/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Add Booking
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by name, email or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/40 py-2.5 pl-10 pr-4 text-stone-900 placeholder-stone-500 backdrop-blur-md focus:border-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-400/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as LeadStatus | "all")
          }
          className="rounded-xl border border-white/20 bg-white/40 px-4 py-2.5 text-stone-700 backdrop-blur-md dark:text-stone-300"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/50 shadow-lg shadow-stone-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-white/20 bg-white/30 backdrop-blur-sm">
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Client
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Reference
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Trip
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-stone-600 dark:text-stone-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-stone-500">
                    No bookings found.{" "}
                    <Link href="/admin/bookings/new" className="text-teal-600 hover:text-teal-700 font-medium">
                      Add your first booking
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="relative transition hover:bg-white/30 group"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/bookings/${lead.id}`}
                        className="block font-medium text-stone-900 dark:text-stone-50 hover:text-teal-600 transition"
                      >
                        {lead.name}
                      </Link>
                      <div className="text-xs text-stone-500 dark:text-stone-400">
                        via {lead.source}
                        {lead.packageId && packageNames[lead.packageId] && (
                          <span className="ml-1.5 inline-flex items-center rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-700">
                            {packageNames[lead.packageId]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="min-w-[140px] px-6 py-4">
                      {lead.reference ? (
                        <Link
                          href={`/admin/bookings/${lead.id}`}
                          className="font-mono text-sm font-semibold text-teal-700 hover:text-teal-800 transition"
                          title="View itinerary"
                        >
                          {lead.reference}
                        </Link>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                          {lead.email}
                        </div>
                        {lead.phone && (
                          <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                            {lead.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            handleStatusChange(lead.id, e.target.value as LeadStatus)
                          }
                          className={`cursor-pointer appearance-none rounded-full border-0 px-3 py-1 text-xs font-medium ${statusColors[lead.status]} pr-8 focus:ring-2 focus:ring-teal-400/50`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-sm text-stone-700 dark:text-stone-300">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                          {lead.travelDate || "TBD"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                          {lead.pax ?? "-"} pax
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(openMenu === lead.id ? null : lead.id)
                          }
                          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-white/50 hover:text-stone-700"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenu === lead.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenu(null)}
                            />
                            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-white/30 bg-white/95 py-1 shadow-xl backdrop-blur-xl">
                              <Link
                                href={`/admin/bookings/${lead.id}`}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-teal-600 hover:bg-teal-50"
                                onClick={() => setOpenMenu(null)}
                              >
                                View itinerary
                              </Link>
                              <button type="button" onClick={() => copyClientLink(lead)} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-white/60">
                                {copied === lead.id ? <Copy className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
                                {copied === lead.id ? "Copied!" : "Copy client link"}
                              </button>
                              <Link
                                href={`/admin/bookings/${lead.id}/edit`}
                                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-stone-700 hover:bg-white/60"
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
