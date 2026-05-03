/**
 * WhatsApp Cloud API integration for Paraíso Ceylon Tours.
 * Uses Meta's WhatsApp Business API (Cloud).
 *
 * Setup: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
 * - Create Meta Business account & WhatsApp App
 * - Get Access Token and Phone Number ID
 * - Register webhook URL in Meta Developer Console
 */

import { getAppSettings, getDisplayCompanyName } from "./app-config";

const WHATSAPP_API = "https://graph.facebook.com/v21.0";

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
}

function getConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) return null;
  return { accessToken: token, phoneNumberId: phoneId };
}

/**
 * Send a text message via WhatsApp.
 * @param to - Phone number in international format without + (e.g. 94771234567)
 * @param text - Message body (max 4096 chars)
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { ok: false, error: "WhatsApp not configured (missing env vars)" };
  }

  const normalizedPhone = to.replace(/\D/g, "");
  if (normalizedPhone.length < 10) {
    return { ok: false, error: "Invalid phone number" };
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedPhone,
          type: "text",
          text: { body: text },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errMsg =
        data.error?.message ?? data.error?.error_user_msg ?? "Unknown error";
      return { ok: false, error: errMsg };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { ok: false, error: msg };
  }
}

/**
 * Send a pre-approved template message (for outside 24h window).
 * Templates must be created in Meta Business Manager first.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = "en",
  components?: Array<{ type: string; parameters: Array<{ type: string; text?: string }> }>
): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  if (!config) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  const normalizedPhone = to.replace(/\D/g, "");
  if (normalizedPhone.length < 10) {
    return { ok: false, error: "Invalid phone number" };
  }

  try {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: normalizedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (components?.length) {
      (body.template as Record<string, unknown>).components = components;
    }

    const res = await fetch(
      `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errMsg =
        data.error?.message ?? data.error?.error_user_msg ?? "Unknown error";
      return { ok: false, error: errMsg };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { ok: false, error: msg };
  }
}

export function isWhatsAppConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Normalize phone for WhatsApp: ensure country code.
 * Sri Lanka = 94. If number starts with 0, replace with 94.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return "94" + digits.slice(1);
  if (digits.length >= 9 && !digits.startsWith("0")) return "94" + digits;
  return digits;
}

/**
 * Send booking confirmation to client via WhatsApp.
 * Call this when a new booking is created (client must have provided phone with country code).
 *
 * Message tone matches the email brand voice — warm, factual,
 * with the booking reference + package + travel date so the guest
 * can scan the message in their notification bar without opening
 * it. Closing "thank you" line mirrors the italic gold closer
 * across the PDF + email artifacts (WhatsApp doesn't support
 * italic, so it's plain text but the wording is consistent).
 */
export async function sendWhatsAppBookingConfirmation(params: {
  clientName: string;
  phone: string;
  reference: string;
  packageName: string;
  travelDate?: string;
  pax?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { clientName, phone, reference, packageName, travelDate, pax } = params;
  const trimmed = phone?.trim();
  if (!trimmed) return { ok: false, error: "No phone number" };

  const normalized = normalizePhone(trimmed);
  if (normalized.length < 10) return { ok: false, error: "Invalid phone number" };
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);
  // Default fallback corrected to paraiso.tours (was the old
  // paraisoceylon.com domain that doesn't exist).
  const contactEmail = settings.company.email || "hello@paraiso.tours";

  const detailLines: string[] = [
    `📋 *Booking Reference:* ${reference}`,
    `📦 *Package:* ${packageName}`,
  ];
  if (travelDate) detailLines.push(`🗓️ *Travel:* ${travelDate}`);
  if (pax != null) {
    detailLines.push(
      `👥 *Travellers:* ${pax} ${pax === 1 ? "guest" : "guests"}`
    );
  }

  const text = [
    `Hello ${clientName}! 👋`,
    ``,
    `Thank you for your booking with *${brandName}*. We've received your request and our team will be in touch shortly to confirm everything.`,
    ``,
    ...detailLines,
    ``,
    `Reply here anytime — happy to help with any question, tweak, or special request.`,
    ``,
    `— ${brandName}`,
    contactEmail,
  ].join("\n");

  return sendWhatsAppMessage(normalized, text);
}

/**
 * Send tour-confirmed notification via WhatsApp once the booking has
 * been approved + scheduled. Mirrors the email's tour-confirmation
 * template but is brief enough for a phone notification.
 *
 * Designed to be called in addition to (not instead of) the email
 * confirmation — admin may want both channels to reach the guest.
 * Call sites can opt in by checking isWhatsAppConfigured() first.
 */
export async function sendWhatsAppTourScheduled(params: {
  clientName: string;
  phone: string;
  reference: string;
  packageName: string;
  startDate: string;
  endDate: string;
  pax: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { clientName, phone, reference, packageName, startDate, endDate, pax } =
    params;
  const trimmed = phone?.trim();
  if (!trimmed) return { ok: false, error: "No phone number" };

  const normalized = normalizePhone(trimmed);
  if (normalized.length < 10) return { ok: false, error: "Invalid phone number" };
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);
  const contactEmail = settings.company.email || "hello@paraiso.tours";

  const text = [
    `Hi ${clientName}! ✈️`,
    ``,
    `Your *${packageName}* is *confirmed* — full itinerary + invoice are on the way to your email.`,
    ``,
    `📋 *Reference:* ${reference}`,
    `🗓️ *Travel window:* ${startDate} → ${endDate}`,
    `👥 *Travellers:* ${pax} ${pax === 1 ? "guest" : "guests"}`,
    ``,
    `We'll send a pre-trip reminder closer to your departure date. Anything we should know in the meantime — dietary, accessibility, schedule tweaks — just message us here.`,
    ``,
    `— ${brandName}`,
    contactEmail,
  ].join("\n");

  return sendWhatsAppMessage(normalized, text);
}

/**
 * Send payment-receipt notification via WhatsApp. Use after admin
 * marks a tour as Completed/Paid or any time an incoming payment
 * is recorded. The email template is the canonical receipt with
 * the PDF; this is the lightweight phone-friendly counterpart.
 */
export async function sendWhatsAppPaymentReceipt(params: {
  clientName: string;
  phone: string;
  amount: number;
  currency: string;
  reference?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { clientName, phone, amount, currency, reference } = params;
  const trimmed = phone?.trim();
  if (!trimmed) return { ok: false, error: "No phone number" };

  const normalized = normalizePhone(trimmed);
  if (normalized.length < 10) return { ok: false, error: "Invalid phone number" };
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);
  const contactEmail = settings.company.email || "hello@paraiso.tours";

  const text = [
    `Hi ${clientName} 🙏`,
    ``,
    `We've received your payment of *${amount.toLocaleString()} ${currency}*${reference ? ` (ref ${reference})` : ""}. Thank you!`,
    ``,
    `A full receipt is on its way to your email.`,
    ``,
    `— ${brandName}`,
    contactEmail,
  ].join("\n");

  return sendWhatsAppMessage(normalized, text);
}
