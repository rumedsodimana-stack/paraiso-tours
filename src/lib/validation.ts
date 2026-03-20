import { z } from "zod";

// --- Client booking (public-facing, must be strict) ---
export const clientBookingSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  email: z.string().email("Valid email is required").max(320),
  phone: z.string().max(50).optional(),
  travelDate: z.string().optional(),
  pax: z.number().int().min(1, "At least 1 guest required").max(100).optional(),
  notes: z.string().max(2000).optional(),
  selectedAccommodationOptionId: z.string().max(200).optional(),
  selectedAccommodationByNight: z.record(z.string(), z.string()).optional(),
  selectedTransportOptionId: z.string().max(200).optional(),
  selectedMealOptionId: z.string().max(200).optional(),
  totalPrice: z.number().finite().optional(),
});

// --- Admin lead creation / update ---
export const leadSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required").max(320),
  phone: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  status: z.enum(["new", "contacted", "quoted", "won", "lost"]).optional(),
  destination: z.string().max(300).optional(),
  travelDate: z.string().optional(),
  pax: z.number().int().min(1).max(500).optional(),
  accompaniedGuestName: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  packageId: z.string().max(200).optional(),
});

// --- Supplier / hotel ---
export const hotelSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  type: z.enum(["hotel", "transport", "meal", "supplier"]),
  location: z.string().max(300).optional(),
  contact: z.string().max(200).optional(),
  email: z.string().email("Valid email").max(320).optional().or(z.literal("")),
  defaultPricePerNight: z.number().finite().min(0).optional(),
  maxConcurrentBookings: z.number().int().min(1).optional(),
  starRating: z.number().min(0).max(5).optional(),
  currency: z.string().length(3).default("USD"),
  notes: z.string().max(2000).optional(),
});

// Helper: convert FormData to a plain object (string values only)
export function formDataToObject(
  formData: FormData
): Record<string, string | undefined> {
  const obj: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      obj[key] = value;
    }
  }
  return obj;
}

// Helper: return first Zod error message as a string
export function zodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Validation failed";
}
