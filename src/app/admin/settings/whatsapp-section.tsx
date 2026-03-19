"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Check, X, ExternalLink } from "lucide-react";

export function WhatsAppSection() {
  const [status, setStatus] = useState<"idle" | "checking" | "configured" | "not-configured">(
    "checking"
  );

  const checkConnection = async () => {
    setStatus("checking");
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setStatus(data.connected ? "configured" : "not-configured");
    } catch {
      setStatus("not-configured");
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/whatsapp/status")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setStatus(data.connected ? "configured" : "not-configured");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("not-configured");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">
            WhatsApp Business
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Connect your WhatsApp Business account for automated booking confirmations,
            supplier notifications, and client messages.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={checkConnection}
              disabled={status === "checking"}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-70"
            >
              {status === "checking" ? (
                "Checking…"
              ) : status === "configured" ? (
                <>
                  <Check className="h-4 w-4" />
                  Connected
                </>
              ) : status === "not-configured" ? (
                <>
                  <X className="h-4 w-4" />
                  Not configured
                </>
              ) : (
                "Check connection"
              )}
            </button>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
            >
              Setup guide
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/50 p-4 dark:border-stone-700 dark:bg-stone-900/30">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
              Required env variables
            </p>
            <ul className="mt-2 space-y-1 font-mono text-sm text-stone-700 dark:text-stone-300">
              <li>WHATSAPP_ACCESS_TOKEN — Meta Graph API token</li>
              <li>WHATSAPP_PHONE_NUMBER_ID — Your WhatsApp Business phone number ID</li>
              <li>WHATSAPP_WEBHOOK_VERIFY_TOKEN — Random string for webhook verification</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
