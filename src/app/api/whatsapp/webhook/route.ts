/**
 * WhatsApp Cloud API webhook endpoint.
 * Meta sends:
 * - GET: Verification (hub.mode, hub.verify_token, hub.challenge)
 * - POST: Incoming messages, status updates, etc.
 *
 * Configure in Meta Developer Console:
 * - Webhook URL: https://your-domain.com/api/whatsapp/webhook
 * - Verify Token: same as WHATSAPP_WEBHOOK_VERIFY_TOKEN in .env
 * - Subscribe to: messages, message_template_status_update
 */

import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true });
    }

    for (const entry of body.entry ?? []) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};

        // Incoming messages
        const messages = value.messages ?? [];
        for (const msg of messages) {
          const from = msg.from;
          const type = msg.type;
          let text = "";
          if (type === "text") {
            text = msg.text?.body ?? "";
          }

          // Echo or handle: e.g. log, reply, trigger automation
          if (process.env.NODE_ENV === "development" && text) {
            console.log(`[WhatsApp] From ${from}: ${text}`);
          }

          // Optional: auto-reply (e.g. "Thanks! We'll get back soon.")
          // await sendWhatsAppMessage(from, "Thanks for your message. We'll respond shortly.");
        }

        // Status updates (sent, delivered, read)
        const statuses = value.statuses ?? [];
        for (const st of statuses) {
          if (process.env.NODE_ENV === "development") {
            console.log(`[WhatsApp] Status: ${st.status} for ${st.id}`);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
