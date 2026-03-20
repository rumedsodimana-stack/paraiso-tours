export const APP_RELEASE = {
  id: "2026-03-20-v0-3-0",
  version: "0.3.0",
  releasedAt: "2026-03-20",
  title: "System updated to v0.3.0",
  summary:
    "The live app now includes white-label branding settings, logo management, and safer storage for branding assets.",
  highlights: [
    "Agency name, contact details, footer copy, navigation labels, and document branding can be managed from Admin Settings.",
    "Logos can be uploaded into Supabase Storage or linked by public URL, avoiding Vercel memory and filesystem limits.",
    "Client portal, admin shell, invoices, payables, supplier emails, and metadata now follow the configured brand.",
  ],
  dataNotice:
    "All live user and operations data stays preserved in Supabase across deployments.",
} as const;

export const APP_RELEASE_STORAGE_KEY = `paraiso-release-seen:${APP_RELEASE.id}`;
