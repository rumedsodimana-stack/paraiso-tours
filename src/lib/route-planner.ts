import type { HotelSupplier, PackageOption, TourPackage } from "./types";

export const ROUTE_COMFORT_TARGET_HOURS = 4.5;
export const ROUTE_COMFORT_HARD_CAP_HOURS = 5.5;
export const ROUTE_COMFORT_MAX_KM = 250;
export const PLANNER_MAP_WIDTH = 1200;
export const PLANNER_MAP_HEIGHT = 1838;
export const PLANNER_MAP_IMAGE_URL =
  "https://upload.wikimedia.org/wikipedia/commons/6/6e/Sri_Lanka_location_map.svg";

const SRI_LANKA_MAP_BOUNDS = {
  north: 10.2,
  south: 5.5,
  west: 79.2,
  east: 82.3,
};

export type PlannerDestinationId =
  | "airport"
  | "negombo"
  | "colombo"
  | "kalpitiya"
  | "anuradhapura"
  | "dambulla"
  | "sigiriya"
  | "kandy"
  | "nuwara-eliya"
  | "ella"
  | "trincomalee"
  | "yala"
  | "galle"
  | "bentota"
  | "mirissa"
  | "tangalle"
  | "pasikuda"
  | "arugam-bay"
  | "jaffna";

export type PlannerStayStyleId = "classic" | "boutique" | "signature";
export type PlannerTransportId = "chauffeur_car" | "premium_van" | "signature_suv";

export interface PlannerMapPoint {
  x: number;
  y: number;
}

export interface PlannerDestination {
  id: PlannerDestinationId;
  name: string;
  shortName: string;
  region: string;
  summary: string;
  arrivalNote: string;
  previewImageUrl: string;
  point: PlannerMapPoint;
  recommendedNights: {
    min: number;
    ideal: number;
    max: number;
  };
  airportTransfer: {
    distanceKm: number;
    driveHours: number;
  };
  tags: string[];
  keywords: string[];
  hotelKeywords: string[];
  packageRegions: string[];
  next: PlannerDestinationId[];
}

export interface PlannerLeg {
  from: PlannerDestinationId;
  to: PlannerDestinationId;
  distanceKm: number;
  driveHours: number;
  scenicNote: string;
}

export interface PlannerActivity {
  id: string;
  destinationId: PlannerDestinationId;
  title: string;
  summary: string;
  durationLabel: string;
  energy: "easy" | "moderate" | "active";
  bestFor: string;
  estimatedPrice: number;
  tags: string[];
}

export interface PlannerHotelSuggestion {
  id: string;
  name: string;
  location: string;
  pricePerNight: number;
  currency: string;
  starRating?: number;
  source: "supplier" | "package_library" | "route_library";
  sourceLabel: string;
  matchReason: string;
  packageNames: string[];
}

export interface PlannerPackageInspiration {
  id: string;
  name: string;
  region: string;
  duration: string;
  price: number;
  currency: string;
  href: string;
}

function pointFromGeo(latitude: number, longitude: number): PlannerMapPoint {
  const x =
    ((longitude - SRI_LANKA_MAP_BOUNDS.west) /
      (SRI_LANKA_MAP_BOUNDS.east - SRI_LANKA_MAP_BOUNDS.west)) *
    PLANNER_MAP_WIDTH;
  const y =
    ((SRI_LANKA_MAP_BOUNDS.north - latitude) /
      (SRI_LANKA_MAP_BOUNDS.north - SRI_LANKA_MAP_BOUNDS.south)) *
    PLANNER_MAP_HEIGHT;

  return {
    x: Math.max(0, Math.min(PLANNER_MAP_WIDTH, Number(x.toFixed(1)))),
    y: Math.max(0, Math.min(PLANNER_MAP_HEIGHT, Number(y.toFixed(1)))),
  };
}

function pointToGeo(point: PlannerMapPoint): [number, number] {
  const longitude =
    SRI_LANKA_MAP_BOUNDS.west +
    (point.x / PLANNER_MAP_WIDTH) *
      (SRI_LANKA_MAP_BOUNDS.east - SRI_LANKA_MAP_BOUNDS.west);
  const latitude =
    SRI_LANKA_MAP_BOUNDS.north -
    (point.y / PLANNER_MAP_HEIGHT) *
      (SRI_LANKA_MAP_BOUNDS.north - SRI_LANKA_MAP_BOUNDS.south);

  return [Number(longitude.toFixed(5)), Number(latitude.toFixed(5))];
}

export const plannerStayStyles: Array<{
  id: PlannerStayStyleId;
  label: string;
  summary: string;
}> = [
  {
    id: "classic",
    label: "Classic",
    summary: "Value-led stays and the strongest low-stress routing.",
  },
  {
    id: "boutique",
    label: "Boutique",
    summary: "Balanced pacing with design-led hotels and experience picks.",
  },
  {
    id: "signature",
    label: "Signature",
    summary: "Higher-end stays, more private comfort, and premium routing.",
  },
];

export const plannerTransportProfiles: Array<{
  id: PlannerTransportId;
  label: string;
  ratePerDay: number;
  summary: string;
}> = [
  {
    id: "chauffeur_car",
    label: "Chauffeur Car",
    ratePerDay: 85,
    summary: "Best for couples or small parties focused on clean transfer days.",
  },
  {
    id: "premium_van",
    label: "Premium Van",
    ratePerDay: 120,
    summary: "More space for families and luggage-heavy island circuits.",
  },
  {
    id: "signature_suv",
    label: "Signature SUV",
    ratePerDay: 175,
    summary: "Higher-comfort private touring with a premium transfer feel.",
  },
];

