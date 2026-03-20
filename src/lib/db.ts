import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { supabase } from "./supabase";
import { generateDocumentNumber } from "./document-number";
import { resolveLeadPackage, resolveTourPackage } from "./package-snapshot";
import type {
  AuditEntityType,
  AuditLog,
  AiInteraction,
  AiKnowledgeDocument,
  Lead,
  TourPackage,
  Tour,
  HotelSupplier,
  Invoice,
  Payment,
  Employee,
  PayrollRun,
  Todo,
} from "./types";
import { mockPackages } from "./mock-data";

const DATA_DIR = path.join(process.cwd(), "data");
const IS_VERCEL = process.env.VERCEL === "1";
const USE_SUPABASE = supabase !== null;

async function getSupabaseDb() {
  return import("./db-supabase");
}

// In-memory cache for local dev (avoids repeated disk reads)
let localCache: { leads?: Lead[]; tours?: Tour[] } | null = null;
function invalidateLocalCache() {
  localCache = null;
}

// In-memory store for Vercel (read-only filesystem). Only packages have data; all else is empty.
let memoryStore: {
  leads: Lead[];
  packages: TourPackage[];
  tours: Tour[];
  hotels: HotelSupplier[];
  invoices: Invoice[];
  payments: Payment[];
  employees: Employee[];
  payrollRuns: PayrollRun[];
  todos: Todo[];
  auditLogs: AuditLog[];
  aiKnowledgeDocuments: AiKnowledgeDocument[];
  aiInteractions: AiInteraction[];
} | null = null;
function getMemoryStore() {
  if (!memoryStore) {
    memoryStore = {
      leads: [],
      packages: JSON.parse(JSON.stringify(mockPackages)),
      tours: [],
      hotels: [],
      invoices: [],
      payments: [],
      employees: [],
      payrollRuns: [],
      todos: [],
      auditLogs: [],
      aiKnowledgeDocuments: [],
      aiInteractions: [],
    };
  }
  return memoryStore;
}

export interface AuditLogFilter {
  entityTypes?: AuditEntityType[];
  entityIds?: string[];
  limit?: number;
}

