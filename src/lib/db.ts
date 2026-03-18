import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Lead, TourPackage, Tour, ItineraryDay } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

async function ensureDataDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // dir exists
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, file);
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, file);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// --- SEED (run once when empty) ---
const SEED_FLAG = ".seed_done";
async function maybeSeed() {
  const flagPath = path.join(DATA_DIR, SEED_FLAG);
  try {
    await readFile(flagPath, "utf-8");
    return; // already seeded
  } catch {
    // seed
  }
  await ensureDataDir();
  const { mockLeads } = await import("./mock-data");
  const { mockPackages } = await import("./mock-data");
  const { mockTours } = await import("./mock-data");
  await writeJson("leads.json", mockLeads);
  await writeJson("packages.json", mockPackages);
  await writeJson("tours.json", mockTours);
  await writeFile(flagPath, "seeded", "utf-8");
}

// --- BACKFILL: Client Portal leads missing references (run once) ---
const REF_BACKFILL_FLAG = ".ref_backfill_done";
async function maybeBackfillReferences(leads: Lead[]): Promise<Lead[]> {
  const flagPath = path.join(DATA_DIR, REF_BACKFILL_FLAG);
  try {
    await readFile(flagPath, "utf-8");
    return leads;
  } catch {
    // run backfill
  }
  let changed = false;
  for (let i = 0; i < leads.length; i++) {
    if (leads[i].source === "Client Portal" && !leads[i].reference) {
      leads[i] = { ...leads[i], reference: generateReference(), updatedAt: new Date().toISOString() };
      changed = true;
    }
  }
  if (changed) {
    await writeJson("leads.json", leads);
  }
  await writeFile(flagPath, "done", "utf-8");
  return leads;
}

// --- LEADS ---
export async function getLeads(): Promise<Lead[]> {
  let leads = await readJson<Lead[]>("leads.json", []);
  if (leads.length === 0) {
    await maybeSeed();
    leads = await readJson<Lead[]>("leads.json", []);
  }
  leads = await maybeBackfillReferences(leads);
  return leads;
}

export async function getLead(id: string): Promise<Lead | null> {
  const leads = await getLeads();
  return leads.find((l) => l.id === id) ?? null;
}

export async function getLeadByReference(ref: string): Promise<Lead | null> {
  const leads = await getLeads();
  return leads.find((l) => l.reference?.toUpperCase() === ref.trim().toUpperCase()) ?? null;
}

function generateReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PCT-${date}-${random}`;
}

export async function createLead(data: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead> {
  const leads = await getLeads();
  const now = new Date().toISOString();
  const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const reference = data.source === "Client Portal"
    ? (data.reference ?? generateReference())
    : data.reference;
  const lead: Lead = { ...data, id, reference, createdAt: now, updatedAt: now };
  leads.push(lead);
  await writeJson("leads.json", leads);
  return lead;
}

export async function updateLead(id: string, data: Partial<Omit<Lead, "id" | "createdAt">>): Promise<Lead | null> {
  const leads = await getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("leads.json", leads);
  return leads[idx];
}

export async function deleteLead(id: string): Promise<boolean> {
  const leads = await getLeads();
  const filtered = leads.filter((l) => l.id !== id);
  if (filtered.length === leads.length) return false;
  await writeJson("leads.json", filtered);
  return true;
}

// --- PACKAGES ---
export async function getPackages(): Promise<TourPackage[]> {
  const pkgs = await readJson<TourPackage[]>("packages.json", []);
  if (pkgs.length === 0) {
    await maybeSeed();
    return readJson<TourPackage[]>("packages.json", []);
  }
  return pkgs;
}

export async function getPackage(id: string): Promise<TourPackage | null> {
  const packages = await getPackages();
  return packages.find((p) => p.id === id) ?? null;
}

export async function createPackage(data: Omit<TourPackage, "id" | "createdAt">): Promise<TourPackage> {
  const packages = await getPackages();
  const id = `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const pkg: TourPackage = { ...data, id, createdAt: new Date().toISOString() };
  packages.push(pkg);
  await writeJson("packages.json", packages);
  return pkg;
}

