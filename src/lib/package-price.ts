import type { TourPackage, PackageOption } from "./types";

function parseNights(duration: string): number {
  const m = duration.match(/(\d+)\s*[Nn]ight/);
  return m ? parseInt(m[1], 10) : 0;
}

export function calcOptionPrice(
  opt: PackageOption,
  pax: number,
  nights: number
): number {
  switch (opt.priceType) {
    case "per_person":
      return opt.price * pax;
    case "per_night":
      return opt.price * nights;
    case "per_day":
      return opt.price * Math.max(1, nights + 1);
    case "total":
      return opt.price;
    default:
      return opt.price;
  }
}

export function getFromPrice(pkg: TourPackage, pax = 1): number {
  const nights = parseNights(pkg.duration);
  let total = pkg.price * pax;

  const min = (opts?: PackageOption[]) => {
    if (!opts?.length) return 0;
    return Math.min(
      ...opts.map((o) => calcOptionPrice(o, pax, nights))
    );
  };

  total += min(pkg.accommodationOptions);
  total += min(pkg.transportOptions);
  total += min(pkg.mealOptions);

  return total;
}
