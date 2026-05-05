/**
 * Per-platform publisher functions. Each takes a SocialPostDraft +
 * a decrypted SocialOAuthToken and POSTs the content to the
 * platform's API. Returns either an `ok: true` result with the
 * platform's post id (so admin can click through to verify) or
 * `ok: false` with a readable error message.
 *
 * Platform notes:
 *
 *   Facebook (Meta) — POST /{page-id}/feed with `message`.
 *     Page access token (long-lived) used as the bearer.
 *
 *   Instagram (Meta) — Two-step container flow:
 *       1. POST /{ig-user-id}/media     → returns container id
 *       2. POST /{ig-user-id}/media_publish with creation_id
 *     IG REQUIRES a public image URL (no text-only posts). The
 *     publisher returns ok:false with a clear error if the draft
 *     doesn't have one.
 *
 *   X (Twitter) — POST /2/tweets with JSON body. Bearer token.
 *     280-char text limit enforced server-side; we let X reject
 *     longer copy rather than truncating silently.
 *
 *   LinkedIn — POST /v2/ugcPosts with the org or person URN as
 *     the author. Text-only posts work without an image.
 *
 * Errors are wrapped in extractErrorMessage so plain-object
 * platform errors render readable text in the audit log.
 */

import { extractErrorMessage } from "./db";
import type {
  SocialOAuthToken,
  SocialPostDraft,
} from "./types";

export interface PublishResult {
  ok: boolean;
  /** Platform post id (when ok). */
  postId?: string;
  /** Platform-side URL to verify the live post. */
  postUrl?: string;
  /** Human-readable error explanation when !ok. */
  error?: string;
}

interface PublishContext {
  draft: SocialPostDraft;
  token: SocialOAuthToken;
  /** Optional public image URL — required for Instagram, optional
   *  elsewhere. Drafts have an `imageDirection` text field but no
   *  hosted image URL — the publisher signature accepts one so the
   *  caller can plumb in a hosted URL when they have one. */
  imageUrl?: string;
}

function combinedCopy(draft: SocialPostDraft): string {
  const tags =
    draft.tags.length > 0
      ? "\n\n" + draft.tags.map((t) => `#${t}`).join(" ")
      : "";
  return draft.copy + tags;
}

// ── Facebook ──────────────────────────────────────────────────────

async function publishFacebook(ctx: PublishContext): Promise<PublishResult> {
  const pageId = ctx.token.metadata.page_id;
  if (!pageId) {
    return {
      ok: false,
      error:
        "Meta connection has no Facebook Page id — reconnect with a page selected.",
    };
  }
  const message = combinedCopy(ctx.draft);
  const body = new URLSearchParams({
    message,
    access_token: ctx.token.accessToken,
  });
  // If a public image URL is supplied, post it as a photo with
  // caption (renders as an image post instead of a text post).
  const endpoint = ctx.imageUrl
    ? `https://graph.facebook.com/v21.0/${pageId}/photos`
    : `https://graph.facebook.com/v21.0/${pageId}/feed`;
  if (ctx.imageUrl) {
    body.set("url", ctx.imageUrl);
    // Caption uses `message` for /photos too — already set above.
  }
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await r.json()) as {
      id?: string;
      post_id?: string;
      error?: { message?: string };
    };
    if (data.error) {
      return { ok: false, error: `Facebook: ${data.error.message ?? "unknown"}` };
    }
    const postId = data.post_id ?? data.id ?? "";
    if (!postId) {
      return { ok: false, error: "Facebook: no post id returned." };
    }
    return {
      ok: true,
      postId,
      postUrl: `https://www.facebook.com/${postId}`,
    };
  } catch (err) {
    return { ok: false, error: `Facebook: ${extractErrorMessage(err)}` };
  }
}

// ── Instagram ─────────────────────────────────────────────────────