async function ensureDataDir() {
  if (IS_VERCEL) return;
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {
    // dir exists
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  if (IS_VERCEL) {
    const store = getMemoryStore();
    if (file === "leads.json") return store.leads as T;
    if (file === "packages.json") return store.packages as T;
    if (file === "tours.json") return store.tours as T;
    if (file === "hotels.json") return store.hotels as T;
    if (file === "invoices.json") return store.invoices as T;
    if (file === "payments.json") return store.payments as T;
    if (file === "employees.json") return store.employees as T;
    if (file === "payroll.json") return store.payrollRuns as T;
    if (file === "todos.json") return store.todos as T;
    if (file === "audit.json") return store.auditLogs as T;
    if (file === "ai-knowledge.json") return store.aiKnowledgeDocuments as T;
    if (file === "ai-interactions.json") return store.aiInteractions as T;
    return fallback;
  }
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
  if (IS_VERCEL) {
    const store = getMemoryStore();
    if (file === "leads.json") store.leads = data as Lead[];
    else if (file === "packages.json") store.packages = data as TourPackage[];
    else if (file === "tours.json") store.tours = data as Tour[];
    else if (file === "hotels.json") store.hotels = data as HotelSupplier[];
    else if (file === "invoices.json") store.invoices = data as Invoice[];
    else if (file === "payments.json") store.payments = data as Payment[];
    else if (file === "employees.json") store.employees = data as Employee[];
    else if (file === "payroll.json") store.payrollRuns = data as PayrollRun[];
    else if (file === "todos.json") store.todos = data as Todo[];
    else if (file === "audit.json") store.auditLogs = data as AuditLog[];
    else if (file === "ai-knowledge.json")
      store.aiKnowledgeDocuments = data as AiKnowledgeDocument[];
    else if (file === "ai-interactions.json")
      store.aiInteractions = data as AiInteraction[];
    return;
  }
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, file);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// --- SEED (run once when empty) ---
const SEED_FLAG = ".seed_done";
async function maybeSeed() {
  if (IS_VERCEL) return;
  const flagPath = path.join(DATA_DIR, SEED_FLAG);
  try {
    await readFile(flagPath, "utf-8");
    return;
  } catch {
    // seed
  }
  await ensureDataDir();
  const { mockPackages: pkgs } = await import("./mock-data");
  await writeJson("leads.json", []);
  await writeJson("packages.json", pkgs);
  await writeJson("tours.json", []);
  await writeJson("hotels.json", []);
  await writeJson("invoices.json", []);
  await writeJson("payments.json", []);
  await writeJson("employees.json", []);
  await writeJson("payroll.json", []);
  await writeJson("todos.json", []);
  await writeJson("audit.json", []);
  await writeJson("ai-knowledge.json", []);
  await writeJson("ai-interactions.json", []);
  await writeFile(flagPath, "seeded", "utf-8");
}

// --- BACKFILL: Client Portal leads missing references (run once) ---
const REF_BACKFILL_FLAG = ".ref_backfill_done";
async function maybeBackfillReferences(leads: Lead[]): Promise<Lead[]> {
  if (IS_VERCEL) {
    for (let i = 0; i < leads.length; i++) {
      if (leads[i].source === "Client Portal" && !leads[i].reference) {
        leads[i] = { ...leads[i], reference: generateReference(), updatedAt: new Date().toISOString() };
      }
    }
    return leads;
  }
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
  if (changed) await writeJson("leads.json", leads);
  await writeFile(flagPath, "done", "utf-8");
  return leads;
}

// --- LEADS ---
export async function getLeads(): Promise<Lead[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getLeads();
    } catch (err) {
      // Supabase not ready (missing tables, etc.) — fall back to file/memory
      if (process.env.NODE_ENV === "development") {
        console.warn("Supabase leads failed, using fallback:", err);
      }
    }
  }
  if (!IS_VERCEL && localCache?.leads) return localCache.leads;
  let leads = await readJson<Lead[]>("leads.json", []);
  if (leads.length === 0) {
    await maybeSeed();
    leads = await readJson<Lead[]>("leads.json", []);
  }
  leads = await maybeBackfillReferences(leads);
  leads = leads.filter((lead) => !lead.archivedAt);
  if (!IS_VERCEL) {
    localCache = localCache ?? {};
    localCache.leads = leads;
  }
  return leads;
}

export async function getLead(id: string): Promise<Lead | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getLead(id);
    } catch {
      // fall through to file/memory
    }
  }
  let leads = await readJson<Lead[]>("leads.json", []);
  leads = await maybeBackfillReferences(leads);
  return leads.find((l) => l.id === id) ?? null;
}

export async function getLeadByReference(ref: string): Promise<Lead | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getLeadByReference(ref);
    } catch {
      // fall through to file/memory
    }
  }
  let leads = await readJson<Lead[]>("leads.json", []);
  leads = await maybeBackfillReferences(leads);
  return leads.find((l) => l.reference?.toUpperCase() === ref.trim().toUpperCase()) ?? null;
}

function generateReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PCT-${date}-${random}`;
}

export async function createLead(data: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createLead(data);
    } catch {
      // fall through to file/memory
    }
  }
  invalidateLocalCache();
  const leads = await getLeads();
  const now = new Date().toISOString();
  const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const reference = data.reference ?? generateReference();
  const lead: Lead = { ...data, id, reference, createdAt: now, updatedAt: now };
  leads.push(lead);
  await writeJson("leads.json", leads);
  return lead;
}

export async function updateLead(id: string, data: Partial<Omit<Lead, "id" | "createdAt">>): Promise<Lead | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateLead(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  invalidateLocalCache();
  const leads = await getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("leads.json", leads);
  return leads[idx];
}

export async function deleteLead(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deleteLead(id);
    } catch {
      // fall through to file/memory
    }
  }
  invalidateLocalCache();
  const leads = await readJson<Lead[]>("leads.json", []);
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1 || leads[idx].archivedAt) return false;
  leads[idx] = {
    ...leads[idx],
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJson("leads.json", leads);
  return true;
}

// --- BACKFILL: Packages missing meal/transport/stay options (run once) ---
const PKG_OPTIONS_BACKFILL_FLAG = ".pkg_options_backfill_done";
async function maybeBackfillPackageOptions(pkgs: TourPackage[]): Promise<TourPackage[]> {
  if (IS_VERCEL) return pkgs;
  const needsOptions = pkgs.some(
    (p) =>
      !p.accommodationOptions?.length ||
      !p.transportOptions?.length ||
      !p.mealOptions?.length
  );
  if (!needsOptions) return pkgs;
  const flagPath = path.join(DATA_DIR, PKG_OPTIONS_BACKFILL_FLAG);
  try {
    await readFile(flagPath, "utf-8");
    return pkgs;
  } catch {
    // run backfill
  }
  const mockById = new Map(mockPackages.map((m) => [m.id, m]));
  let changed = false;
  const updated = pkgs.map((p) => {
    const mock = mockById.get(p.id);
    if (!mock) return p;
    const next = { ...p };
    if (!next.accommodationOptions?.length && mock.accommodationOptions?.length) {
      next.accommodationOptions = mock.accommodationOptions;
      changed = true;
    }
    if (!next.transportOptions?.length && mock.transportOptions?.length) {
      next.transportOptions = mock.transportOptions;
      changed = true;
    }
    if (!next.mealOptions?.length && mock.mealOptions?.length) {
      next.mealOptions = mock.mealOptions;
      changed = true;
    }
    return next;
  });
  if (changed) await writeJson("packages.json", updated);
  await writeFile(flagPath, "done", "utf-8");
  return updated;
}

// --- PACKAGES ---
export async function getPackages(): Promise<TourPackage[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPackages();
    } catch {
      // fall through to file/memory
    }
  }
  let pkgs = await readJson<TourPackage[]>("packages.json", []);
  if (pkgs.length === 0) {
    await maybeSeed();
    pkgs = await readJson<TourPackage[]>("packages.json", []);
  }
  pkgs = await maybeBackfillPackageOptions(pkgs);
  return pkgs.filter((pkg) => !pkg.archivedAt);
}

export async function getPackage(id: string): Promise<TourPackage | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPackage(id);
    } catch {
      // fall through to file/memory
    }
  }
  let packages = await readJson<TourPackage[]>("packages.json", []);
  packages = await maybeBackfillPackageOptions(packages);
  return packages.find((p) => p.id === id) ?? null;
}

export async function getPackagesForClient(): Promise<TourPackage[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPackagesForClient();
    } catch {
      // fall through to file/memory
    }
  }
  const packages = await getPackages();
  return packages.filter((p) => p.published !== false);
}

export async function createPackage(data: Omit<TourPackage, "id" | "createdAt">): Promise<TourPackage> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createPackage(data);
    } catch {
      // fall through to file/memory
    }
  }
  const packages = await getPackages();
  const id = `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const pkg: TourPackage = { ...data, id, createdAt: new Date().toISOString() };
  packages.push(pkg);
  await writeJson("packages.json", packages);
  return pkg;
}

export async function updatePackage(id: string, data: Partial<Omit<TourPackage, "id" | "createdAt">>): Promise<TourPackage | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updatePackage(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const packages = await getPackages();
  const idx = packages.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  packages[idx] = { ...packages[idx], ...data };
  await writeJson("packages.json", packages);
  return packages[idx];
}

export async function deletePackage(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deletePackage(id);
    } catch {
      // fall through to file/memory
    }
  }
  const packages = await readJson<TourPackage[]>("packages.json", []);
  const idx = packages.findIndex((p) => p.id === id);
  if (idx === -1 || packages[idx].archivedAt) return false;
  packages[idx] = {
    ...packages[idx],
    archivedAt: new Date().toISOString(),
  };
  await writeJson("packages.json", packages);
  return true;
}

