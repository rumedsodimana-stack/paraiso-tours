import type { ComponentType } from "react";
import {
  Bell,
  Bot,
  Building2,
  Globe2,
  KeyRound,
  Palette,
} from "lucide-react";
import { getAppSettings } from "@/lib/app-config";
import { getAiRuntimeStatus } from "@/lib/ai";
import { CompanySettingsSection } from "./CompanySettingsSection";
import { PortalSettingsSection } from "./PortalSettingsSection";
import { NotificationsSection } from "./NotificationsSection";
import { AiSettingsSection } from "./AiSettingsSection";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { ThemeSelector } from "@/components/theme/ThemeSelector";

type SectionId = "company" | "portal" | "notifications" | "ai" | "appearance" | "security";

const SECTIONS: Array<{
  id: SectionId;
  title: string;
  eyebrow: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "company",
    title: "Company",
    eyebrow: "Identity",
    description: "Name, logo, country & contact",
    icon: Building2,
  },
  {
    id: "portal",
    title: "Client Portal",
    eyebrow: "Public site",
    description: "Banner, labels & footer copy",
    icon: Globe2,
  },
  {
    id: "notifications",
    title: "Notifications",
    eyebrow: "Messaging",
    description: "Email (Resend) & WhatsApp",
    icon: Bell,
  },
  {
    id: "ai",
    title: "AI Assistant",
    eyebrow: "Automation",
    description: "API key, models & features",
    icon: Bot,
  },
  {
    id: "appearance",
    title: "Appearance",
    eyebrow: "Theme",
    description: "Color scheme & dark mode",
    icon: Palette,
  },
  {
    id: "security",
    title: "Security",
    eyebrow: "Access",
    description: "Admin password",
    icon: KeyRound,
  },
];

function resolveSection(value?: string): SectionId {
  const valid: SectionId[] = ["company", "portal", "notifications", "ai", "appearance", "security"];
  return valid.includes(value as SectionId) ? (value as SectionId) : "company";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string }> | { section?: string };
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const activeId = resolveSection(params.section);
  const [settings, aiRuntime] = await Promise.all([getAppSettings(), getAiRuntimeStatus()]);

  const aiKeyMissing = aiRuntime.credentialSource === "missing";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white/20 bg-white/40 px-6 py-5 shadow-sm backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Configure your agency, branding, notifications, and AI tools
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar nav */}
        <aside className="rounded-2xl border border-white/20 bg-white/40 p-3 shadow-sm backdrop-blur-xl xl:sticky xl:top-6 xl:h-fit">
          <nav className="space-y-1">
            {SECTIONS.map(({ icon: Icon, id, title, eyebrow, description }) => {
              const isActive = id === activeId;
              const showBadge = id === "ai" && aiKeyMissing;
              return (
                <a
                  key={id}
                  href={`/admin/settings?section=${id}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                    isActive
                      ? "bg-teal-50 text-teal-900"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                  }`}
                >
                  <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-teal-600 text-white" : "bg-stone-100 text-stone-500"}`}>
                    <Icon className="h-4 w-4" />
                    {showBadge && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${isActive ? "text-teal-900" : "text-stone-700"}`}>{title}</p>
                    <p className="text-xs text-stone-400 truncate">{description}</p>
                  </div>
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div>
          {activeId === "company" && <CompanySettingsSection settings={settings} />}
          {activeId === "portal" && <PortalSettingsSection settings={settings} />}
          {activeId === "notifications" && <NotificationsSection />}
          {activeId === "ai" && <AiSettingsSection settings={settings} runtime={aiRuntime} />}
          {activeId === "appearance" && <ThemeSelector />}
          {activeId === "security" && <ChangePasswordSection />}
        </div>
      </div>
    </div>
  );
}
