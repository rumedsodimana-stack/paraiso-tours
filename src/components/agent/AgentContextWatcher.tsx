"use client";

/**
 * AgentContextWatcher
 *
 * Headless component that bridges the admin workspace store into the
 * agent conversation. When the admin focuses a different entity or
 * navigates to a different view, this watcher pushes a small
 * `role: "system"` message into the conversation so the agent's
 * awareness flow is visible inline (instead of in a parallel sidebar).
 *
 * Design notes:
 * - Each `useEffect` is guarded by its own `mountedRef` so the initial
 *   render is silent — we only emit on *changes*. Otherwise every page
 *   load would inject a useless "Switched to dashboard" pill.
 * - We skip emissions while the agent is mid-turn (`busy === true`) so
 *   pills don't interleave between an assistant response and its tool
 *   results. Reading `busy` via `useAgent.getState()` (not a selector)
 *   keeps this watcher from re-rendering on every busy flip.
 * - `partialize` in the agent store filters `role: "system"` out of
 *   persisted messages, so reloads won't replay these pills (their
 *   world state may have moved on).
 *
 * Mounted unconditionally inside `<AdminShell>` — one instance produces
 * exactly one pill per change even if the floating drawer and
 * `/admin/ai` happen to be active in parallel.
 */

import { useEffect, useRef } from "react";
import { useAdminWorkspace, type AdminView, type EntityReference } from "@/stores/admin-workspace.store";
import { useAgent } from "@/stores/ai-agent.store";

/** Friendly label for each AdminView. Falls back to the raw code. */
const VIEW_LABELS: Record<AdminView, string> = {
  dashboard: "Dashboard",
  bookings: "Bookings",
  booking_detail: "Booking detail",
  tours: "Tours",
  tour_detail: "Tour detail",
  invoices: "Invoices",
  invoice_detail: "Invoice detail",
  payments: "Payments",
  payables: "Payables",
  packages: "Packages",
  hotels: "Hotels",
  reports: "Reports",
  insights: "Insights",
  hitl: "HITL approvals",
  communications: "Communications",
  settings: "Settings",
  other: "Other",
};

function entityKey(e: EntityReference | null): string {
  if (!e) return "__none__";
  return `${e.kind}:${e.id}`;
}

export function AgentContextWatcher() {
  const currentView = useAdminWorkspace((s) => s.currentView);
  const currentEntity = useAdminWorkspace((s) => s.currentEntity);

  // Track the last value we *announced* so we don't re-emit on
  // unrelated re-renders (e.g. an entity's `at` timestamp changing).
  const lastViewRef = useRef<AdminView | null>(null);
  const lastEntityKeyRef = useRef<string | null>(null);
  const viewMountedRef = useRef(false);
  const entityMountedRef = useRef(false);

  // Entity transitions
  useEffect(() => {
    const key = entityKey(currentEntity);
    if (!entityMountedRef.current) {
      // First render — record but stay silent.
      entityMountedRef.current = true;
      lastEntityKeyRef.current = key;
      return;
    }
    if (lastEntityKeyRef.current === key) return;
    lastEntityKeyRef.current = key;

    // Don't interrupt an in-flight OODA round — interleaving a system
    // pill between an assistant message and its tool result reads weird.
    if (useAgent.getState().busy) return;

    const text = currentEntity
      ? `Now focusing on ${currentEntity.kind}: ${currentEntity.label ?? currentEntity.id}`
      : "No focused entity";
    useAgent.getState().addMessage({ role: "system", content: text });
  }, [currentEntity]);

  // View transitions
  useEffect(() => {
    if (!viewMountedRef.current) {
      viewMountedRef.current = true;
      lastViewRef.current = currentView;
      return;
    }
    if (lastViewRef.current === currentView) return;
    lastViewRef.current = currentView;

    if (useAgent.getState().busy) return;

    const label = VIEW_LABELS[currentView] ?? currentView;
    useAgent.getState().addMessage({
      role: "system",
      content: `Switched to ${label}`,
    });
  }, [currentView]);

  return null;
}
