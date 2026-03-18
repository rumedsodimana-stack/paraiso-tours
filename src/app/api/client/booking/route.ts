import { NextRequest, NextResponse } from "next/server";
import { getTourForClient } from "@/lib/db";
import { debugLog } from "@/lib/debug";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")?.trim();
  const email = request.nextUrl.searchParams.get("email")?.trim();

  if (!ref && !email) {
    return NextResponse.json(
      { ok: false, error: "Enter your booking reference or email" },
      { status: 400 }
    );
  }

  // Email only -> redirect to My Bookings
  if (!ref && email) {
    return NextResponse.json({ ok: true, redirect: "/my-bookings", email });
  }

  debugLog("API booking lookup", { ref, hasEmail: !!email });
  const result = await getTourForClient(ref!, email?.toLowerCase());
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Booking not found. Please check your reference or email." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
