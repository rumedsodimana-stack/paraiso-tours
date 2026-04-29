"use client";

import { useEffect, useState } from "react";
import { Bell, Check, ExternalLink, Mail, MessageCircle, RefreshCw, X } from "lucide-react";

type ConnStatus = "idle" | "checking" | "ok" | "off";

function StatusBadge({ status }: { status: ConnStatus }) {
  if (status === "checking") return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4ecdd] px-3 py-1 text-xs font-medium text-[#5e7279]"><RefreshCw className="h-3 w-3 animate-spin" />Checking…</span>;
  if (status === "ok") return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"><Check className="h-3 w-3" />Connected</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4ecdd] px-3 py-1 text-xs font-medium text-[#5e7279]"><X className="h-3 w-3" />Not configured</span>;
}

function EnvRow({ variable, description }: { variable: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3">
      <code className="mt-0.5 rounded bg-[#e0e4dd] px-1.5 py-0.5 text-[11px] font-mono text-[#11272b] shrink-0">{variable}</code>
      <p className="text-xs text-[#5e7279] leading-relaxed">{description}</p>
    </div>
  );
}

export function NotificationsSection() {
  const [waStatus, setWaStatus] = useState<ConnStatus>("checking");
  const [emailStatus, setEmailStatus] = useState<ConnStatus>("checking");
  const [emailFromAddress, setEmailFromAddress] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/whatsapp/status")
      .then((r) => r.json())
      .then((d) => { if (active) setWaStatus(d.connected ? "ok" : "off"); })
      .catch(() => { if (active) setWaStatus("off"); });
    fetch("/api/email/status")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setEmailStatus(d.connected ? "ok" : "off");
        setEmailFromAddress(d.fromAddress ?? null);
      })
      .catch(() => { if (active) setEmailStatus("off"); });
    return () => { active = false; };
  }, []);

  function recheck() {
    setWaStatus("checking");
    setEmailStatus("checking");
    fetch("/api/whatsapp/status")
      .then((r) => r.json())
      .then((d) => setWaStatus(d.connected ? "ok" : "off"))
      .catch(() => setWaStatus("off"));
    fetch("/api/email/status")
      .then((r) => r.json())
      .then((d) => {
        setEmailStatus(d.connected ? "ok" : "off");
        setEmailFromAddress(d.fromAddress ?? null);
      })
      .catch(() => setEmailStatus("off"));
  }

  return (
    <div className="space-y-5">
      {/* Email */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#e0e4dd] px-6 py-4">
          <Mail className="h-5 w-5 text-[#c9922f]" />
          <div className="flex-1">
            <p className="font-semibold text-[#11272b]">Email — Resend</p>
            <p className="text-xs text-[#5e7279]">Sends booking confirmations, invoices, and client notifications</p>
          </div>
          <StatusBadge status={emailStatus} />
          <a
            href="https://resend.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-3 py-1.5 text-xs font-medium text-[#5e7279] transition hover:bg-[#f4ecdd]"
          >
            Get API key <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="space-y-3 p-6">
          {emailStatus === "ok" && emailFromAddress && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              <span className="font-medium">Sending from:</span>{" "}
              <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[11px]">{emailFromAddress}</code>
            </div>
          )}
          {emailStatus === "ok" && !emailFromAddress && (
            <div className="rounded-xl border border-[#e9d49a] bg-[#fdf4dd] px-4 py-3 text-xs text-[#7d5a13]">
              <p className="font-medium">RESEND_API_KEY is set, but RESEND_FROM_EMAIL is not.</p>
              <p className="mt-1">Mail will go out from <code className="font-mono">onboarding@resend.dev</code> (Resend&apos;s shared sandbox). Set <code className="font-mono">RESEND_FROM_EMAIL</code> after verifying your domain to send from your own address.</p>
            </div>
          )}
          {emailStatus === "off" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <p className="font-medium">No email provider configured.</p>
              <p className="mt-1">Booking confirmations, supplier reservations, payment receipts, and admin alerts will be skipped until <code className="font-mono">RESEND_API_KEY</code> is set in Vercel.</p>
            </div>
          )}
          <p className="text-sm text-[#5e7279]">Set these environment variables in your Vercel project dashboard:</p>
          <div className="space-y-2">
            <EnvRow variable="RESEND_API_KEY" description="Your Resend API key — starts with re_" />
            <EnvRow variable="RESEND_FROM_EMAIL" description='Verified sender email, e.g. "Paraíso Tours &lt;bookings@paraiso.tours&gt;"' />
          </div>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
          >
            Open Vercel dashboard <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#e0e4dd] px-6 py-4">
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold text-[#11272b]">WhatsApp Business</p>
            <p className="text-xs text-[#5e7279]">Automated messages, booking confirmations, supplier alerts</p>
          </div>
          <StatusBadge status={waStatus} />
        </div>
        <div className="space-y-3 p-6">
          <p className="text-sm text-[#5e7279]">Add these to your Vercel environment variables:</p>
          <div className="space-y-2">
            <EnvRow variable="WHATSAPP_ACCESS_TOKEN" description="Meta Graph API access token from your WhatsApp Business App" />
            <EnvRow variable="WHATSAPP_PHONE_NUMBER_ID" description="Phone number ID from Meta Developer Console (not the actual phone number)" />
            <EnvRow variable="WHATSAPP_WEBHOOK_VERIFY_TOKEN" description="Any secret string you choose — used to verify webhook calls from Meta" />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Meta Developer Console <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={recheck}
              disabled={waStatus === "checking"}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#11272b] transition hover:bg-[#f4ecdd] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${waStatus === "checking" ? "animate-spin" : ""}`} />
              Re-check connection
            </button>
          </div>

          {/* Webhook URL helper */}
          <div className="mt-2 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3">
            <p className="text-xs font-semibold text-[#5e7279]">Webhook URL to register in Meta:</p>
            <code className="mt-1 block text-xs text-[#5e7279] break-all">https://your-domain.vercel.app/api/whatsapp/webhook</code>
            <p className="mt-1 text-[11px] text-[#8a9ba1]">Subscribe to: <span className="font-mono">messages</span> and <span className="font-mono">message_status_updates</span></p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <Bell className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Environment variables are set once per deployment. After adding them in Vercel, redeploy for them to take effect. They are never stored in the database.</p>
      </div>
    </div>
  );
}
