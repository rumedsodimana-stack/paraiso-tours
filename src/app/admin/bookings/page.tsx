import { getLeads, getPackages } from "@/lib/db";
import { LeadsTable } from "./LeadsTable";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }> | { q?: string };
}) {
  const [leads, packages] = await Promise.all([getLeads(), getPackages()]);
  const packageNames: Record<string, string> = Object.fromEntries(
    packages.map((p) => [p.id, p.name])
  );
  const rawParams = searchParams ? await Promise.resolve(searchParams) : {};
  const params = rawParams as { q?: string };
  const initialSearch = typeof params?.q === "string" ? params.q : undefined;
  return (
    <div className="space-y-6">
      <LeadsTable
        key={initialSearch ?? "__empty__"}
        initialLeads={leads}
        packageNames={packageNames}
        initialSearch={initialSearch}
      />
    </div>
  );
}
