import { supabase } from "./supabase";
import { mockPackages } from "./mock-data";
import { generateDocumentNumber } from "./document-number";
import { resolveLeadPackage, resolveTourPackage } from "./package-snapshot";
import type {
  AuditEntityType,
  AuditLog,
  AiInteraction,
  AiKnowledgeDocument,
  Employee,
  HotelSupplier,
  Invoice,
  Lead,
  PayrollRun,
  Todo,
  Tour,
  TourPackage,
  ItineraryDay,
  Payment,
  PackageOption,
} from "./types";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  return String(value).replace("Z", "").replace("+00", "");
}

function toNullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject<T>(value: unknown): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as T;
}

function toLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    reference: (row.reference as string | null) ?? undefined,
    name: String(row.name),
    email: String(row.email),
    phone: (row.phone as string | null) ?? "",
    source: String(row.source),
    status: row.status as Lead["status"],
    destination: (row.destination as string | null) ?? undefined,
    travelDate: (row.travel_date as string | null) ?? undefined,
    pax: (row.pax as number | null) ?? undefined,
    accompaniedGuestName:
      (row.accompanied_guest_name as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    packageId: (row.package_id as string | null) ?? undefined,
    selectedAccommodationOptionId:
      (row.selected_accommodation_option_id as string | null) ?? undefined,
    selectedAccommodationByNight: asObject<Record<string, string>>(
      row.selected_accommodation_by_night
    ),
    selectedTransportOptionId:
      (row.selected_transport_option_id as string | null) ?? undefined,
    selectedMealOptionId:
      (row.selected_meal_option_id as string | null) ?? undefined,
    totalPrice:
      row.total_price == null ? undefined : Number(row.total_price),
    packageSnapshot: asObject<Lead["packageSnapshot"]>(row.package_snapshot),
    archivedAt: (row.archived_at as string | null) ?? undefined,
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
    updatedAt: toTimestamp(row.updated_at) ?? new Date().toISOString(),
  };
}

function toPackage(row: Record<string, unknown>): TourPackage {
  return {
    id: String(row.id),
    name: String(row.name),
    duration: String(row.duration),
    destination: String(row.destination),
    price: Number(row.price),
    currency: String(row.currency),
    description: String(row.description),
    itinerary: asArray<ItineraryDay>(row.itinerary),
    inclusions: asArray<string>(row.inclusions),
    exclusions: asArray<string>(row.exclusions),
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
    rating: row.rating == null ? undefined : Number(row.rating),
    reviewCount:
      row.review_count == null ? undefined : Number(row.review_count),
    featured: row.featured == null ? undefined : Boolean(row.featured),
    region: (row.region as string | null) ?? undefined,
    published: row.published == null ? undefined : Boolean(row.published),
    imageUrl: (row.image_url as string | null) ?? undefined,
    cancellationPolicy:
      (row.cancellation_policy as string | null) ?? undefined,
    mealOptions: asArray<PackageOption>(row.meal_options),
    transportOptions: asArray<PackageOption>(row.transport_options),
    accommodationOptions: asArray<PackageOption>(row.accommodation_options),
    customOptions: asArray<PackageOption>(row.custom_options),
    archivedAt: (row.archived_at as string | null) ?? undefined,
  };
}

function toTour(row: Record<string, unknown>): Tour {
  return {
    id: String(row.id),
    packageId: String(row.package_id),
    packageName: String(row.package_name),
    leadId: String(row.lead_id),
    clientName: String(row.client_name),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    pax: Number(row.pax),
    status: row.status as Tour["status"],
    totalValue: Number(row.total_value),
    currency: String(row.currency),
    packageSnapshot: asObject<Tour["packageSnapshot"]>(row.package_snapshot),
    clientConfirmationSentAt:
      (row.client_confirmation_sent_at as string | null) ?? undefined,
    supplierNotificationsSentAt:
      (row.supplier_notifications_sent_at as string | null) ?? undefined,
    paymentReceiptSentAt:
      (row.payment_receipt_sent_at as string | null) ?? undefined,
    availabilityStatus:
      (row.availability_status as Tour["availabilityStatus"] | null) ??
      undefined,
    availabilityWarnings: asArray<string>(row.availability_warnings),
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  };
}

function toHotel(row: Record<string, unknown>): HotelSupplier {
  return {
    id: String(row.id),
    name: String(row.name),
    type: row.type as HotelSupplier["type"],
    location: (row.location as string | null) ?? undefined,
    email: (row.email as string | null) ?? undefined,
    contact: (row.contact as string | null) ?? undefined,
    defaultPricePerNight:
      row.default_price_per_night == null
        ? undefined
        : Number(row.default_price_per_night),
    currency: String(row.currency),
    maxConcurrentBookings:
      row.max_concurrent_bookings == null
        ? undefined
        : Number(row.max_concurrent_bookings),
    starRating:
      row.star_rating == null ? undefined : Number(row.star_rating),
    notes: (row.notes as string | null) ?? undefined,
    bankName: (row.bank_name as string | null) ?? undefined,
    bankBranch: (row.bank_branch as string | null) ?? undefined,
    accountName: (row.account_name as string | null) ?? undefined,
    accountNumber: (row.account_number as string | null) ?? undefined,
    swiftCode: (row.swift_code as string | null) ?? undefined,
    bankCurrency: (row.bank_currency as string | null) ?? undefined,
    paymentReference: (row.payment_reference as string | null) ?? undefined,
    archivedAt: (row.archived_at as string | null) ?? undefined,
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
  };
}

function toInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    reference: (row.reference as string | null) ?? undefined,
    invoiceNumber: String(row.invoice_number),
    status: row.status as Invoice["status"],
    clientName: String(row.client_name),
    clientEmail: String(row.client_email),
    clientPhone: (row.client_phone as string | null) ?? undefined,
    packageName: String(row.package_name),
    travelDate: (row.travel_date as string | null) ?? undefined,
    pax: row.pax == null ? undefined : Number(row.pax),
    baseAmount: Number(row.base_amount),
    lineItems: asArray<Invoice["lineItems"][number]>(row.line_items),
    totalAmount: Number(row.total_amount),
    currency: String(row.currency),
    notes: (row.notes as string | null) ?? undefined,
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
    updatedAt: toTimestamp(row.updated_at) ?? new Date().toISOString(),
    paidAt: (row.paid_at as string | null) ?? undefined,
  };
}

function toEmployee(row: Record<string, unknown>): Employee {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: (row.phone as string | null) ?? undefined,
    role: String(row.role),
    department: (row.department as string | null) ?? undefined,
    payType: row.pay_type as Employee["payType"],
    salary: row.salary == null ? undefined : Number(row.salary),
    commissionPct:
      row.commission_pct == null ? undefined : Number(row.commission_pct),
    hourlyRate:
      row.hourly_rate == null ? undefined : Number(row.hourly_rate),
    taxPct: row.tax_pct == null ? undefined : Number(row.tax_pct),
    benefitsAmount:
      row.benefits_amount == null ? undefined : Number(row.benefits_amount),
    currency: String(row.currency),
    bankName: (row.bank_name as string | null) ?? undefined,
    accountNumber: (row.account_number as string | null) ?? undefined,
    status: row.status as Employee["status"],
    startDate: (row.start_date as string | null) ?? undefined,
    endDate: (row.end_date as string | null) ?? undefined,
    archivedAt: (row.archived_at as string | null) ?? undefined,
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
    updatedAt: toTimestamp(row.updated_at) ?? new Date().toISOString(),
  };
}

function toPayrollRun(row: Record<string, unknown>): PayrollRun {
  return {
    id: String(row.id),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    payDate: String(row.pay_date),
    status: row.status as PayrollRun["status"],
    items: asArray<PayrollRun["items"][number]>(row.items),
    totalGross: Number(row.total_gross),
    totalDeductions: Number(row.total_deductions),
    totalNet: Number(row.total_net),
    currency: String(row.currency),
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
    updatedAt: toTimestamp(row.updated_at) ?? new Date().toISOString(),
    paidAt: (row.paid_at as string | null) ?? undefined,
  };
}

function toPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    type: row.type as Payment["type"],
    amount: Number(row.amount),
    currency: String(row.currency),
    description: String(row.description),
    clientName: (row.client_name as string | null) ?? undefined,
    reference: (row.reference as string | null) ?? undefined,
    leadId: (row.lead_id as string | null) ?? undefined,
    tourId: (row.tour_id as string | null) ?? undefined,
    invoiceId: (row.invoice_id as string | null) ?? undefined,
    supplierId: (row.supplier_id as string | null) ?? undefined,
    payrollRunId: (row.payroll_run_id as string | null) ?? undefined,
    payableWeekStart:
      (row.payable_week_start as string | null) ?? undefined,
    payableWeekEnd: (row.payable_week_end as string | null) ?? undefined,
    supplierName: (row.supplier_name as string | null) ?? undefined,
    status: row.status as Payment["status"],
    date: String(row.date),
    createdAt: (row.created_at as string | null) ?? undefined,
  };
}

function toTodo(row: Record<string, unknown>): Todo {
  return {
    id: String(row.id),
    title: String(row.title),
    completed: Boolean(row.completed),
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
  };
}

function toAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: String(row.id),
    entityType: row.entity_type as AuditEntityType,
    entityId: String(row.entity_id),
    action: String(row.action),
    summary: String(row.summary),
    actor: String(row.actor),
    details: asArray<string>(row.details),
    metadata: asObject<Record<string, unknown>>(row.metadata),
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
  };
}

function toAiKnowledgeDocument(row: Record<string, unknown>): AiKnowledgeDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    sourceType: row.source_type as AiKnowledgeDocument["sourceType"],
    sourceRef: (row.source_ref as string | null) ?? undefined,
    tags: asArray<string>(row.tags),
    active: Boolean(row.active),
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
    updatedAt: toTimestamp(row.updated_at) ?? new Date().toISOString(),
  };
}

