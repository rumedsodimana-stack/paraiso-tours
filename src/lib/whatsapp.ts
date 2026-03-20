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
 */
export async function sendWhatsAppBookingConfirmation(params: {
  clientName: string;
  phone: string;
  reference: string;
  packageName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { clientName, phone, reference, packageName } = params;
  const trimmed = phone?.trim();
  if (!trimmed) return { ok: false, error: "No phone number" };

  const normalized = normalizePhone(trimmed);
  if (normalized.length < 10) return { ok: false, error: "Invalid phone number" };
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);
  const contactEmail = settings.company.email || "info@paraisoceylon.com";

  const text = [
    `Hello ${clientName}! 👋`,
    ``,
    `Thank you for your booking with ${brandName}.`,
    ``,
    `📋 *Booking Reference:* ${reference}`,
    `📦 *Package:* ${packageName}`,
    ``,
    `We'll contact you soon to confirm your tour.`,
    `Questions? Reply to this message or email ${contactEmail}`,
    ``,
    `— ${brandName}`,
  ].join("\n");

  return sendWhatsAppMessage(normalized, text);
}