// --- TOURS ---
export async function getTours(): Promise<Tour[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getTours();
    } catch {
      // fall through to file/memory
    }
  }
  if (!IS_VERCEL && localCache?.tours) return localCache.tours;
  const tours = await readJson<Tour[]>("tours.json", []);
  if (tours.length === 0) {
    await maybeSeed();
    const t = await readJson<Tour[]>("tours.json", []);
    if (!IS_VERCEL) {
      localCache = localCache ?? {};
      localCache.tours = t;
    }
    return t;
  }
  if (!IS_VERCEL) {
    localCache = localCache ?? {};
    localCache.tours = tours;
  }
  return tours;
}

export async function getTour(id: string): Promise<Tour | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getTour(id);
    } catch {
      // fall through to file/memory
    }
  }
  const tours = await getTours();
  return tours.find((t) => t.id === id) ?? null;
}

export async function createTour(data: Omit<Tour, "id">): Promise<Tour> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createTour(data);
    } catch {
      // fall through to file/memory
    }
  }
  invalidateLocalCache();
  const tours = await getTours();
  const id = `tour_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const tour: Tour = { ...data, id, createdAt: now, updatedAt: now };
  tours.push(tour);
  await writeJson("tours.json", tours);
  return tour;
}

export async function updateTour(id: string, data: Partial<Omit<Tour, "id">>): Promise<Tour | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateTour(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  invalidateLocalCache();
  const tours = await getTours();
  const idx = tours.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tours[idx] = { ...tours[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("tours.json", tours);
  return tours[idx];
}

export async function deleteTour(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deleteTour(id);
    } catch {
      // fall through to file/memory
    }
  }
  invalidateLocalCache();
  const tours = await getTours();
  const filtered = tours.filter((t) => t.id !== id);
  if (filtered.length === tours.length) return false;
  await writeJson("tours.json", filtered);
  return true;
}

// --- HOTELS & SUPPLIERS ---
export async function getHotels(): Promise<HotelSupplier[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getHotels();
    } catch {
      // fall through to file/memory
    }
  }
  const hotels = await readJson<HotelSupplier[]>("hotels.json", []);
  if (hotels.length === 0 && !IS_VERCEL) {
    await maybeSeed();
    const seeded = await readJson<HotelSupplier[]>("hotels.json", []);
    return seeded.filter((hotel) => !hotel.archivedAt);
  }
  return hotels.filter((hotel) => !hotel.archivedAt);
}

export async function getHotel(id: string): Promise<HotelSupplier | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getHotel(id);
    } catch {
      // fall through to file/memory
    }
  }
  const hotels = await readJson<HotelSupplier[]>("hotels.json", []);
  return hotels.find((h) => h.id === id) ?? null;
}

export async function createHotel(data: Omit<HotelSupplier, "id" | "createdAt">): Promise<HotelSupplier> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createHotel(data);
    } catch {
      // fall through to file/memory
    }
  }
  const hotels = await getHotels();
  const id = `h_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const hotel: HotelSupplier = { ...data, id, createdAt: new Date().toISOString() };
  hotels.push(hotel);
  await writeJson("hotels.json", hotels);
  return hotel;
}

export async function updateHotel(id: string, data: Partial<Omit<HotelSupplier, "id" | "createdAt">>): Promise<HotelSupplier | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateHotel(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const hotels = await getHotels();
  const idx = hotels.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  hotels[idx] = { ...hotels[idx], ...data };
  await writeJson("hotels.json", hotels);
  return hotels[idx];
}

export async function deleteHotel(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deleteHotel(id);
    } catch {
      // fall through to file/memory
    }
  }
  const hotels = await readJson<HotelSupplier[]>("hotels.json", []);
  const idx = hotels.findIndex((h) => h.id === id);
  if (idx === -1 || hotels[idx].archivedAt) return false;
  hotels[idx] = {
    ...hotels[idx],
    archivedAt: new Date().toISOString(),
  };
  await writeJson("hotels.json", hotels);
  return true;
}