function toAiInteraction(row: Record<string, unknown>): AiInteraction {
  return {
    id: String(row.id),
    tool: String(row.tool),
    requestText: String(row.request_text),
    responseText: String(row.response_text),
    plannedAction: asObject<Record<string, unknown>>(row.planned_action),
    executedOk:
      row.executed_ok == null ? undefined : Boolean(row.executed_ok),
    helpful: row.helpful == null ? undefined : Boolean(row.helpful),
    feedbackNotes: (row.feedback_notes as string | null) ?? undefined,
    promotedToKnowledge:
      row.promoted_to_knowledge == null
        ? undefined
        : Boolean(row.promoted_to_knowledge),
    providerLabel: (row.provider_label as string | null) ?? undefined,
    model: (row.model as string | null) ?? undefined,
    modelMode: (row.model_mode as AiInteraction["modelMode"] | null) ?? undefined,
    superpowerUsed:
      row.superpower_used == null ? undefined : Boolean(row.superpower_used),
    inputTokens:
      row.input_tokens == null ? undefined : Number(row.input_tokens),
    outputTokens:
      row.output_tokens == null ? undefined : Number(row.output_tokens),
    cacheCreationInputTokens:
      row.cache_creation_input_tokens == null
        ? undefined
        : Number(row.cache_creation_input_tokens),
    cacheReadInputTokens:
      row.cache_read_input_tokens == null
        ? undefined
        : Number(row.cache_read_input_tokens),
    estimatedCostUsd:
      row.estimated_cost_usd == null
        ? undefined
        : Number(row.estimated_cost_usd),
    createdAt: toTimestamp(row.created_at) ?? new Date().toISOString(),
    updatedAt: toTimestamp(row.updated_at) ?? new Date().toISOString(),
  };
}

function packageToRow(
  data: Omit<TourPackage, "id" | "createdAt"> & { id?: string; createdAt?: string }
): Record<string, unknown> {
  return {
    id: data.id ?? generateId("pkg"),
    name: data.name,
    duration: data.duration,
    destination: data.destination,
    price: data.price,
    currency: data.currency,
    description: data.description,
    itinerary: data.itinerary ?? [],
    inclusions: data.inclusions ?? [],
    exclusions: data.exclusions ?? [],
    region: toNullable(data.region),
    image_url: toNullable(data.imageUrl),
    rating: toNullable(data.rating),
    review_count: toNullable(data.reviewCount),
    featured: data.featured ?? false,
    published: data.published ?? true,
    cancellation_policy: toNullable(data.cancellationPolicy),
    meal_options: data.mealOptions ?? [],
    transport_options: data.transportOptions ?? [],
    accommodation_options: data.accommodationOptions ?? [],
    custom_options: data.customOptions ?? [],
    archived_at: toNullable(data.archivedAt),
    created_at: data.createdAt ?? new Date().toISOString(),
  };
}

async function seedPackagesIfEmpty(): Promise<void> {
  const { count, error } = await supabase!
    .from("packages")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const { error: insertError } = await supabase!
    .from("packages")
    .insert(mockPackages.map((pkg) => packageToRow(pkg)));
  if (insertError) throw insertError;
}

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase!
    .from("leads")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toLead(row));
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase!
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
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