async function publishInstagram(
  ctx: PublishContext
): Promise<PublishResult> {
  const igUserId = ctx.token.metadata.instagram_business_account_id;
  if (!igUserId) {
    return {
      ok: false,
      error:
        "Meta connection has no Instagram Business account id — link a Facebook Page to an Instagram Business profile and reconnect.",
    };
  }
  if (!ctx.imageUrl) {
    return {
      ok: false,
      error:
        "Instagram requires a public image URL — Instagram doesn't allow text-only posts. Host the image (Cloudinary / S3 / your CDN) and pass the public URL to publish.",
    };
  }
  const caption = combinedCopy(ctx.draft);

  try {
    // Step 1: create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: ctx.imageUrl,
          caption,
          access_token: ctx.token.accessToken,
        }).toString(),
      }
    );
    const createData = (await createRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (createData.error || !createData.id) {
      return {
        ok: false,
        error: `Instagram (container): ${createData.error?.message ?? "no container id"}`,
      };
    }
    const containerId = createData.id;

    // Step 2: publish container
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: ctx.token.accessToken,
        }).toString(),
      }
    );
    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (publishData.error || !publishData.id) {
      return {
        ok: false,
        error: `Instagram (publish): ${publishData.error?.message ?? "no media id"}`,
      };
    }
    const username = ctx.token.metadata.instagram_username;
    return {
      ok: true,
      postId: publishData.id,
      postUrl: username
        ? `https://www.instagram.com/${username}/`
        : undefined,
    };
  } catch (err) {
    return { ok: false, error: `Instagram: ${extractErrorMessage(err)}` };
  }
}

// ── X (Twitter) ───────────────────────────────────────────────────

async function publishX(ctx: PublishContext): Promise<PublishResult> {
  const text = combinedCopy(ctx.draft);
  if (text.length > 280) {
    return {
      ok: false,
      error: `X: copy is ${text.length} chars including hashtags — max is 280. Edit the draft before publishing.`,
    };
  }
  try {
    const r = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    const data = (await r.json()) as {
      data?: { id: string };
      errors?: Array<{ detail?: string; title?: string }>;
      title?: string;
      detail?: string;
    };
    if (!r.ok || !data.data) {
      const errText =
        data.errors?.[0]?.detail ??
        data.detail ??
        data.title ??
        `${r.status}`;
      return { ok: false, error: `X: ${errText}` };
    }
    const username = ctx.token.metadata.username;
    return {
      ok: true,
      postId: data.data.id,
      postUrl: username
        ? `https://x.com/${username}/status/${data.data.id}`
        : undefined,
    };
  } catch (err) {
    return { ok: false, error: `X: ${extractErrorMessage(err)}` };
  }
}

// ── LinkedIn ──────────────────────────────────────────────────────

async function publishLinkedIn(
  ctx: PublishContext
): Promise<PublishResult> {
  // Prefer the company-page URN if available; fall back to the
  // person URN. (Text-only person posts work; org posts require
  // w_organization_social on the granted token.)
  const author =
    ctx.token.metadata.organization_urn ||
    ctx.token.metadata.person_urn;
  if (!author) {
    return {
      ok: false,
      error:
        "LinkedIn connection has no person/org URN — reconnect with the appropriate scopes.",
    };
  }
  const text = combinedCopy(ctx.draft);

  try {
    const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.token.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return {
        ok: false,
        error: `LinkedIn (${r.status}): ${errText.slice(0, 300)}`,
      };
    }
    const data = (await r.json()) as { id?: string };
    if (!data.id) {
      return { ok: false, error: "LinkedIn: no post id returned." };
    }
    return {
      ok: true,
      postId: data.id,
      // LinkedIn doesn't give a clean public URL from the ugc
      // post id — admin verifies on their feed.
    };
  } catch (err) {
    return { ok: false, error: `LinkedIn: ${extractErrorMessage(err)}` };
  }
}

// ── Dispatch ──────────────────────────────────────────────────────

/**
 * Map a draft's `platform` (instagram | facebook | x | linkedin) to
 * the right publisher. Returns the result.
 */
export async function publishToSocialPlatform(
  ctx: PublishContext
): Promise<PublishResult> {
  switch (ctx.draft.platform) {
    case "facebook":
      return publishFacebook(ctx);
    case "instagram":
      return publishInstagram(ctx);
    case "x":
      return publishX(ctx);
    case "linkedin":
      return publishLinkedIn(ctx);
    default:
      return {
        ok: false,
        error: `Unsupported platform: ${ctx.draft.platform}`,
      };
  }
}

/**
 * Maps a SocialPostDraft platform to the SocialConnectedPlatform key
 * the token store uses. Both Instagram and Facebook share the
 * single Meta connection.
 */
export function tokenPlatformFor(draftPlatform: string): "meta" | "x" | "linkedin" | null {
  if (draftPlatform === "facebook" || draftPlatform === "instagram") return "meta";
  if (draftPlatform === "x") return "x";
  if (draftPlatform === "linkedin") return "linkedin";
  return null;
}
