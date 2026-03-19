import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { supabase } from "./supabase";
import type { Lead, TourPackage, Tour, ItineraryDay, HotelSupplier, Invoice, Payment, Employee, PayrollRun, Todo } from "./types";
import { mockPackages } from "./mock-data";

const DATA_DIR = path.join(process.cwd(), "data");
const IS_VERCEL = process.env.VERCEL === "1";
const USE_SUPABASE_FOR_LEADS = supabase !== null;

// In-memory cache for local dev (avoids repeated disk reads)
let localCache: { leads?: Lead[]; tours?: Tour[] } | null = null;
function invalidateLocalCache() {
  localCache = null;
}

// In-memory store for Vercel (read-only filesystem). Only packages have data; all else is empty.
let memoryStore: { leads: Lead[]; packages: TourPackage[]; tours: Tour[]; hotels: HotelSupplier[]; invoices: Invoice[]; payments: Payment[]; employees: Employee[]; payrollRuns: PayrollRun[]; todos: Todo[] } | null = null;
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
    };
  }
  return memoryStore;
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
  if (USE_SUPABASE_FOR_LEADS) {
    const mod = await import("./db-supabase");
    return mod.getLeads();
  }
  if (!IS_VERCEL && localCache?.leads) return localCache.leads;
  let leads = await readJson<Lead[]>("leads.json", []);
  if (leads.length === 0) {
    await maybeSeed();
    leads = await readJson<Lead[]>("leads.json", []);
  }
  leads = await maybeBackfillReferences(leads);
  if (!IS_VERCEL) {
    localCache = localCache ?? {};
    localCache.leads = leads;
  }
  return leads;
}

export async function getLead(id: string): Promise<Lead | null> {
  if (USE_SUPABASE_FOR_LEADS) {
    const mod = await import("./db-supabase");
    return mod.getLead(id);
  }
  const leads = await getLeads();
  return leads.find((l) => l.id === id) ?? null;
}

export async function getLeadByReference(ref: string): Promise<Lead | null> {
  if (USE_SUPABASE_FOR_LEADS) {
    const mod = await import("./db-supabase");
    return mod.getLeadByReference(ref);
  }
  const leads = await getLeads();
  return leads.find((l) => l.reference?.toUpperCase() === ref.trim().toUpperCase()) ?? null;
}

function generateReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PCT-${date}-${random}`;
}

export async function createLead(data: Omit<Lead, "id" | "createdAt" | "updatedAt">): Promise<Lead> {
  if (USE_SUPABASE_FOR_LEADS) {
    const mod = await import("./db-supabase");
    return mod.createLead(data);
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
  if (USE_SUPABASE_FOR_LEADS) {
    const mod = await import("./db-supabase");
    return mod.updateLead(id, data);
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
  if (USE_SUPABASE_FOR_LEADS) {
    const mod = await import("./db-supabase");
    return mod.deleteLead(id);
  }
  invalidateLocalCache();
  const leads = await getLeads();
  const filtered = leads.filter((l) => l.id !== id);
  if (filtered.length === leads.length) return false;
  await writeJson("leads.json", filtered);
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
  let pkgs = await readJson<TourPackage[]>("packages.json", []);
  if (pkgs.length === 0) {
    await maybeSeed();
    pkgs = await readJson<TourPackage[]>("packages.json", []);
  }
  pkgs = await maybeBackfillPackageOptions(pkgs);
  return pkgs;
}

export async function getPackage(id: string): Promise<TourPackage | null> {
  const packages = await getPackages();
  return packages.find((p) => p.id === id) ?? null;
}

export async function getPackagesForClient(): Promise<TourPackage[]> {
  const packages = await getPackages();
  return packages.filter((p) => p.published !== false);
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
  const tours = await getTours();
  return tours.find((t) => t.id === id) ?? null;
}

export async function createTour(data: Omit<Tour, "id">): Promise<Tour> {
  invalidateLocalCache();
  const tours = await getTours();
  const id = `tour_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const tour: Tour = { ...data, id };
  tours.push(tour);
  await writeJson("tours.json", tours);
  return tour;
}

export async function updateTour(id: string, data: Partial<Omit<Tour, "id">>): Promise<Tour | null> {
  invalidateLocalCache();
  const tours = await getTours();
  const idx = tours.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tours[idx] = { ...tours[idx], ...data };
  await writeJson("tours.json", tours);
  return tours[idx];
}

export async function deleteTour(id: string): Promise<boolean> {
  invalidateLocalCache();
  const tours = await getTours();
  const filtered = tours.filter((t) => t.id !== id);
  if (filtered.length === tours.length) return false;
  await writeJson("tours.json", filtered);
  return true;
}

