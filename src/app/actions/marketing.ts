"use server";

/**
 * Marketing-assistant server actions.
 *
 * The marketing agent generates social-post drafts that admin
 * reviews and copy-pastes into each platform's app. v1 is
 * copy-paste-only — no OAuth or direct posting to Instagram /
 * Facebook / X / LinkedIn. Lets admin keep editorial control and
 * keeps the system free of third-party platform approvals.
 *
 * Surfaces a single generate action plus CRUD on individual drafts.
 * All audit events are tagged actor: "Marketing Agent" via the
 * AsyncLocalStorage context so /admin/communications correctly
 * attributes the activity (vs Admin / AI Assistant / Booking
 * Processor).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSocialPostDraft,
  deleteSocialPostDraft,
  extractErrorMessage,
  getPackages,
  getSocialPostDraft,
  getTours,
  updateSocialPostDraft,
} from "@/lib/db";
import { getPlannerDestinations } from "@/lib/route-planner";
import { recordAuditEvent } from "@/lib/audit";
import { runAsActor } from "@/lib/audit-context";
import { generateAiJsonResult } from "@/lib/ai";
import { debugLog } from "@/lib/debug";
import { requireAdmin } from "@/lib/admin-session";
import type {
  SocialPlatform,
  SocialPostDraft,
  SocialPostStatus,
  SocialPostTargetKind,
} from "@/lib/types";

// ── Generate action ────────────────────────────────────────────

const PLATFORMS: SocialPlatform[] = ["instagram", "facebook", "x", "linkedin"];

const generateSchema = z.object({
  platforms: z.array(z.enum(["instagram", "facebook", "x", "linkedin"])).min(1).max(4),
  targetKind: z.enum(["package", "destination", "tour", "generic"]),
  /** When targetKind is package/destination/tour, this is the id. */
  targetId: z.string().max(200).optional(),
  /** Optional admin steer ("focus on adventure travelers", etc.) */
  brief: z.string().max(1000).optional(),
  /** How many drafts to generate per platform. Default 2; cap 5 to
   *  keep AI cost / response time reasonable. */
  countPerPlatform: z.number().int().min(1).max(5).default(2),
});

interface GeneratedDraft {
  platform: SocialPlatform;
  copy: string;
  imageDirection?: string;
  tags: string[];
}

/**
 * Generate fresh post drafts via the marketing agent. Returns the
 * persisted drafts so the caller can render them immediately.
 *
 * Flow:
 *   1. Resolve grounding context (the package/destination/tour the
 *      drafts should reference) so the AI doesn't invent details
 *   2. Build a tone- and platform-aware prompt
 *   3. Call generateAiJsonResult (already supports the marketing_assistant
 *      AiFeature)
 *   4. Persist each returned draft as a SocialPostDraft row
 *   5. Audit-log under actor "Marketing Agent"
 */
