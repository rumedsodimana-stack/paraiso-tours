export const themeStorageKey = "paraiso-theme";

export const defaultThemeId = "lagoon-glass";

export const themeIds = [
  "lagoon-glass",
  "desert-sun",
  "sakura-mist",
  "arctic-frost",
  "forest-lodge",
  "cobalt-night",
  "coral-coast",
  "citron-burst",
  "monsoon-indigo",
  "ember-market",
  "vintage-postcard",
] as const;

export type ThemeId = (typeof themeIds)[number];

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  preview: [string, string, string];
};

export const themes: readonly ThemeDefinition[] = [
  {
    id: "lagoon-glass",
    name: "Lagoon Glass",
    description: "The current Paraiso teal glass look, kept as the default.",
    preview: ["#fefce8", "#d1fae5", "#0d9488"],
  },
  {
    id: "desert-sun",
    name: "Desert Sun",
    description: "Warm sand panels with brass and terracotta accents.",
    preview: ["#fff7ed", "#fde68a", "#c2410c"],
  },
  {
    id: "sakura-mist",
    name: "Sakura Mist",
    description: "Soft blush gradients with berry highlights.",
    preview: ["#fff1f2", "#fecdd3", "#be185d"],
  },
  {
    id: "arctic-frost",
    name: "Arctic Frost",
    description: "Icy blues, cool light surfaces, and crisp contrast.",
    preview: ["#eff6ff", "#bfdbfe", "#1d4ed8"],
  },
  {
    id: "forest-lodge",
    name: "Forest Lodge",
    description: "Botanical greens balanced by warm lodge bronze.",
    preview: ["#f7fee7", "#86efac", "#166534"],
  },
  {
    id: "cobalt-night",
    name: "Cobalt Night",
    description: "A dark navy control room lit with cobalt highlights.",
    preview: ["#020617", "#1d4ed8", "#38bdf8"],
  },
  {
    id: "coral-coast",
    name: "Coral Coast",
    description: "Beachfront coral tones with tropical aqua contrast.",
    preview: ["#fff7ed", "#fdba74", "#0ea5a4"],
  },
  {
    id: "citron-burst",
    name: "Citron Burst",
    description: "Bright citrus energy with a fresh editorial edge.",
    preview: ["#fefce8", "#d9f99d", "#65a30d"],
  },
  {
    id: "monsoon-indigo",
    name: "Monsoon Indigo",
    description: "Stormy indigo surfaces with luminous violet detail.",
    preview: ["#0f172a", "#4338ca", "#a855f7"],
  },
  {
    id: "ember-market",
    name: "Ember Market",
    description: "Charcoal surfaces with copper and ember glow.",
    preview: ["#111827", "#ea580c", "#fb7185"],
  },
  {
    id: "vintage-postcard",
    name: "Vintage Postcard",
    description: "Sun-faded paper tones with olive travel-poster accents.",
    preview: ["#fffbeb", "#e7d3b2", "#4d7c0f"],
  },
] as const;

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value != null && themeIds.includes(value as ThemeId);
}
