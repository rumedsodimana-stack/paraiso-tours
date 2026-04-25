"use client";

/**
 * Entity-focus beacon.
 *
 * Mounted from server-rendered detail pages (booking, tour, invoice,
 * payment, package). On mount it tells the admin-workspace store the
 * admin is now "focused on" this specific entity. The agent reads the
 * focused entity from the store and treats it as the implicit subject
 * of any prompt that doesn't name something else explicitly — so
 * "rename this to Down South" on /admin/bookings/X hard-binds to that
 * booking ID without the agent having to ask.
 *
 * Pairs with `<AgentContextWatcher />` (in `AdminShell`) which is what
 * actually surfaces the focus change as a system pill in the conversation.
 *
 * Why this lives in `agent/` (not `admin/`):
 *   The store is shared with the admin app, but the *reason* we ping it
 *   is to feed the agent. Keeping the file next to the watcher makes
 *   the contract obvious to anyone reading the agent layer.
 */

import { useEffect } from "react";
import {
  useAdminWorkspace,
  type AdminView,
  type EntityKind,
} from "@/stores/admin-workspace.store";

export interface EntityFocusBeaconProps {
  /** Which admin "view" the beacon represents. Drives copy in pills. */
  view: AdminView;
  /** The entity the admin is looking at. */
  entity: {
    kind: EntityKind;
    id: string;
    label?: string;
  };
}

export function EntityFocusBeacon({ view, entity }: EntityFocusBeaconProps) {
  const setView = useAdminWorkspace((s) => s.setView);
  // We deliberately don't `clearEntity` on unmount — the next page will
  // either set its own focus (overwriting cleanly) or the admin returns
  // to a list page and the workspace store retains the last touched
  // entity in `recent` so the agent can still reach it via "the booking".

  useEffect(() => {
    setView(view, {
      kind: entity.kind,
      id: entity.id,
      label: entity.label,
    });
    // Stable: id + kind identify the entity uniquely; label changes
    // shouldn't refire the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, entity.kind, entity.id]);

  return null;
}