// --- INVOICES ---
export async function getInvoices(): Promise<Invoice[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getInvoices();
    } catch {
      // fall through to file/memory
    }
  }
  let invoices = IS_VERCEL
    ? getMemoryStore().invoices
    : await readJson<Invoice[]>("invoices.json", []);
  if (invoices.length === 0 && !IS_VERCEL) {
    invoices = [];
  }
  return invoices;
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getInvoice(id);
    } catch {
      // fall through to file/memory
    }
  }
  const invoices = await getInvoices();
  return invoices.find((i) => i.id === id) ?? null;
}

export async function getInvoiceByLeadId(leadId: string): Promise<Invoice | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getInvoiceByLeadId(leadId);
    } catch {
      // fall through to file/memory
    }
  }
  const invoices = await getInvoices();
  return invoices.find((i) => i.leadId === leadId) ?? null;
}

function generateInvoiceNumber(): string {
  return generateDocumentNumber("INV");
}

export async function createInvoice(data: Omit<Invoice, "id" | "createdAt" | "updatedAt">): Promise<Invoice> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createInvoice(data);
    } catch {
      // fall through to file/memory
    }
  }
  const invoices = await getInvoices();
  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const invoice: Invoice = {
    ...data,
    id,
    invoiceNumber: data.invoiceNumber ?? generateInvoiceNumber(),
    createdAt: now,
    updatedAt: now,
  };
  invoices.push(invoice);
  await writeJson("invoices.json", invoices);
  return invoice;
}

export async function updateInvoice(id: string, data: Partial<Omit<Invoice, "id" | "createdAt">>): Promise<Invoice | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateInvoice(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const invoices = await getInvoices();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  invoices[idx] = { ...invoices[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("invoices.json", invoices);
  return invoices[idx];
}

export async function deleteInvoice(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deleteInvoice(id);
    } catch {
      // fall through to file/memory
    }
  }
  const invoices = await getInvoices();
  const filtered = invoices.filter((invoice) => invoice.id !== id);
  if (filtered.length === invoices.length) return false;
  await writeJson("invoices.json", filtered);
  return true;
}

// --- EMPLOYEES ---
export async function getEmployees(): Promise<Employee[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getEmployees();
    } catch {
      // fall through to file/memory
    }
  }
  const employees = await readJson<Employee[]>("employees.json", []);
  // No mock data - employees start empty
  return employees.filter((employee) => !employee.archivedAt);
}

export async function getEmployee(id: string): Promise<Employee | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getEmployee(id);
    } catch {
      // fall through to file/memory
    }
  }
  const employees = await readJson<Employee[]>("employees.json", []);
  return employees.find((e) => e.id === id) ?? null;
}

export async function createEmployee(data: Omit<Employee, "id" | "createdAt" | "updatedAt">): Promise<Employee> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createEmployee(data);
    } catch {
      // fall through to file/memory
    }
  }
  const employees = await getEmployees();
  const now = new Date().toISOString();
  const id = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const employee: Employee = { ...data, id, createdAt: now, updatedAt: now };
  employees.push(employee);
  await writeJson("employees.json", employees);
  return employee;
}

export async function updateEmployee(id: string, data: Partial<Omit<Employee, "id" | "createdAt">>): Promise<Employee | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateEmployee(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const employees = await getEmployees();
  const idx = employees.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  employees[idx] = { ...employees[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("employees.json", employees);
  return employees[idx];
}

export async function deleteEmployee(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deleteEmployee(id);
    } catch {
      // fall through to file/memory
    }
  }
  const employees = await readJson<Employee[]>("employees.json", []);
  const idx = employees.findIndex((e) => e.id === id);
  if (idx === -1 || employees[idx].archivedAt) return false;
  employees[idx] = {
    ...employees[idx],
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJson("employees.json", employees);
  return true;
}

// --- PAYROLL ---
export async function getPayrollRuns(): Promise<PayrollRun[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPayrollRuns();
    } catch {
      // fall through to file/memory
    }
  }
  let runs = await readJson<PayrollRun[]>("payroll.json", []);
  if (runs.length === 0 && !IS_VERCEL) {
    runs = [];
  }
  return runs.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

