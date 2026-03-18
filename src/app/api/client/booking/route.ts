import { NextRequest, NextResponse } from "next/server";
import { getTourForClient } from "@/lib/db";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");
  const email = request.nextUrl.searchParams.get("email");

  if (!ref || !email) {
    return NextResponse.json(
      { ok: false, error: "Booking reference and email are required" },
      { status: 400 }
    );
  }

  const result = await getTourForClient(ref.trim(), email.trim().toLowerCase());
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Booking not found. Please check your reference and email." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
