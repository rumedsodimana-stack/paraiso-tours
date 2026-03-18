import { getPackages } from "@/lib/db";
import { PackagesGrid } from "./PackagesGrid";

export default async function PackagesPage() {
  const packages = await getPackages();
  return (
    <div className="space-y-6">
      <PackagesGrid initialPackages={packages} />
    </div>
  );
}
