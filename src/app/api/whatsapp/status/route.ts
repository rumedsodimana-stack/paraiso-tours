import { NextResponse } from "next/server";
import { isWhatsAppConfigured } from "@/lib/whatsapp";

export async function GET() {
  const connected = isWhatsAppConfigured();
  return NextResponse.json({ connected });
}
