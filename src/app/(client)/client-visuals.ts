import type { TourPackage } from "@/lib/types";

export type ClientScene = {
  title: string;
  location: string;
  imageUrl: string;
  href: string;
  summary: string;
  chips: string[];
  searchTerm?: string;
};

export const homeHeroScene: ClientScene = {
  title: "Sri Lanka, paced around how you actually travel",
  location: "Sigiriya, tea country, coast, and wild south",
  imageUrl:
    "https://upload.wikimedia.org/wikipedia/commons/e/e6/Sigiriya_%28141688197%29.jpeg",
  href: "/packages",
  summary:
    "Private circuits, coastal escapes, hill-country trains, and wildlife stays designed as one smooth route instead of disconnected bookings.",
  chips: ["Private transport", "Flexible stays", "Sri Lanka specialists"],
};

export const destinationHighlights: ClientScene[] = [
  {
    title: "Cultural Triangle",
    location: "Sigiriya and Polonnaruwa",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/e/e6/Sigiriya_%28141688197%29.jpeg",
    href: "/packages?region=Cultural%20Triangle",
    summary:
      "Rock fortresses, cave temples, and ancient royal cities at sunrise and golden hour.",
    chips: ["UNESCO sites", "Sunrise climbs", "Heritage stays"],
    searchTerm: "Cultural Triangle",
  },
  {
    title: "Tea Country",
    location: "Ella and Nuwara Eliya",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/f6/The_Nine_Arches_Bridge.jpg",
    href: "/packages?region=Tea%20Country",
    summary:
      "Cool mountain air, tea estates, scenic rail journeys, and cloud-forest viewpoints.",
    chips: ["Train journeys", "Tea estates", "Hill-country lodges"],
    searchTerm: "Tea Country",
  },
  {
    title: "South Coast",
    location: "Galle Fort and Unawatuna",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/7/77/Galle_Fort.jpg",
    href: "/packages?region=Southern%20Coast",
    summary:
      "Fort walls, beach mornings, boutique hotels, and a slower oceanfront rhythm.",
    chips: ["Coastal stays", "Fort walks", "Beach time"],
    searchTerm: "Southern Coast",
  },
  {
    title: "Wild Coast",
    location: "Yala National Park",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Yala_Beach.jpg/3840px-Yala_Beach.jpg",
    href: "/packages?region=Yala",
    summary:
      "Safari routes, dune-backed coastline, and lodges positioned for early game drives.",
    chips: ["Safari days", "Nature lodges", "Wild shoreline"],
    searchTerm: "Yala",
  },
  {
    title: "Colombo Arrival",
    location: "Gangaramaya and the capital",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/9/9a/Gangaramaya_Temple.JPG",
    href: "/packages?region=Colombo",
    summary:
      "Urban arrivals shaped with lakefront temples, skyline dinners, and easy first nights.",
    chips: ["Arrival night", "City culture", "West coast"],
    searchTerm: "Colombo",
  },
  {
    title: "East Coast Water",
    location: "Pasikudah and Trincomalee",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Pasikudah_beach.JPG/1920px-Pasikudah_beach.JPG",
    href: "/packages?region=Eastern%20Province",
    summary:
      "Shallow turquoise bays, reef time, and warm-season beach extensions on the east.",
    chips: ["East coast", "Snorkeling", "Lagoon beaches"],
    searchTerm: "Eastern Province",
  },
];

export const clientPortalStats = [
  { label: "Island routes", value: "6" },
  { label: "Styles of stay", value: "Boutique to safari" },
  { label: "Best for", value: "Culture, coast, wildlife" },
];

type RegionVisual = {
  imageUrl: string;
  eyebrow: string;
  highlight: string;
  microcopy: string;
  chips: string[];
};

const defaultRegionVisual: RegionVisual = {
  imageUrl:
    "https://upload.wikimedia.org/wikipedia/commons/5/58/20160128_Sri_Lanka_4132_Sinharaja_Forest_Preserve_sRGB_%2825674474901%29.jpg",
  eyebrow: "Sri Lanka circuit",
  highlight: "Curated around the island's natural pace",
  microcopy: "Routes shaped across coast, culture, and hill country.",
  chips: ["Tailored pace", "Local routing", "Scenic stays"],
};

const regionVisuals: Record<string, RegionVisual> = {
  "Cultural Triangle": {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/e/e6/Sigiriya_%28141688197%29.jpeg",
    eyebrow: "Ancient heartland",
    highlight: "Dawn climbs, stone monasteries, and layered history",
    microcopy: "Ideal for travellers who want Sri Lanka's big heritage moments.",
    chips: ["Sigiriya", "Polonnaruwa", "Temple routes"],
  },
  "Southern Coast": {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/8/83/Unawatuna.jpg",
    eyebrow: "Indian Ocean edge",
    highlight: "Boutique coastlines and fort-town afternoons",
    microcopy: "Built around sea views, fort walks, and slower evenings.",
    chips: ["Galle", "Unawatuna", "Mirissa side trips"],
  },
  "Tea Country": {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/c/c6/NuwaraEliya_from_top.jpg",
    eyebrow: "Highland escape",
    highlight: "Rail curves, tea slopes, and cool-climate scenery",
    microcopy: "Best for scenic train legs and elevated lodge stays.",
    chips: ["Ella", "Nine Arch Bridge", "Tea estates"],
  },
  Yala: {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Yala_Beach.jpg/3840px-Yala_Beach.jpg",
    eyebrow: "Wild south",
    highlight: "Safari mornings with a coastal edge",
    microcopy: "Strong for wildlife-focused itineraries and lodge stays.",
    chips: ["Game drives", "Wild coast", "Safari lodges"],
  },
  Colombo: {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/9/9a/Gangaramaya_Temple.JPG",
    eyebrow: "Capital arrival",
    highlight: "Lakefront temples, city rhythm, and polished first nights",
    microcopy: "Works well for short stopovers and arrival/departure framing.",
    chips: ["Colombo", "Gangaramaya", "City evenings"],
  },
  "Eastern Province": {
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Pasikudah_beach.JPG/1920px-Pasikudah_beach.JPG",
    eyebrow: "East coast water",
    highlight: "Calm bays and reef-side downtime",
    microcopy: "Useful for warm-season beach extensions and snorkel breaks.",
    chips: ["Pasikudah", "Trincomalee", "Coastal water"],
  },
};

export function getClientPackageVisual(
  pkg: Pick<TourPackage, "name" | "region" | "destination">
) {
  const key = pkg.region ?? pkg.destination;
  const visual = regionVisuals[key] ?? defaultRegionVisual;

  return {
    ...visual,
    location: key,
    badge: pkg.region ?? "Sri Lanka",
  };
}