export async function generateSocialPostDraftsAction(
  input: z.infer<typeof generateSchema>
): Promise<{
  drafts?: SocialPostDraft[];
  error?: string;
  warnings?: string[];
}> {
  await requireAdmin();
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { platforms, targetKind, targetId, brief, countPerPlatform } =
    parsed.data;

  // ── Build grounding context ──
  // Read real catalog data when targeted so the AI doesn't make up
  // package names, destinations, or pricing. For "generic" posts we
  // include a brief summary of what the company does.
  let groundingBlock = "";
  let displayLabel = "(general brand post)";
  try {
    if (targetKind === "package" && targetId) {
      const packages = await getPackages();
      const pkg = packages.find((p) => p.id === targetId);
      if (pkg) {
        displayLabel = pkg.name;
        groundingBlock = [
          `Package: ${pkg.name}`,
          `Destination: ${pkg.destination}`,
          `Duration: ${pkg.duration}`,
          `Currency: ${pkg.currency}`,
          `Description: ${pkg.description ?? ""}`.trim(),
          pkg.inclusions?.length
            ? `Inclusions: ${pkg.inclusions.slice(0, 8).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    } else if (targetKind === "destination" && targetId) {
      const destinations = getPlannerDestinations();
      const dest = destinations.find((d) => d.id === targetId);
      if (dest) {
        displayLabel = dest.name;
        groundingBlock = [
          `Destination: ${dest.name}`,
          `Region: ${dest.region}`,
          dest.summary ? `Summary: ${dest.summary}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    } else if (targetKind === "tour" && targetId) {
      const tours = await getTours();
      const tour = tours.find((t) => t.id === targetId);
      if (tour) {
        displayLabel = `${tour.packageName} (${tour.startDate})`;
        groundingBlock = [
          `Recent tour: ${tour.packageName}`,
          `Travel window: ${tour.startDate} → ${tour.endDate}`,
          `Travellers: ${tour.pax}`,
        ].join("\n");
      }
    }
  } catch (err) {
    debugLog("Marketing grounding context fetch failed", {
      error: extractErrorMessage(err),
      targetKind,
      targetId,
    });
    // Falls through with empty groundingBlock; the agent will lean
    // on the brief instead of catalog data.
  }

  const systemPrompt = [
    "You are the social-media marketing assistant for Paraíso Tours, a Sri Lanka travel company.",
    "Generate evocative, sensory post copy that makes people want to book.",
    "Do not invent prices, dates, or facts not provided in the user prompt.",
    "Match each platform's voice:",
    "- Instagram: 2-3 short paragraphs, emotive, sensory, ends with 5-8 hashtags",
    "- Facebook: 1-2 paragraphs, slightly longer, conversational, 3-5 hashtags",
    "- X: under 280 chars total including hashtags, punchy, 2-3 hashtags",
    "- LinkedIn: 2-3 paragraphs, professional, B2B angle (corporate retreats, incentive travel), 3-5 hashtags",
    "",
    'Return strict JSON: { "drafts": [{ "platform": "instagram", "copy": "...", "imageDirection": "...", "tags": ["sigiriya", "tea"] }] }',
    "Each `tags` array contains hashtag words WITHOUT the # symbol.",
    "Each `imageDirection` is a short note (under 100 chars) describing the photo to pair with the copy.",
  ].join("\n");

  const userPrompt = [
    `Generate ${countPerPlatform} draft post(s) for each of these platforms: ${platforms.join(", ")}.`,
    `Topic: ${displayLabel}`,
    groundingBlock ? `\nGrounding context:\n${groundingBlock}` : "",
    brief ? `\nAdmin brief: ${brief}` : "",
    `\nReturn ${platforms.length * countPerPlatform} draft(s) total in the JSON.`,
  ]
    .filter(Boolean)
    .join("\n");

  let aiResult: { drafts?: GeneratedDraft[] };
  try {
    const r = await generateAiJsonResult<{ drafts?: GeneratedDraft[] }>({
      feature: "marketing_assistant",
      title: `Marketing drafts: ${displayLabel}`,
      systemPrompt,
      userPrompt,
      usePromptCache: true,
    });
    aiResult = r.data;
  } catch (err) {
    return { error: `Couldn't reach the AI: ${extractErrorMessage(err)}` };
  }

  const candidates = (aiResult.drafts ?? []).filter(
    (d): d is GeneratedDraft =>
      !!d &&
      typeof d.copy === "string" &&
      d.copy.trim().length > 0 &&
      PLATFORMS.includes(d.platform as SocialPlatform)
  );

  if (candidates.length === 0) {
    return {
      error:
        "AI returned no usable drafts. Try a more specific brief, or pick a different package/destination as the topic.",
    };
  }

  // Persist each draft + audit event. Wrapped in runAsActor so all
  // audit rows correctly attribute to the Marketing Agent (not Admin).
  const persisted: SocialPostDraft[] = [];
  const warnings: string[] = [];
  await runAsActor("Marketing Agent", async () => {
    for (const c of candidates) {
      try {
        const row = await createSocialPostDraft({
          platform: c.platform,
          copy: c.copy.trim(),
          imageDirection: c.imageDirection?.trim() || undefined,
          targetKind: targetKind as SocialPostTargetKind,
          targetId: targetId || undefined,
          tags: Array.isArray(c.tags)
            ? c.tags
                .map((t) => String(t).replace(/^#/, "").trim())
                .filter(Boolean)
            : [],
          status: "draft",
          generatedBy: "Marketing Agent",
        });
        persisted.push(row);
        await recordAuditEvent({
          entityType: "social_post",
          entityId: row.id,
          action: "draft_generated",
          summary: `Marketing draft generated for ${c.platform} — ${displayLabel}`,
          details: [`Platform: ${c.platform}`, `Topic: ${displayLabel}`],
          metadata: {
            channel: "marketing",
            platform: c.platform,
            template: "social_post_draft",
            status: "sent",
          },
        });
      } catch (err) {
        warnings.push(
          `Couldn't persist a ${c.platform} draft: ${extractErrorMessage(err)}`
        );
      }
    }
  });

  revalidatePath("/admin/marketing");

  if (persisted.length === 0) {
    return {
      error: "No drafts saved — see warnings above.",
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
  return {
    drafts: persisted,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// ── CRUD actions for the page ──────────────────────────────────

const updateSchema = z.object({
  copy: z.string().max(10000).optional(),
  imageDirection: z.string().max(500).optional(),
  status: z.enum(["draft", "approved", "posted", "archived"]).optional(),
  tags: z.array(z.string().max(50)).max(50).optional(),
});

export async function updateSocialPostDraftAction(
  id: string,
  patch: z.infer<typeof updateSchema>
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(patch);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const existing = await getSocialPostDraft(id);
    if (!existing) return { error: "Draft not found" };

    const update: Partial<SocialPostDraft> = { ...parsed.data };
    // Stamp postedAt the moment status flips to posted. Doesn't
    // touch the field on other transitions so admin can't
    // accidentally lose the original timestamp.
    if (parsed.data.status === "posted" && !existing.postedAt) {
      update.postedAt = new Date().toISOString();
    }
    const updated = await updateSocialPostDraft(id, update);
    if (!updated) return { error: "Update failed" };

    // Audit only on meaningful state transitions (not every typo).
    if (parsed.data.status && parsed.data.status !== existing.status) {
      await recordAuditEvent({
        entityType: "social_post",
        entityId: id,
        action: `status_changed_to_${parsed.data.status}`,
        summary: `Social post draft moved to ${parsed.data.status} (${updated.platform})`,
        details: [
          `Platform: ${updated.platform}`,
          `Previous status: ${existing.status}`,
        ],
        metadata: {
          channel: "marketing",
          platform: updated.platform,
          template: "social_post_draft",
          status: parsed.data.status === "posted" ? "sent" : "skipped",
        },
      });
    }

    revalidatePath("/admin/marketing");
    return { success: true };
  } catch (err) {
    return { error: extractErrorMessage(err) };
  }
}

export async function deleteSocialPostDraftAction(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  try {
    const existing = await getSocialPostDraft(id);
    if (!existing) return { error: "Draft not found" };
    const ok = await deleteSocialPostDraft(id);
    if (!ok) return { error: "Delete failed" };
    await recordAuditEvent({
      entityType: "social_post",
      entityId: id,
      action: "deleted",
      summary: `Social post draft deleted (${existing.platform})`,
      details: [`Platform: ${existing.platform}`],
    });
    revalidatePath("/admin/marketing");
    return { success: true };
  } catch (err) {
    return { error: extractErrorMessage(err) };
  }
}

// Tiny helper for the page to surface known SocialPostStatus values
// without re-typing them.
export const SOCIAL_POST_STATUSES: ReadonlyArray<SocialPostStatus> = [
  "draft",
  "approved",
  "posted",
  "archived",
];

// ── Suggest topics ─────────────────────────────────────────────
//
// Reduces the admin's cognitive load: instead of asking "which
// package should I post about?", the agent looks at the catalog +
// recent activity + drafts already generated and proposes the
// best topics to focus on right now.

export interface MarketingTopicSuggestion {
  /** Stable client-side key — used by the UI as the React key. */
  id: string;
  /** Short topic label, e.g. "Sigiriya at sunrise". */
  title: string;
  /** 1-2 sentence rationale shown under the title. */
  rationale: string;
  /** Pre-filled targetKind so admin can one-click draft. */
  targetKind: SocialPostTargetKind;
  /** Pre-filled targetId where applicable. */
  targetId?: string;
  /** Pre-filled brief the AI should use for the draft. */
  brief: string;
  /** Suggested platforms — admin can override. */
  platforms: SocialPlatform[];
}

/**
 * Ask the AI for 3-5 topic suggestions based on the current catalog
 * + recent booking activity + drafts already in the system.
 *
 * Heuristic seeds passed to the AI as grounding:
 *  - Top published packages by booking count (popularity signal)
 *  - Packages with NO drafts in the last 30 days (coverage gap)
 *  - Recent completed tours (testimonial fodder)
 *  - Current month name (seasonal angle)
 */
export async function suggestMarketingTopicsAction(): Promise<{
  suggestions?: MarketingTopicSuggestion[];
  error?: string;
}> {
  await requireAdmin();

  // ── Build grounding context ──
  const [packages, tours, drafts] = await Promise.all([
    getPackages(),
    getTours(),
    (async () => {
      // Reuse the DB module so the same schema-tolerant path is used.
      const { getSocialPostDrafts: g } = await import("@/lib/db");
      return g({ limit: 200 });
    })(),
  ]);
  const destinations = getPlannerDestinations().filter(
    (d) => d.id !== "airport"
  );

  // Booking-volume-by-package — package popularity signal. Custom-route
  // tours have no packageId, so we skip them here (they show up in the
  // "recently completed" testimonial section instead).
  const bookingsByPackage = new Map<string, number>();
  for (const t of tours) {
    if (t.status === "cancelled") continue;
    if (!t.packageId) continue;
    bookingsByPackage.set(
      t.packageId,
      (bookingsByPackage.get(t.packageId) ?? 0) + 1
    );
  }
  const popularPackages = packages
    .filter((p) => p.published !== false)
    .map((p) => ({
      id: p.id,
      name: p.name,
      destination: p.destination,
      bookingCount: bookingsByPackage.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, 8);

  // Coverage gap: packages without any draft in the last 30 days.
  const cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentlyDraftedPackageIds = new Set<string>();
  for (const d of drafts) {
    if (
      d.targetKind === "package" &&
      d.targetId &&
      new Date(d.createdAt).getTime() >= cutoffMs
    ) {
      recentlyDraftedPackageIds.add(d.targetId);
    }
  }
  const coverageGaps = popularPackages.filter(
    (p) => !recentlyDraftedPackageIds.has(p.id)
  );

  // Recent completed tours (last 8) — testimonial fodder.
  const recentCompleted = tours
    .filter((t) => t.status === "completed")
    .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
    .slice(0, 8);

  const monthName = new Date().toLocaleString("en-US", { month: "long" });
  const groundingBlock = [
    `Current month: ${monthName}`,
    "",
    `Top packages by booking count:`,
    ...popularPackages.map(
      (p) => `- ${p.name} (${p.destination}, ${p.bookingCount} bookings, id: ${p.id})`
    ),
    "",
    coverageGaps.length > 0
      ? `Packages WITHOUT a recent draft (coverage gaps to fill):\n${coverageGaps
          .slice(0, 5)
          .map((p) => `- ${p.name} (id: ${p.id})`)
          .join("\n")}`
      : "All popular packages have recent drafts.",
    "",
    recentCompleted.length > 0
      ? `Recent completed tours (testimonial candidates):\n${recentCompleted
          .slice(0, 5)
          .map(
            (t) =>
              `- ${t.packageName} for ${t.clientName}, ended ${t.endDate} (tour id: ${t.id})`
          )
          .join("\n")}`
      : "No recently completed tours.",
    "",
    `Destinations on offer: ${destinations
      .slice(0, 12)
      .map((d) => `${d.name} (id: ${d.id})`)
      .join(", ")}`,
  ].join("\n");

  const systemPrompt = [
    "You are the marketing strategist for Paraíso Tours, a Sri Lanka travel company.",
    "Look at the catalog + booking activity + draft coverage and propose 3-5 social-post topics for THIS WEEK.",
    "Prioritize: coverage gaps (popular packages with no recent drafts), seasonal angles (use the current month), and testimonial moments (recent completed tours).",
    "",
    "Return strict JSON:",
    `{ "suggestions": [{ "title": "...", "rationale": "...", "targetKind": "package|destination|tour|generic", "targetId": "...", "brief": "...", "platforms": ["instagram", "facebook"] }] }`,
    "",
    "- `targetKind` must reference real catalog records using the exact IDs in the grounding context. Use 'generic' only for brand/seasonal posts.",
    "- `targetId` is the matching id from the grounding block; omit for generic.",
    "- `platforms` should fit the topic (visual destinations → Instagram + Facebook; B2B angles → LinkedIn; quick news → X).",
    "- Each `rationale` is one sentence explaining WHY this topic right now (e.g. 'No drafts in 6 weeks despite 12 bookings').",
  ].join("\n");

  const userPrompt = `Grounding context:\n\n${groundingBlock}\n\nReturn 3-5 well-reasoned topic suggestions.`;

  let aiResult: { suggestions?: MarketingTopicSuggestion[] };
  try {
    const r = await generateAiJsonResult<{
      suggestions?: MarketingTopicSuggestion[];
    }>({
      feature: "marketing_assistant",
      title: "Marketing topic suggestions",
      systemPrompt,
      userPrompt,
      usePromptCache: true,
    });
    aiResult = r.data;
  } catch (err) {
    return { error: `Couldn't reach the AI: ${extractErrorMessage(err)}` };
  }

  const suggestions: MarketingTopicSuggestion[] = (aiResult.suggestions ?? [])
    .filter(
      (s) =>
        s &&
        typeof s.title === "string" &&
        s.title.trim().length > 0 &&
        typeof s.rationale === "string"
    )
    .slice(0, 5)
    .map((s, idx) => ({
      id: `sugg_${idx}_${Date.now()}`,
      title: s.title.trim(),
      rationale: s.rationale.trim(),
      targetKind: (
        ["package", "destination", "tour", "generic"] as SocialPostTargetKind[]
      ).includes(s.targetKind as SocialPostTargetKind)
        ? (s.targetKind as SocialPostTargetKind)
        : "generic",
      targetId: s.targetId?.toString().trim() || undefined,
      brief: s.brief?.toString().trim() ?? "",
      platforms: Array.isArray(s.platforms)
        ? (s.platforms.filter((p) =>
            PLATFORMS.includes(p as SocialPlatform)
          ) as SocialPlatform[])
        : ["instagram", "facebook"],
    }));

  if (suggestions.length === 0) {
    return {
      error:
        "AI returned no suggestions. Try again, or generate a draft manually using the form below.",
    };
  }

  return { suggestions };
}
