import { supabase } from "./supabase";
import type { Lead, TourPackage, Tour, ItineraryDay } from "./types";

// --- LEADS ---
function toLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as string,
    reference: row.reference as string | undefined,
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string) || "",
    source: row.source as string,
    status: row.status as Lead["status"],
    destination: row.destination as string | undefined,
    travelDate: row.travel_date as string | undefined,
    pax: row.pax as number | undefined,
    notes: row.notes as string | undefined,
    packageId: row.package_id as string | undefined,
    createdAt: (row.created_at as string).replace("Z", "").replace("+00", ""),
    updatedAt: (row.updated_at as string).replace("Z", "").replace("+00", ""),
  };
}

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase!.from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toLead(r));
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase!.from("leads").select("*").eq("id", id).single();
  if (error || !data) return null;
  return toLead(data);
}

export async function getLeadByReference(ref: string): Promise<Lead | null> {
  const { data, error } = await supabase!
    .from("leads")
    .select("*")
    .ilike("reference", ref.trim())
    .maybeSingle();
  if (error || !data) return null;
  return toLead(data);
}

function generateReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PCT-${date}-${random}`;
}

export async function createLead(data: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead> {
  const now = new Date().toISOString();
  const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const reference = data.source === "Client Portal" ? (data.reference ?? generateReference()) : data.reference;

  const row = {
    id,
    reference,
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    source: data.source,
    status: data.status,
    destination: data.destination ?? null,
    travel_date: data.travelDate ?? null,
    pax: data.pax ?? null,
    notes: data.notes ?? null,
    package_id: data.packageId ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error } = await supabase!.from("leads").insert(row).select().single();
  if (error) throw error;
  return toLead(inserted);
}

export async function updateLead(id: string, data: Partial<Omit<Lead, "id" | "createdAt">>): Promise<Lead | null> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.reference !== undefined) update.reference = data.reference;
  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) update.email = data.email;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.source !== undefined) update.source = data.source;
  if (data.status !== undefined) update.status = data.status;
  if (data.destination !== undefined) update.destination = data.destination;
  if (data.travelDate !== undefined) update.travel_date = data.travelDate;
  if (data.pax !== undefined) update.pax = data.pax;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.packageId !== undefined) update.package_id = data.packageId;

  const { data: updated, error } = await supabase!.from("leads").update(update).eq("id", id).select().single();
  if (error || !updated) return null;
  return toLead(updated);
}

export async function deleteLead(id: string): Promise<boolean> {
  const { error } = await supabase!.from("leads").delete().eq("id", id);
  return !error;
}

// --- PACKAGES ---
function toPackage(row: Record<string, unknown>): TourPackage {
  return {
    id: row.id as string,
    name: row.name as string,
    duration: row.duration as string,
    destination: row.destination as string,
    price: Number(row.price),
    currency: row.currency as string,
    description: row.description as string,
    itinerary: (row.itinerary as ItineraryDay[]) ?? [],
    inclusions: (row.inclusions as string[]) ?? [],
    exclusions: (row.exclusions as string[]) ?? [],
    createdAt: (row.created_at as string).replace("Z", "").replace("+00", ""),
  };
}

export async function getPackages(): Promise<TourPackage[]> {
  const { data, error } = await supabase!.from("packages").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toPackage(r));
}

export async function getPackage(id: string): Promise<TourPackage | null> {
  const { data, error } = await supabase!.from("packages").select("*").eq("id", id).single();
  if (error || !data) return null;
  return toPackage(data);
}

export async function createPackage(data: Omit<TourPackage, "id" | "createdAt">): Promise<TourPackage> {
  const id = `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const row = {
    id,
    name: data.name,
    duration: data.duration,
    destination: data.destination,
    price: data.price,
    currency: data.currency,
    description: data.description,
    itinerary: data.itinerary,
    inclusions: data.inclusions,
    exclusions: data.exclusions,
    created_at: now,
  };
  const { data: inserted, error } = await supabase!.from("packages").insert(row).select().single();
  if (error) throw error;
  return toPackage(inserted);
}

