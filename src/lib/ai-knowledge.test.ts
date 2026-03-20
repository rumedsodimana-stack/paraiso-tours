import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFocusTerms,
  buildSriLankaKnowledgeContext,
} from "./ai-knowledge";
import type { HotelSupplier, TourPackage } from "./types";

test("buildFocusTerms deduplicates meaningful route context", () => {
  const terms = buildFocusTerms({
    query: "Sigiriya and Kandy route",
    destination: "Sigiriya",
    packageName: "Sigiriya Explorer",
    itineraryTitles: ["Sigiriya Rock", "Kandy Temple"],
    notes: "Couple trip",
  });

  assert.deepEqual(terms, [
    "Sigiriya and Kandy route",
    "Sigiriya",
    "Sigiriya Explorer",
    "Couple trip",
    "Sigiriya Rock",
    "Kandy Temple",
  ]);
});

test("Sri Lanka knowledge context includes destination, activities, and mapped hotels", () => {
  const packages: TourPackage[] = [
    {
      id: "pkg_sigiriya",
      name: "Sigiriya Explorer",
      duration: "4D/3N",
      destination: "Sri Lanka",
      region: "Cultural Triangle",
      price: 640,
      currency: "USD",
      description: "Culture and rock fortress stay",
      itinerary: [
        {
          day: 1,
          title: "Sigiriya",
          description: "Arrive and settle in",
          accommodation: "Sigiriya Village Hotel",
        },
      ],
      inclusions: [],
      exclusions: [],
      accommodationOptions: [
        {
          id: "acc_sigiriya",
          label: "Sigiriya Village Hotel",
          price: 120,
          priceType: "per_night",
          supplierId: "hotel_sigiriya",
        },
      ],
      createdAt: "2026-03-20T00:00:00.000Z",
    },
  ];

  const hotels: HotelSupplier[] = [
    {
      id: "hotel_sigiriya",
      name: "Sigiriya Village Hotel",
      type: "hotel",
      location: "Sigiriya",
      defaultPricePerNight: 130,
      currency: "USD",
      createdAt: "2026-03-20T00:00:00.000Z",
    },
  ];

  const context = buildSriLankaKnowledgeContext({
    query: "Guest wants Sigiriya and nearby culture with a scenic route",
    focusTerms: ["Sigiriya", "Cultural Triangle"],
    packages,
    hotels,
    travelDate: "2026-07-12",
    pax: 2,
    customNotes: "Prefer supplier-linked hotels first.",
  });

  assert.match(context, /Sri Lanka domain knowledge for this app:/);
  assert.match(context, /Sigiriya/);
  assert.match(context, /Hotels: Sigiriya Village Hotel/);
  assert.match(context, /Activities:/);
  assert.match(context, /Company-specific notes: Prefer supplier-linked hotels first\./);
});