const destinationList: PlannerDestination[] = [
  {
    id: "airport",
    name: "Bandaranaike Airport",
    shortName: "Airport",
    region: "Arrival",
    summary: "The planner starts here and then opens realistic first-night directions.",
    arrivalNote: "Ideal first moves are west coast reset nights, Kandy, or a direct Sigiriya start.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/0/03/Bandaranaike_International_Airport.jpg",
    point: pointFromGeo(7.1808, 79.8841),
    recommendedNights: { min: 0, ideal: 0, max: 0 },
    airportTransfer: { distanceKm: 0, driveHours: 0 },
    tags: ["Arrival", "Airport pickup", "West coast access"],
    keywords: ["airport", "katunayake", "bandaranaike"],
    hotelKeywords: ["airport", "katunayake", "negombo"],
    packageRegions: ["Colombo"],
    next: ["negombo", "colombo", "bentota", "kandy", "dambulla", "sigiriya", "kalpitiya"],
  },
  {
    id: "negombo",
    name: "Negombo",
    shortName: "Negombo",
    region: "West Coast",
    summary: "A soft first night with lagoon hotels, beach air, and a very short airport transfer.",
    arrivalNote: "Good if guests land late, want to reset, or prefer an easy final night before departure.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/2/2e/Negombo_beach%2C_Sri_Lanka.jpg",
    point: pointFromGeo(7.2083, 79.8358),
    recommendedNights: { min: 1, ideal: 1, max: 2 },
    airportTransfer: { distanceKm: 15, driveHours: 0.5 },
    tags: ["Lagoon stays", "Arrival reset", "Beach sunset"],
    keywords: ["negombo", "lagoon", "jetwing lagoon"],
    hotelKeywords: ["negombo", "lagoon", "jetwing lagoon", "airport"],
    packageRegions: ["Colombo"],
    next: ["colombo", "kalpitiya", "dambulla", "kandy", "bentota"],
  },
  {
    id: "colombo",
    name: "Colombo",
    shortName: "Colombo",
    region: "Colombo",
    summary: "An urban arrival or final-night stop with temples, dining, and easy logistics.",
    arrivalNote: "Works best for short city stays, arrival nights, or a polished end to the trip.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/9/9a/Gangaramaya_Temple.JPG",
    point: pointFromGeo(6.9271, 79.8612),
    recommendedNights: { min: 1, ideal: 1, max: 2 },
    airportTransfer: { distanceKm: 35, driveHours: 1 },
    tags: ["City culture", "Dining", "Arrival support"],
    keywords: ["colombo", "gangaramaya", "galle face", "city"],
    hotelKeywords: ["colombo", "galle face", "city"],
    packageRegions: ["Colombo"],
    next: ["negombo", "bentota", "kandy", "dambulla", "sigiriya"],
  },
  {
    id: "kalpitiya",
    name: "Kalpitiya",
    shortName: "Kalpitiya",
    region: "Northwest Coast",
    summary: "A northwestern coast extension for kitesurf winds, dolphin waters, and quieter seaside stays.",
    arrivalNote: "Best for guests who want a west-coast beach start without dropping immediately to the south.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/3/38/Kalpitiya_Beach.jpg",
    point: pointFromGeo(8.2333, 79.7667),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 145, driveHours: 3.2 },
    tags: ["West coast water", "Kitesurf", "Marine life"],
    keywords: ["kalpitiya", "bar reef", "dolphin"],
    hotelKeywords: ["kalpitiya", "bar reef", "lagoon"],
    packageRegions: ["Colombo"],
    next: ["negombo", "anuradhapura"],
  },
  {
    id: "anuradhapura",
    name: "Anuradhapura",
    shortName: "Anuradhapura",
    region: "Ancient North Central",
    summary: "A sacred-city stop for dagobas, monastery ruins, and a calmer northern heritage rhythm.",
    arrivalNote: "Works well for longer heritage circuits or as the bridge into the north.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/8/83/Ruwanwelisaya_Anuradhapura.JPG",
    point: pointFromGeo(8.3114, 80.4037),
    recommendedNights: { min: 1, ideal: 1, max: 2 },
    airportTransfer: { distanceKm: 205, driveHours: 4.6 },
    tags: ["Ancient city", "Stupas", "Sacred sites"],
    keywords: ["anuradhapura", "ruwanwelisaya", "mihintale", "ancient city"],
    hotelKeywords: ["anuradhapura", "ulagala", "rajarata"],
    packageRegions: ["Cultural Triangle"],
    next: ["jaffna", "dambulla", "sigiriya", "trincomalee", "kalpitiya"],
  },
  {
    id: "dambulla",
    name: "Dambulla",
    shortName: "Dambulla",
    region: "Cultural Triangle",
    summary: "A practical heritage base for cave temples, lake resorts, and short jumps to Sigiriya or Polonnaruwa.",
    arrivalNote: "One of the best inland first stops when you want comfort before deeper routing.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a8/Dambulla_cave_temple.jpg",
    point: pointFromGeo(7.8742, 80.6511),
    recommendedNights: { min: 1, ideal: 1, max: 2 },
    airportTransfer: { distanceKm: 150, driveHours: 3.7 },
    tags: ["Cave temples", "Lake hotels", "Central routing"],
    keywords: ["dambulla", "cave temple", "jetwing lake", "amaya lake"],
    hotelKeywords: ["dambulla", "jetwing lake", "amaya lake"],
    packageRegions: ["Cultural Triangle"],
    next: ["sigiriya", "anuradhapura", "kandy", "trincomalee", "pasikuda"],
  },
  {
    id: "sigiriya",
    name: "Sigiriya",
    shortName: "Sigiriya",
    region: "Cultural Triangle",
    summary: "The strongest heritage base for Sigiriya, Dambulla, Minneriya, and temple-country mornings.",
    arrivalNote: "A good first inland stop if the guest wants to start with the island's heritage core.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/e/e6/Sigiriya_%28141688197%29.jpeg",
    point: pointFromGeo(7.957, 80.7603),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 165, driveHours: 4 },
    tags: ["UNESCO sites", "Sunrise climbs", "Wildlife nearby"],
    keywords: ["sigiriya", "dambulla", "polonnaruwa", "cultural triangle", "kandalama"],
    hotelKeywords: ["sigiriya", "dambulla", "kandalama", "habarana"],
    packageRegions: ["Cultural Triangle"],
    next: ["dambulla", "kandy", "anuradhapura", "trincomalee", "pasikuda"],
  },
  {
    id: "kandy",
    name: "Kandy",
    shortName: "Kandy",
    region: "Hill Gateway",
    summary: "A transitional stop that connects heritage, tea country, and cultural performance nights.",
    arrivalNote: "Best used as a 1-2 night bridge before the central highlands or after Sigiriya.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/3/3e/Kandy_lake.jpg",
    point: pointFromGeo(7.2906, 80.6337),
    recommendedNights: { min: 1, ideal: 1, max: 2 },
    airportTransfer: { distanceKm: 115, driveHours: 3.5 },
    tags: ["Temple visits", "Culture", "Hill-country handoff"],
    keywords: ["kandy", "temple of the tooth", "peradeniya", "citadel"],
    hotelKeywords: ["kandy", "peradeniya", "citadel"],
    packageRegions: ["Tea Country", "Cultural Triangle"],
    next: ["dambulla", "sigiriya", "nuwara-eliya", "ella", "bentota"],
  },
  {
    id: "nuwara-eliya",
    name: "Nuwara Eliya",
    shortName: "Nuwara Eliya",
    region: "Tea Country",
    summary: "Cool-climate tea estate country with lake strolls, plantation visits, and slower pacing.",
    arrivalNote: "Strong for guests who want tea estates and cooler weather without a very long stay.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/c/c6/NuwaraEliya_from_top.jpg",
    point: pointFromGeo(6.9497, 80.7891),
    recommendedNights: { min: 1, ideal: 1, max: 2 },
    airportTransfer: { distanceKm: 165, driveHours: 5 },
    tags: ["Tea estates", "Cool weather", "Highland scenery"],
    keywords: ["nuwara eliya", "tea country", "tea factory", "gregory lake"],
    hotelKeywords: ["nuwara", "tea factory", "tea estate"],
    packageRegions: ["Tea Country"],
    next: ["ella", "kandy"],
  },
  {
    id: "ella",
    name: "Ella",
    shortName: "Ella",
    region: "Tea Country",
    summary: "A scenic hill-country stop built around train views, short hikes, and boutique mountain stays.",
    arrivalNote: "One of the best destinations for guests who want scenery and a softer activity mix.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/f6/The_Nine_Arches_Bridge.jpg",
    point: pointFromGeo(6.8667, 81.0466),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 210, driveHours: 5.5 },
    tags: ["Train views", "Tea hills", "Boutique stays"],
    keywords: ["ella", "nine arch", "little adam", "98 acres"],
    hotelKeywords: ["ella", "98 acres", "ekho"],
    packageRegions: ["Tea Country"],
    next: ["nuwara-eliya", "yala", "arugam-bay", "mirissa", "kandy"],
  },
  {
    id: "trincomalee",
    name: "Trincomalee",
    shortName: "Trinco",
    region: "East Coast",
    summary: "A classic east-coast stop for bays, fort views, and calm-season beach days.",
    arrivalNote: "Best used as a heritage-to-beach switch when the east coast is in season.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/4/44/Trincomalee_bay.jpg",
    point: pointFromGeo(8.5874, 81.2152),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 260, driveHours: 6 },
    tags: ["East coast", "Harbour views", "Beach stays"],
    keywords: ["trincomalee", "trinco", "nilaveli", "pigeon island"],
    hotelKeywords: ["trincomalee", "trinco", "nilaveli", "uppuveli"],
    packageRegions: ["Eastern Province"],
    next: ["pasikuda", "arugam-bay", "anuradhapura", "dambulla"],
  },
  {
    id: "yala",
    name: "Yala",
    shortName: "Yala",
    region: "Yala",
    summary: "A focused safari stop for wildlife, dune-backed coastline, and early game drive departures.",
    arrivalNote: "Best as a 1-2 night wildlife pivot between the hill country and south coast.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Yala_Beach.jpg/3840px-Yala_Beach.jpg",
    point: pointFromGeo(6.3725, 81.5185),
    recommendedNights: { min: 1, ideal: 2, max: 2 },
    airportTransfer: { distanceKm: 280, driveHours: 5.5 },
    tags: ["Safari", "Wild coast", "Lodge stays"],
    keywords: ["yala", "safari", "wild", "jetwing yala", "cinnamon wild"],
    hotelKeywords: ["yala", "kirinda", "cinnamon wild", "jetwing yala"],
    packageRegions: ["Yala"],
    next: ["ella", "tangalle", "arugam-bay"],
  },
  {
    id: "galle",
    name: "Galle",
    shortName: "Galle",
    region: "Southern Coast",
    summary: "An easy south-coast base for fort walks, beach time, and slower oceanfront nights.",
    arrivalNote: "Best for guests who want a soft coastal finish or a direct airport-to-beach route.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/7/77/Galle_Fort.jpg",
    point: pointFromGeo(6.0535, 80.221),
    recommendedNights: { min: 1, ideal: 3, max: 4 },
    airportTransfer: { distanceKm: 155, driveHours: 3 },
    tags: ["Coastal finish", "Fort walks", "Beach time"],
    keywords: ["galle", "southern coast", "unawatuna", "fort bazaar"],
    hotelKeywords: ["galle", "unawatuna", "fort", "lighthouse"],
    packageRegions: ["Southern Coast"],
    next: ["bentota", "mirissa", "tangalle", "colombo"],
  },
  {
    id: "bentota",
    name: "Bentota",
    shortName: "Bentota",
    region: "Southwest Coast",
    summary: "A softer southwest beach base with river safaris and lower-effort airport access.",
    arrivalNote: "Best for guests who want beach time without pushing too far south on day one.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/6/60/Bentota_beach.jpg",
    point: pointFromGeo(6.4218, 79.9951),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 110, driveHours: 2.2 },
    tags: ["Easy beach start", "River safari", "Shorter transfer"],
    keywords: ["bentota", "balapitiya", "madu river"],
    hotelKeywords: ["bentota", "balapitiya", "river"],
    packageRegions: ["Southern Coast", "Colombo"],
    next: ["galle", "colombo", "negombo", "kandy"],
  },
  {
    id: "mirissa",
    name: "Mirissa",
    shortName: "Mirissa",
    region: "Southern Coast",
    summary: "A more youthful south-coast stop for whale season, surf pockets, and beach-town energy.",
    arrivalNote: "Works best after Galle or Tangalle when guests want a proper beach block.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/1/1d/Mirissa_Beach.jpg",
    point: pointFromGeo(5.9483, 80.4583),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 180, driveHours: 3.5 },
    tags: ["Whale season", "Beach town", "Surf pockets"],
    keywords: ["mirissa", "weligama", "whale", "surf"],
    hotelKeywords: ["mirissa", "weligama", "cape weligama"],
    packageRegions: ["Southern Coast"],
    next: ["galle", "tangalle", "bentota"],
  },
  {
    id: "tangalle",
    name: "Tangalle",
    shortName: "Tangalle",
    region: "Deep South Coast",
    summary: "A quieter deep-south coast stop with long beaches and easier access to Yala than Galle.",
    arrivalNote: "Useful as the softer bridge between safari country and the southern coast.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/2/24/Tangalle_Beach.jpg",
    point: pointFromGeo(6.0243, 80.7981),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 220, driveHours: 4.3 },
    tags: ["Deep south", "Quiet beaches", "Safari bridge"],
    keywords: ["tangalle", "rekawa", "peace haven"],
    hotelKeywords: ["tangalle", "rekawa", "peace haven"],
    packageRegions: ["Southern Coast", "Yala"],
    next: ["yala", "mirissa", "galle"],
  },
  {
    id: "pasikuda",
    name: "Pasikuda",
    shortName: "Pasikuda",
    region: "Eastern Province",
    summary: "A calmer east-coast add-on built around reef water, bay resorts, and warm-season beach time.",
    arrivalNote: "Useful as a longer beach extension once the inland route is already shaped well.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Pasikudah_beach.JPG/1920px-Pasikudah_beach.JPG",
    point: pointFromGeo(7.928, 81.5616),
    recommendedNights: { min: 1, ideal: 3, max: 4 },
    airportTransfer: { distanceKm: 280, driveHours: 6.5 },
    tags: ["East coast water", "Lagoon calm", "Beach extension"],
    keywords: ["pasikuda", "pasikudah", "trincomalee", "east coast", "eastern province"],
    hotelKeywords: ["pasikuda", "pasikudah", "trincomalee", "east coast"],
    packageRegions: ["Eastern Province"],
    next: ["trincomalee", "arugam-bay", "dambulla", "sigiriya"],
  },
  {
    id: "arugam-bay",
    name: "Arugam Bay",
    shortName: "Arugam",
    region: "Southeast Coast",
    summary: "A farther southeast surf and lagoon extension that works best on longer island circuits.",
    arrivalNote: "Best for surfers or east-coast travellers who can absorb a longer regional transfer.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/5e/Arugam_Bay_Beach.jpg",
    point: pointFromGeo(6.8404, 81.8352),
    recommendedNights: { min: 1, ideal: 2, max: 3 },
    airportTransfer: { distanceKm: 320, driveHours: 6.5 },
    tags: ["Surf coast", "Lagoon trips", "Longer extension"],
    keywords: ["arugam bay", "surf", "pottuvil", "lagoon"],
    hotelKeywords: ["arugam", "pottuvil", "jetwing surf"],
    packageRegions: ["Eastern Province"],
    next: ["pasikuda", "trincomalee", "yala", "ella"],
  },
  {
    id: "jaffna",
    name: "Jaffna",
    shortName: "Jaffna",
    region: "Northern Peninsula",
    summary: "A northern extension for guests who want a broader island narrative beyond the classic circuit.",
    arrivalNote: "This is for longer trips only. It works best after Anuradhapura rather than as an early stop.",
    previewImageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/8/8b/Jaffna_Fort.JPG",
    point: pointFromGeo(9.6615, 80.0255),
    recommendedNights: { min: 1, ideal: 2, max: 2 },
    airportTransfer: { distanceKm: 390, driveHours: 7.5 },
    tags: ["Northern culture", "Forts", "Longer route"],
    keywords: ["jaffna", "nallur", "fort", "northern"],
    hotelKeywords: ["jaffna", "nallur", "north gate"],
    packageRegions: [],
    next: ["anuradhapura"],
  },
];