// --- HOTELS & SUPPLIERS ---
export async function getHotels(): Promise<HotelSupplier[]> {
  const hotels = await readJson<HotelSupplier[]>("hotels.json", []);
  if (hotels.length === 0 && !IS_VERCEL) {
    await maybeSeed();
    return readJson<HotelSupplier[]>("hotels.json", []);
  }
  return hotels;
}

export async function getHotel(id: string): Promise<HotelSupplier | null> {
  const hotels = await getHotels();
  return hotels.find((h) => h.id === id) ?? null;
}

export async function createHotel(data: Omit<HotelSupplier, "id" | "createdAt">): Promise<HotelSupplier> {
  const hotels = await getHotels();
  const id = `h_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const hotel: HotelSupplier = { ...data, id, createdAt: new Date().toISOString() };
  hotels.push(hotel);
  await writeJson("hotels.json", hotels);
  return hotel;
}

export async function updateHotel(id: string, data: Partial<Omit<HotelSupplier, "id" | "createdAt">>): Promise<HotelSupplier | null> {
  const hotels = await getHotels();
  const idx = hotels.findIndex((h) => h.id === id);
  if (idx === -1) return null;
  hotels[idx] = { ...hotels[idx], ...data };
  await writeJson("hotels.json", hotels);
  return hotels[idx];
}

export async function deleteHotel(id: string): Promise<boolean> {
  const hotels = await getHotels();
  const filtered = hotels.filter((h) => h.id !== id);
  if (filtered.length === hotels.length) return false;
  await writeJson("hotels.json", filtered);
  return true;
}

// --- INVOICES ---
export async function getInvoices(): Promise<Invoice[]> {
  let invoices = IS_VERCEL
    ? getMemoryStore().invoices
    : await readJson<Invoice[]>("invoices.json", []);
  if (invoices.length === 0 && !IS_VERCEL) {
    invoices = [];
  }
  return invoices;
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const invoices = await getInvoices();
  return invoices.find((i) => i.id === id) ?? null;
}

export async function getInvoiceByLeadId(leadId: string): Promise<Invoice | null> {
  const invoices = await getInvoices();
  return invoices.find((i) => i.leadId === leadId) ?? null;
}

function generateInvoiceNumber(invoices: Invoice[]): string {
  const year = new Date().getFullYear();
  const yearPrefix = `INV-${year}-`;
  const sameYear = invoices.filter((i) => i.invoiceNumber.startsWith(yearPrefix));
  const nextSeq = sameYear.length + 1;
  return `${yearPrefix}${String(nextSeq).padStart(3, "0")}`;
}

export async function createInvoice(data: Omit<Invoice, "id" | "createdAt" | "updatedAt">): Promise<Invoice> {
  const invoices = await getInvoices();
  const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const invoice: Invoice = {
    ...data,
    id,
    invoiceNumber: data.invoiceNumber ?? generateInvoiceNumber(invoices),
    createdAt: now,
    updatedAt: now,
  };
  invoices.push(invoice);
  await writeJson("invoices.json", invoices);
  return invoice;
}

export async function updateInvoice(id: string, data: Partial<Omit<Invoice, "id" | "createdAt">>): Promise<Invoice | null> {
  const invoices = await getInvoices();
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  invoices[idx] = { ...invoices[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("invoices.json", invoices);
  return invoices[idx];
}

// --- EMPLOYEES ---
export async function getEmployees(): Promise<Employee[]> {
  let employees = await readJson<Employee[]>("employees.json", []);
  // No mock data - employees start empty
  return employees;
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const employees = await getEmployees();
  return employees.find((e) => e.id === id) ?? null;
}

export async function createEmployee(data: Omit<Employee, "id" | "createdAt" | "updatedAt">): Promise<Employee> {
  const employees = await getEmployees();
  const now = new Date().toISOString();
  const id = `emp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const employee: Employee = { ...data, id, createdAt: now, updatedAt: now };
  employees.push(employee);
  await writeJson("employees.json", employees);
  return employee;
}

