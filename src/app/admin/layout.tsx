import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { AdminShell } from "@/components/AdminShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getAppSettings();

  return (
    <AdminShell
      brandName={getDisplayCompanyName(settings)}
      logoUrl={settings.company.logoUrl}
    >
      {children}
    </AdminShell>
  );
}