const plannerLegs: PlannerLeg[] = [
  {
    from: "airport",
    to: "negombo",
    distanceKm: 15,
    driveHours: 0.4,
    scenicNote: "Very short arrival transfer that keeps the first day light.",
  },
  {
    from: "airport",
    to: "colombo",
    distanceKm: 35,
    driveHours: 1,
    scenicNote: "A clean airport-to-city run for guests who want restaurants and skyline energy.",
  },
  {
    from: "airport",
    to: "bentota",
    distanceKm: 110,
    driveHours: 2.2,
    scenicNote: "A smooth expressway run for guests who want the beach early without going too far south.",
  },
  {
    from: "airport",
    to: "kandy",
    distanceKm: 115,
    driveHours: 3.5,
    scenicNote: "A comfortable first inland transfer into Sri Lanka's cultural hill gateway.",
  },
  {
    from: "airport",
    to: "dambulla",
    distanceKm: 150,
    driveHours: 3.7,
    scenicNote: "A direct inland move that sets up the cultural triangle without making the first day too hard.",
  },
  {
    from: "airport",
    to: "sigiriya",
    distanceKm: 165,
    driveHours: 4,
    scenicNote: "A direct inland move that works best on morning arrivals.",
  },
  {
    from: "airport",
    to: "kalpitiya",
    distanceKm: 145,
    driveHours: 3.2,
    scenicNote: "A northwest coastal start for guests who want water and wind instead of the southern beach line.",
  },
  {
    from: "negombo",
    to: "colombo",
    distanceKm: 40,
    driveHours: 1.2,
    scenicNote: "A short west-coast hop if the guest wants a city night after arrival.",
  },
  {
    from: "negombo",
    to: "kalpitiya",
    distanceKm: 130,
    driveHours: 3,
    scenicNote: "A northwestern move that still keeps the day manageable after arrival.",
  },
  {
    from: "negombo",
    to: "kandy",
    distanceKm: 115,
    driveHours: 3.5,
    scenicNote: "Simple airport-side start before moving uphill.",
  },
  {
    from: "negombo",
    to: "dambulla",
    distanceKm: 145,
    driveHours: 3.5,
    scenicNote: "A clean first inland leg once the jetlag buffer night is done.",
  },
  {
    from: "negombo",
    to: "bentota",
    distanceKm: 125,
    driveHours: 2.5,
    scenicNote: "A west-coast arrival stay before sliding down to the beach belt.",
  },
  {
    from: "colombo",
    to: "bentota",
    distanceKm: 85,
    driveHours: 1.5,
    scenicNote: "One of the easiest west-to-southwest shifts in the planner.",
  },
  {
    from: "colombo",
    to: "kandy",
    distanceKm: 115,
    driveHours: 3.5,
    scenicNote: "A classic city-to-hill-country transition.",
  },
  {
    from: "colombo",
    to: "dambulla",
    distanceKm: 155,
    driveHours: 4,
    scenicNote: "Longer than Kandy, but still a realistic heritage-first move from the city.",
  },
  {
    from: "colombo",
    to: "sigiriya",
    distanceKm: 170,
    driveHours: 4.5,
    scenicNote: "The long-but-still-manageable city jump for guests who want to front-load heritage.",
  },
  {
    from: "kalpitiya",
    to: "anuradhapura",
    distanceKm: 150,
    driveHours: 3.2,
    scenicNote: "A northwestern coast to ancient-city jump that opens the north cleanly.",
  },
  {
    from: "anuradhapura",
    to: "dambulla",
    distanceKm: 75,
    driveHours: 1.7,
    scenicNote: "A very workable heritage shift through the north-central plains.",
  },
  {
    from: "anuradhapura",
    to: "sigiriya",
    distanceKm: 85,
    driveHours: 1.9,
    scenicNote: "Short enough to combine northern heritage with Sigiriya without route fatigue.",
  },
  {
    from: "anuradhapura",
    to: "trincomalee",
    distanceKm: 110,
    driveHours: 2.8,
    scenicNote: "A strong north-to-east handoff for a bigger island loop.",
  },
  {
    from: "anuradhapura",
    to: "jaffna",
    distanceKm: 190,
    driveHours: 3.5,
    scenicNote: "A longer northern leg that still works on extended circuits.",
  },
  {
    from: "dambulla",
    to: "sigiriya",
    distanceKm: 25,
    driveHours: 0.5,
    scenicNote: "A short hop that lets guests separate the cave temples from the Sigiriya base if they want to.",
  },
  {
    from: "dambulla",
    to: "kandy",
    distanceKm: 75,
    driveHours: 2.3,
    scenicNote: "A very standard culture-to-hills transition.",
  },
  {
    from: "dambulla",
    to: "trincomalee",
    distanceKm: 105,
    driveHours: 2.5,
    scenicNote: "A realistic switch from the cultural triangle to the east coast.",
  },
  {
    from: "dambulla",
    to: "pasikuda",
    distanceKm: 145,
    driveHours: 3.5,
    scenicNote: "A longer but still comfortable inland-to-east-coast move.",
  },
  {
    from: "sigiriya",
    to: "kandy",
    distanceKm: 90,
    driveHours: 2.5,
    scenicNote: "A comfortable culture-to-hills link.",
  },
  {
    from: "sigiriya",
    to: "trincomalee",
    distanceKm: 100,
    driveHours: 2.6,
    scenicNote: "One of the cleanest ways to move from heritage into the east coast.",
  },
  {
    from: "sigiriya",
    to: "pasikuda",
    distanceKm: 150,
    driveHours: 3.5,
    scenicNote: "A realistic cross-island move if the guest wants an east-coast finish.",
  },
  {
    from: "kandy",
    to: "nuwara-eliya",
    distanceKm: 80,
    driveHours: 2.5,
    scenicNote: "A strong tea-country handoff with manageable road time.",
  },
  {
    from: "kandy",
    to: "ella",
    distanceKm: 135,
    driveHours: 4,
    scenicNote: "Longer than Nuwara Eliya, but still comfortable enough as one scenic leg.",
  },
  {
    from: "kandy",
    to: "bentota",
    distanceKm: 185,
    driveHours: 4.5,
    scenicNote: "A manageable drop from the hills to the southwest coast when beach time is next.",
  },
  {
    from: "nuwara-eliya",
    to: "ella",
    distanceKm: 60,
    driveHours: 2,
    scenicNote: "One of the lightest and prettiest mountain transfers in the planner.",
  },
  {
    from: "ella",
    to: "yala",
    distanceKm: 115,
    driveHours: 2.5,
    scenicNote: "A very workable switch from hill views to safari country.",
  },
  {
    from: "ella",
    to: "arugam-bay",
    distanceKm: 135,
    driveHours: 3.5,
    scenicNote: "A southeastern descent that works best when the guest specifically wants surf coast time.",
  },
  {
    from: "ella",
    to: "mirissa",
    distanceKm: 200,
    driveHours: 4.5,
    scenicNote: "A longer coast descent that still stays under the comfort cap.",
  },
  {
    from: "trincomalee",
    to: "pasikuda",
    distanceKm: 110,
    driveHours: 2.2,
    scenicNote: "A clean east-coast progression southward.",
  },
  {
    from: "trincomalee",
    to: "arugam-bay",
    distanceKm: 215,
    driveHours: 5,
    scenicNote: "A longer east-coast drive that still works for dedicated beach itineraries.",
  },
  {
    from: "pasikuda",
    to: "arugam-bay",
    distanceKm: 145,
    driveHours: 3.2,
    scenicNote: "A southbound east-coast link that keeps the route on the shoreline side of the island.",
  },
  {
    from: "yala",
    to: "tangalle",
    distanceKm: 100,
    driveHours: 2.1,
    scenicNote: "A soft wildlife-to-beach bridge with much less road than Yala to Galle.",
  },
  {
    from: "yala",
    to: "arugam-bay",
    distanceKm: 145,
    driveHours: 3.5,
    scenicNote: "A southeastern wildlife-to-surf move for longer custom routes.",
  },
  {
    from: "tangalle",
    to: "mirissa",
    distanceKm: 65,
    driveHours: 1.4,
    scenicNote: "A short deep-south to surf-coast shift that keeps the beach segment easy.",
  },
  {
    from: "tangalle",
    to: "galle",
    distanceKm: 110,
    driveHours: 2.2,
    scenicNote: "A deep-south to fort-coast progression without route strain.",
  },
  {
    from: "mirissa",
    to: "galle",
    distanceKm: 45,
    driveHours: 1,
    scenicNote: "An easy coastal hop for guests who want a final fort-town night.",
  },
  {
    from: "mirissa",
    to: "bentota",
    distanceKm: 95,
    driveHours: 2,
    scenicNote: "A clean move up the coast if the guest wants a shorter airport run at the end.",
  },
  {
    from: "galle",
    to: "bentota",
    distanceKm: 65,
    driveHours: 1.2,
    scenicNote: "One of the simplest southern coast legs in the planner.",
  },
  {
    from: "galle",
    to: "colombo",
    distanceKm: 130,
    driveHours: 2.5,
    scenicNote: "A reliable fort-to-capital move on the expressway.",
  },
];