export async function updateEmployee(id: string, data: Partial<Omit<Employee, "id" | "createdAt">>): Promise<Employee | null> {
  const employees = await getEmployees();
  const idx = employees.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  employees[idx] = { ...employees[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("employees.json", employees);
  return employees[idx];
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const employees = await getEmployees();
  const filtered = employees.filter((e) => e.id !== id);
  if (filtered.length === employees.length) return false;
  await writeJson("employees.json", filtered);
  return true;
}

// --- PAYROLL ---
export async function getPayrollRuns(): Promise<PayrollRun[]> {
  let runs = await readJson<PayrollRun[]>("payroll.json", []);
  if (runs.length === 0 && !IS_VERCEL) {
    runs = [];
  }
  return runs.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

export async function getPayrollRun(id: string): Promise<PayrollRun | null> {
  const runs = await getPayrollRuns();
  return runs.find((r) => r.id === id) ?? null;
}

export async function createPayrollRun(data: Omit<PayrollRun, "id" | "createdAt" | "updatedAt">): Promise<PayrollRun> {
  const runs = await getPayrollRuns();
  const now = new Date().toISOString();
  const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const run: PayrollRun = { ...data, id, createdAt: now, updatedAt: now };
  runs.unshift(run);
  await writeJson("payroll.json", runs);
  return run;
}

export async function updatePayrollRun(id: string, data: Partial<Omit<PayrollRun, "id" | "createdAt">>): Promise<PayrollRun | null> {
  const runs = await getPayrollRuns();
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  runs[idx] = { ...runs[idx], ...data, updatedAt: new Date().toISOString() };
  await writeJson("payroll.json", runs);
  return runs[idx];
}

// --- PAYMENTS ---
export async function getPayment(id: string): Promise<Payment | null> {
  const payments = await getPayments();
  return payments.find((p) => p.id === id) ?? null;
}

export async function getPaymentByTourId(tourId: string): Promise<Payment | null> {
  const payments = await getPayments();
  return payments.find((p) => p.tourId === tourId) ?? null;
}

export async function getPayments(): Promise<Payment[]> {
  let payments = await readJson<Payment[]>("payments.json", []);
  if (payments.length === 0 && !IS_VERCEL) {
    payments = [];
  }
  return payments;
}

export async function createPayment(data: Omit<Payment, "id">): Promise<Payment> {
  const payments = await getPayments();
  const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const payment: Payment = { ...data, id };
  payments.push(payment);
  await writeJson("payments.json", payments);
  return payment;
}

export async function updatePayment(id: string, data: Partial<Omit<Payment, "id">>): Promise<Payment | null> {
  const payments = await getPayments();
  const idx = payments.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  payments[idx] = { ...payments[idx], ...data };
  await writeJson("payments.json", payments);
  return payments[idx];
}

// --- TODOS ---
export async function getTodos(): Promise<Todo[]> {
  let todos = await readJson<Todo[]>("todos.json", []);
  if (todos.length === 0 && !IS_VERCEL) {
    todos = [];
  }
  return todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createTodo(data: Omit<Todo, "id" | "createdAt">): Promise<Todo> {
  const todos = await getTodos();
  const id = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const todo: Todo = { ...data, id, createdAt: now };
  todos.unshift(todo);
  await writeJson("todos.json", todos);
  return todo;
}

export async function updateTodo(id: string, data: Partial<Omit<Todo, "id" | "createdAt">>): Promise<Todo | null> {
  const todos = await getTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  todos[idx] = { ...todos[idx], ...data };
  await writeJson("todos.json", todos);
  return todos[idx];
}

export async function deleteTodo(id: string): Promise<boolean> {
  const todos = await getTodos();
  const filtered = todos.filter((t) => t.id !== id);
  if (filtered.length === todos.length) return false;
  await writeJson("todos.json", filtered);
  return true;
}

// --- CLIENT PORTAL ---
export type ClientBookingResult =
  | { tour: Tour; package: TourPackage }
  | { pending: true; lead: Lead; package: TourPackage | null };

export async function getTourForClient(
  bookingRef: string,
  email?: string
): Promise<ClientBookingResult | null> {
  const ref = bookingRef.trim();
  const emailNorm = email?.trim().toLowerCase() ?? "";
  const verifyEmail = emailNorm.length > 0;

  // Try as tour id first
  const tour = await getTour(ref);
  if (tour) {
    const lead = await getLead(tour.leadId);
    if (!lead) return null;
    if (verifyEmail && lead.email.toLowerCase() !== emailNorm) return null;
    const pkg = await getPackage(tour.packageId);
    if (!pkg) return null;
    return { tour, package: pkg };
  }

  // Try as lead reference (e.g. PCT-20260312-A3B7)
  const lead = await getLeadByReference(ref);
  if (!lead) return null;
  if (verifyEmail && lead.email.toLowerCase() !== emailNorm) return null;

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
    (l) => l.email.toLowerCase() === emailNorm
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
