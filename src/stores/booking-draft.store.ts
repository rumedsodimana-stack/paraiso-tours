/**
 * Booking-draft Zustand store.
 *
 * Two distinct drafts live here:
 *   1. `journey`  — the guest-facing custom journey-builder (multi-stop,
 *      AI-assisted, persisted across reloads so a guest doesn't lose work).
 *   2. `wizard`   — the pre-built package booking wizard's per-step state.
 *
 * Both persist to localStorage via Zustand's `persist` middleware so a
 * reload or a crash doesn't wipe guest work. The store is the single
 * source of truth — components subscribe with slice selectors.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ── Journey-builder draft (custom trips) ─────────────────────────────────

export type AccommodationMode = "auto" | "choose";

export interface TripDay {
  id: string;
  dayNumber: number;
  destinationId?: string;
  hotelId?: string;
  activityIds?: string[];
}

export interface JourneyDraft {
  travelDate: string;
  pax: number;
  days: TripDay[];
  accommodationMode: AccommodationMode;
  transportSelectionId: string;
  mealSelectionId: string;
  mealRequest: string;
  guestNames: string[];
  email: string;
  phone: string;
  notes: string;
  aiPrompt: string;
}

// ── Pre-built wizard draft ───────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardDraft {
  step: WizardStep;
  name: string;
  email: string;
  phone: string;
  travelDate: string;
  notes: string;
  pax: number;
  guestNames: string[];
  transportId: string;
  mealId: string;
  accommodationId: string; // legacy single-option, or BOOK_MY_OWN sentinel
  accommodationByNight: Record<number, string>;
  bookMyOwnNights: Record<number, boolean>;
  bookMyOwnNotes: string;
  /** Tag the package this draft belongs to so we don't bleed state across
   *  different packages if the user bounces between them. */
  packageId: string | null;
}

// ── Store shape + actions ────────────────────────────────────────────────

interface BookingDraftState {
  journey: JourneyDraft;
  wizard: WizardDraft;

  // Journey actions
  patchJourney: (patch: Partial<JourneyDraft>) => void;
  setJourneyDays: (days: TripDay[]) => void;
  resetJourney: () => void;

  // Wizard actions
  loadWizardForPackage: (packageId: string) => void;
  patchWizard: (patch: Partial<WizardDraft>) => void;
  setWizardStep: (step: WizardStep) => void;
  resetWizard: () => void;
}

const EMPTY_JOURNEY: JourneyDraft = {
  travelDate: "",
  pax: 2,
  days: [],
  accommodationMode: "auto",
  transportSelectionId: "none",
  mealSelectionId: "none",
  mealRequest: "",
  guestNames: ["", ""],
  email: "",
  phone: "",
  notes: "",
  aiPrompt: "",
};

const EMPTY_WIZARD: WizardDraft = {
  step: 1,
  name: "",
  email: "",
  phone: "",
  travelDate: "",
  notes: "",
  pax: 2,
  guestNames: [""],
  transportId: "",
  mealId: "",
  accommodationId: "",
  accommodationByNight: {},
  bookMyOwnNights: {},
  bookMyOwnNotes: "",
  packageId: null,
};

export const useBookingDraft = create<BookingDraftState>()(
  persist(
    (set) => ({
      journey: { ...EMPTY_JOURNEY },
      wizard: { ...EMPTY_WIZARD },

      patchJourney: (patch) =>
        set((s) => ({ journey: { ...s.journey, ...patch } })),
      setJourneyDays: (days) =>
        set((s) => ({ journey: { ...s.journey, days } })),
      resetJourney: () => set({ journey: { ...EMPTY_JOURNEY } }),

      loadWizardForPackage: (packageId) =>
        set((s) => {
          // If the user switched packages, reset the wizard so state from
          // one package can't contaminate another.
          if (s.wizard.packageId && s.wizard.packageId !== packageId) {
            return { wizard: { ...EMPTY_WIZARD, packageId } };
          }
          return { wizard: { ...s.wizard, packageId } };
        }),
      patchWizard: (patch) =>
        set((s) => ({ wizard: { ...s.wizard, ...patch } })),
      setWizardStep: (step) =>
        set((s) => ({ wizard: { ...s.wizard, step } })),
      resetWizard: () => set({ wizard: { ...EMPTY_WIZARD } }),
    }),
    {
      name: "paraiso.booking-draft.v2",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : memoryStorage
      ),
      // Bump this when the shape changes to purge stale drafts gracefully.
      version: 2,
      partialize: (state) => ({
        journey: state.journey,
        wizard: state.wizard,
      }),
    }
  )
);

// Fallback storage for SSR / non-browser contexts so persist doesn't blow up.
const _memory: Record<string, string> = {};
const memoryStorage: Storage = {
  get length() {
    return Object.keys(_memory).length;
  },
  clear: () => {
    for (const k of Object.keys(_memory)) delete _memory[k];
  },
  getItem: (key) => _memory[key] ?? null,
  key: (i) => Object.keys(_memory)[i] ?? null,
  removeItem: (key) => {
    delete _memory[key];
  },
  setItem: (key, value) => {
    _memory[key] = value;
  },
};