const destinationActivities: PlannerActivity[] = [
  {
    id: "negombo_lagoon",
    destinationId: "negombo",
    title: "Negombo lagoon boat ride",
    summary: "A gentle first-day lagoon cruise with birdlife and fishing-craft views.",
    durationLabel: "2 hours",
    energy: "easy",
    bestFor: "Late arrivals and recovery days",
    estimatedPrice: 28,
    tags: ["Lagoon", "Sunset", "Boat"],
  },
  {
    id: "negombo_market",
    destinationId: "negombo",
    title: "Fish market and church quarter walk",
    summary: "Walk the old-town lanes and shoreline market before an early dinner.",
    durationLabel: "2.5 hours",
    energy: "easy",
    bestFor: "Arrival night culture",
    estimatedPrice: 18,
    tags: ["Market", "Walk", "Culture"],
  },
  {
    id: "colombo_temple",
    destinationId: "colombo",
    title: "Gangaramaya and lakefront city loop",
    summary: "A private city circuit through temples, colonial edges, and the waterfront.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "First or final day sightseeing",
    estimatedPrice: 24,
    tags: ["Temple", "City", "Culture"],
  },
  {
    id: "colombo_food",
    destinationId: "colombo",
    title: "Colombo dining and design district evening",
    summary: "A curated evening around galleries, cafes, and a proper dinner stop.",
    durationLabel: "3.5 hours",
    energy: "easy",
    bestFor: "Couples and urban short stays",
    estimatedPrice: 38,
    tags: ["Food", "City", "Evening"],
  },
  {
    id: "sigiriya_rock",
    destinationId: "sigiriya",
    title: "Sigiriya sunrise climb",
    summary: "The signature heritage morning with early light and the cleanest temperatures.",
    durationLabel: "3 hours",
    energy: "active",
    bestFor: "First heritage morning",
    estimatedPrice: 42,
    tags: ["UNESCO", "Sunrise", "Climb"],
  },
  {
    id: "sigiriya_dambulla",
    destinationId: "sigiriya",
    title: "Dambulla cave temple visit",
    summary: "Layer the route with painted caves, shrine halls, and a shorter heritage stop.",
    durationLabel: "2 hours",
    energy: "moderate",
    bestFor: "Culture-focused guests",
    estimatedPrice: 20,
    tags: ["Temple", "Culture", "History"],
  },
  {
    id: "sigiriya_safari",
    destinationId: "sigiriya",
    title: "Minneriya or eco-park safari",
    summary: "An evening wildlife drive that pairs well with a heritage base.",
    durationLabel: "4 hours",
    energy: "easy",
    bestFor: "Families and wildlife lovers",
    estimatedPrice: 55,
    tags: ["Wildlife", "Jeep", "Nature"],
  },
  {
    id: "kandy_temple",
    destinationId: "kandy",
    title: "Temple of the Tooth and upper-lake walk",
    summary: "A compact cultural loop that works well on a 1-night stay.",
    durationLabel: "2.5 hours",
    energy: "easy",
    bestFor: "Short cultural stops",
    estimatedPrice: 20,
    tags: ["Temple", "Walk", "Culture"],
  },
  {
    id: "kandy_gardens",
    destinationId: "kandy",
    title: "Peradeniya botanical gardens",
    summary: "A quieter half-day among giant trees and planted avenue views.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "Soft scenic afternoons",
    estimatedPrice: 18,
    tags: ["Gardens", "Scenic", "Relaxed"],
  },
  {
    id: "nuwara_tea",
    destinationId: "nuwara-eliya",
    title: "Tea estate and factory visit",
    summary: "An easy highland afternoon built around tea processing and tastings.",
    durationLabel: "2.5 hours",
    energy: "easy",
    bestFor: "Tea-country first timers",
    estimatedPrice: 22,
    tags: ["Tea", "Estate", "Scenic"],
  },
  {
    id: "nuwara_horton",
    destinationId: "nuwara-eliya",
    title: "Horton Plains dawn start",
    summary: "An active early outing for travellers who want cooler-weather walking.",
    durationLabel: "5 hours",
    energy: "active",
    bestFor: "Hikers",
    estimatedPrice: 48,
    tags: ["Hike", "Dawn", "Nature"],
  },
  {
    id: "ella_bridge",
    destinationId: "ella",
    title: "Nine Arch Bridge and village loop",
    summary: "The cleanest way to see Ella's iconic rail view without overcomplicating the day.",
    durationLabel: "2 hours",
    energy: "moderate",
    bestFor: "First-time Ella stays",
    estimatedPrice: 16,
    tags: ["Bridge", "Walk", "Views"],
  },
  {
    id: "ella_peak",
    destinationId: "ella",
    title: "Little Adam's Peak sunrise hike",
    summary: "A short high-reward hill walk that fits even into relaxed itineraries.",
    durationLabel: "2.5 hours",
    energy: "moderate",
    bestFor: "Scenic mornings",
    estimatedPrice: 14,
    tags: ["Hike", "Sunrise", "Views"],
  },
  {
    id: "ella_cook",
    destinationId: "ella",
    title: "Hill-country cooking session",
    summary: "A lower-energy afternoon with local dishes and tea-country ingredients.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "Couples and families",
    estimatedPrice: 32,
    tags: ["Food", "Hands-on", "Local"],
  },
  {
    id: "yala_safari",
    destinationId: "yala",
    title: "Dawn safari in Yala National Park",
    summary: "The route's signature wildlife experience and the clearest reason to stop here.",
    durationLabel: "5 hours",
    energy: "easy",
    bestFor: "Wildlife-first trips",
    estimatedPrice: 78,
    tags: ["Safari", "Wildlife", "Dawn"],
  },
  {
    id: "yala_sundowner",
    destinationId: "yala",
    title: "Wild-coast sundowner drive",
    summary: "A slower evening option for guests who want landscape without another full safari.",
    durationLabel: "2.5 hours",
    energy: "easy",
    bestFor: "Couples and soft landings",
    estimatedPrice: 36,
    tags: ["Sunset", "Coast", "Nature"],
  },
  {
    id: "galle_fort",
    destinationId: "galle",
    title: "Galle Fort at golden hour",
    summary: "The best low-friction activity on the south coast and easy to pair with dinner.",
    durationLabel: "2 hours",
    energy: "easy",
    bestFor: "Every south-coast route",
    estimatedPrice: 18,
    tags: ["Fort", "Walk", "Sunset"],
  },
  {
    id: "galle_surf",
    destinationId: "galle",
    title: "South-coast surf or swim session",
    summary: "A flexible beach block that keeps the route from feeling too heavy.",
    durationLabel: "3 hours",
    energy: "moderate",
    bestFor: "Beach mornings",
    estimatedPrice: 34,
    tags: ["Beach", "Surf", "Coast"],
  },
  {
    id: "galle_cooking",
    destinationId: "galle",
    title: "Private coastal cooking class",
    summary: "A stronger rainy-day or family-friendly option than another long transfer day.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "Families and food-focused trips",
    estimatedPrice: 40,
    tags: ["Food", "Hands-on", "Coast"],
  },
  {
    id: "pasikuda_snorkel",
    destinationId: "pasikuda",
    title: "Lagoon swim and snorkel session",
    summary: "The easiest way to use Pasikuda's shallow water and calm bay conditions.",
    durationLabel: "2.5 hours",
    energy: "easy",
    bestFor: "Warm-season beach extensions",
    estimatedPrice: 30,
    tags: ["Snorkel", "Beach", "Water"],
  },
  {
    id: "pasikuda_catamaran",
    destinationId: "pasikuda",
    title: "East-coast sunset cruise",
    summary: "A simple premium add-on when the route is already ending with beach time.",
    durationLabel: "2 hours",
    energy: "easy",
    bestFor: "Couples and longer beach stays",
    estimatedPrice: 42,
    tags: ["Cruise", "Sunset", "Beach"],
  },
  {
    id: "kalpitiya_dolphins",
    destinationId: "kalpitiya",
    title: "Kalpitiya dolphin-watching cruise",
    summary: "A marine morning built around the northwest coast's dolphin water.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "Coastal starters",
    estimatedPrice: 34,
    tags: ["Boat", "Marine life", "Northwest coast"],
  },
  {
    id: "kalpitiya_kitesurf",
    destinationId: "kalpitiya",
    title: "Lagoon kitesurf lesson",
    summary: "A higher-energy wind session for guests who want sport built into the route.",
    durationLabel: "2.5 hours",
    energy: "active",
    bestFor: "Adventure travellers",
    estimatedPrice: 58,
    tags: ["Water sport", "Lagoon", "Active"],
  },
  {
    id: "anuradhapura_ruins",
    destinationId: "anuradhapura",
    title: "Sacred city cycling loop",
    summary: "A calm heritage day through major ruins and dagoba sites without heavy vehicle time.",
    durationLabel: "4 hours",
    energy: "moderate",
    bestFor: "History-focused routes",
    estimatedPrice: 26,
    tags: ["Heritage", "Cycle", "Ancient city"],
  },
  {
    id: "anuradhapura_mihintale",
    destinationId: "anuradhapura",
    title: "Mihintale hill visit",
    summary: "A shorter add-on for guests who want a spiritual high point in the northern heritage circuit.",
    durationLabel: "2 hours",
    energy: "moderate",
    bestFor: "Sacred-site travellers",
    estimatedPrice: 18,
    tags: ["Sacred site", "Views", "Culture"],
  },
  {
    id: "dambulla_caves",
    destinationId: "dambulla",
    title: "Dambulla cave temple visit",
    summary: "A compact cultural stop with strong reward and very little route disruption.",
    durationLabel: "2 hours",
    energy: "moderate",
    bestFor: "One-night heritage stays",
    estimatedPrice: 20,
    tags: ["Temple", "Culture", "History"],
  },
  {
    id: "dambulla_village",
    destinationId: "dambulla",
    title: "Village lake and cooking visit",
    summary: "A softer countryside block that balances the heavier UNESCO stops nearby.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "Families and cultural pacing",
    estimatedPrice: 24,
    tags: ["Village", "Food", "Lake"],
  },
  {
    id: "trinco_pigeon",
    destinationId: "trincomalee",
    title: "Pigeon Island snorkel trip",
    summary: "The cleanest east-coast activity for warm-season beach itineraries.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "Beach extensions",
    estimatedPrice: 36,
    tags: ["Snorkel", "Boat", "East coast"],
  },
  {
    id: "trinco_fort",
    destinationId: "trincomalee",
    title: "Fort Frederick and harbour loop",
    summary: "A lighter culture block that works between beach time and departure transfers.",
    durationLabel: "2 hours",
    energy: "easy",
    bestFor: "Mixed culture-beach routes",
    estimatedPrice: 18,
    tags: ["Fort", "Harbour", "Culture"],
  },
  {
    id: "bentota_river",
    destinationId: "bentota",
    title: "Madu River mangrove cruise",
    summary: "A relaxed southwest-coast activity that gives the beach segment more variety.",
    durationLabel: "2.5 hours",
    energy: "easy",
    bestFor: "Arrival or departure beach stays",
    estimatedPrice: 24,
    tags: ["River", "Mangrove", "Boat"],
  },
  {
    id: "bentota_beach",
    destinationId: "bentota",
    title: "Bentota beach and watersport block",
    summary: "A simple half-day beach slot for travellers who want a lower-friction coast stay.",
    durationLabel: "3 hours",
    energy: "moderate",
    bestFor: "Short coast stays",
    estimatedPrice: 28,
    tags: ["Beach", "Water sport", "Relaxed"],
  },
  {
    id: "mirissa_whales",
    destinationId: "mirissa",
    title: "Mirissa whale season cruise",
    summary: "The big reason to place Mirissa in-season rather than just treating it as another beach stop.",
    durationLabel: "4 hours",
    energy: "easy",
    bestFor: "Seasonal south-coast routes",
    estimatedPrice: 52,
    tags: ["Whales", "Boat", "Seasonal"],
  },
  {
    id: "mirissa_surf",
    destinationId: "mirissa",
    title: "Surf and beach town morning",
    summary: "A lighter south-coast activity mix around Weligama and Mirissa.",
    durationLabel: "3 hours",
    energy: "moderate",
    bestFor: "Beach-focused trips",
    estimatedPrice: 30,
    tags: ["Surf", "Beach", "Town"],
  },
  {
    id: "tangalle_turtles",
    destinationId: "tangalle",
    title: "Rekawa turtle-watch outing",
    summary: "A lower-key night activity that gives Tangalle its own identity inside the route.",
    durationLabel: "2 hours",
    energy: "easy",
    bestFor: "Couples and wildlife add-ons",
    estimatedPrice: 22,
    tags: ["Wildlife", "Night", "Coast"],
  },
  {
    id: "tangalle_beach",
    destinationId: "tangalle",
    title: "Cliffside beach and spa day",
    summary: "A recovery stop between safari and the surfier south-coast sections.",
    durationLabel: "Half day",
    energy: "easy",
    bestFor: "Soft pacing",
    estimatedPrice: 34,
    tags: ["Beach", "Spa", "Relaxed"],
  },
  {
    id: "arugam_surf",
    destinationId: "arugam-bay",
    title: "Arugam Bay surf session",
    summary: "The defining experience here and the main reason to route the guest into the southeast coast.",
    durationLabel: "3 hours",
    energy: "active",
    bestFor: "Surf travellers",
    estimatedPrice: 34,
    tags: ["Surf", "Southeast", "Active"],
  },
  {
    id: "arugam_lagoon",
    destinationId: "arugam-bay",
    title: "Pottuvil lagoon safari",
    summary: "A softer wildlife-water option that balances the surf energy of the bay.",
    durationLabel: "2.5 hours",
    energy: "easy",
    bestFor: "Mixed surf and nature trips",
    estimatedPrice: 28,
    tags: ["Lagoon", "Birdlife", "Nature"],
  },
  {
    id: "jaffna_fort",
    destinationId: "jaffna",
    title: "Jaffna fort and peninsula city loop",
    summary: "A northern culture day that changes the tone of the trip from the southern classic circuit.",
    durationLabel: "3 hours",
    energy: "easy",
    bestFor: "Longer island journeys",
    estimatedPrice: 24,
    tags: ["Fort", "North", "Culture"],
  },
  {
    id: "jaffna_islands",
    destinationId: "jaffna",
    title: "Northern islands excursion",
    summary: "A slower excursion that gives the peninsula a proper reason to stay two nights.",
    durationLabel: "4 hours",
    energy: "easy",
    bestFor: "Long-form cultural routes",
    estimatedPrice: 42,
    tags: ["Islands", "Boat", "North"],
  },
];

