import { Suspense } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Activity,
  Mail,
  MessageCircle,
  Database,
  Hotel as HotelIcon,
  Inbox,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin-session";
import { isEmailConfigured } from "@/lib/email";
import { isWhatsAppConfigured } from "@/lib/whatsapp";
import { supabase } from "@/lib/supabase";
import { getHotels, getLeads, getAuditLogs } from "@/lib/db";
import type { AuditLog } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * /admin/health — single page that surfaces every misconfiguration
 * the admin needs to act on. Replaces the "hunt across five pages
 * to figure out why something's broken" pattern.
 *
 * Each row has:
 *  - status chip (green/yellow/red)
 *  - one-line summary
 *  - actionable hint when the status is yellow/red
 *
 * All checks degrade gracefully — if a check itself errors, the row
 * shows "Couldn't check" rather than crashing the whole page.
 */
export default async function HealthPage() {
  await requireAdmin();

  const checks = await Promise.allSettled([
    checkEmail(),
    checkWhatsApp(),
    checkSupabase(),
    checkSuppliersWithoutEmail(),
    checkBookingsWithoutEmail(),
    checkRecentFailures(),
  ]);

  const results = checks.map((c, i) =>
    c.status === "fulfilled"
      ? c.value
      : {
          icon: Activity,
          name: ["Email", "WhatsApp", "Database", "Suppliers", "Bookings", "Recent failures"][i] ?? "Unknown",
          status: "unknown" as const,
          message: "Couldn't run this check.",
          hint:
            c.reason instanceof Error ? c.reason.message : String(c.reason ?? ""),
        }
  );

  const counts = {
    ok: results.filter((r) => r.status === "ok").length,
    warn: results.filter((r) => r.status === "warn").length,
    err: results.filter((r) => r.status === "err").length,
    unknown: results.filter((r) => r.status === "unknown").length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#11272b]">
            System health
          </h1>
          <p className="mt-1 text-sm text-[#5e7279]">
            One page to see what needs your attention. Refresh the page to re-run every check.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {counts.ok > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              {counts.ok} OK
            </span>
          )}
          {counts.warn > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {counts.warn} warning{counts.warn === 1 ? "" : "s"}
            </span>
          )}
          {counts.err > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {counts.err} error{counts.err === 1 ? "" : "s"}
            </span>
          )}
          {counts.unknown > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f4ecdd] px-3 py-1 font-medium text-[#5e7279]">
              <Activity className="h-3 w-3" />
              {counts.unknown} unknown
            </span>
          )}
        </div>
      </header>

      <Suspense>
        <div className="space-y-3">
          {results.map((row) => (
            <HealthRow key={row.name} {...row} />
          ))}
        </div>
      </Suspense>
    </div>
  );
}

// ───────────────────────────── Row ─────────────────────────────

type CheckStatus = "ok" | "warn" | "err" | "unknown";

interface CheckResult {
  icon: React.ElementType;
  name: string;
  status: CheckStatus;
  message: string;
  hint?: string;
  href?: string;
  hrefLabel?: string;
}

