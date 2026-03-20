import assert from "node:assert/strict";
import test from "node:test";
import { coerceClientJourneyPlan } from "./client-ai-concierge";

test("client concierge plan keeps only valid route stops and allowed option ids", () => {
  const plan = coerceClientJourneyPlan(
    {
      summary: "Draft a classic island route.",
      travelDate: "2026-08-15",
      pax: 4,
      accommodationMode: "choose",
      transportSelectionId: "premium_van",
      mealSelectionId: "meal_half_board",
      routeStops: [
        { destinationId: "sigiriya", nights: 2, hotelId: "sig_hotel" },
        { destinationId: "sigiriya", nights: 3, hotelId: "sig_hotel" },
        { destinationId: "jaffna", nights: 2, hotelId: "north_hotel" },
        { destinationId: "kandy", nights: 2, hotelId: "bad_hotel" },
      ],
      followUpQuestions: ["What time does the flight land?"],
    },
    {
      defaultPax: 2,
      transportOptionIds: ["none", "premium_van"],
      mealOptionIds: ["none", "meal_half_board"],
      hotelIdsByDestination: {
        sigiriya: ["sig_hotel"],
        kandy: ["kandy_hotel"],
        jaffna: ["north_hotel"],
      },
    }
  );

  assert.equal(plan.routeStops.length, 2);
  assert.equal(plan.routeStops[0]?.destinationId, "sigiriya");
  assert.equal(plan.routeStops[1]?.destinationId, "kandy");
  assert.equal(plan.routeStops[1]?.hotelId, "kandy_hotel");
  assert.equal(plan.transportSelectionId, "premium_van");
  assert.equal(plan.mealSelectionId, "meal_half_board");
});

test("client concierge plan falls back when travel date and options are missing", () => {
  const plan = coerceClientJourneyPlan(
    {
      summary: "",
      pax: "abc",
      transportSelectionId: "unknown_transport",
      mealSelectionId: "unknown_meal",
      routeStops: [{ destinationId: "kandy", nights: 0 }],
    },
    {
      defaultTravelDate: "",
      defaultPax: 3,
      transportOptionIds: ["none", "chauffeur_car"],
      mealOptionIds: ["none", "meal_breakfast"],
      hotelIdsByDestination: {
        kandy: ["kandy_hotel"],
      },
    }
  );

  assert.equal(plan.pax, 3);
  assert.equal(plan.transportSelectionId, "none");
  assert.equal(plan.mealSelectionId, "none");
  assert.equal(plan.routeStops[0]?.nights, 1);
  assert.equal(plan.routeStops[0]?.hotelId, "kandy_hotel");
  assert.match(plan.followUpQuestions.join(" "), /travel date/i);
});
