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
  /** Hotel-attached meal plan ids keyed by night index (as string).
   *  Populated for per-night packages where guests pick RO/BB/HB/FB/AI
   *  straight from the room choice. */
  selectedMealPlanByNight: z.record(z.string(), z.string()).optional(),
  totalPrice: z.number().finite().optional(),
});

// --- Admin lead creation / update ---
export const leadSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    email: z.string().email("Valid email is required").max(320),
    phone: z.string().max(50).optional(),
    source: z.string().max(100).optional(),
    status: z.enum(["new", "scheduled", "cancelled", "completed"]).optional(),
    destination: z.string().max(300).optional(),
    travelDate: z.string().optional(),
    pax: z.number().int().min(1).max(500).optional(),
    accompaniedGuestName: z.string().max(200).optional(),
    notes: z.string().max(5000).optional(),
    packageId: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    // When a package is attached, require traveler count so pricing
    // downstream can't silently default to 1 and misprice.
    if (data.packageId && data.pax == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pax"],
        message: "Select a traveler count when choosing a package.",
      });
    }
    // Soft date sanity — admins may leave it blank (draft) but if set it
    // must be parseable.
    if (data.travelDate && data.travelDate.trim()) {
      const d = data.travelDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d).getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["travelDate"],
          message: "Travel date must be a valid YYYY-MM-DD date.",
        });
      }
    }
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

// --- Custom-route booking (public-facing journey-builder) ---
//
// Same input-cap discipline as clientBookingSchema. Without these
// caps, a hostile client could push a 10MB notes blob into the DB
// or 10000 route stops into a single payload.
export const customRouteRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email is required").max(320),
  phone: z.string().max(50).optional(),
  travelDate: z.string().max(40).optional(),
  pax: z.number().int().min(1).max(50),
  desiredNights: z.number().int().min(0).max(60),
  stayStyle: z.string().max(200),
  transportLabel: z.string().max(200),
  mealLabel: z.string().max(200).optional(),
  mealRequest: z.string().max(2000).optional(),
  accommodationMode: z.enum(["auto", "choose"]).optional(),
  guidanceFee: z.number().finite().min(0).max(100000).optional(),
  guidanceLabel: z.string().max(200).optional(),
  routeStops: z
    .array(
      z.object({
        destinationId: z.string().max(200),
        destinationName: z.string().max(200),
        nights: z.number().int().min(0).max(60),
        hotelName: z.string().max(200).optional(),
        hotelId: z.string().max(200).optional(),
        hotelRate: z.number().finite().min(0).max(1000000).optional(),
        hotelCurrency: z.string().max(10).optional(),
        activities: z.array(z.string().max(500)).max(50),
        legDistanceKm: z.number().finite().min(0).max(50000).optional(),
        legDriveHours: z.number().finite().min(0).max(500).optional(),
      })
    )
    .min(1, "Add at least one destination")
    .max(60, "Too many stops"),
  estimatedTotal: z.number().finite().min(0).max(10000000),
  estimatedCurrency: z.string().min(1).max(10),
  totalDriveHours: z.number().finite().min(0).max(2000),
  notes: z.string().max(5000).optional(),
});
