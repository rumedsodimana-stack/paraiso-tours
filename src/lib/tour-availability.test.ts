import test from "node:test";
import assert from "node:assert/strict";
import { assessTourAvailability } from "./tour-availability";
import type { HotelSupplier, Lead, Tour, TourPackage } from "./types";

const now = new Date().toISOString();

const capacitySupplier: HotelSupplier = {
  id: "hotel_capacity",
  name: "Lagoon Resort",
  type: "hotel",
  currency: "USD",
  maxConcurrentBookings: 1,
  createdAt: now,
};

const sharedPackage: TourPackage = {
  id: "pkg_shared",
  name: "South Coast Escape",
  duration: "3 Days / 2 Nights",
  destination: "South Coast",
  price: 100,
  currency: "USD",
  description: "Test package",
  itinerary: [],
  inclusions: [],
  exclusions: [],
  accommodationOptions: [
    {
      id: "acc_shared",
      label: "Lagoon Resort",
      supplierId: capacitySupplier.id,
      price: 50,
      costPrice: 40,
      priceType: "per_room_per_night",
      capacity: 2,
    },
  ],
  createdAt: now,
};

function makeLead(id: string, name: string): Lead {
  return {
    id,
    name,
    email: `${id}@example.com`,
    phone: "",
    source: "Manual",
    status: "won",
    packageId: sharedPackage.id,
    pax: 2,
    selectedAccommodationOptionId: "acc_shared",
    createdAt: now,
    updatedAt: now,
  };
}

function makeTour(id: string, leadId: string, clientName: string): Tour {
  return {
    id,
    packageId: sharedPackage.id,
    packageName: sharedPackage.name,
    leadId,
    clientName,
    startDate: "2026-04-10",
    endDate: "2026-04-12",
    pax: 2,
    status: "scheduled",
    totalValue: 300,
    currency: "USD",
  };
}

test("assessTourAvailability flags overlapping supplier capacity conflicts", () => {
  const currentLead = makeLead("lead_current", "Current Guest");
  const otherLead = makeLead("lead_other", "Other Guest");
  const otherTour = makeTour("tour_other", otherLead.id, otherLead.name);

  const result = assessTourAvailability({
    lead: currentLead,
    pkg: sharedPackage,
    suppliers: [capacitySupplier],
    tours: [otherTour],
    startDate: "2026-04-11",
    endDate: "2026-04-13",
    getTourContext: (tour) =>
      tour.id === otherTour.id ? { lead: otherLead, pkg: sharedPackage } : null,
  });

  assert.equal(result.status, "attention_needed");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Lagoon Resort/);
  assert.match(result.warnings[0], /allows 1 concurrent booking/);
});

test("assessTourAvailability flags custom options that cannot be checked", () => {
  const customPackage: TourPackage = {
    ...sharedPackage,
    id: "pkg_custom",
    accommodationOptions: [
      {
        id: "acc_custom",
        label: "Unlinked Villa",
        price: 90,
        priceType: "total",
      },
    ],
  };
  const currentLead: Lead = {
    ...makeLead("lead_custom", "Custom Guest"),
    packageId: customPackage.id,
    selectedAccommodationOptionId: "acc_custom",
  };

  const result = assessTourAvailability({
    lead: currentLead,
    pkg: customPackage,
    suppliers: [capacitySupplier],
    tours: [],
    startDate: "2026-04-11",
    endDate: "2026-04-13",
    getTourContext: () => null,
  });

  assert.equal(result.status, "attention_needed");
  assert.match(result.warnings[0], /not linked to a supplier record/);
});
