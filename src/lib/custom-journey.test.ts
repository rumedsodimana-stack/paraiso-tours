import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCustomJourneyPricing,
  getCustomJourneyMealOptions,
  getCustomJourneyTransportOptions,
} from "./custom-journey";
import type { HotelSupplier, TourPackage } from "./types";

test("custom journey pricing combines guidance, hotel, transport, and meals", () => {
  const summary = calculateCustomJourneyPricing({
    pax: 4,
    routeStops: [
      {
        nights: 2,
        hotel: {
          id: "h1",
          name: "Sigiriya Stay",
          pricePerNight: 100,
          currency: "USD",
        },
      },
      {
        nights: 1,
        hotel: {
          id: "h2",
          name: "Kandy Stay",
          pricePerNight: 120,
          currency: "USD",
        },
      },
    ],
    transportOption: {
      id: "t1",
      label: "Private Van",
      description: "Supplier",
      price: 90,
      priceType: "per_vehicle_per_day",
      currency: "USD",
      capacity: 6,
      source: "supplier",
    },
    mealOption: {
      id: "m1",
      label: "Half board",
      description: "Package",
      price: 20,
      priceType: "per_person_per_day",
      currency: "USD",
      source: "package_library",
    },
    guidanceFee: 100,
    guidanceLabel: "Planning fee",
  });

  assert.equal(summary.rooms, 2);
  assert.equal(summary.totalNights, 3);
  assert.equal(summary.totalDays, 4);
  assert.equal(summary.hotelTotal, 640);
  assert.equal(summary.transportTotal, 360);
  assert.equal(summary.mealTotal, 320);
  assert.equal(summary.guidanceFee, 100);
  assert.equal(summary.total, 1420);
});

test("custom journey pricing adds hotel-attached meal plans per stop", () => {
  const summary = calculateCustomJourneyPricing({
    pax: 2,
    routeStops: [
      {
        nights: 2,
        hotel: {
          id: "h1",
          name: "Sigiriya Stay",
          pricePerNight: 100,
          currency: "USD",
        },
        // 2 pax × 2 nights × 15 = 60
        mealPlan: {
          id: "mp_bb",
          label: "Bed & Breakfast",
          pricePerPerson: 15,
          currency: "USD",
        },
      },
      {
        nights: 1,
        hotel: {
          id: "h2",
          name: "Kandy Stay",
          pricePerNight: 120,
          currency: "USD",
        },
        // 2 pax × 1 night × 30 = 60
        mealPlan: {
          id: "mp_fb",
          label: "Full Board",
          pricePerPerson: 30,
          currency: "USD",
        },
      },
    ],
    guidanceFee: 0,
    guidanceLabel: "Planning fee",
  });

  // Hotels: 100 × 2 × 1 room + 120 × 1 × 1 room = 320
  assert.equal(summary.hotelTotal, 320);
  // Meals: 60 + 60 from per-stop plans, no trip-wide mealOption = 120
  assert.equal(summary.mealTotal, 120);
  // Line item label should surface both plan labels
  const mealLine = summary.lineItems.find((li) => li.id === "journey_meals");
  assert.ok(mealLine?.label.includes("Bed & Breakfast"));
  assert.ok(mealLine?.label.includes("Full Board"));
});

test("custom journey pricing falls back to trip-wide meal option when no stop plans", () => {
  const summary = calculateCustomJourneyPricing({
    pax: 2,
    routeStops: [
      {
        nights: 2,
        hotel: { id: "h1", name: "Stay", pricePerNight: 100, currency: "USD" },
      },
    ],
    mealOption: {
      id: "m1",
      label: "Half board",
      description: "Package",
      price: 20,
      priceType: "per_person_per_day",
      currency: "USD",
      source: "package_library",
    },
  });

  // per_person_per_day charges over totalDays (nights + 1) to mirror
  // travel-day meal coverage: 2 pax × 3 days × 20 = 120.
  assert.equal(summary.mealTotal, 120);
});

test("transport options prefer suppliers and fall back when no data exists", () => {
  const suppliers: HotelSupplier[] = [
    {
      id: "tr_1",
      name: "Premium Van",
      type: "transport",
      currency: "USD",
      defaultPricePerNight: 120,
      createdAt: "2026-03-20T00:00:00.000Z",
    },
  ];

  const transportOptions = getCustomJourneyTransportOptions(suppliers, [], "USD");
  assert.equal(transportOptions[0].label, "Premium Van");
  assert.equal(transportOptions[0].source, "supplier");

  const fallbackOptions = getCustomJourneyTransportOptions([], [], "USD");
  assert.ok(fallbackOptions.length > 0);
  assert.equal(fallbackOptions[0].source, "planner_fallback");
});

test("meal options include package pricing labels when present", () => {
  const packages: TourPackage[] = [
    {
      id: "pkg_1",
      name: "Classic Route",
      duration: "5 Days / 4 Nights",
      destination: "Sri Lanka",
      price: 200,
      currency: "USD",
      description: "Test",
      itinerary: [],
      inclusions: [],
      exclusions: [],
      createdAt: "2026-03-20T00:00:00.000Z",
      mealOptions: [
        {
          id: "meal_hb",
          label: "Half Board",
          price: 25,
          priceType: "per_person_per_day",
        },
      ],
    },
  ];

  const mealOptions = getCustomJourneyMealOptions([], packages, "USD");
  assert.equal(mealOptions[0].label, "Half Board");
  assert.equal(mealOptions[0].source, "package_library");
});