export async function createLead(
  data: Omit<Lead, "id" | "createdAt" | "updatedAt">
): Promise<Lead> {
  const now = new Date().toISOString();
  const reference =
    data.reference ??
    `PCT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
  const row = {
    id: generateId("lead"),
    reference,
    name: data.name,
    email: data.email,
    phone: data.phone || "",
    source: data.source,
    status: data.status,
    destination: toNullable(data.destination),
    travel_date: toNullable(data.travelDate),
    pax: toNullable(data.pax),
    accompanied_guest_name: toNullable(data.accompaniedGuestName),
    notes: toNullable(data.notes),
    package_id: toNullable(data.packageId),
    selected_accommodation_option_id: toNullable(
      data.selectedAccommodationOptionId
    ),
    selected_accommodation_by_night: toNullable(
      data.selectedAccommodationByNight
    ),
    selected_transport_option_id: toNullable(data.selectedTransportOptionId),
    selected_meal_option_id: toNullable(data.selectedMealOptionId),
    total_price: toNullable(data.totalPrice),
    package_snapshot: toNullable(data.packageSnapshot),
    archived_at: toNullable(data.archivedAt),
    created_at: now,
    updated_at: now,
  };
  const { data: inserted, error } = await supabase!
    .from("leads")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toLead(inserted);
}

export async function updateLead(
  id: string,
  data: Partial<Omit<Lead, "id" | "createdAt">>
): Promise<Lead | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.reference !== undefined) update.reference = data.reference;
  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) update.email = data.email;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.source !== undefined) update.source = data.source;
  if (data.status !== undefined) update.status = data.status;
  if (data.destination !== undefined) {
    update.destination = toNullable(data.destination);
  }
  if (data.travelDate !== undefined) {
    update.travel_date = toNullable(data.travelDate);
  }
  if (data.pax !== undefined) update.pax = toNullable(data.pax);
  if (data.accompaniedGuestName !== undefined) {
    update.accompanied_guest_name = toNullable(data.accompaniedGuestName);
  }
  if (data.notes !== undefined) update.notes = toNullable(data.notes);
  if (data.packageId !== undefined) {
    update.package_id = toNullable(data.packageId);
  }
  if (data.selectedAccommodationOptionId !== undefined) {
    update.selected_accommodation_option_id = toNullable(
      data.selectedAccommodationOptionId
    );
  }
  if (data.selectedAccommodationByNight !== undefined) {
    update.selected_accommodation_by_night = toNullable(
      data.selectedAccommodationByNight
    );
  }
  if (data.selectedTransportOptionId !== undefined) {
    update.selected_transport_option_id = toNullable(
      data.selectedTransportOptionId
    );
  }
  if (data.selectedMealOptionId !== undefined) {
    update.selected_meal_option_id = toNullable(data.selectedMealOptionId);
  }
  if (data.totalPrice !== undefined) {
    update.total_price = toNullable(data.totalPrice);
  }
  if (data.packageSnapshot !== undefined) {
    update.package_snapshot = toNullable(data.packageSnapshot);
  }
  if (data.archivedAt !== undefined) {
    update.archived_at = toNullable(data.archivedAt);
  }

  const { data: updated, error } = await supabase!
    .from("leads")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toLead(updated);
}

export async function deleteLead(id: string): Promise<boolean> {
  const { error } = await supabase!
    .from("leads")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("archived_at", null);
  return !error;
}

export async function getPackages(): Promise<TourPackage[]> {
  await seedPackagesIfEmpty();
  const { data, error } = await supabase!
    .from("packages")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toPackage(row));
}

export async function getPackage(id: string): Promise<TourPackage | null> {
  await seedPackagesIfEmpty();
  const { data, error } = await supabase!
    .from("packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toPackage(data);
}

export async function getPackagesForClient(): Promise<TourPackage[]> {
  const packages = await getPackages();
  return packages.filter((pkg) => pkg.published !== false);
}

export async function createPackage(
  data: Omit<TourPackage, "id" | "createdAt">
): Promise<TourPackage> {
  const { data: inserted, error } = await supabase!
    .from("packages")
    .insert(packageToRow(data))
    .select("*")
    .single();
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
  if (data.region !== undefined) update.region = toNullable(data.region);
  if (data.imageUrl !== undefined) update.image_url = toNullable(data.imageUrl);
  if (data.rating !== undefined) update.rating = toNullable(data.rating);
  if (data.reviewCount !== undefined) {
    update.review_count = toNullable(data.reviewCount);
  }
  if (data.featured !== undefined) update.featured = data.featured;
  if (data.published !== undefined) update.published = data.published;
  if (data.cancellationPolicy !== undefined) {
    update.cancellation_policy = toNullable(data.cancellationPolicy);
  }
  if (data.mealOptions !== undefined) update.meal_options = data.mealOptions;
  if (data.transportOptions !== undefined) {
    update.transport_options = data.transportOptions;
  }
  if (data.accommodationOptions !== undefined) {
    update.accommodation_options = data.accommodationOptions;
  }
  if (data.customOptions !== undefined) update.custom_options = data.customOptions;
  if (data.archivedAt !== undefined) {
    update.archived_at = toNullable(data.archivedAt);
  }

  const { data: updated, error } = await supabase!
    .from("packages")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toPackage(updated);
}

export async function deletePackage(id: string): Promise<boolean> {
  const { error } = await supabase!
    .from("packages")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null);
  return !error;
}

export async function getTours(): Promise<Tour[]> {
  const { data, error } = await supabase!
    .from("tours")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toTour(row));
}

export async function getTour(id: string): Promise<Tour | null> {
  const { data, error } = await supabase!
    .from("tours")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toTour(data);
}

export async function createTour(data: Omit<Tour, "id">): Promise<Tour> {
  const now = new Date().toISOString();
  const row = {
    id: generateId("tour"),
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
    package_snapshot: toNullable(data.packageSnapshot),
    client_confirmation_sent_at: toNullable(data.clientConfirmationSentAt),
    supplier_notifications_sent_at: toNullable(
      data.supplierNotificationsSentAt
    ),
    payment_receipt_sent_at: toNullable(data.paymentReceiptSentAt),
    availability_status: toNullable(data.availabilityStatus),
    availability_warnings: data.availabilityWarnings ?? [],
    created_at: now,
    updated_at: now,
  };

  const { data: inserted, error } = await supabase!
    .from("tours")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toTour(inserted);
}

export async function updateTour(
  id: string,
  data: Partial<Omit<Tour, "id">>
): Promise<Tour | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
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
  if (data.packageSnapshot !== undefined) {
    update.package_snapshot = toNullable(data.packageSnapshot);
  }
  if (data.clientConfirmationSentAt !== undefined) {
    update.client_confirmation_sent_at = toNullable(
      data.clientConfirmationSentAt
    );
  }
  if (data.supplierNotificationsSentAt !== undefined) {
    update.supplier_notifications_sent_at = toNullable(
      data.supplierNotificationsSentAt
    );
  }
  if (data.paymentReceiptSentAt !== undefined) {
    update.payment_receipt_sent_at = toNullable(data.paymentReceiptSentAt);
  }
  if (data.availabilityStatus !== undefined) {
    update.availability_status = toNullable(data.availabilityStatus);
  }
  if (data.availabilityWarnings !== undefined) {
    update.availability_warnings = data.availabilityWarnings;
  }

  const { data: updated, error } = await supabase!
    .from("tours")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toTour(updated);
}

export async function deleteTour(id: string): Promise<boolean> {
  const { error } = await supabase!.from("tours").delete().eq("id", id);
  return !error;
}

export async function getHotels(): Promise<HotelSupplier[]> {
  const { data, error } = await supabase!
    .from("hotels")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toHotel(row));
}

export async function getHotel(id: string): Promise<HotelSupplier | null> {
  const { data, error } = await supabase!
    .from("hotels")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toHotel(data);
}

export async function createHotel(
  data: Omit<HotelSupplier, "id" | "createdAt">
): Promise<HotelSupplier> {
  const row = {
    id: generateId("h"),
    name: data.name,
    type: data.type,
    location: toNullable(data.location),
    email: toNullable(data.email),
    contact: toNullable(data.contact),
    default_price_per_night: toNullable(data.defaultPricePerNight),
    currency: data.currency,
    max_concurrent_bookings: toNullable(data.maxConcurrentBookings),
    star_rating: toNullable(data.starRating),
    notes: toNullable(data.notes),
    bank_name: toNullable(data.bankName),
    bank_branch: toNullable(data.bankBranch),
    account_name: toNullable(data.accountName),
    account_number: toNullable(data.accountNumber),
    swift_code: toNullable(data.swiftCode),
    bank_currency: toNullable(data.bankCurrency),
    payment_reference: toNullable(data.paymentReference),
    archived_at: toNullable(data.archivedAt),
    created_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase!
    .from("hotels")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toHotel(inserted);
}

export async function updateHotel(
  id: string,
  data: Partial<Omit<HotelSupplier, "id" | "createdAt">>
): Promise<HotelSupplier | null> {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.type !== undefined) update.type = data.type;
  if (data.location !== undefined) update.location = toNullable(data.location);
  if (data.email !== undefined) update.email = toNullable(data.email);
  if (data.contact !== undefined) update.contact = toNullable(data.contact);
  if (data.defaultPricePerNight !== undefined) {
    update.default_price_per_night = toNullable(data.defaultPricePerNight);
  }
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.maxConcurrentBookings !== undefined) {
    update.max_concurrent_bookings = toNullable(data.maxConcurrentBookings);
  }
  if (data.starRating !== undefined) {
    update.star_rating = toNullable(data.starRating);
  }
  if (data.notes !== undefined) update.notes = toNullable(data.notes);
  if (data.bankName !== undefined) update.bank_name = toNullable(data.bankName);
  if (data.bankBranch !== undefined) {
    update.bank_branch = toNullable(data.bankBranch);
  }
  if (data.accountName !== undefined) {
    update.account_name = toNullable(data.accountName);
  }
  if (data.accountNumber !== undefined) {
    update.account_number = toNullable(data.accountNumber);
  }
  if (data.swiftCode !== undefined) {
    update.swift_code = toNullable(data.swiftCode);
  }
  if (data.bankCurrency !== undefined) {
    update.bank_currency = toNullable(data.bankCurrency);
  }
  if (data.paymentReference !== undefined) {
    update.payment_reference = toNullable(data.paymentReference);
  }
  if (data.archivedAt !== undefined) {
    update.archived_at = toNullable(data.archivedAt);
  }

  const { data: updated, error } = await supabase!
    .from("hotels")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toHotel(updated);
}

export async function deleteHotel(id: string): Promise<boolean> {
  const { error } = await supabase!
    .from("hotels")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null);
  return !error;
}

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase!
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toInvoice(row));
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase!
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toInvoice(data);
}

export async function getInvoiceByLeadId(leadId: string): Promise<Invoice | null> {
  const { data, error } = await supabase!
    .from("invoices")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return toInvoice(data[0]);
}

export async function createInvoice(
  data: Omit<Invoice, "id" | "createdAt" | "updatedAt">
): Promise<Invoice> {
  const now = new Date().toISOString();
  const row = {
    id: generateId("inv"),
    lead_id: data.leadId,
    reference: toNullable(data.reference),
    invoice_number: data.invoiceNumber ?? generateDocumentNumber("INV"),
    status: data.status,
    client_name: data.clientName,
    client_email: data.clientEmail,
    client_phone: toNullable(data.clientPhone),
    package_name: data.packageName,
    travel_date: toNullable(data.travelDate),
    pax: toNullable(data.pax),
    base_amount: data.baseAmount,
    line_items: data.lineItems,
    total_amount: data.totalAmount,
    currency: data.currency,
    notes: toNullable(data.notes),
    created_at: now,
    updated_at: now,
    paid_at: toNullable(data.paidAt),
  };
  const { data: inserted, error } = await supabase!
    .from("invoices")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toInvoice(inserted);
}

export async function updateInvoice(
  id: string,
  data: Partial<Omit<Invoice, "id" | "createdAt">>
): Promise<Invoice | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.reference !== undefined) update.reference = toNullable(data.reference);
  if (data.invoiceNumber !== undefined) update.invoice_number = data.invoiceNumber;
  if (data.status !== undefined) update.status = data.status;
  if (data.clientName !== undefined) update.client_name = data.clientName;
  if (data.clientEmail !== undefined) update.client_email = data.clientEmail;
  if (data.clientPhone !== undefined) {
    update.client_phone = toNullable(data.clientPhone);
  }
  if (data.packageName !== undefined) update.package_name = data.packageName;
  if (data.travelDate !== undefined) {
    update.travel_date = toNullable(data.travelDate);
  }
  if (data.pax !== undefined) update.pax = toNullable(data.pax);
  if (data.baseAmount !== undefined) update.base_amount = data.baseAmount;
  if (data.lineItems !== undefined) update.line_items = data.lineItems;
  if (data.totalAmount !== undefined) update.total_amount = data.totalAmount;
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.notes !== undefined) update.notes = toNullable(data.notes);
  if (data.paidAt !== undefined) update.paid_at = toNullable(data.paidAt);

  const { data: updated, error } = await supabase!
    .from("invoices")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toInvoice(updated);
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const { error } = await supabase!.from("invoices").delete().eq("id", id);
  return !error;
}

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase!
    .from("employees")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toEmployee(row));
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase!
    .from("employees")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toEmployee(data);
}

export async function createEmployee(
  data: Omit<Employee, "id" | "createdAt" | "updatedAt">
): Promise<Employee> {
  const now = new Date().toISOString();
  const row = {
    id: generateId("emp"),
    name: data.name,
    email: data.email,
    phone: toNullable(data.phone),
    role: data.role,
    department: toNullable(data.department),
    pay_type: data.payType,
    salary: toNullable(data.salary),
    commission_pct: toNullable(data.commissionPct),
    hourly_rate: toNullable(data.hourlyRate),
    tax_pct: toNullable(data.taxPct),
    benefits_amount: toNullable(data.benefitsAmount),
    currency: data.currency,
    bank_name: toNullable(data.bankName),
    account_number: toNullable(data.accountNumber),
    status: data.status,
    start_date: toNullable(data.startDate),
    end_date: toNullable(data.endDate),
    archived_at: toNullable(data.archivedAt),
    created_at: now,
    updated_at: now,
  };
  const { data: inserted, error } = await supabase!
    .from("employees")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toEmployee(inserted);
}

export async function updateEmployee(
  id: string,
  data: Partial<Omit<Employee, "id" | "createdAt">>
): Promise<Employee | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) update.email = data.email;
  if (data.phone !== undefined) update.phone = toNullable(data.phone);
  if (data.role !== undefined) update.role = data.role;
  if (data.department !== undefined) {
    update.department = toNullable(data.department);
  }
  if (data.payType !== undefined) update.pay_type = data.payType;
  if (data.salary !== undefined) update.salary = toNullable(data.salary);
  if (data.commissionPct !== undefined) {
    update.commission_pct = toNullable(data.commissionPct);
  }
  if (data.hourlyRate !== undefined) {
    update.hourly_rate = toNullable(data.hourlyRate);
  }
  if (data.taxPct !== undefined) update.tax_pct = toNullable(data.taxPct);
  if (data.benefitsAmount !== undefined) {
    update.benefits_amount = toNullable(data.benefitsAmount);
  }
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.bankName !== undefined) update.bank_name = toNullable(data.bankName);
  if (data.accountNumber !== undefined) {
    update.account_number = toNullable(data.accountNumber);
  }
  if (data.status !== undefined) update.status = data.status;
  if (data.startDate !== undefined) {
    update.start_date = toNullable(data.startDate);
  }
  if (data.endDate !== undefined) update.end_date = toNullable(data.endDate);
  if (data.archivedAt !== undefined) {
    update.archived_at = toNullable(data.archivedAt);
  }

  const { data: updated, error } = await supabase!
    .from("employees")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toEmployee(updated);
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const { error } = await supabase!
    .from("employees")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("archived_at", null);
  return !error;
}

export async function getPayrollRuns(): Promise<PayrollRun[]> {
  const { data, error } = await supabase!
    .from("payroll_runs")
    .select("*")
    .order("period_end", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toPayrollRun(row));
}

export async function getPayrollRun(id: string): Promise<PayrollRun | null> {
  const { data, error } = await supabase!
    .from("payroll_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toPayrollRun(data);
}

export async function createPayrollRun(
  data: Omit<PayrollRun, "id" | "createdAt" | "updatedAt">
): Promise<PayrollRun> {
  const now = new Date().toISOString();
  const row = {
    id: generateId("pr"),
    period_start: data.periodStart,
    period_end: data.periodEnd,
    pay_date: data.payDate,
    status: data.status,
    items: data.items,
    total_gross: data.totalGross,
    total_deductions: data.totalDeductions,
    total_net: data.totalNet,
    currency: data.currency,
    created_at: now,
    updated_at: now,
    paid_at: toNullable(data.paidAt),
  };
  const { data: inserted, error } = await supabase!
    .from("payroll_runs")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toPayrollRun(inserted);
}

export async function updatePayrollRun(
  id: string,
  data: Partial<Omit<PayrollRun, "id" | "createdAt">>
): Promise<PayrollRun | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.periodStart !== undefined) update.period_start = data.periodStart;
  if (data.periodEnd !== undefined) update.period_end = data.periodEnd;
  if (data.payDate !== undefined) update.pay_date = data.payDate;
  if (data.status !== undefined) update.status = data.status;
  if (data.items !== undefined) update.items = data.items;
  if (data.totalGross !== undefined) update.total_gross = data.totalGross;
  if (data.totalDeductions !== undefined) {
    update.total_deductions = data.totalDeductions;
  }
  if (data.totalNet !== undefined) update.total_net = data.totalNet;
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.paidAt !== undefined) update.paid_at = toNullable(data.paidAt);

  const { data: updated, error } = await supabase!
    .from("payroll_runs")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toPayrollRun(updated);
}

export async function getPayment(id: string): Promise<Payment | null> {
  const { data, error } = await supabase!
    .from("payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toPayment(data);
}

export async function getPaymentByTourId(tourId: string): Promise<Payment | null> {
  const { data, error } = await supabase!
    .from("payments")
    .select("*")
    .eq("tour_id", tourId)
    .order("date", { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return toPayment(data[0]);
}

export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase!
    .from("payments")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toPayment(row));
}

export async function createPayment(
  data: Omit<Payment, "id">
): Promise<Payment> {
  const row = {
    id: generateId("pay"),
    type: data.type,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    client_name: toNullable(data.clientName),
    reference: toNullable(data.reference),
    lead_id: toNullable(data.leadId),
    tour_id: toNullable(data.tourId),
    invoice_id: toNullable(data.invoiceId),
    supplier_id: toNullable(data.supplierId),
    payroll_run_id: toNullable(data.payrollRunId),
    payable_week_start: toNullable(data.payableWeekStart),
    payable_week_end: toNullable(data.payableWeekEnd),
    supplier_name: toNullable(data.supplierName),
    status: data.status,
    date: data.date,
    created_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase!
    .from("payments")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toPayment(inserted);
}

export async function updatePayment(
  id: string,
  data: Partial<Omit<Payment, "id">>
): Promise<Payment | null> {
  const update: Record<string, unknown> = {};
  if (data.type !== undefined) update.type = data.type;
  if (data.amount !== undefined) update.amount = data.amount;
  if (data.currency !== undefined) update.currency = data.currency;
  if (data.description !== undefined) update.description = data.description;
  if (data.clientName !== undefined) {
    update.client_name = toNullable(data.clientName);
  }
  if (data.reference !== undefined) update.reference = toNullable(data.reference);
  if (data.leadId !== undefined) update.lead_id = toNullable(data.leadId);
  if (data.tourId !== undefined) update.tour_id = toNullable(data.tourId);
  if (data.invoiceId !== undefined) {
    update.invoice_id = toNullable(data.invoiceId);
  }
  if (data.supplierId !== undefined) {
    update.supplier_id = toNullable(data.supplierId);
  }
  if (data.payrollRunId !== undefined) {
    update.payroll_run_id = toNullable(data.payrollRunId);
  }
  if (data.payableWeekStart !== undefined) {
    update.payable_week_start = toNullable(data.payableWeekStart);
  }
  if (data.payableWeekEnd !== undefined) {
    update.payable_week_end = toNullable(data.payableWeekEnd);
  }
  if (data.supplierName !== undefined) {
    update.supplier_name = toNullable(data.supplierName);
  }
  if (data.status !== undefined) update.status = data.status;
  if (data.date !== undefined) update.date = data.date;

  const { data: updated, error } = await supabase!
    .from("payments")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toPayment(updated);
}

export async function deletePayment(id: string): Promise<boolean> {
  const { error } = await supabase!.from("payments").delete().eq("id", id);
  return !error;
}

export async function getTodos(): Promise<Todo[]> {
  const { data, error } = await supabase!
    .from("todos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toTodo(row));
}

export async function createTodo(
  data: Omit<Todo, "id" | "createdAt">
): Promise<Todo> {
  const row = {
    id: generateId("todo"),
    title: data.title,
    completed: data.completed,
    created_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase!
    .from("todos")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toTodo(inserted);
}

export async function updateTodo(
  id: string,
  data: Partial<Omit<Todo, "id" | "createdAt">>
): Promise<Todo | null> {
  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.completed !== undefined) update.completed = data.completed;

  const { data: updated, error } = await supabase!
    .from("todos")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toTodo(updated);
}

export async function deleteTodo(id: string): Promise<boolean> {
  const { error } = await supabase!.from("todos").delete().eq("id", id);
  return !error;
}

export async function getAuditLogs(filter?: {
  entityTypes?: AuditEntityType[];
  entityIds?: string[];
  limit?: number;
}): Promise<AuditLog[]> {
  let query = supabase!
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter?.entityTypes?.length === 1) {
    query = query.eq("entity_type", filter.entityTypes[0]);
  } else if (filter?.entityTypes?.length) {
    query = query.in("entity_type", filter.entityTypes);
  }

  if (filter?.entityIds?.length === 1) {
    query = query.eq("entity_id", filter.entityIds[0]);
  } else if (filter?.entityIds?.length) {
    query = query.in("entity_id", filter.entityIds);
  }

  if (filter?.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toAuditLog(row));
}

export async function createAuditLog(
  data: Omit<AuditLog, "id" | "createdAt">
): Promise<AuditLog> {
  const row = {
    id: generateId("audit"),
    entity_type: data.entityType,
    entity_id: data.entityId,
    action: data.action,
    summary: data.summary,
    actor: data.actor,
    details: data.details ?? [],
    metadata: data.metadata ?? {},
    created_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase!
    .from("audit_logs")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toAuditLog(inserted);
}

export async function getAiKnowledgeDocuments(): Promise<AiKnowledgeDocument[]> {
  const { data, error } = await supabase!
    .from("ai_knowledge_documents")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toAiKnowledgeDocument(row));
}

export async function createAiKnowledgeDocument(
  data: Omit<AiKnowledgeDocument, "id" | "createdAt" | "updatedAt">
): Promise<AiKnowledgeDocument> {
  const row = {
    id: generateId("aik"),
    title: data.title,
    content: data.content,
    source_type: data.sourceType,
    source_ref: toNullable(data.sourceRef),
    tags: data.tags ?? [],
    active: data.active,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase!
    .from("ai_knowledge_documents")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toAiKnowledgeDocument(inserted);
}

export async function updateAiKnowledgeDocument(
  id: string,
  data: Partial<
    Omit<AiKnowledgeDocument, "id" | "createdAt" | "updatedAt">
  >
): Promise<AiKnowledgeDocument | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.title !== undefined) update.title = data.title;
  if (data.content !== undefined) update.content = data.content;
  if (data.sourceType !== undefined) update.source_type = data.sourceType;
  if (data.sourceRef !== undefined) update.source_ref = toNullable(data.sourceRef);
  if (data.tags !== undefined) update.tags = data.tags;
  if (data.active !== undefined) update.active = data.active;

  const { data: updated, error } = await supabase!
    .from("ai_knowledge_documents")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toAiKnowledgeDocument(updated);
}

export async function getAiInteractions(limit = 30): Promise<AiInteraction[]> {
  const { data, error } = await supabase!
    .from("ai_interactions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toAiInteraction(row));
}

export async function getAiInteraction(id: string): Promise<AiInteraction | null> {
  const { data, error } = await supabase!
    .from("ai_interactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toAiInteraction(data);
}

export async function createAiInteraction(
  data: Omit<AiInteraction, "id" | "createdAt" | "updatedAt">
): Promise<AiInteraction> {
  const row = {
    id: generateId("aii"),
    tool: data.tool,
    request_text: data.requestText,
    response_text: data.responseText,
    planned_action: data.plannedAction ?? {},
    executed_ok: toNullable(data.executedOk),
    helpful: toNullable(data.helpful),
    feedback_notes: toNullable(data.feedbackNotes),
    promoted_to_knowledge: toNullable(data.promotedToKnowledge),
    provider_label: toNullable(data.providerLabel),
    model: toNullable(data.model),
    model_mode: toNullable(data.modelMode),
    superpower_used: toNullable(data.superpowerUsed),
    input_tokens: toNullable(data.inputTokens),
    output_tokens: toNullable(data.outputTokens),
    cache_creation_input_tokens: toNullable(data.cacheCreationInputTokens),
    cache_read_input_tokens: toNullable(data.cacheReadInputTokens),
    estimated_cost_usd: toNullable(data.estimatedCostUsd),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: inserted, error } = await supabase!
    .from("ai_interactions")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return toAiInteraction(inserted);
}

export async function updateAiInteraction(
  id: string,
  data: Partial<Omit<AiInteraction, "id" | "createdAt" | "updatedAt">>
): Promise<AiInteraction | null> {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.tool !== undefined) update.tool = data.tool;
  if (data.requestText !== undefined) update.request_text = data.requestText;
  if (data.responseText !== undefined) update.response_text = data.responseText;
  if (data.plannedAction !== undefined) update.planned_action = data.plannedAction;
  if (data.executedOk !== undefined) update.executed_ok = data.executedOk;
  if (data.helpful !== undefined) update.helpful = data.helpful;
  if (data.feedbackNotes !== undefined) {
    update.feedback_notes = toNullable(data.feedbackNotes);
  }
  if (data.promotedToKnowledge !== undefined) {
    update.promoted_to_knowledge = data.promotedToKnowledge;
  }
  if (data.providerLabel !== undefined) {
    update.provider_label = toNullable(data.providerLabel);
  }
  if (data.model !== undefined) update.model = toNullable(data.model);
  if (data.modelMode !== undefined) {
    update.model_mode = toNullable(data.modelMode);
  }
  if (data.superpowerUsed !== undefined) {
    update.superpower_used = data.superpowerUsed;
  }
  if (data.inputTokens !== undefined) {
    update.input_tokens = data.inputTokens;
  }
  if (data.outputTokens !== undefined) {
    update.output_tokens = data.outputTokens;
  }
  if (data.cacheCreationInputTokens !== undefined) {
    update.cache_creation_input_tokens = data.cacheCreationInputTokens;
  }
  if (data.cacheReadInputTokens !== undefined) {
    update.cache_read_input_tokens = data.cacheReadInputTokens;
  }
  if (data.estimatedCostUsd !== undefined) {
    update.estimated_cost_usd = data.estimatedCostUsd;
  }

  const { data: updated, error } = await supabase!
    .from("ai_interactions")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !updated) return null;
  return toAiInteraction(updated);
}

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
  const ref = bookingRef.trim();
  const emailNorm = email?.trim().toLowerCase() ?? "";
  const verifyEmail = emailNorm.length > 0;

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

  const lead = await getLeadByReference(ref);
  if (!lead) return null;
  if (verifyEmail && lead.email.toLowerCase() !== emailNorm) return null;

  const tours = await getTours();
  const linkedTour = tours.find((candidate) => candidate.leadId === lead.id);
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
  const emailNorm = email.trim().toLowerCase();
  const leads = await getLeads();
  const tours = await getTours();
  const clientLeads = leads.filter(
    (lead) => lead.email.toLowerCase() === emailNorm
  );
  const leadIds = new Set(clientLeads.map((lead) => lead.id));
  const clientTours = tours.filter((tour) => leadIds.has(tour.leadId));
  const tourLeadIds = new Set(clientTours.map((tour) => tour.leadId));
  const requests = clientLeads.filter((lead) => !tourLeadIds.has(lead.id));

  const toursWithPackages: {
    tour: Tour;
    package: TourPackage;
    invoice: Invoice | null;
    payment: Payment | null;
  }[] = [];
  for (const tour of clientTours) {
    const [livePackage, invoice, payment, lead] = await Promise.all([
      getPackage(tour.packageId),
      getInvoiceByLeadId(tour.leadId),
      getPaymentByTourId(tour.id),
      getLead(tour.leadId),
    ]);
    const pkg = resolveTourPackage(tour, livePackage, lead);
    if (pkg) toursWithPackages.push({ tour, package: pkg, invoice, payment });
  }

  return {
    requests: requests.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    tours: toursWithPackages.sort((a, b) =>
      b.tour.startDate.localeCompare(a.tour.startDate)
    ),
  };
}
