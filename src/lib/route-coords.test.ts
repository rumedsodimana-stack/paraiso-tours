import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPackageRouteMapPoints,
  resolveDestinationFromText,
} from "./route-coords";
import type { TourPackage } from "./types";

test("resolveDestinationFromText matches planner ids, names, and keywords", () => {
  // Exact id
  const kandy = resolveDestinationFromText("kandy");
  assert.ok(kandy);
  assert.equal(kandy!.id, "kandy");
  assert.equal(kandy!.coordinates.length, 2);

  // Name with punctuation / case
  const ella = resolveDestinationFromText("Ella");
  assert.ok(ella);
  assert.equal(ella!.id, "ella");

  // Keyword substring
  const sigiriya = resolveDestinationFromText("Climb Sigiriya Rock at dawn");
  assert.ok(sigiriya);
  assert.equal(sigiriya!.id, "sigiriya");

  // Garbage returns null
  assert.equal(resolveDestinationFromText("asdf qwerty"), null);
  assert.equal(resolveDestinationFromText(""), null);
  assert.equal(resolveDestinationFromText(undefined), null);
});

test("buildPackageRouteMapPoints collapses consecutive days at same destination", () => {
  const pkg: TourPackage = {
    id: "pkg_1",
    name: "Cultural loop",
    duration: "4 Days / 3 Nights",
    destination: "Sri Lanka",
    region: "Cultural Triangle",
    price: 500,
    currency: "USD",
    description: "",
    createdAt: "2026-03-20T00:00:00.000Z",
    inclusions: [],
    exclusions: [],
    itinerary: [
      { day: 1, title: "Arrival in Negombo", description: "", accommodation: "" },
      { day: 2, title: "Kandy temple tour", description: "", accommodation: "" },
      { day: 3, title: "Kandy botanical gardens", description: "", accommodation: "" },
      { day: 4, title: "Return to Colombo", description: "", accommodation: "" },
    ],
  };

  const points = buildPackageRouteMapPoints(pkg);
  // Three distinct destinations expected: Negombo, Kandy (collapsed), Colombo
  assert.equal(points.length, 3);

  const kandyPoint = points.find((p) => p.name.toLowerCase() === "kandy");
  assert.ok(kandyPoint);
  assert.deepEqual(kandyPoint!.dayNumbers, [2, 3]);
});

test("buildPackageRouteMapPoints returns [] when fewer than 2 destinations resolve", () => {
  const pkg: TourPackage = {
    id: "pkg_2",
    name: "Singleton",
    duration: "2 Days / 1 Night",
    destination: "zzz unknown zzz",
    region: "zzz",
    price: 100,
    currency: "USD",
    description: "",
    createdAt: "2026-03-20T00:00:00.000Z",
    inclusions: [],
    exclusions: [],
    itinerary: [
      { day: 1, title: "nothing", description: "", accommodation: "" },
      { day: 2, title: "also nothing", description: "", accommodation: "" },
    ],
  };
  assert.deepEqual(buildPackageRouteMapPoints(pkg), []);
});
