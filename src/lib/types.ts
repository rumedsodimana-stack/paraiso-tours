export type LeadStatus = "new" | "contacted" | "quoted" | "negotiating" | "won" | "lost";

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
  notes?: string;
  packageId?: string; // Selected package when client requests from portal
  selectedAccommodationOptionId?: string;
  selectedTransportOptionId?: string;
  selectedMealOptionId?: string;
  totalPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TourPackage {
  id: string;
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
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  accommodation?: string;
}

export type PriceType = "per_person" | "total" | "per_night" | "per_day";

export interface PackageOption {
  id: string;
  label: string;
  price: number;
  priceType: PriceType;
  costPrice?: number;
  supplierId?: string;
  isDefault?: boolean;
}

export interface HotelSupplier {
  id: string;
  name: string;
  type: "hotel" | "transport" | "supplier";
  location?: string;
  contact?: string;
  defaultPricePerNight?: number;
  currency: string;
  notes?: string;
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
}

export interface Quotation {
  id: string;
  leadId: string;
  clientName: string;
  packageId: string;
  packageName: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "accepted" | "declined";
  createdAt: string;
}

export interface Payment {
  id: string;
  type: "incoming" | "outgoing";
  amount: number;
  currency: string;
  description: string;
  clientName?: string;
  reference?: string;
  status: "pending" | "completed" | "cancelled";
  date: string;
}
