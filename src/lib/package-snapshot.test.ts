import test from "node:test";
import assert from "node:assert/strict";
import {
  createPackageSnapshot,
  packageFromSnapshot,
  resolveLeadPackage,
} from "./package-snapshot";
import type { TourPackage } from "./types";

const samplePackage: TourPackage = {
  id: "pkg_sigiriya",
  name: "Sigiriya Escape",
  duration: "4 Days / 3 Nights",
  destination: "Sigiriya",
  price: 320,
  currency: "USD",
  description: "Culture triangle route",
  itinerary: [
    { day: 1, title: "Arrive", description: "Airport to Sigiriya" },
    { day: 2, title: "Explore", description: "Rock fortress visit" },
  ],
  inclusions: ["Transfers"],
  exclusions: ["Flights"],
  createdAt: "2026-03-20T00:00:00.000Z",
  mealOptions: [{ id: "meal_hb", label: "Half Board", price: 30, priceType: "per_person_per_day" }],
  transportOptions: [{ id: "car_private", label: "Private Car", price: 90, priceType: "per_vehicle_per_day" }],
  accommodationOptions: [{ id: "hotel_a", label: "Lake View", price: 110, priceType: "per_room_per_night" }],
};

test("createPackageSnapshot freezes package details and booking selections", () => {
  const snapshot = createPackageSnapshot({
    pkg: samplePackage,
    selectedAccommodationByNight: { "0": "hotel_a" },
    selectedTransportOptionId: "car_private",
    selectedMealOptionId: "meal_hb",
    totalPrice: 640,
  });

  assert.equal(snapshot.packageId, "pkg_sigiriya");
  assert.equal(snapshot.name, "Sigiriya Escape");
  assert.deepEqual(snapshot.selectedAccommodationByNight, { "0": "hotel_a" });
  assert.equal(snapshot.selectedTransportOptionId, "car_private");
  assert.equal(snapshot.totalPrice, 640);
});

test("resolveLeadPackage prefers the frozen snapshot over the live package", () => {
  const snapshot = createPackageSnapshot({
    pkg: samplePackage,
    totalPrice: 640,
  });
  const frozenPackage = packageFromSnapshot(snapshot);
  const renamedLivePackage = { ...samplePackage, name: "Edited live package" };

  const resolved = resolveLeadPackage(
    { packageSnapshot: snapshot },
    renamedLivePackage
  );

  assert.ok(frozenPackage);
  assert.ok(resolved);
  assert.equal(resolved?.name, frozenPackage?.name);
  assert.equal(resolved?.name, "Sigiriya Escape");
});
