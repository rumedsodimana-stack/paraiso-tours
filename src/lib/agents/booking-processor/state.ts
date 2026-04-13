import { Annotation } from "@langchain/langgraph";

export interface ItineraryStop {
  day: number;
  destination: string;
  hotel?: string;
  hotelEmail?: string;
  hotelId?: string;
  mealPlan?: string;
  activities: string[];
  transferNote?: string;
}

export interface SupplierEmail {
  type: "hotel" | "transport";
  supplierName: string;
  supplierEmail: string;
  subject: string;
  body: string;
}

export const BookingProcessorState = Annotation.Root({
  threadId: Annotation<string>,
  leadId: Annotation<string>,
  leadReference: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  leadName: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  leadEmail: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  leadPhone: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  leadNotes: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  destination: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  travelDate: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  endDate: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  pax: Annotation<number>({ reducer: (_, b) => b, default: () => 1 }),
  totalPrice: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  currency: Annotation<string>({ reducer: (_, b) => b, default: () => "USD" }),
  transportLabel: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  transportSupplierEmail: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  transportSupplierId: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),

  // Parsed itinerary
  itinerary: Annotation<ItineraryStop[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  itinerarySummary: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),

  // Availability
  availabilityOk: Annotation<boolean>({ reducer: (_, b) => b, default: () => true }),
  availabilityWarnings: Annotation<string[]>({ reducer: (_, b) => b, default: () => [] }),

  // Drafted emails
  guestEmailSubject: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  guestEmailBody: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  supplierEmails: Annotation<SupplierEmail[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),

  // Company branding
  companyName: Annotation<string>({ reducer: (_, b) => b, default: () => "Paraíso Ceylon Tours" }),
  companyEmail: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  companyPhone: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),

  // Human-in-the-loop
  adminDecision: Annotation<"approved" | "rejected" | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  adminNotes: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
});

export type BookingProcessorStateType = typeof BookingProcessorState.State;