export async function updatePackage(
  id: string,
  data: Partial<Omit<TourPackage, "id" | "createdAt">>
): Promise<TourPackage | null> {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.duration !== undefined) update.duration = data.duration;
  if (data.destination !== undefined) update.destination = data.destination;
  if (data.price !== undefined) update.price = data.price;
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.description !== undefined) update.description = data.description;
  if (data.itinerary !== undefined) update.itinerary = data.itinerary;
  if (data.inclusions !== undefined) update.inclusions = data.inclusions;
  if (data.exclusions !== undefined) update.exclusions = data.exclusions;
  if (Object.keys(update).length === 0) return getPackage(id);

  const { data: updated, error } = await supabase!.from("packages").update(update).eq("id", id).select().single();
  if (error || !updated) return null;
  return toPackage(updated);
}

export async function deletePackage(id: string): Promise<boolean> {
  const { error } = await supabase!.from("packages").delete().eq("id", id);
  return !error;
}

// --- TOURS ---
function toTour(row: Record<string, unknown>): Tour {
  return {
    id: row.id as string,
    packageId: row.package_id as string,
    packageName: row.package_name as string,
    leadId: row.lead_id as string,
    clientName: row.client_name as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    pax: Number(row.pax),
    status: row.status as Tour["status"],
    totalValue: Number(row.total_value),
    currency: row.currency as string,
  };
}

export async function getTours(): Promise<Tour[]> {
  const { data, error } = await supabase!.from("tours").select("*").order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toTour(r));
}

export async function getTour(id: string): Promise<Tour | null> {
  const { data, error } = await supabase!.from("tours").select("*").eq("id", id).single();
  if (error || !data) return null;
  return toTour(data);
}

export async function createTour(data: Omit<Tour, "id">): Promise<Tour> {
  const id = `tour_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const row = {
    id,
    package_id: data.packageId,
    package_name: data.packageName,
    lead_id: data.leadId,
    client_name: data.clientName,
    start_date: data.startDate,
    end_date: data.endDate,
    pax: data.pax,
    status: data.status,
    total_value: data.totalValue,
    currency: data.currency,
  };
  const { data: inserted, error } = await supabase!.from("tours").insert(row).select().single();
  if (error) throw error;
  return toTour(inserted);
}

export async function updateTour(id: string, data: Partial<Omit<Tour, "id">>): Promise<Tour | null> {
  const update: Record<string, unknown> = {};
  if (data.packageId !== undefined) update.package_id = data.packageId;
  if (data.packageName !== undefined) update.package_name = data.packageName;
  if (data.leadId !== undefined) update.lead_id = data.leadId;
  if (data.clientName !== undefined) update.client_name = data.clientName;
  if (data.startDate !== undefined) update.start_date = data.startDate;
  if (data.endDate !== undefined) update.end_date = data.endDate;
  if (data.pax !== undefined) update.pax = data.pax;
  if (data.status !== undefined) update.status = data.status;
  if (data.totalValue !== undefined) update.total_value = data.totalValue;
  if (data.currency !== undefined) update.currency = data.currency;
  if (Object.keys(update).length === 0) return getTour(id);

  const { data: updated, error } = await supabase!.from("tours").update(update).eq("id", id).select().single();
  if (error || !updated) return null;
  return toTour(updated);
}

export async function deleteTour(id: string): Promise<boolean> {
  const { error } = await supabase!.from("tours").delete().eq("id", id);
  return !error;
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
  const tour = await getTour(ref);
  if (tour) {
    const lead = await getLead(tour.leadId);
    if (!lead || lead.email.toLowerCase() !== emailNorm) return null;
    const pkg = await getPackage(tour.packageId);
    if (!pkg) return null;
    return { tour, package: pkg };
  }
  const lead = await getLeadByReference(ref);
  if (!lead || lead.email.toLowerCase() !== emailNorm) return null;
  const tours = await getTours();
  const linkedTour = tours.find((t) => t.leadId === lead.id);
  if (linkedTour) {
    const pkg = await getPackage(linkedTour.packageId);
    if (!pkg) return null;
    return { tour: linkedTour, package: pkg };
  }
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
    (l) => l.source === "Client Portal" && l.email.toLowerCase() === emailNorm
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
    requests: requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    tours: tourWithPackages.sort(
      (a, b) => new Date(b.tour.startDate).getTime() - new Date(a.tour.startDate).getTime()
    ),
  };
}