export async function updatePackage(id: string, data: Partial<Omit<TourPackage, "id" | "createdAt">>): Promise<TourPackage | null> {
  const packages = await getPackages();
  const idx = packages.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  packages[idx] = { ...packages[idx], ...data };
  await writeJson("packages.json", packages);
  return packages[idx];
}

export async function deletePackage(id: string): Promise<boolean> {
  const packages = await getPackages();
  const filtered = packages.filter((p) => p.id !== id);
  if (filtered.length === packages.length) return false;
  await writeJson("packages.json", filtered);
  return true;
}

// --- TOURS ---
export async function getTours(): Promise<Tour[]> {
  const tours = await readJson<Tour[]>("tours.json", []);
  if (tours.length === 0) {
    await maybeSeed();
    return readJson<Tour[]>("tours.json", []);
  }
  return tours;
}

export async function getTour(id: string): Promise<Tour | null> {
  const tours = await getTours();
  return tours.find((t) => t.id === id) ?? null;
}

export async function createTour(data: Omit<Tour, "id">): Promise<Tour> {
  const tours = await getTours();
  const id = `tour_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const tour: Tour = { ...data, id };
  tours.push(tour);
  await writeJson("tours.json", tours);
  return tour;
}

export async function updateTour(id: string, data: Partial<Omit<Tour, "id">>): Promise<Tour | null> {
  const tours = await getTours();
  const idx = tours.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tours[idx] = { ...tours[idx], ...data };
  await writeJson("tours.json", tours);
  return tours[idx];
}

export async function deleteTour(id: string): Promise<boolean> {
  const tours = await getTours();
  const filtered = tours.filter((t) => t.id !== id);
  if (filtered.length === tours.length) return false;
  await writeJson("tours.json", filtered);
  return true;
}

// --- CLIENT PORTAL ---
export type ClientBookingResult =
  | { tour: Tour; package: TourPackage }
  | { pending: true; lead: Lead; package: TourPackage | null };

export async function getTourForClient(
  bookingRef: string,
  email: string
): Promise<ClientBookingResult | null> {
  const ref = bookingRef.trim();
  const emailNorm = email.trim().toLowerCase();

  // Try as tour id first
  const tour = await getTour(ref);
  if (tour) {
    const lead = await getLead(tour.leadId);
    if (!lead || lead.email.toLowerCase() !== emailNorm) return null;
    const pkg = await getPackage(tour.packageId);
    if (!pkg) return null;
    return { tour, package: pkg };
  }

  // Try as lead reference (e.g. PCT-20260312-A3B7)
  const lead = await getLeadByReference(ref);
  if (!lead || lead.email.toLowerCase() !== emailNorm) return null;

  // Check if there's a tour for this lead
  const tours = await getTours();
  const linkedTour = tours.find((t) => t.leadId === lead.id);
  if (linkedTour) {
    const pkg = await getPackage(linkedTour.packageId);
    if (!pkg) return null;
    return { tour: linkedTour, package: pkg };
  }

  // Pending request – no tour yet
  const pkg = lead.packageId ? await getPackage(lead.packageId) : null;
  return { pending: true, lead, package: pkg };
}

export async function getClientBookings(email: string): Promise<{
  requests: Lead[];
  tours: { tour: Tour; package: TourPackage }[];
}> {
  const emailNorm = email.trim().toLowerCase();
  const leads = await getLeads();
  const tours = await getTours();

  const clientLeads = leads.filter(
    (l) =>
      l.source === "Client Portal" && l.email.toLowerCase() === emailNorm
  );
  const leadIds = new Set(clientLeads.map((l) => l.id));
  const clientTours = tours.filter((t) => leadIds.has(t.leadId));

  const tourIdsWithTour = new Set(clientTours.map((t) => t.leadId));
  const requests = clientLeads.filter((l) => !tourIdsWithTour.has(l.id));

  const tourWithPackages: { tour: Tour; package: TourPackage }[] = [];
  for (const t of clientTours) {
    const pkg = await getPackage(t.packageId);
    if (pkg) tourWithPackages.push({ tour: t, package: pkg });
  }

  return {
    requests: requests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    tours: tourWithPackages.sort(
      (a, b) =>
        new Date(b.tour.startDate).getTime() - new Date(a.tour.startDate).getTime()
    ),
  };
}
