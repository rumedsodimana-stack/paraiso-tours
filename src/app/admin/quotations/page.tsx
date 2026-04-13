import { getQuotations } from "@/lib/db";
import Link from "next/link";
import {
  Plus,
  FileText,
  ChevronRight,
  Building2,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Send,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  draft: { label: "Draft", color: "bg-stone-100 text-stone-600", icon: Clock },
  sent: { label: "Sent", color: "bg-sky-100 text-sky-800", icon: Send },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
};

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
}) {
  const quotations = await getQuotations();
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const saved = (params as { saved?: string })?.saved === "1";

  return (
    <div className="space-y-6">
      {saved && <SaveSuccessBanner message="Quotation saved successfully" />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Quotations</h1>
          <p className="mt-1 text-stone-500">
            Custom tour proposals for corporate clients and organisations
          </p>
        </div>
        <Link
          href="/admin/quotations/new"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Link>
      </div>

      {/* Summary stats */}
      {quotations.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["draft", "sent", "accepted", "rejected"] as const).map((s) => {
            const count = quotations.filter((q) => q.status === s).length;
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <div
                key={s}
                className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-xl"
              >
                <Icon className="h-5 w-5 text-stone-400 shrink-0" />
                <div>
                  <p className="text-xl font-semibold text-stone-900">{count}</p>
                  <p className="text-xs text-stone-500">{cfg.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-stone-300 bg-white/50 py-16 text-center">
          <FileText className="h-10 w-10 text-stone-300" />
          <div>
            <p className="font-medium text-stone-700">No quotations yet</p>
            <p className="mt-1 text-sm text-stone-500">
              Create a custom tour quotation for a corporate or group client.
            </p>
          </div>
          <Link
            href="/admin/quotations/new"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            New Quotation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {quotations.map((q) => {
            const cfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.draft;
            const Icon = cfg.icon;
            return (
              <Link
                key={q.id}
                href={`/admin/quotations/${q.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-white/30 bg-white/50 px-5 py-4 shadow-sm backdrop-blur-xl transition hover:bg-white/70 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <FileText className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900 truncate">
                      {q.title || q.contactName}
                    </span>
                    <span className="text-xs font-mono text-stone-400">{q.reference}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-stone-500">
                    {q.companyName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {q.companyName}
                      </span>
                    )}
                    {q.travelDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {q.travelDate}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {q.pax} pax
                    </span>
                    {q.destination && <span>{q.destination}</span>}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold text-stone-900">
                    {q.totalAmount.toLocaleString()} {q.currency}
                  </p>
                  {q.validUntil && (
                    <p className="text-xs text-stone-400">Valid until {q.validUntil}</p>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 transition group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
