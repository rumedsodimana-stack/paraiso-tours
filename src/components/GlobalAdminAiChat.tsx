"use client";

/**
 * Floating right-side admin AI drawer.
 *
 * Thin portal/animation wrapper around `<AgentConversation />`. The
 * drawer no longer owns layout, message rendering, or its own OODA
 * brain — that all lives in the shared component, which is also used
 * by `/admin/ai`. So the experience is identical regardless of where
 * the admin opens it.
 *
 * The drawer keeps three responsibilities:
 *   1. Sliding in/out and rendering the backdrop.
 *   2. Mapping the per-route `pageContext` for the shared component.
 *   3. Refreshing the route after every OODA round (busy → idle) so
 *      mutations re-fetch any server-rendered data on the page behind
 *      the drawer. Reads `busy` directly from the agent store so we
 *      don't run a second `useAgentLoop` instance here.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { AgentConversation } from "@/components/agent/AgentConversation";
import { useAgent } from "@/stores/ai-agent.store";

interface RuntimeSummary {
  enabled: boolean;
  configured: boolean;
  providerLabel: string;
  baseUrl: string;
  model: string;
  simpleModel: string;
  defaultModel: string;
  heavyModel: string;
  superpowerEnabled: boolean;
  missingReason?: string;
}

interface PageContextResolved {
  label: string;
  details: string[];
  prompts: string[];
}

function buildPageContext(pathname: string): PageContextResolved {
  const p = pathname.replace(/\/+$/, "") || pathname;
  const bookingMatch = p.match(/^\/admin\/bookings\/([^/]+)$/);
  const invoiceMatch = p.match(/^\/admin\/invoices\/([^/]+)$/);
  const paymentMatch = p.match(/^\/admin\/payments\/([^/]+)$/);
  const packageMatch = p.match(/^\/admin\/packages\/([^/]+)$/);
  const tourMatch = p.match(/^\/admin\/tours\/([^/]+)$/);

  if (bookingMatch)
    return {
      label: "Booking detail",
      details: [
        `Current admin page path: ${p}`,
        `Current page type: booking detail`,
        `Current booking id: ${bookingMatch[1]}`,
        `If staff says "this booking", use booking id ${bookingMatch[1]}.`,
      ],
      prompts: [
        "What's missing before this booking can move forward?",
        "Is this booking ready to schedule?",
        "Draft the next client update for this booking.",
      ],
    };
  if (invoiceMatch)
    return {
      label: "Invoice detail",
      details: [
        `Current admin page path: ${p}`,
        `Current page type: invoice detail`,
        `Current invoice id: ${invoiceMatch[1]}`,
      ],
      prompts: [
        "Summarize the status of this invoice.",
        "Is there a next finance action needed?",
        "Draft a payment reminder for this invoice.",
      ],
    };
  if (paymentMatch)
    return {
      label: "Payment detail",
      details: [
        `Current admin page path: ${p}`,
        `Current page type: payment detail`,
        `Current payment id: ${paymentMatch[1]}`,
      ],
      prompts: [
        "Explain the status of this payment.",
        "Should this trigger any next step?",
        "Summarize for finance handoff.",
      ],
    };
  if (packageMatch)
    return {
      label: "Package detail",
      details: [
        `Current admin page path: ${p}`,
        `Current page type: package detail`,
        `Current package id: ${packageMatch[1]}`,
      ],
      prompts: [
        "Summarize this package for the sales team.",
        "What gaps do you see in this package?",
        "Suggest a stronger sales angle.",
      ],
    };
  if (tourMatch)
    return {
      label: "Tour detail",
      details: [
        `Current admin page path: ${p}`,
        `Current page type: scheduled tour`,
        `Current tour id: ${tourMatch[1]}`,
      ],
      prompts: [
        "Summarize the operational status of this tour.",
        "What's the next best action here?",
        "Does anything look risky?",
      ],
    };
  if (p === "/admin/bookings")
    return {
      label: "Bookings",
      details: [
        `Current admin page path: ${p}`,
        `Current page type: booking list`,
      ],
      prompts: [
        "What should I focus on in bookings right now?",
        "Which bookings look risky or incomplete?",
        "Summarize the latest booking workload.",
      ],
    };
  if (p === "/admin/payments")
    return {
      label: "Payments",
      details: [
        `Current admin page path: ${p}`,
        `Current page type: payments list`,
      ],
      prompts: [
        "Summarize payment status across the workspace.",
        "Which payments need attention?",
        "What finance follow-ups are missing?",
      ],
    };
  return {
    label: "Admin workspace",
    details: [
      `Current admin page path: ${p}`,
      `Current page type: general admin workspace`,
    ],
    prompts: [
      "What should I focus on right now?",
      "Summarize the most important next actions.",
      "Explain how this part of the app works.",
    ],
  };
}

export function GlobalAdminAiChat({
  runtime,
  desktopOpen,
  mobileOpen,
  onClose,
  onFinalize,
}: {
  runtime: RuntimeSummary;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onFinalize?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const wasBusyRef = useRef(false);

  // Drawer doesn't run its own OODA loop — just observes busy from the
  // shared store. This keeps the drawer wrapper itself cheap; the
  // shared `<AgentConversation />` inside owns the loop.
  const busy = useAgent((s) => s.busy);

  const pageContext = useMemo(() => buildPageContext(pathname), [pathname]);
  const runtimeReady = runtime.enabled && runtime.configured;

  // After every OODA round (busy → idle), refresh the route so any
  // server-side data the tool just mutated re-renders behind the
  // drawer. Also pings `onFinalize` for the host glow effect.
  useEffect(() => {
    if (busy) {
      wasBusyRef.current = true;
      return;
    }
    if (wasBusyRef.current) {
      wasBusyRef.current = false;
      router.refresh();
      onFinalize?.();
    }
  }, [busy, router, onFinalize]);

  const isOpen = desktopOpen || mobileOpen;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-[#11272b]/20 transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Drawer — slides in from the right */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <AgentConversation
          pageContext={{
            path: pathname,
            label: pageContext.label,
            details: pageContext.details,
          }}
          runtime={{
            ready: runtimeReady,
            missingReason: runtime.missingReason,
            defaultModel: runtime.defaultModel,
          }}
          suggestedPrompts={pageContext.prompts}
          onClose={onClose}
          compact
          headerExtra={
            <Link
              href="/admin/ai"
              title="Open full AI workspace"
              className="rounded-lg p-1.5 text-[#8a9ba1] transition hover:bg-[#f4ecdd] hover:text-[#11272b]"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        />
      </aside>
    </>
  );
}
