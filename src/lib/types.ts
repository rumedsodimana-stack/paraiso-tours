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
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  accommodation?: string;
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
