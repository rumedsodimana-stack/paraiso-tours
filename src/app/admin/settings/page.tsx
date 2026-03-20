import Link from "next/link";
import type { ComponentType } from "react";
import {
  Bot,
  KeyRound,
  MessageCircle,
  Palette,
  Sparkles,
} from "lucide-react";
import { getAppSettings } from "@/lib/app-config";
import { getAiRuntimeStatus } from "@/lib/ai";
import { BrandSettingsSection } from "./BrandSettingsSection";
import { AiSettingsSection } from "./AiSettingsSection";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { WhatsAppSection } from "./whatsapp-section";
import { ThemeSelector } from "@/components/theme/ThemeSelector";

type SettingsSectionId =
  | "brand"
  | "ai"
  | "appearance"
  | "security"
  | "whatsapp";

const sectionMeta: Array<{
  id: SettingsSectionId;
  title: string;
  eyebrow: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    id: "brand",
    title: "Brand & Portal",
    eyebrow: "Company",
    icon: Sparkles,
  },
  {
    id: "ai",
    title: "AI Control Center",
    eyebrow: "Automation",
    icon: Bot,
  },
  {
    id: "appearance",
    title: "Appearance",
    eyebrow: "Theme",
    icon: Palette,
  },
  {
    id: "security",
    title: "Security",
    eyebrow: "Access",
    icon: KeyRound,
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    eyebrow: "Messaging",
    icon: MessageCircle,
  },
];

function resolveSection(value?: string): SettingsSectionId {
  if (
    value === "brand" ||
    value === "ai" ||
    value === "appearance" ||
    value === "security" ||
    value === "whatsapp"
  ) {
    return value;
  }
  return "brand";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string }> | { section?: string };
}) {
  const params = searchParams ? await Promise.resolve(searchParams) : {};
  const activeSection = resolveSection(params.section);
  const [settings, aiRuntime] = await Promise.all([
    getAppSettings(),
    getAiRuntimeStatus(),
  ]);

  const activeMeta =
    sectionMeta.find((section) => section.id === activeSection) ?? sectionMeta[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-stone-900 dark:text-stone-50">
            Settings
          </h1>
          <p className="mt-1 text-sm text-stone-500">{activeMeta.title}</p>
        </div>
        <Link
          href="/admin/user-guide#ai-setup"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-white/30 bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white"
        >
          Setup guide
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-white/20 bg-white/40 p-4 shadow-lg shadow-stone-200/50 backdrop-blur-xl xl:sticky xl:top-6 xl:h-fit">
          <nav className="space-y-2">
            {sectionMeta.map(({ icon: Icon, id, title, eyebrow }) => {
              const isActive = id === activeSection;

              return (
                <Link
                  key={id}
                  href={`/admin/settings?section=${id}`}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                    isActive
                      ? "border-teal-200 bg-teal-50/90 shadow-sm"
                      : "border-transparent bg-white/55 hover:border-white/30 hover:bg-white/70"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isActive
                        ? "bg-teal-600 text-white"
                        : "bg-white text-stone-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {eyebrow}
                    </p>
                    <p className="mt-1 font-medium text-stone-900">{title}</p>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-6">
          {activeSection === "brand" ? (
            <BrandSettingsSection settings={settings} />
          ) : null}

          {activeSection === "ai" ? (
            <AiSettingsSection settings={settings} runtime={aiRuntime} />
          ) : null}

          {activeSection === "appearance" ? <ThemeSelector /> : null}

          {activeSection === "security" ? <ChangePasswordSection /> : null}

          {activeSection === "whatsapp" ? <WhatsAppSection /> : null}
        </div>
      </div>
    </div>
  );
}
