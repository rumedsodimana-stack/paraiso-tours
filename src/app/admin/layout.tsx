import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import { getAiRuntimeStatus } from "@/lib/ai";
import { AdminShell } from "@/components/AdminShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, aiRuntime] = await Promise.all([
    getAppSettings(),
    getAiRuntimeStatus(),
  ]);

  return (
    <AdminShell
      brandName={getDisplayCompanyName(settings)}
      logoUrl={settings.company.logoUrl}
      aiRuntime={aiRuntime}
    >
      {children}
    </AdminShell>
  );
}
