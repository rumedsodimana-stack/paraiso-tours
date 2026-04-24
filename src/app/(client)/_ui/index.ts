/**
 * Client-portal primitives barrel.
 *
 * Import pattern:
 *   import { PortalShell, HeroBand, SectionHeader, ... } from "../_ui";
 *
 * Only primitives live here — no page-specific components. If a
 * component is only used on one surface, keep it next to that page.
 */

export { PortalShell } from "./PortalShell";
export { HeroBand } from "./HeroBand";
export { SectionHeader } from "./SectionHeader";
export { ContentCard } from "./ContentCard";
export { StoryCard, StoryCardPriceFooter } from "./StoryCard";
export { PillRow } from "./PillRow";
export { StatRow, type StatItem } from "./StatRow";
export { PortalButton } from "./PortalButton";
export { DestinationsShowcase } from "./DestinationsShowcase";
export { portalColors, portalHeroGradient } from "./tokens";
