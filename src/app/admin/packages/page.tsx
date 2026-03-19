import { getPackages } from "@/lib/db";
import { PackagesGrid } from "./PackagesGrid";
import { SaveSuccessBanner } from "../SaveSuccessBanner";

export default async function PackagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }> | { saved?: string };
}) {
  const packages = await getPackages();
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const saved = params?.saved === "1";
  return (
    <div className="space-y-6">
      {saved && <SaveSuccessBanner message="Package created successfully" />}
      <PackagesGrid initialPackages={packages} />
    </div>
  );
}
