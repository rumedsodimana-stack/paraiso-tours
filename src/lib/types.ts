export type LeadStatus = "new" | "contacted" | "quoted" | "negotiating" | "won" | "lost";

export interface PackageSnapshot {
  packageId?: string;
  name: string;
  duration: string;
  destination: string;
  price: number;
  currency: string;
  description: string;
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  region?: string;
  imageUrl?: string;
  cancellationPolicy?: string;
  mealOptions?: PackageOption[];
  transportOptions?: PackageOption[];
  accommodationOptions?: PackageOption[];
  customOptions?: PackageOption[];
  selectedAccommodationOptionId?: string;
  selectedAccommodationByNight?: Record<string, string>;
  selectedTransportOptionId?: string;
  selectedMealOptionId?: string;
  totalPrice?: number;
  capturedAt: string;
}

export interface Lead {
  id: string;
  reference?: string; // e.g. PCT-20260312-A3B7 for client-facing lookup
  name: string;
  email: string;
  phone: string;
  source: string;
  status: LeadStatus;
  destination?: string;
  travelDate?: string;
  pax?: number;
  /** When 2+ guests, name of accompanied traveler(s) */
  accompaniedGuestName?: string;
  notes?: string;
  packageId?: string; // Selected package when client requests from portal
  /** Legacy: single accommodation for all nights */
  selectedAccommodationOptionId?: string;
  /** Per-night accommodation: { "1": optionId, "2": optionId, ... } */
  selectedAccommodationByNight?: Record<string, string>;
  selectedTransportOptionId?: string;
  selectedMealOptionId?: string;
  totalPrice?: number;
  packageSnapshot?: PackageSnapshot;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TourPackage {
  id: string;
  reference?: string; // e.g. PKG-20260312-A3B7 — client-facing package ID
  name: string;
  duration: string;
  destination: string;
  price: number;
  currency: string;
  description: string;
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  createdAt: string;
  rating?: number;
  reviewCount?: number;
  featured?: boolean;
  region?: string;
  published?: boolean;
  imageUrl?: string;
  cancellationPolicy?: string;
  mealOptions?: PackageOption[];
  transportOptions?: PackageOption[];
  accommodationOptions?: PackageOption[];
  customOptions?: PackageOption[];
  archivedAt?: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  accommodation?: string;
  /** Accommodation options for this night (hotels guest can choose) */
  accommodationOptions?: PackageOption[];
}

export type PriceType =
  | "per_person"
  | "total"
  | "per_night"
  | "per_day"
  | "per_person_total"
  | "per_person_per_night"
  | "per_person_per_day"
  | "per_room_per_night"
  | "per_vehicle_per_day";

export interface PackageOption {
  id: string;
  label: string;
  price: number;
  priceType: PriceType;
  costPrice?: number;
  supplierId?: string;
  /** Persons/rooms/vehicles covered by one priced unit. Used for room and vehicle based pricing. */
  capacity?: number;
  isDefault?: boolean;
}

export interface HotelSupplier {
  id: string;
  name: string;
  type: "hotel" | "transport" | "meal" | "supplier";
  location?: string;
  destinationId?: string;
  /** Email for reservations & communications (used when emailing suppliers) */
  email?: string;
  contact?: string;
  defaultPricePerNight?: number;
  currency: string;
  /** Optional cap for overlapping bookings. Leave empty for unlimited availability. */
  maxConcurrentBookings?: number;
  /** Star rating (1-5) for hotels, set when adding supplier */
  starRating?: number;
  /** Passenger capacity for transport suppliers */
  capacity?: number;
  notes?: string;
  /** Banking details for supplier payments */
  bankName?: string;
  bankBranch?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;
  bankCurrency?: string;
  paymentReference?: string;
  archivedAt?: string;
  createdAt: string;
}

export type TourStatus =
  | "scheduled"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled";

export interface Tour {
  id: string;
  confirmationId?: string; // e.g. TCF-20260312-A3B7 — client-facing confirmation number
  packageId: string;
  packageName: string;
  leadId: string;
  clientName: string;
  startDate: string;
  endDate: string;
  pax: number;
  status: "scheduled" | "confirmed" | "in-progress" | "completed" | "cancelled";
  totalValue: number;
  currency: string;
  packageSnapshot?: PackageSnapshot;
  clientConfirmationSentAt?: string;
  supplierNotificationsSentAt?: string;
  paymentReceiptSentAt?: string;
  availabilityStatus?: "ready" | "attention_needed";
  availabilityWarnings?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface QuotationLineItem {
  id: string;
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected";

export interface Quotation {
  id: string;
  reference: string; // QUO-YYYYMMDDHHMMSS-XXXX

  // Corporate / company client
  companyName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;

  // Trip details
  travelDate?: string; // YYYY-MM-DD
  duration?: string;   // e.g. "8 Nights / 9 Days"
  pax: number;
  destination?: string;

  // Quotation content
  title?: string;
  itinerary: ItineraryDay[];
  inclusions?: string[];
  exclusions?: string[];
  termsAndConditions?: string;
  notes?: string;
  validUntil?: string; // YYYY-MM-DD

  // Pricing
  lineItems: QuotationLineItem[];
  subtotal: number;
  discountAmount?: number;
  totalAmount: number;
  currency: string;

  // Status
  status: QuotationStatus;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;

  // Links — set when quotation is accepted and converted to a tour
  leadId?: string;
  tourId?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  type: "incoming" | "outgoing";
  amount: number;
  currency: string;
  description: string;
  clientName?: string;
  reference?: string;
  /** Link to lead (for client payments) */
  leadId?: string;
  /** Link to tour (for client or supplier payments) */
  tourId?: string;
  /** Link to invoice (for client payments) */
  invoiceId?: string;
  /** Supplier ID for outgoing payments */
  supplierId?: string;
  /** Link to payroll run (for payroll payments) */
  payrollRunId?: string;
  /** For outgoing supplier payments from Payables: week range for exclusion */
  payableWeekStart?: string;
  payableWeekEnd?: string;
  /** For outgoing: supplier name (for display) */
  supplierName?: string;
  status: "pending" | "completed" | "cancelled";
  date: string;
  createdAt?: string;
}

export type InvoiceStatus = "pending_payment" | "paid" | "overdue" | "cancelled";

export interface InvoiceLineItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  leadId: string;
  reference?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  packageName: string;
  travelDate?: string;
  pax?: number;
  baseAmount: number;
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  currency: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export type BusinessType =
  | "adventure"
  | "beach_resort"
  | "cultural"
  | "luxury"
  | "budget"
  | "eco"
  | "corporate"
  | "safari_wildlife"
  | "multi_destination"
  | "other";

export interface Company {
  displayName?: string;
  companyName: string;
  tagline?: string;
  address?: string;
  country?: string;
  timezone?: string;
  currency?: string; // default invoice/pricing currency, e.g. "USD"
  website?: string;
  businessType?: BusinessType;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

export interface PortalSettings {
  topBannerText: string;
  topBannerSubtext?: string;
  locationBadgeText?: string;
  mobileMenuDescription?: string;
  clientPortalDescription: string;
  footerExploreTitle: string;
  footerContactTitle: string;
  footerBaseTitle: string;
  footerBaseDescription?: string;
  footerCtaEyebrow?: string;
  footerCtaTitle: string;
  footerCtaDescription?: string;
  packagesLabel: string;
  journeyBuilderLabel: string;
  myBookingsLabel: string;
  trackBookingLabel: string;
  customJourneyGuidanceFee: number;
  customJourneyGuidanceLabel: string;
  copyrightSuffix?: string;
}

export type AiProviderKind = "gemini" | "openai_compatible" | "anthropic";
export type AiPromptCacheTtl = "5m" | "1h";
export type AiModelMode = "auto" | "simple" | "default" | "heavy";

export interface AiSettings {
  enabled: boolean;
  providerKind: AiProviderKind;
  providerLabel: string;
  baseUrl: string;
  model: string;
  simpleModel: string;
  defaultModel: string;
  heavyModel: string;
  temperature: number;
  maxTokens: number;
  bookingBriefEnabled: boolean;
  packageWriterEnabled: boolean;
  journeyAssistantEnabled: boolean;
  workspaceCopilotEnabled: boolean;
  clientConciergeEnabled: boolean;
  ragEnabled: boolean;
  ragMaxChunks: number;
  selfLearningEnabled: boolean;
  promptCacheEnabled: boolean;
  promptCacheTtl: AiPromptCacheTtl;
  dailyBudgetAlertUsd: number;
  superpowerEnabled: boolean;
  globalInstructions?: string;
  knowledgeNotes?: string;
}

export interface AppSettings {
  company: Company;
  portal: PortalSettings;
  ai: AiSettings;
  updatedAt: string;
}

export type EmployeePayType = "salary" | "commission" | "hourly";

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  payType: EmployeePayType;
  /** Monthly salary (when payType is salary) */
  salary?: number;
  /** Commission % of tour value (when payType is commission) */
  commissionPct?: number;
  /** Hourly rate (when payType is hourly) */
  hourlyRate?: number;
  /** Deductions: tax % and fixed benefits amount per pay period */
  taxPct?: number;
  benefitsAmount?: number;
  currency: string;
  bankName?: string;
  accountNumber?: string;
  status: "active" | "inactive";
  startDate?: string;
  endDate?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollItem {
  employeeId: string;
  employeeName: string;
  grossAmount: number;
  taxAmount: number;
  benefitsAmount: number;
  netAmount: number;
  notes?: string;
  /** For commission: tour IDs or count */
  tourIds?: string[];
}

export type PayrollRunStatus = "draft" | "approved" | "paid";

export interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayrollRunStatus;
  items: PayrollItem[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export type AuditEntityType =
  | "lead"
  | "package"
  | "tour"
  | "invoice"
  | "payment"
  | "supplier"
  | "employee"
  | "activity"
  | "meal_plan"
  | "system"
  | "agent";

export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  summary: string;
  actor: string;
  details?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type AiKnowledgeSourceType =
  | "manual"
  | "system"
  | "learned"
  | "interaction";

export interface AiKnowledgeDocument {
  id: string;
  title: string;
  content: string;
  sourceType: AiKnowledgeSourceType;
  sourceRef?: string;
  tags?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiInteraction {
  id: string;
  tool: string;
  requestText: string;
  responseText: string;
  plannedAction?: Record<string, unknown>;
  executedOk?: boolean;
  helpful?: boolean;
  feedbackNotes?: string;
  promotedToKnowledge?: boolean;
  providerLabel?: string;
  model?: string;
  modelMode?: AiModelMode;
  superpowerUsed?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  estimatedCostUsd?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerActivityRecord {
  id: string;
  destinationId: string;
  title: string;
  summary: string;
  durationLabel: string;
  energy: "easy" | "moderate" | "active";
  bestFor?: string;
  estimatedPrice: number;
  tags: string[];
  active: boolean;
  createdAt: string;
}

export interface HotelMealPlan {
  id: string;
  hotelId: string;
  label: string;
  pricePerPerson: number;
  priceType: string;
  currency: string;
  description?: string;
  active: boolean;
  createdAt: string;
}