export async function getPayrollRun(id: string): Promise<PayrollRun | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPayrollRun(id);
    } catch {
      // fall through to file/memory
    }
  }
  const runs = await getPayrollRuns();
  return runs.find((r) => r.id === id) ?? null;
}

export async function createPayrollRun(data: Omit<PayrollRun, "id" | "createdAt" | "updatedAt">): Promise<PayrollRun> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createPayrollRun(data);
    } catch {
      // fall through to file/memory
    }
  }
  const runs = await getPayrollRuns();
  const now = new Date().toISOString();
  const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const run: PayrollRun = { ...data, id, createdAt: now, updatedAt: now };
  runs.unshift(run);
  await writeJson("payroll.json", runs);
  return run;
}

export async function updatePayrollRun(id: string, data: Partial<Omit<PayrollRun, "id" | "createdAt">>): Promise<PayrollRun | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updatePayrollRun(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const runs = await getPayrollRuns();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  runs[idx] = { ...runs[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("payroll.json", runs);
  return runs[idx];
}

// --- PAYMENTS ---
export async function getPayment(id: string): Promise<Payment | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPayment(id);
    } catch {
      // fall through to file/memory
    }
  }
  const payments = await getPayments();
  return payments.find((p) => p.id === id) ?? null;
}

export async function getPaymentByTourId(tourId: string): Promise<Payment | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPaymentByTourId(tourId);
    } catch {
      // fall through to file/memory
    }
  }
  const payments = await getPayments();
  return payments.find((p) => p.tourId === tourId) ?? null;
}

export async function getPayments(): Promise<Payment[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getPayments();
    } catch {
      // fall through to file/memory
    }
  }
  let payments = await readJson<Payment[]>("payments.json", []);
  if (payments.length === 0 && !IS_VERCEL) {
    payments = [];
  }
  return payments;
}

export async function createPayment(data: Omit<Payment, "id">): Promise<Payment> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createPayment(data);
    } catch {
      // fall through to file/memory
    }
  }
  const payments = await getPayments();
  const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const payment: Payment = { ...data, id };
  payments.push(payment);
  await writeJson("payments.json", payments);
  return payment;
}

export async function updatePayment(id: string, data: Partial<Omit<Payment, "id">>): Promise<Payment | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updatePayment(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const payments = await getPayments();
  const idx = payments.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  payments[idx] = { ...payments[idx], ...data };
  await writeJson("payments.json", payments);
  return payments[idx];
}

export async function deletePayment(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deletePayment(id);
    } catch {
      // fall through to file/memory
    }
  }
  const payments = await getPayments();
  const filtered = payments.filter((payment) => payment.id !== id);
  if (filtered.length === payments.length) return false;
  await writeJson("payments.json", filtered);
  return true;
}

// --- TODOS ---
export async function getTodos(): Promise<Todo[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getTodos();
    } catch {
      // fall through to file/memory
    }
  }
  let todos = await readJson<Todo[]>("todos.json", []);
  if (todos.length === 0 && !IS_VERCEL) {
    todos = [];
  }
  return todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createTodo(data: Omit<Todo, "id" | "createdAt">): Promise<Todo> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createTodo(data);
    } catch {
      // fall through to file/memory
    }
  }
  const todos = await getTodos();
  const id = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const todo: Todo = { ...data, id, createdAt: now };
  todos.unshift(todo);
  await writeJson("todos.json", todos);
  return todo;
}

export async function updateTodo(id: string, data: Partial<Omit<Todo, "id" | "createdAt">>): Promise<Todo | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateTodo(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const todos = await getTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  todos[idx] = { ...todos[idx], ...data };
  await writeJson("todos.json", todos);
  return todos[idx];
}

export async function deleteTodo(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.deleteTodo(id);
    } catch {
      // fall through to file/memory
    }
  }
  const todos = await getTodos();
  const filtered = todos.filter((t) => t.id !== id);
  if (filtered.length === todos.length) return false;
  await writeJson("todos.json", filtered);
  return true;
}

