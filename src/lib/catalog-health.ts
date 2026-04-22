/**
 * Catalog health checks.
 *
 * The two most painful runtime symptoms — hotels showing up in the wrong
 * destination and supplier emails silently skipping — both trace back to
 * missing fields on catalog records. This module walks the catalog and
 * returns a structured report of those gaps, each with a direct fix link
 * so the admin can clear them in one pass.
 */

import type { HotelSupplier, TourPackage, PackageOption } from "./types";

export type CatalogGapSeverity = "critical" | "warning" | "info";

export interface CatalogGap {
  id: string; // stable, dedup-friendly
  kind:
    | "hotel_missing_destination"
    | "hotel_missing_email"
    | "supplier_missing_email"
    | "transport_missing_email"
    | "package_option_missing_supplier"
    | "package_missing_destination";
  severity: CatalogGapSeverity;
  title: string;
  detail: string;
  /** href to open the fix view in the admin UI. */
  fixHref: string;
}

export interface CatalogHealthReport {
  gaps: CatalogGap[];
  stats: {
    totalHotels: number;
    hotelsWithDestination: number;
    hotelsWithEmail: number;
    transportsWithEmail: number;
    totalPackages: number;
    packagesWithDestination: number;
    optionsChecked: number;
    optionsWithSupplier: number;
  };
}

const SUPPLIER_OPTION_PREFIX_OK = /^custom_/i; // guest-provided custom options — skip

function optionsMissingSupplier(options: PackageOption[] | undefined): PackageOption[] {
  if (!options || options.length === 0) return [];
  return options.filter(
    (o) => !o.supplierId && !(o.id && SUPPLIER_OPTION_PREFIX_OK.test(o.id))
  );
}

export function analyzeCatalogHealth(
  hotels: HotelSupplier[],
  packages: TourPackage[]
): CatalogHealthReport {
  const gaps: CatalogGap[] = [];

  // ── Hotels / suppliers ────────────────────────────────────────────────
  let hotelsWithDestination = 0;
  let hotelsWithEmail = 0;
  let transportsWithEmail = 0;

  for (const h of hotels) {
    if (h.type === "hotel") {
      if (h.destinationId?.trim()) hotelsWithDestination += 1;
      if (h.email?.trim()) hotelsWithEmail += 1;
    }
    if (h.type === "transport" && h.email?.trim()) {
      transportsWithEmail += 1;
    }

    // Hotels without destination → the root cause of cross-destination
    // bleed in the journey-builder.
    if (h.type === "hotel" && !h.destinationId?.trim()) {
      gaps.push({
        id: `hotel_no_destination_${h.id}`,
        kind: "hotel_missing_destination",
        severity: "critical",
        title: `Hotel "${h.name}" has no destination assigned`,
        detail:
          "Without a destination, this hotel can appear under any destination in the guest journey-builder.",
        fixHref: `/admin/hotels/${h.id}`,
      });
    }

    // Hotels without email → supplier reservation emails can't send.
    if (h.type === "hotel" && !h.email?.trim()) {
      gaps.push({
        id: `hotel_no_email_${h.id}`,
        kind: "hotel_missing_email",
        severity: "warning",
        title: `Hotel "${h.name}" has no email on file`,
        detail:
          "Supplier reservation emails for this hotel will be skipped during scheduling.",
        fixHref: `/admin/hotels/${h.id}`,
      });
    }

    if (h.type === "transport" && !h.email?.trim()) {
      gaps.push({
        id: `transport_no_email_${h.id}`,
        kind: "transport_missing_email",
        severity: "warning",
        title: `Transport supplier "${h.name}" has no email on file`,
        detail:
          "Transport reservation emails for this supplier will be skipped.",
        fixHref: `/admin/hotels/${h.id}`,
      });
    }

    if (h.type === "supplier" && !h.email?.trim()) {
      gaps.push({
        id: `supplier_no_email_${h.id}`,
        kind: "supplier_missing_email",
        severity: "info",
        title: `Supplier "${h.name}" has no email on file`,
        detail:
          "Supplier remittance advice emails won't dispatch automatically.",
        fixHref: `/admin/hotels/${h.id}`,
      });
    }
  }

  // ── Packages ──────────────────────────────────────────────────────────
  let packagesWithDestination = 0;
  let optionsChecked = 0;
  let optionsWithSupplier = 0;

  for (const p of packages) {
    if (p.destination?.trim()) packagesWithDestination += 1;

    if (!p.destination?.trim()) {
      gaps.push({
        id: `pkg_no_destination_${p.id}`,
        kind: "package_missing_destination",
        severity: "info",
        title: `Package "${p.name}" has no destination set`,
        detail:
          "Hotel / activity filtering inside this package won't know which region to narrow to.",
        fixHref: `/admin/packages/${p.id}/edit`,
      });
    }

    // Walk every option family that holds supplier-backed references.
    const allOptions: Array<{
      scope: "accommodation" | "transport" | "meal";
      options: PackageOption[] | undefined;
    }> = [
      { scope: "accommodation", options: p.accommodationOptions },
      { scope: "transport", options: p.transportOptions },
      { scope: "meal", options: p.mealOptions },
    ];
    const nightOptions = (p.itinerary ?? []).flatMap((d) => [
      ...(d.accommodationOptions ?? []),
      ...(d.mealPlanOptions ?? []),
    ]);
    if (nightOptions.length > 0) {
      allOptions.push({ scope: "accommodation", options: nightOptions });
    }

    for (const { scope, options } of allOptions) {
      if (!options || options.length === 0) continue;
      optionsChecked += options.length;
      optionsWithSupplier += options.filter((o) => !!o.supplierId).length;
      const missing = optionsMissingSupplier(options);
      for (const opt of missing) {
        gaps.push({
          id: `pkg_option_no_supplier_${p.id}_${scope}_${opt.id}`,
          kind: "package_option_missing_supplier",
          severity: "critical",
          title: `Package "${p.name}" — ${scope} option "${opt.label}" has no supplier`,
          detail:
            "Options without supplier IDs mean supplier emails can't find the supplier for reservation notifications.",
          fixHref: `/admin/packages/${p.id}/edit`,
        });
      }
    }
  }

  // Dedupe by id just in case (e.g. same option referenced twice).
  const seen = new Set<string>();
  const deduped: CatalogGap[] = [];
  for (const g of gaps) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    deduped.push(g);
  }

  // Sort: critical first, then warning, then info. Within severity, alpha
  // by title so the same run produces deterministic ordering.
  const order: Record<CatalogGapSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  deduped.sort((a, b) => {
    if (order[a.severity] !== order[b.severity]) {
      return order[a.severity] - order[b.severity];
    }
    return a.title.localeCompare(b.title);
  });

  return {
    gaps: deduped,
    stats: {
      totalHotels: hotels.filter((h) => h.type === "hotel").length,
      hotelsWithDestination,
      hotelsWithEmail,
      transportsWithEmail,
      totalPackages: packages.length,
      packagesWithDestination,
      optionsChecked,
      optionsWithSupplier,
    },
  };
}
