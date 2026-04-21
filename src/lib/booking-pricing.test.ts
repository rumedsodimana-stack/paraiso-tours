import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBookingSelectionsTotal,
  getLeadBookingFinancials,
  normalizeSelectedAccommodationByNight,
} from "./booking-pricing";
import { createCustomRoutePackageSnapshot } from "./custom-route-booking";
import { calcOptionCost, calcOptionPrice } from "./package-price";
import type { HotelSupplier, Lead, TourPackage } from "./types";

const pkg: TourPackage = {
  id: "pkg_test",
  name: "Test Package",
  duration: "4 Days / 3 Nights",
  destination: "Sri Lanka",
  price: 100,
  currency: "USD",
  description: "Test package",
  itinerary: [
    {
      day: 1,
      title: "Day 1",
      description: "Start",
      accommodationOptions: [
        { id: "acc_1", label: "Hotel A", price: 30, priceType: "per_night" },
      ],
    },
    {
      day: 2,
      title: "Day 2",
      description: "Middle",
      accommodationOptions: [
        { id: "acc_2", label: "Hotel B", price: 40, priceType: "per_night" },
      ],
    },
    {
      day: 3,
      title: "Day 3",
      description: "End",
      accommodationOptions: [
        { id: "acc_3", label: "Hotel C", price: 50, priceType: "per_night" },
      ],
    },
    { day: 4, title: "Day 4", description: "Departure" },
  ],
  inclusions: [],
  exclusions: [],
  transportOptions: [
    { id: "tr_1", label: "Car", price: 20, priceType: "per_day" },
  ],
  mealOptions: [
    { id: "meal_1", label: "Half Board", price: 15, priceType: "per_person" },
  ],
  createdAt: new Date().toISOString(),
};

const suppliers: HotelSupplier[] = [
  { id: "hotel_a", name: "Hotel A", type: "hotel", currency: "USD", createdAt: new Date().toISOString() },
];

test("normalizeSelectedAccommodationByNight removes invalid keys and trims values", () => {
  assert.deepEqual(
    normalizeSelectedAccommodationByNight({
      "0": " acc_1 ",
      "2": "acc_3",
      bad: "",
    }),
    {
      "0": "acc_1",
      "2": "acc_3",
    }
  );
});

test("calculateBookingSelectionsTotal uses per-night accommodation and option pricing", () => {
  const result = calculateBookingSelectionsTotal({
    pkg,
    pax: 2,
    selectedAccommodationByNight: {
      "0": "acc_1",
      "1": "acc_2",
      "2": "acc_3",
    },
    selectedTransportOptionId: "tr_1",
    selectedMealOptionId: "meal_1",
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.nights, 3);
  assert.equal(result.totalPrice, 430);
});

test("getLeadBookingFinancials respects stored total as booking snapshot", () => {
  const lead: Lead = {
    id: "lead_1",
    name: "Test Lead",
    email: "lead@example.com",
    phone: "",
    source: "Client Portal",
    status: "new",
    packageId: pkg.id,
    pax: 2,
    selectedAccommodationByNight: {
      "0": "acc_1",
      "1": "acc_2",
      "2": "acc_3",
    },
    selectedTransportOptionId: "tr_1",
    selectedMealOptionId: "meal_1",
    totalPrice: 445,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = getLeadBookingFinancials(lead, pkg, suppliers);
  assert.equal(result.totalPrice, 445);
  assert.equal(result.adjustmentAmount, 15);
  assert.ok(result.breakdown);
});

test("getLeadBookingFinancials keeps stored total for snapshot-only custom routes", () => {
  const customLead: Lead = {
    id: "lead_custom",
    name: "Custom Lead",
    email: "custom@example.com",
    phone: "",
    source: "Client Route Builder",
    status: "new",
    destination: "Sigiriya -> Kandy",
    pax: 2,
    totalPrice: 1200,
    packageSnapshot: createCustomRoutePackageSnapshot(
      {
        id: "lead_custom",
        destination: "Sigiriya -> Kandy",
        pax: 2,
        totalPrice: 1200,
      },
      {
        routeStops: [
          {
            destinationName: "Sigiriya",
            nights: 2,
            hotelName: "Rock View Hotel",
            hotelCurrency: "USD",
          },
          {
            destinationName: "Kandy",
            nights: 1,
            hotelName: "Lake Kandy Hotel",
            hotelCurrency: "USD",
          },
        ],
        transportLabel: "Private Car",
        mealLabel: "Half Board",
        desiredNights: 3,
      }
    ),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const customPkg = customLead.packageSnapshot
    ? {
        id: customLead.packageSnapshot.packageId ?? "custom_route_lead_custom",
        name: customLead.packageSnapshot.name,
        duration: customLead.packageSnapshot.duration,
        destination: customLead.packageSnapshot.destination,
        price: customLead.packageSnapshot.price,
        currency: customLead.packageSnapshot.currency,
        description: customLead.packageSnapshot.description,
        itinerary: customLead.packageSnapshot.itinerary,
        inclusions: customLead.packageSnapshot.inclusions,
        exclusions: customLead.packageSnapshot.exclusions,
        createdAt: customLead.packageSnapshot.capturedAt,
      }
    : null;

  assert.ok(customPkg);
  const result = getLeadBookingFinancials(customLead, customPkg!, suppliers);
  assert.equal(result.totalPrice, 1200);
  assert.equal(result.adjustmentAmount, 0);
  assert.equal(result.breakdown, null);
});

test("capacity-based option pricing uses rooms and vehicles instead of raw pax", () => {
  assert.equal(
    calcOptionPrice(
      {
        id: "room_1",
        label: "Deluxe Room",
        price: 80,
        costPrice: 55,
        priceType: "per_room_per_night",
        capacity: 2,
      },
      5,
      3
    ),
    720
  );

  assert.equal(
    calcOptionCost(
      {
        id: "vehicle_1",
        label: "Van",
        price: 100,
        costPrice: 70,
        priceType: "per_vehicle_per_day",
        capacity: 6,
      },
      10,
      2
    ),
    420
  );
});