// --- AUDIT LOGS ---
export async function getAuditLogs(
  filter?: AuditLogFilter
): Promise<AuditLog[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getAuditLogs(filter);
    } catch {
      // fall through to file/memory
    }
  }
  let logs = await readJson<AuditLog[]>("audit.json", []);
  logs = logs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (filter?.entityTypes?.length) {
    const allowedTypes = new Set(filter.entityTypes);
    logs = logs.filter((log) => allowedTypes.has(log.entityType));
  }
  if (filter?.entityIds?.length) {
    const allowedIds = new Set(filter.entityIds);
    logs = logs.filter((log) => allowedIds.has(log.entityId));
  }
  if (filter?.limit) {
    logs = logs.slice(0, filter.limit);
  }
  return logs;
}

export async function createAuditLog(
  data: Omit<AuditLog, "id" | "createdAt">
): Promise<AuditLog> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createAuditLog(data);
    } catch {
      // fall through to file/memory
    }
  }
  const logs = await getAuditLogs();
  const log: AuditLog = {
    ...data,
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  logs.unshift(log);
  await writeJson("audit.json", logs);
  return log;
}

// --- AI KNOWLEDGE ---
export async function getAiKnowledgeDocuments(): Promise<AiKnowledgeDocument[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getAiKnowledgeDocuments();
    } catch {
      // fall through to file/memory
    }
  }
  const documents = await readJson<AiKnowledgeDocument[]>("ai-knowledge.json", []);
  return documents
    .filter((document) => document.active)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export async function createAiKnowledgeDocument(
  data: Omit<AiKnowledgeDocument, "id" | "createdAt" | "updatedAt">
): Promise<AiKnowledgeDocument> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createAiKnowledgeDocument(data);
    } catch {
      // fall through to file/memory
    }
  }
  const documents = await readJson<AiKnowledgeDocument[]>("ai-knowledge.json", []);
  const now = new Date().toISOString();
  const document: AiKnowledgeDocument = {
    ...data,
    id: `aik_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };
  documents.unshift(document);
  await writeJson("ai-knowledge.json", documents);
  return document;
}

export async function updateAiKnowledgeDocument(
  id: string,
  data: Partial<
    Omit<AiKnowledgeDocument, "id" | "createdAt" | "updatedAt">
  >
): Promise<AiKnowledgeDocument | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateAiKnowledgeDocument(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const documents = await readJson<AiKnowledgeDocument[]>("ai-knowledge.json", []);
  const index = documents.findIndex((document) => document.id === id);
  if (index === -1) return null;
  documents[index] = {
    ...documents[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await writeJson("ai-knowledge.json", documents);
  return documents[index];
}

// --- AI INTERACTIONS ---
export async function getAiInteractions(limit = 30): Promise<AiInteraction[]> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getAiInteractions(limit);
    } catch {
      // fall through to file/memory
    }
  }
  const interactions = await readJson<AiInteraction[]>(
    "ai-interactions.json",
    []
  );
  return interactions
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, limit);
}

export async function getAiInteraction(id: string): Promise<AiInteraction | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getAiInteraction(id);
    } catch {
      // fall through to file/memory
    }
  }
  const interactions = await readJson<AiInteraction[]>(
    "ai-interactions.json",
    []
  );
  return interactions.find((interaction) => interaction.id === id) ?? null;
}

export async function createAiInteraction(
  data: Omit<AiInteraction, "id" | "createdAt" | "updatedAt">
): Promise<AiInteraction> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.createAiInteraction(data);
    } catch {
      // fall through to file/memory
    }
  }
  const interactions = await readJson<AiInteraction[]>(
    "ai-interactions.json",
    []
  );
  const now = new Date().toISOString();
  const interaction: AiInteraction = {
    ...data,
    id: `aii_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };
  interactions.unshift(interaction);
  await writeJson("ai-interactions.json", interactions);
  return interaction;
}

