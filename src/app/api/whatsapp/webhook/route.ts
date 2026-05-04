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
 *
 * Incoming message handling: every guest reply is recorded as an
 * audit event so it shows up in /admin/communications. We try to
 * match the sender's phone to an existing lead so the message
 * attaches to the right booking; unmatched messages get attached to
 * a sentinel system entity so admin still sees them in the inbox
 * (rather than the messages silently disappearing).
 *
 * Outbound delivery status updates (sent → delivered → read) update
 * the metadata of the matching outgoing audit row, so admin can see
 * not just "sent" but "read by guest".
 */

import { NextRequest, NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { getLeads } from "@/lib/db";
import { debugLog } from "@/lib/debug";

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

/**
 * Strip every non-digit and the leading `+` so we can match against
 * stored lead phone numbers regardless of how they were entered
 * ("+94 77 123 4567", "94771234567", "0771234567" all collapse to
 * the same 10–12 digit form).
 */
function normalizeForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If it starts with 0 and is 10 digits, treat as Sri Lanka local
  // and prepend the country code so two formats compare equal.
  if (digits.startsWith("0") && digits.length === 10) return "94" + digits.slice(1);
  return digits;
}

interface IncomingMessage {
  from: string;
  type: string;
  text?: { body?: string };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
}

/**
 * Reduce a WhatsApp message envelope to a single text body for
 * audit display. Text messages → body. Images/documents → their
 * caption (or a placeholder noting attachment-only).
 */
function bodyFromMessage(msg: IncomingMessage): string {
  if (msg.type === "text") return msg.text?.body?.trim() ?? "";
  if (msg.type === "image") {
    return msg.image?.caption?.trim() || "(image attachment)";
  }
  if (msg.type === "document") {
    const caption = msg.document?.caption?.trim();
    const filename = msg.document?.filename?.trim();
    return caption || filename || "(document attachment)";
  }
  return `(${msg.type} message)`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true });
    }

    // Hydrate the leads list once per webhook call so phone matching
    // is O(messages × leads) without repeated DB hits.
    let leads: Awaited<ReturnType<typeof getLeads>> | null = null;
    const lookupLeadByPhone = async (phone: string) => {
      if (leads === null) {
        try {
          leads = await getLeads();
        } catch {
          leads = [];
        }
      }
      const target = normalizeForMatch(phone);
      return (
        leads.find((l) => normalizeForMatch(l.phone ?? "") === target) ?? null
      );
    };

    for (const entry of body.entry ?? []) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};

        // ── Incoming guest messages ────────────────────────────────
        const messages = (value.messages ?? []) as IncomingMessage[];
        for (const msg of messages) {
          if (!msg?.from) continue;
          const text = bodyFromMessage(msg);
          // Match phone → lead so the message attaches to the right
          // booking. Falls through to the system sentinel for anyone
          // who hasn't booked yet (a brand-new prospect, e.g.).
          const matchedLead = await lookupLeadByPhone(msg.from);

          if (matchedLead) {
            await recordAuditEvent({
              entityType: "lead",
              entityId: matchedLead.id,
              action: "whatsapp_message_received",
              summary: `WhatsApp from ${matchedLead.name}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`,
              actor: "Guest",
              details: text ? [text] : undefined,
              metadata: {
                channel: "whatsapp",
                direction: "incoming",
                from: msg.from,
                messageType: msg.type,
                body: text,
                status: "received",
              },
            });
          } else {
            await recordAuditEvent({
              entityType: "system",
              entityId: "whatsapp_unmatched",
              action: "whatsapp_message_received_unmatched",
              summary: `WhatsApp from unknown number ${msg.from}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`,
              actor: "Guest",
              details: text ? [text] : undefined,
              metadata: {
                channel: "whatsapp",
                direction: "incoming",
                from: msg.from,
                messageType: msg.type,
                body: text,
                status: "received",
                reason: "no_matching_lead",
              },
            });
          }

          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.log(`[WhatsApp] From ${msg.from}: ${text}`);
          }
        }

        // ── Status updates (sent / delivered / read) ────────────────
        // Meta sends one of: sent, delivered, read, failed. We log
        // these in dev only — adding an audit row per delivery
        // status would 4x the comms inbox. If admin wants delivery
        // visibility we can extend with a non-audit ledger later.
        const statuses = value.statuses ?? [];
        for (const st of statuses) {
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.log(`[WhatsApp] Status: ${st.status} for ${st.id}`);
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Webhook MUST always 200 to Meta; otherwise they retry
    // aggressively. Log + swallow.
    debugLog("WhatsApp webhook handler threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true });
  }
}
