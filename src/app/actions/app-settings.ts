"use server";

import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit";
import { getAppSettings, updateAppSettings } from "@/lib/app-config";
import { supabase } from "@/lib/supabase";

export interface AppSettingsActionState {
  ok: boolean;
  message: string;
}

const BRANDING_BUCKET =
  process.env.SUPABASE_BRANDING_BUCKET?.trim() || "branding-assets";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

function sanitizeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function uploadBrandLogo(file: File) {
  if (!supabase) {
    throw new Error(
      "Logo uploads need Supabase Storage. Configure Supabase or paste a public logo URL instead."
    );
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error("Logo must be PNG, JPG, WEBP, or SVG.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo must be 2 MB or smaller.");
  }

  const { data: existingBucket } = await supabase.storage.getBucket(
    BRANDING_BUCKET
  );
  if (!existingBucket) {
    const { error: createError } = await supabase.storage.createBucket(
      BRANDING_BUCKET,
      {
        public: true,
        fileSizeLimit: `${MAX_LOGO_BYTES}`,
        allowedMimeTypes: Array.from(ALLOWED_LOGO_TYPES),
      }
    );
    if (
      createError &&
      !/already exists|duplicate/i.test(createError.message)
    ) {
      throw createError;
    }
  }

  const safeName = sanitizeFilename(file.name || "logo");
  const extension = safeName.includes(".")
    ? safeName.split(".").pop()
    : file.type === "image/svg+xml"
      ? "svg"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/png"
          ? "png"
          : "jpg";
  const objectPath = `logos/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;
  const body = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(objectPath, body, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(BRANDING_BUCKET)
    .getPublicUrl(objectPath);
  if (!data.publicUrl) {
    throw new Error("Unable to publish the uploaded logo.");
  }
  return data.publicUrl;
}

export async function updateAppSettingsAction(
  _prevState: AppSettingsActionState,
  formData: FormData
): Promise<AppSettingsActionState> {
  try {
    const previous = await getAppSettings();
    const logoFile = formData.get("logoFile");
    const uploadedLogoUrl =
      logoFile instanceof File && logoFile.size > 0
        ? await uploadBrandLogo(logoFile)
        : undefined;
    const next = await updateAppSettings({
      company: {
        displayName: String(formData.get("displayName") ?? ""),
        companyName: String(formData.get("companyName") ?? ""),
        tagline: String(formData.get("tagline") ?? ""),
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        logoUrl: uploadedLogoUrl ?? String(formData.get("logoUrl") ?? ""),
      },
      portal: {
        topBannerText: String(formData.get("topBannerText") ?? ""),
        topBannerSubtext: String(formData.get("topBannerSubtext") ?? ""),
        locationBadgeText: String(formData.get("locationBadgeText") ?? ""),
        mobileMenuDescription: String(
          formData.get("mobileMenuDescription") ?? ""
        ),
        clientPortalDescription: String(
          formData.get("clientPortalDescription") ?? ""
        ),
        footerExploreTitle: String(formData.get("footerExploreTitle") ?? ""),
        footerContactTitle: String(formData.get("footerContactTitle") ?? ""),
        footerBaseTitle: String(formData.get("footerBaseTitle") ?? ""),
        footerBaseDescription: String(
          formData.get("footerBaseDescription") ?? ""
        ),
        footerCtaEyebrow: String(formData.get("footerCtaEyebrow") ?? ""),
        footerCtaTitle: String(formData.get("footerCtaTitle") ?? ""),
        footerCtaDescription: String(
          formData.get("footerCtaDescription") ?? ""
        ),
        packagesLabel: String(formData.get("packagesLabel") ?? ""),
        journeyBuilderLabel: String(
          formData.get("journeyBuilderLabel") ?? ""
        ),
        myBookingsLabel: String(formData.get("myBookingsLabel") ?? ""),
        trackBookingLabel: String(formData.get("trackBookingLabel") ?? ""),
        copyrightSuffix: String(formData.get("copyrightSuffix") ?? ""),
      },
    });

    await recordAuditEvent({
      entityType: "system",
      entityId: "app_settings",
      action: "branding_updated",
      summary: `Workspace branding updated to ${next.company.companyName}`,
      actor: "Admin",
      details: [
        `Display name: ${next.company.displayName ?? next.company.companyName}`,
        `Support email: ${next.company.email ?? "Not set"}`,
        `Previous display name: ${
          previous.company.displayName ?? previous.company.companyName
        }`,
      ],
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    revalidatePath("/packages");
    revalidatePath("/journey-builder");
    revalidatePath("/my-bookings");
    revalidatePath("/booking-confirmed");
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/invoices");

    return {
      ok: true,
      message: uploadedLogoUrl
        ? "Branding updated and logo uploaded to Supabase Storage."
        : "Branding and company settings updated.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to update settings.",
    };
  }
}