export async function updateAiInteraction(
  id: string,
  data: Partial<Omit<AiInteraction, "id" | "createdAt" | "updatedAt">>
): Promise<AiInteraction | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.updateAiInteraction(id, data);
    } catch {
      // fall through to file/memory
    }
  }
  const interactions = await readJson<AiInteraction[]>(
    "ai-interactions.json",
    []
  );
  const index = interactions.findIndex((interaction) => interaction.id === id);
  if (index === -1) return null;
  interactions[index] = {
    ...interactions[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await writeJson("ai-interactions.json", interactions);
  return interactions[index];
}

// --- CLIENT PORTAL ---
export type ClientBookingResult =
  | {
      tour: Tour;
      package: TourPackage;
      invoice: Invoice | null;
      payment: Payment | null;
    }
  | { pending: true; lead: Lead; package: TourPackage | null };

export async function getTourForClient(
  bookingRef: string,
  email?: string
): Promise<ClientBookingResult | null> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getTourForClient(bookingRef, email);
    } catch {
      // fall through to file/memory
    }
  }
  const ref = bookingRef.trim();
  const emailNorm = email?.trim().toLowerCase() ?? "";
  const verifyEmail = emailNorm.length > 0;

  // Try as tour id first
  const tour = await getTour(ref);
  if (tour) {
    const lead = await getLead(tour.leadId);
    if (!lead) return null;
    if (verifyEmail && lead.email.toLowerCase() !== emailNorm) return null;
    const livePackage = await getPackage(tour.packageId);
    const pkg = resolveTourPackage(tour, livePackage, lead);
    if (!pkg) return null;
    const [invoice, payment] = await Promise.all([
      getInvoiceByLeadId(lead.id),
      getPaymentByTourId(tour.id),
    ]);
    return { tour, package: pkg, invoice, payment };
  }

  // Try as lead reference (e.g. PCT-20260312-A3B7)
  const lead = await getLeadByReference(ref);
  if (!lead) return null;
  if (verifyEmail && lead.email.toLowerCase() !== emailNorm) return null;

  // Check if there's a tour for this lead
  const tours = await getTours();
  const linkedTour = tours.find((t) => t.leadId === lead.id);
  if (linkedTour) {
    const livePackage = await getPackage(linkedTour.packageId);
    const pkg = resolveTourPackage(linkedTour, livePackage, lead);
    if (!pkg) return null;
    const [invoice, payment] = await Promise.all([
      getInvoiceByLeadId(lead.id),
      getPaymentByTourId(linkedTour.id),
    ]);
    return { tour: linkedTour, package: pkg, invoice, payment };
  }

  // Pending request – no tour yet
  const livePackage = lead.packageId ? await getPackage(lead.packageId) : null;
  const pkg = resolveLeadPackage(lead, livePackage);
  return { pending: true, lead, package: pkg };
}

export async function getClientBookings(email: string): Promise<{
  requests: Lead[];
  tours: {
    tour: Tour;
    package: TourPackage;
    invoice: Invoice | null;
    payment: Payment | null;
  }[];
}> {
  if (USE_SUPABASE) {
    try {
      const mod = await getSupabaseDb();
      return await mod.getClientBookings(email);
    } catch {
      // fall through to file/memory
    }
  }
  const emailNorm = email.trim().toLowerCase();
  const leads = await getLeads();
  const tours = await getTours();

  const clientLeads = leads.filter(
    (l) => l.email.toLowerCase() === emailNorm
  );
  const leadIds = new Set(clientLeads.map((l) => l.id));
  const clientTours = tours.filter((t) => leadIds.has(t.leadId));

  const tourIdsWithTour = new Set(clientTours.map((t) => t.leadId));
  const requests = clientLeads.filter((l) => !tourIdsWithTour.has(l.id));

  const tourWithPackages: {
    tour: Tour;
    package: TourPackage;
    invoice: Invoice | null;
    payment: Payment | null;
  }[] = [];
  for (const t of clientTours) {
    const [livePackage, invoice, payment, lead] = await Promise.all([
      getPackage(t.packageId),
      getInvoiceByLeadId(t.leadId),
      getPaymentByTourId(t.id),
      getLead(t.leadId),
    ]);
    const pkg = resolveTourPackage(t, livePackage, lead);
    if (pkg) {
      tourWithPackages.push({ tour: t, package: pkg, invoice, payment });
    }
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
