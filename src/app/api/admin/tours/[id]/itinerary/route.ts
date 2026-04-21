import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTour, getLead, getPackage } from "@/lib/db";
import { resolveTourPackage } from "@/lib/package-snapshot";
import { generateItineraryPdf } from "@/lib/itinerary-pdf";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const session = await verifyAdminSessionToken(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const tour = await getTour(id);
  if (!tour) {
    return NextResponse.json({ ok: false, error: "Tour not found" }, { status: 404 });
  }

  const [lead, livePackage] = await Promise.all([
    getLead(tour.leadId),
    getPackage(tour.packageId),
  ]);
  const pkg = resolveTourPackage(tour, livePackage, lead);

  const pdf = await generateItineraryPdf({ tour, pkg, lead });
  const safeName = `itinerary-${(tour.confirmationId || tour.id).replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