const routeLibraryHotels: Partial<Record<
  Exclude<PlannerDestinationId, "airport">,
  Array<{
    id: string;
    name: string;
    location: string;
    pricePerNight: number;
    currency: string;
    starRating?: number;
  }>
>> = {
  negombo: [
    {
      id: "route_jetwing_lagoon",
      name: "Jetwing Lagoon",
      location: "Negombo",
      pricePerNight: 120,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_heritance_negombo",
      name: "Heritance Negombo",
      location: "Negombo",
      pricePerNight: 145,
      currency: "USD",
      starRating: 5,
    },
  ],
  colombo: [
    {
      id: "route_shangri_la_colombo",
      name: "Shangri-La Colombo",
      location: "Colombo",
      pricePerNight: 250,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_galle_face_hotel",
      name: "Galle Face Hotel",
      location: "Colombo",
      pricePerNight: 210,
      currency: "USD",
      starRating: 5,
    },
  ],
  kalpitiya: [
    {
      id: "route_bar_reef",
      name: "Bar Reef Resort",
      location: "Kalpitiya",
      pricePerNight: 145,
      currency: "USD",
      starRating: 4,
    },
    {
      id: "route_palagama",
      name: "Palagama Beach",
      location: "Kalpitiya",
      pricePerNight: 135,
      currency: "USD",
      starRating: 4,
    },
  ],
  anuradhapura: [
    {
      id: "route_rajarata",
      name: "Rajarata Hotel",
      location: "Anuradhapura",
      pricePerNight: 95,
      currency: "USD",
      starRating: 4,
    },
    {
      id: "route_ulagala",
      name: "Uga Ulagalla",
      location: "Anuradhapura",
      pricePerNight: 220,
      currency: "USD",
      starRating: 5,
    },
  ],
  dambulla: [
    {
      id: "route_jetwing_lake",
      name: "Jetwing Lake",
      location: "Dambulla",
      pricePerNight: 150,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_amaya_lake",
      name: "Amaya Lake",
      location: "Dambulla",
      pricePerNight: 145,
      currency: "USD",
      starRating: 4,
    },
  ],
  sigiriya: [
    {
      id: "route_heritance_kandalama",
      name: "Heritance Kandalama",
      location: "Dambulla",
      pricePerNight: 185,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_aliya_resort",
      name: "Aliya Resort",
      location: "Sigiriya",
      pricePerNight: 160,
      currency: "USD",
      starRating: 4,
    },
  ],
  kandy: [
    {
      id: "route_cinnamon_citadel",
      name: "Cinnamon Citadel",
      location: "Kandy",
      pricePerNight: 150,
      currency: "USD",
      starRating: 4,
    },
    {
      id: "route_theva_residency",
      name: "Theva Residency",
      location: "Kandy",
      pricePerNight: 170,
      currency: "USD",
      starRating: 4,
    },
  ],
  "nuwara-eliya": [
    {
      id: "route_heritance_tea_factory",
      name: "Heritance Tea Factory",
      location: "Nuwara Eliya",
      pricePerNight: 200,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_grand_hotel",
      name: "Grand Hotel Nuwara Eliya",
      location: "Nuwara Eliya",
      pricePerNight: 175,
      currency: "USD",
      starRating: 4,
    },
  ],
  ella: [
    {
      id: "route_98_acres",
      name: "98 Acres",
      location: "Ella",
      pricePerNight: 150,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_ekho_ella",
      name: "EKHO Ella",
      location: "Ella",
      pricePerNight: 140,
      currency: "USD",
      starRating: 4,
    },
  ],
  trincomalee: [
    {
      id: "route_trinco_blu",
      name: "Trinco Blu",
      location: "Trincomalee",
      pricePerNight: 165,
      currency: "USD",
      starRating: 4,
    },
    {
      id: "route_jungle_beach",
      name: "Jungle Beach",
      location: "Trincomalee",
      pricePerNight: 220,
      currency: "USD",
      starRating: 5,
    },
  ],
  yala: [
    {
      id: "route_cinnamon_wild",
      name: "Cinnamon Wild",
      location: "Yala",
      pricePerNight: 220,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_jetwing_yala",
      name: "Jetwing Yala",
      location: "Yala",
      pricePerNight: 180,
      currency: "USD",
      starRating: 5,
    },
  ],
  galle: [
    {
      id: "route_fort_bazaar",
      name: "Fort Bazaar",
      location: "Galle",
      pricePerNight: 95,
      currency: "USD",
      starRating: 4,
    },
    {
      id: "route_jetwing_lighthouse",
      name: "Jetwing Lighthouse",
      location: "Galle",
      pricePerNight: 210,
      currency: "USD",
      starRating: 5,
    },
  ],
  bentota: [
    {
      id: "route_taj_bentota",
      name: "Taj Bentota Resort",
      location: "Bentota",
      pricePerNight: 185,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_cinnamon_bentota",
      name: "Cinnamon Bentota Beach",
      location: "Bentota",
      pricePerNight: 170,
      currency: "USD",
      starRating: 5,
    },
  ],
  mirissa: [
    {
      id: "route_cape_weligama",
      name: "Cape Weligama",
      location: "Mirissa",
      pricePerNight: 240,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_sri_sharavi",
      name: "Sri Sharavi Beach Villas",
      location: "Mirissa",
      pricePerNight: 180,
      currency: "USD",
      starRating: 4,
    },
  ],
  tangalle: [
    {
      id: "route_peace_haven",
      name: "Anantara Peace Haven",
      location: "Tangalle",
      pricePerNight: 235,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_buckingham_place",
      name: "Buckingham Place",
      location: "Tangalle",
      pricePerNight: 170,
      currency: "USD",
      starRating: 4,
    },
  ],
  pasikuda: [
    {
      id: "route_maalu_maalu",
      name: "Maalu Maalu Resort",
      location: "Pasikuda",
      pricePerNight: 165,
      currency: "USD",
      starRating: 4,
    },
    {
      id: "route_uga_bay",
      name: "Uga Bay",
      location: "Pasikuda",
      pricePerNight: 190,
      currency: "USD",
      starRating: 5,
    },
  ],
  "arugam-bay": [
    {
      id: "route_jetwing_surf",
      name: "Jetwing Surf",
      location: "Arugam Bay",
      pricePerNight: 195,
      currency: "USD",
      starRating: 5,
    },
    {
      id: "route_kottukal",
      name: "Kottukal Beach House",
      location: "Arugam Bay",
      pricePerNight: 175,
      currency: "USD",
      starRating: 4,
    },
  ],
  jaffna: [
    {
      id: "route_jetwing_jaffna",
      name: "Jetwing Jaffna",
      location: "Jaffna",
      pricePerNight: 140,
      currency: "USD",
      starRating: 4,
    },
    {
      id: "route_north_gate",
      name: "North Gate Jaffna",
      location: "Jaffna",
      pricePerNight: 120,
      currency: "USD",
      starRating: 4,
    },
  ],
};

