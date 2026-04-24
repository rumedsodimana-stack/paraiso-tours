/**
 * Paraíso Tours — design tokens as TypeScript constants.
 *
 * These mirror `tokens.css` for when components need the literal value
 * (e.g. inline SVG fills, computed styles). For CSS/Tailwind usage,
 * prefer the `var(--portal-*)` form defined in `tokens.css`.
 */

export const portalColors = {
  ink: "#12343b",
  inkDark: "#0b2125",
  inkSoft: "#0f2b31",
  cream: "#f6efe4",
  paper: "#fbf5ec",
  paperStrong: "#f8f1e7",
  gold: "#dcb87b",
  goldDeep: "#b67833",
  sand: "#dfd7c6",
  sandWarm: "#e5dccd",
  highlight: "#f2dfbf",
  highlightSoft: "#f7e8cf",
  border: "#d9c6ad",
  borderSoft: "#dcc9b1",
  eyebrow: "#8c6a38",
} as const;

/**
 * Classic gradient used across hero bands — biased to the left so
 * content stays readable without darkening the entire image.
 */
export const portalHeroGradient =
  "linear-gradient(110deg,rgba(11,33,38,0.92) 8%,rgba(11,33,38,0.55) 55%,rgba(11,33,38,0.15) 100%)";