function HealthRow({ icon: Icon, name, status, message, hint, href, hrefLabel }: CheckResult) {
  const tone =
    status === "ok"
      ? { chip: "bg-emerald-50 text-emerald-700", label: "OK", border: "border-[#e0e4dd]" }
      : status === "warn"
        ? { chip: "bg-amber-50 text-amber-700", label: "Warning", border: "border-amber-200" }
        : status === "err"
          ? { chip: "bg-red-50 text-red-700", label: "Action needed", border: "border-red-200" }
          : { chip: "bg-[#f4ecdd] text-[#5e7279]", label: "Unknown", border: "border-[#e0e4dd]" };

  return (
    <div className={`rounded-2xl border ${tone.border} bg-[#fffbf4] p-5 shadow-sm`}>
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f4ecdd] text-[#5e7279]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#11272b]">{name}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone.chip}`}>
              {tone.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#11272b]">{message}</p>
          {hint && <p className="mt-1 text-xs text-[#5e7279]">{hint}</p>}
          {href && (
            <a
              href={href}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#12343b] hover:underline"
            >
              {hrefLabel ?? "Open"} →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────── Individual checks ────────────────────────

async function checkEmail(): Promise<CheckResult> {
  const configured = isEmailConfigured();
  const fromAddress = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  if (!configured) {
    return {
      icon: Mail,
      name: "Email provider (Resend)",
      status: "err",
      message: "RESEND_API_KEY is not set in Vercel.",
      hint: "Until this is set, every guest confirmation, supplier reservation, payment receipt, and admin alert is skipped.",
      href: "/admin/settings",
      hrefLabel: "Open settings",
    };
  }
  if (!fromAddress) {
    return {
      icon: Mail,
      name: "Email provider (Resend)",
      status: "warn",
      message: "Sending from Resend's shared sandbox (`onboarding@resend.dev`).",
      hint: "Verify your domain in Resend, then set RESEND_FROM_EMAIL so emails come from paraiso.tours instead.",
      href: "/admin/settings",
      hrefLabel: "Open settings",
    };
  }
  return {
    icon: Mail,
    name: "Email provider (Resend)",
    status: "ok",
    message: `Configured. Sending from ${fromAddress}.`,
  };
}

async function checkWhatsApp(): Promise<CheckResult> {
  const configured = isWhatsAppConfigured();
  if (!configured) {
    return {
      icon: MessageCircle,
      name: "WhatsApp Business",
      status: "warn",
      message: "Not configured.",
      hint: "Optional. If you connect WhatsApp, guests with a phone number get an additional channel for confirmations.",
      href: "/admin/settings",
      hrefLabel: "Open settings",
    };
  }
  return {
    icon: MessageCircle,
    name: "WhatsApp Business",
    status: "ok",
    message: "Connected.",
  };
}

async function checkSupabase(): Promise<CheckResult> {
  if (!supabase) {
    return {
      icon: Database,
      name: "Database (Supabase)",
      status: "err",
      message: "Supabase client not initialised.",
      hint: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in Vercel.",
    };
  }
  // Cheap probe — just count one row from a table that always exists.
  const { error } = await supabase
    .from("packages")
    .select("id", { count: "exact", head: true });
  if (error) {
    return {
      icon: Database,
      name: "Database (Supabase)",
      status: "err",
      message: "Could not query the packages table.",
      hint: error.message ?? "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
    };
  }
  return {
    icon: Database,
    name: "Database (Supabase)",
    status: "ok",
    message: "Connected and queryable.",
  };
}

async function checkSuppliersWithoutEmail(): Promise<CheckResult> {
  const hotels = await getHotels();
  const missing = hotels.filter((h) => {
    const email = h.email?.trim();
    if (email) return false;
    // Fallback: contact field may contain an email.
    const contactEmail = h.contact?.match(/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
    return !contactEmail;
  });
  if (hotels.length === 0) {
    return {
      icon: HotelIcon,
      name: "Supplier emails",
      status: "warn",
      message: "No suppliers in the catalog yet.",
      hint: "Add hotels and transport providers in the catalog so scheduled tours can send reservation emails.",
      href: "/admin/hotels",
      hrefLabel: "Open hotels",
    };
  }
  if (missing.length === 0) {
    return {
      icon: HotelIcon,
      name: "Supplier emails",
      status: "ok",
      message: `All ${hotels.length} active suppliers have an email on file.`,
    };
  }
  return {
    icon: HotelIcon,
    name: "Supplier emails",
    status: "warn",
    message: `${missing.length} of ${hotels.length} suppliers have no email address.`,
    hint:
      "Reservation emails for these suppliers will be skipped during scheduling. Add an email under /admin/hotels for each.",
    href: "/admin/hotels",
    hrefLabel: "Open hotels",
  };
}

async function checkBookingsWithoutEmail(): Promise<CheckResult> {
  const leads = await getLeads();
  const active = leads.filter((l) => l.status !== "cancelled");
  const missing = active.filter((l) => !l.email?.trim());
  if (active.length === 0) {
    return {
      icon: Inbox,
      name: "Booking guest emails",
      status: "ok",
      message: "No active bookings.",
    };
  }
  if (missing.length === 0) {
    return {
      icon: Inbox,
      name: "Booking guest emails",
      status: "ok",
      message: `All ${active.length} active bookings have a guest email.`,
    };
  }
  return {
    icon: Inbox,
    name: "Booking guest emails",
    status: "warn",
    message: `${missing.length} active booking${missing.length === 1 ? "" : "s"} missing a guest email.`,
    hint:
      "Confirmations and itineraries can't be sent until the guest's email is added under the booking.",
    href: "/admin/bookings",
    hrefLabel: "Open bookings",
  };
}

async function checkRecentFailures(): Promise<CheckResult> {
  // Pull the last 100 audit logs and count *_failed events from the
  // last 24 hours. Skipped events count as a softer signal.
  const logs = await getAuditLogs({ limit: 100 });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = logs.filter((l: AuditLog) => {
    const ts = l.createdAt ? new Date(l.createdAt).getTime() : 0;
    return ts >= cutoff;
  });
  const failed = recent.filter((l) => l.action.endsWith("_failed")).length;
  const skipped = recent.filter((l) => l.action.endsWith("_skipped")).length;
  if (failed === 0 && skipped === 0) {
    return {
      icon: Inbox,
      name: "Recent communication failures (24h)",
      status: "ok",
      message: "No failed or skipped emails in the last 24 hours.",
    };
  }
  return {
    icon: Inbox,
    name: "Recent communication failures (24h)",
    status: failed > 0 ? "err" : "warn",
    message:
      failed > 0
        ? `${failed} failed event${failed === 1 ? "" : "s"} in the last 24 hours${
            skipped > 0 ? ` (plus ${skipped} skipped)` : ""
          }.`
        : `${skipped} skipped event${skipped === 1 ? "" : "s"} in the last 24 hours.`,
    hint:
      "Open Communications to see each row, the underlying error, and click Resend or Bulk Retry.",
    href: "/admin/communications?status=failed",
    hrefLabel: "Open Communications",
  };
}
