"use server";

import { getClientBookings } from "@/lib/db";
import type { Lead } from "@/lib/types";
import type { Invoice, Payment, TourPackage, Tour } from "@/lib/types";

export async function getClientBookingsAction(email: string): Promise<
  | { error: string }
  | {
      requests: Lead[];
      tours: {
        tour: Tour;
        package: TourPackage;
        invoice: Invoice | null;
        payment: Payment | null;
      }[];
    }
> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { error: "Email is required" };
  }
  const { requests, tours } = await getClientBookings(trimmed);
  return { requests, tours };
}
