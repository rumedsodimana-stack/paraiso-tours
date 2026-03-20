export const APP_RELEASE = {
  id: "2026-03-20-v0-2-0",
  version: "0.2.0",
  releasedAt: "2026-03-20",
  title: "System updated to v0.2.0",
  summary:
    "The live app now includes the refreshed client portal, the journey builder, frozen booking snapshots, and secured admin login.",
  highlights: [
    "Client portal and journey builder are live with the newer travel-planning experience.",
    "Bookings now keep a frozen package snapshot so later package edits do not change sold trips.",
    "Admin access is protected with a real session-based login flow.",
  ],
  dataNotice:
    "All live user and operations data stays preserved in Supabase across deployments.",
} as const;

export const APP_RELEASE_STORAGE_KEY = `paraiso-release-seen:${APP_RELEASE.id}`;
