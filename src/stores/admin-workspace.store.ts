/**
 * Admin-workspace Zustand store.
 *
 * Tracks the admin's working context — what they're looking at right now,
 * what filters they've applied, and which entities are "hot" (recently
 * interacted with). The AI agent reads from this store to stay oriented:
 * when the admin asks "send this invoice" the agent knows which invoice
 * "this" is because it's the one in context.
 *
 * The store is session-scoped (sessionStorage) so refreshing keeps context
 * but closing the browser clears it — admins should never carry stale
 * context across sessions.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

// In-memory no-op storage used during SSR or when sessionStorage is absent.
const _noopMemory: Record<string, string> = {};
const ssrSafeStorage: StateStorage = {
  getItem: (k) => _noopMemory[k] ?? null,
  setItem: (k, v) => {
    _noopMemory[k] = v;
  },
  removeItem: (k) => {
    delete _noopMemory[k];
  },
};

export type AdminView =
  | "dashboard"
  | "bookings"
  | "booking_detail"
  | "tours"
  | "tour_detail"
  | "invoices"
  | "invoice_detail"
  | "payments"
  | "payables"
  | "packages"
  | "hotels"
  | "reports"
  | "insights"
  | "hitl"
  | "communications"
  | "settings"
  | "other";

export type EntityKind =
  | "lead"
  | "tour"
  | "invoice"
  | "payment"
  | "package"
  | "hotel"
  | "quotation"
  | "employee";

export interface EntityReference {
  kind: EntityKind;
  id: string;
  label?: string;
  /** When it entered context (epoch ms) so we can evict stale entries. */
  at: number;
}

export interface FilterState {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  supplierId?: string;
}

interface AdminWorkspaceState {
  currentView: AdminView;
  currentEntity: EntityReference | null;
  /** Up to 8 most-recent entities the admin has viewed or touched. */
  recent: EntityReference[];
  filters: Record<string, FilterState>;

  setView: (view: AdminView, entity?: Omit<EntityReference, "at">) => void;
  touchEntity: (entity: Omit<EntityReference, "at">) => void;
  clearEntity: () => void;
  setFilter: (scope: string, filter: FilterState) => void;
  clearFilter: (scope: string) => void;
  reset: () => void;
}

const MAX_RECENT = 8;

export const useAdminWorkspace = create<AdminWorkspaceState>()(
  persist(
    (set) => ({
      currentView: "dashboard",
      currentEntity: null,
      recent: [],
      filters: {},

      setView: (view, entity) =>
        set((s) => {
          if (!entity) return { currentView: view, currentEntity: null };
          const withAt: EntityReference = { ...entity, at: Date.now() };
          const filtered = s.recent.filter(
            (r) => !(r.kind === entity.kind && r.id === entity.id)
          );
          return {
            currentView: view,
            currentEntity: withAt,
            recent: [withAt, ...filtered].slice(0, MAX_RECENT),
          };
        }),

      touchEntity: (entity) =>
        set((s) => {
          const withAt: EntityReference = { ...entity, at: Date.now() };
          const filtered = s.recent.filter(
            (r) => !(r.kind === entity.kind && r.id === entity.id)
          );
          return {
            recent: [withAt, ...filtered].slice(0, MAX_RECENT),
          };
        }),

      clearEntity: () => set({ currentEntity: null }),

      setFilter: (scope, filter) =>
        set((s) => ({ filters: { ...s.filters, [scope]: filter } })),

      clearFilter: (scope) =>
        set((s) => {
          const next = { ...s.filters };
          delete next[scope];
          return { filters: next };
        }),

      reset: () =>
        set({
          currentView: "dashboard",
          currentEntity: null,
          recent: [],
          filters: {},
        }),
    }),
    {
      name: "paraiso.admin-workspace.v1",
      // sessionStorage — cleared on close, survives reload.
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.sessionStorage
          : ssrSafeStorage
      ),
      partialize: (state) => ({
        currentView: state.currentView,
        currentEntity: state.currentEntity,
        recent: state.recent,
        filters: state.filters,
      }),
    }
  )
);
