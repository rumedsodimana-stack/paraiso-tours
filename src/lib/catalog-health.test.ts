import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCatalogHealth } from "./catalog-health";
import type { HotelSupplier, TourPackage } from "./types";

const mk = {
  hotel: (over: Partial<HotelSupplier> = {}): HotelSupplier => {
    const {
      id = "h1",
      name = "Test hotel",
      type = "hotel",
      currency = "USD",
      createdAt = "2026-01-01T00:00:00.000Z",
      ...rest
    } = over;

    return {
      ...rest,
      id,
      name,
      type,
      currency,
      createdAt,
    };
  },
  pkg: (over: Partial<TourPackage> = {}): TourPackage => ({
    id: "p1",
    name: "Test package",
    duration: "3 Days / 2 Nights",
    destination: "Kandy",
    price: 100,
    currency: "USD",
    description: "",
    itinerary: [],
    inclusions: [],
    exclusions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  }),
};

test("catalog-health: clean catalog → zero gaps", () => {
  const report = analyzeCatalogHealth(
    [
      mk.hotel({
        id: "h1",
        destinationId: "kandy",
        email: "stay@hotel.test",
      }),
    ],
    [
      mk.pkg({
        accommodationOptions: [
          { id: "o1", label: "Sea view", price: 100, priceType: "per_night", supplierId: "h1" },
        ],
      }),
    ]
  );
  assert.equal(report.gaps.length, 0);
});

test("catalog-health: hotel missing destinationId is flagged critical", () => {
  const report = analyzeCatalogHealth(
    [mk.hotel({ id: "h1", name: "Negombo Stay", email: "x@x.com" })],
    []
  );
  const gap = report.gaps.find((g) => g.kind === "hotel_missing_destination");
  assert.ok(gap);
  assert.equal(gap?.severity, "critical");
  assert.match(gap!.title, /Negombo Stay/);
  assert.equal(gap!.fixHref, "/admin/hotels/h1");
});

test("catalog-health: hotel missing email is flagged warning", () => {
  const report = analyzeCatalogHealth(
    [mk.hotel({ id: "h1", destinationId: "kandy" })],
    []
  );
  const gap = report.gaps.find((g) => g.kind === "hotel_missing_email");
  assert.ok(gap);
  assert.equal(gap?.severity, "warning");
});

test("catalog-health: transport supplier missing email is flagged", () => {
  const report = analyzeCatalogHealth(
    [
      mk.hotel({
        id: "t1",
        name: "Island Cars",
        type: "transport",
      }),
    ],
    []
  );
  const gap = report.gaps.find((g) => g.kind === "transport_missing_email");
  assert.ok(gap);
});

test("catalog-health: package option without supplierId → critical gap", () => {
  const report = analyzeCatalogHealth(
    [],
    [
      mk.pkg({
        accommodationOptions: [
          { id: "o1", label: "Standard", price: 100, priceType: "per_night" },
        ],
      }),
    ]
  );
  const gap = report.gaps.find(
    (g) => g.kind === "package_option_missing_supplier"
  );
  assert.ok(gap);
  assert.equal(gap?.severity, "critical");
  assert.match(gap!.title, /Standard/);
});

test("catalog-health: custom_* option is NOT flagged", () => {
  const report = analyzeCatalogHealth(
    [],
    [
      mk.pkg({
        accommodationOptions: [
          { id: "custom_guest_stay", label: "Guest-arranged", price: 0, priceType: "per_night" },
        ],
      }),
    ]
  );
  assert.equal(
    report.gaps.filter((g) => g.kind === "package_option_missing_supplier").length,
    0
  );
});

test("catalog-health: per-night itinerary options are scanned", () => {
  const report = analyzeCatalogHealth(
    [],
    [
      mk.pkg({
        itinerary: [
          {
            day: 1,
            title: "Day 1",
            description: "",
            accommodationOptions: [{ id: "n1", label: "Night 1 stay", price: 80, priceType: "per_night" }],
          },
        ],
      }),
    ]
  );
  const gap = report.gaps.find(
    (g) => g.kind === "package_option_missing_supplier"
  );
  assert.ok(gap);
  assert.match(gap!.title, /Night 1 stay/);
});

test("catalog-health: package missing destination is info-level", () => {
  const report = analyzeCatalogHealth([], [mk.pkg({ destination: "" })]);
  const gap = report.gaps.find((g) => g.kind === "package_missing_destination");
  assert.ok(gap);
  assert.equal(gap?.severity, "info");
});

test("catalog-health: gaps sorted by severity (critical first)", () => {
  const report = analyzeCatalogHealth(
    [
      mk.hotel({ id: "h1", destinationId: "kandy" }), // warning (no email)
      mk.hotel({ id: "h2", name: "No dest" }), // critical (no destination, no email)
    ],
    []
  );
  assert.ok(report.gaps.length >= 2);
  assert.equal(report.gaps[0].severity, "critical");
});

test("catalog-health: stats count correctly", () => {
  const report = analyzeCatalogHealth(
    [
      mk.hotel({ id: "h1", destinationId: "kandy", email: "a@a.com" }),
      mk.hotel({ id: "h2", destinationId: "galle" }),
      mk.hotel({ id: "h3" }),
    ],
    [mk.pkg()]
  );
  assert.equal(report.stats.totalHotels, 3);
  assert.equal(report.stats.hotelsWithDestination, 2);
  assert.equal(report.stats.hotelsWithEmail, 1);
  assert.equal(report.stats.totalPackages, 1);
  assert.equal(report.stats.packagesWithDestination, 1);
});