const destinationMap = new Map(
  destinationList.map((destination) => [destination.id, destination])
);

const legMap = new Map<string, PlannerLeg>();
for (const leg of plannerLegs) {
  legMap.set(getLegKey(leg.from, leg.to), leg);
}

function getLegKey(a: PlannerDestinationId, b: PlannerDestinationId) {
  return [a, b].sort().join(":");
}

function normalizeText(value: string | undefined | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function textMatchesKeywords(text: string | undefined | null, keywords: string[]) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function collectPackageAccommodationOptions(pkg: TourPackage) {
  const options: PackageOption[] = [...(pkg.accommodationOptions ?? [])];

  for (const day of pkg.itinerary ?? []) {
    if (day.accommodationOptions?.length) {
      options.push(...day.accommodationOptions);
    }
  }

  return options;
}

function matchesDestinationPackage(
  destination: PlannerDestination,
  pkg: TourPackage
) {
  const searchable = [
    pkg.name,
    pkg.region,
    pkg.destination,
    pkg.description,
    ...pkg.itinerary.flatMap((day) => [
      day.title,
      day.description,
      day.accommodation,
      ...(day.accommodationOptions?.map((option) => option.label) ?? []),
    ]),
    ...(pkg.accommodationOptions?.map((option) => option.label) ?? []),
  ];

  if (
    destination.packageRegions.some(
      (region) => normalizeText(region) === normalizeText(pkg.region)
    )
  ) {
    return true;
  }

  return searchable.some((entry) =>
    textMatchesKeywords(entry, destination.keywords)
  );
}

function matchesDestinationHotel(
  destination: PlannerDestination,
  hotel: HotelSupplier
) {
  return (
    textMatchesKeywords(hotel.location, destination.hotelKeywords) ||
    textMatchesKeywords(hotel.name, destination.hotelKeywords) ||
    textMatchesKeywords(hotel.notes, destination.hotelKeywords)
  );
}

function dedupeHotels(hotels: PlannerHotelSuggestion[]) {
  const byName = new Map<string, PlannerHotelSuggestion>();

  for (const hotel of hotels) {
    const key = normalizeText(hotel.name);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, hotel);
      continue;
    }

    const sourcePriority = {
      supplier: 3,
      package_library: 2,
      route_library: 1,
    };

    if (sourcePriority[hotel.source] > sourcePriority[existing.source]) {
      byName.set(key, hotel);
      continue;
    }

    if (
      sourcePriority[hotel.source] === sourcePriority[existing.source] &&
      hotel.pricePerNight > 0 &&
      (existing.pricePerNight === 0 || hotel.pricePerNight < existing.pricePerNight)
    ) {
      byName.set(key, hotel);
    }
  }

  return [...byName.values()];
}

