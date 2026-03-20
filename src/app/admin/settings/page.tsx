import { Bell, Globe, Settings as SettingsIcon, User, WandSparkles } from "lucide-react";
import { getAppSettings } from "@/lib/app-config";
import { BrandSettingsSection } from "./BrandSettingsSection";
import {
  ChangePasswordSection,
} from "./ChangePasswordSection";
import { WhatsAppSection } from "./whatsapp-section";
import { ThemeSelector } from "@/components/theme/ThemeSelector";

export default async function SettingsPage() {
  const settings = await getAppSettings();
  const settingCards = [
    {
      icon: User,
      title: "Profile",
      description: "Update your name, direct contact, and staff identity.",
    },
    {
      icon: Globe,
      title: "Company",
      description: "Manage brand details, invoice defaults, and currency.",
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Tune reminders, follow-ups, and booking alerts.",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-white/40 p-6 shadow-lg shadow-stone-200/50 backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              <SettingsIcon className="h-3.5 w-3.5" />
              Workspace Settings
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-stone-900 dark:text-stone-50">
              Personalize the operations hub
            </h1>
            <p className="mt-3 text-stone-600 dark:text-stone-400">
              Update branding, portal copy, and theme choices without changing
              the core booking and operations structure.
            </p>
          </div>

          <div className="flex max-w-sm items-start gap-3 rounded-2xl border border-white/30 bg-white/60 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <WandSparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-stone-900">Appearance is now themeable</p>
              <p className="mt-1 text-sm text-stone-500">
                Choose from eleven looks and keep the original glass theme as
                the baseline option.
              </p>
            </div>
          </div>
        </div>
      </div>

      <BrandSettingsSection settings={settings} />

      <ThemeSelector />

      <ChangePasswordSection />

      <WhatsAppSection />

      <div className="grid gap-4 xl:grid-cols-3">
        {settingCards.map(({ description, icon: Icon, title }) => (
          <div
            key={title}
            className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/40 p-5 shadow-lg shadow-stone-200/50 backdrop-blur-xl"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70">
              <Icon className="h-5 w-5 text-stone-500" />
            </div>
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-50">
                {title}
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
