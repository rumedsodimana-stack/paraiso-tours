import test from "node:test";
import assert from "node:assert/strict";
import {
  createCustomRoutePackageSnapshot,
  getCustomRouteMetaFromAuditLogs,
} from "./custom-route-booking";
import type { AuditLog } from "./types";

test("getCustomRouteMetaFromAuditLogs reads route builder metadata", () => {
  const logs: AuditLog[] = [
    {
      id: "audit_1",
      entityType: "lead",
      entityId: "lead_1",
      action: "created_from_route_builder",
      summary: "Custom route created",
      actor: "Client Route Builder",
      metadata: {
        routeStops: [
          {
            destinationName: "Sigiriya",
            nights: 2,
            hotelName: "Rock View Hotel",
            hotelCurrency: "USD",
            activities: ["Sigiriya Rock"],
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
      },
      createdAt: "2026-04-21T10:00:00.000Z",
    },
  ];

  const route = getCustomRouteMetaFromAuditLogs(logs);
  assert.ok(route);
  assert.equal(route?.routeStops.length, 2);
  assert.equal(route?.transportLabel, "Private Car");
});

test("createCustomRoutePackageSnapshot builds a schedulable package snapshot", () => {
  const snapshot = createCustomRoutePackageSnapshot(
    {
      id: "lead_1",
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
          activities: ["Sigiriya Rock", "Village tour"],
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
      guidanceLabel: "Host support",
      desiredNights: 3,
    }
  );

  assert.equal(snapshot.packageId, "custom_route_lead_1");
  assert.equal(snapshot.name, "Custom Sri Lanka journey");
  assert.equal(snapshot.duration, "4 Days / 3 Nights");
  assert.equal(snapshot.price, 600);
  assert.equal(snapshot.currency, "USD");
  assert.equal(snapshot.totalPrice, 1200);
  assert.equal(snapshot.itinerary.length, 4);
  assert.equal(snapshot.itinerary[0]?.title, "Arrive in Sigiriya");
  assert.equal(snapshot.itinerary[3]?.title, "Departure from Kandy");
  assert.ok(snapshot.inclusions.includes("Transport: Private Car"));
});