export function getPlannerDestinations() {
  return destinationList;
}

export function getPlannerDestination(id: PlannerDestinationId) {
  const destination = destinationMap.get(id);
  if (!destination) {
    throw new Error(`Unknown planner destination: ${id}`);
  }
  return destination;
}

export function getPlannerDestinationCoordinates(id: PlannerDestinationId) {
  return pointToGeo(getPlannerDestination(id).point);
}

export function getPlannerLeg(
  from: PlannerDestinationId,
  to: PlannerDestinationId
) {
  return legMap.get(getLegKey(from, to)) ?? null;
}

export function getSuggestedNextDestinations(routeIds: PlannerDestinationId[]) {
  const currentId = routeIds[routeIds.length - 1] ?? "airport";
  const current = getPlannerDestination(currentId);
  const visited = new Set(routeIds);

  const direct = current.next
    .filter((id) => !visited.has(id))
    .map((id) => {
      const leg = getPlannerLeg(currentId, id);
      return leg ? { destination: getPlannerDestination(id), leg } : null;
    })
    .filter(
      (entry): entry is { destination: PlannerDestination; leg: PlannerLeg } =>
        entry !== null
    );

  if (direct.length > 0) {
    return direct;
  }

  return destinationList
    .filter((destination) => destination.id !== "airport" && !visited.has(destination.id))
    .map((destination) => {
      const leg = getPlannerLeg(currentId, destination.id);
      return leg ? { destination, leg } : null;
    })
    .filter(
      (entry): entry is { destination: PlannerDestination; leg: PlannerLeg } =>
        entry !== null &&
        entry.leg.driveHours <= ROUTE_COMFORT_HARD_CAP_HOURS &&
        entry.leg.distanceKm <= ROUTE_COMFORT_MAX_KM
    )
    .sort((a, b) => a.leg.driveHours - b.leg.driveHours);
}

export function getPlannerActivities(destinationId: PlannerDestinationId) {
  return destinationActivities.filter(
    (activity) => activity.destinationId === destinationId
  );
}

export function getPlannerPackagesForDestination(
  destinationId: PlannerDestinationId,
  packages: TourPackage[]
): PlannerPackageInspiration[] {
  const destination = getPlannerDestination(destinationId);

  return packages
    .filter((pkg) => pkg.published !== false)
    .filter((pkg) => matchesDestinationPackage(destination, pkg))
    .slice(0, 3)
    .map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      region: pkg.region ?? pkg.destination,
      duration: pkg.duration,
      price: pkg.price,
      currency: pkg.currency,
      href: `/packages/${pkg.id}`,
    }));
}

export function getPlannerHotelsForDestination(
  destinationId: PlannerDestinationId,
  hotels: HotelSupplier[],
  packages: TourPackage[]
) {
  if (destinationId === "airport") return [] as PlannerHotelSuggestion[];

  const destination = getPlannerDestination(destinationId);
  const matchingPackages = packages.filter((pkg) =>
    matchesDestinationPackage(destination, pkg)
  );
  const packageOptions = matchingPackages.flatMap(collectPackageAccommodationOptions);
  const packageSupplierIds = new Set(
    packageOptions
      .map((option) => option.supplierId)
      .filter((supplierId): supplierId is string => Boolean(supplierId))
  );

  const supplierMatches = hotels
    .filter((hotel) => hotel.type === "hotel")
    .filter(
      (hotel) =>
        packageSupplierIds.has(hotel.id) || matchesDestinationHotel(destination, hotel)
    )
    .map((hotel) => {
      const packageOption = packageOptions.find(
        (option) => option.supplierId === hotel.id && option.price > 0
      );

      return {
        id: hotel.id,
        name: hotel.name,
        location: hotel.location ?? destination.name,
        pricePerNight:
          hotel.defaultPricePerNight ?? packageOption?.price ?? 0,
        currency: hotel.currency || matchingPackages[0]?.currency || "USD",
        starRating: hotel.starRating,
        source: "supplier" as const,
        sourceLabel: "From your supplier list",
        matchReason: packageSupplierIds.has(hotel.id)
          ? "Already linked to one or more published package options."
          : "Matched by hotel location and destination routing.",
        packageNames: matchingPackages
          .filter((pkg) =>
            collectPackageAccommodationOptions(pkg).some(
              (option) => option.supplierId === hotel.id
            )
          )
          .map((pkg) => pkg.name),
      };
    });

  const packageLibraryMatches = packageOptions
    .filter((option) => option.label.trim().length > 0)
    .map((option) => {
      const supplier = hotels.find((hotel) => hotel.id === option.supplierId);
      return {
        id: option.supplierId ?? `pkg_${option.id}`,
        name: supplier?.name ?? option.label,
        location: supplier?.location ?? destination.name,
        pricePerNight: option.price,
        currency: supplier?.currency ?? "USD",
        starRating: supplier?.starRating,
        source: "package_library" as const,
        sourceLabel: "From the package library",
        matchReason: "Derived from accommodation options already used in live packages.",
        packageNames: matchingPackages
          .filter((pkg) =>
            collectPackageAccommodationOptions(pkg).some(
              (pkgOption) => pkgOption.id === option.id
            )
          )
          .map((pkg) => pkg.name),
      };
    });

  const routeFallbackEntries =
    routeLibraryHotels[
      destinationId as Exclude<PlannerDestinationId, "airport">
    ] ?? [];

  const routeFallbacks = routeFallbackEntries.map((hotel) => ({
    ...hotel,
    source: "route_library" as const,
    sourceLabel: "From the route planner library",
    matchReason: "Fallback route-library stay to keep planning usable even before suppliers are fully mapped.",
    packageNames: matchingPackages.map((pkg) => pkg.name),
  }));

  return dedupeHotels([
    ...supplierMatches,
    ...packageLibraryMatches,
    ...routeFallbacks,
  ]).sort((a, b) => a.pricePerNight - b.pricePerNight);
}

export function getSuggestedNightsForDestination(
  destinationId: Exclude<PlannerDestinationId, "airport">,
  remainingNights?: number
) {
  const destination = getPlannerDestination(destinationId);

  if (remainingNights == null || remainingNights <= 0) {
    return destination.recommendedNights.ideal;
  }

  return Math.min(
    destination.recommendedNights.max,
    Math.max(destination.recommendedNights.min, remainingNights)
  );
}

export function sortPlannerHotelsForStayStyle(
  hotels: PlannerHotelSuggestion[],
  stayStyle: PlannerStayStyleId
) {
  const ranked = [...hotels];

  if (stayStyle === "classic") {
    return ranked.sort((a, b) => a.pricePerNight - b.pricePerNight);
  }

  if (stayStyle === "signature") {
    return ranked.sort((a, b) => {
      const starDelta = (b.starRating ?? 0) - (a.starRating ?? 0);
      if (starDelta !== 0) return starDelta;
      return b.pricePerNight - a.pricePerNight;
    });
  }

  return ranked.sort((a, b) => {
    const aScore = Math.abs(a.pricePerNight - 165);
    const bScore = Math.abs(b.pricePerNight - 165);
    if (aScore !== bScore) return aScore - bScore;
    return (b.starRating ?? 0) - (a.starRating ?? 0);
  });
}

export function pickDefaultPlannerHotel(
  hotels: PlannerHotelSuggestion[],
  stayStyle: PlannerStayStyleId
) {
  return sortPlannerHotelsForStayStyle(hotels, stayStyle)[0] ?? null;
}
