"use client";

/**
 * /admin/settings → Marketing section.
 *
 * Two states per platform:
 *   1. Not configured (env vars missing) → grey "Not configured"
 *      pill + the env-var documentation row group, no Connect button
 *   2. Configured but not connected → blue "Ready to connect" pill
 *      + a Connect button that initiates OAuth 2.0 redirect
 *   3. Connected → green "Connected" pill + a Disconnect button
 *
 * The OAuth start endpoints (/api/oauth/{meta,x,linkedin}/start)
 * verify admin session, sign a state token, and redirect to the
 * platform's consent screen. The callback exchanges the code,
 * fetches per-platform metadata (page id, IG biz account, org URN),
 * encrypts + stores the tokens, then bounces back here with
 * ?connected=<platform> or ?marketing_error=<reason>.
 */

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  Twitter,
  Unlink,
  X as XIcon,
} from "lucide-react";
import { disconnectSocialPlatformAction } from "@/app/actions/marketing";

type ConnState = "checking" | "off" | "ready" | "connected";

interface DetailRow {
  envConfigured: boolean;
  connected: boolean;
}

interface StatusResponse {
  detail?: {
    meta?: DetailRow;
    x?: DetailRow;
    linkedin?: DetailRow;
  };
}

function StatusBadge({ state }: { state: ConnState }) {
  if (state === "checking")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4ecdd] px-3 py-1 text-xs font-medium text-[#5e7279]">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking…
      </span>
    );
  if (state === "connected")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        <Check className="h-3 w-3" />
        Connected
      </span>
    );
  if (state === "ready")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
        Ready to connect
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4ecdd] px-3 py-1 text-xs font-medium text-[#5e7279]">
      <XIcon className="h-3 w-3" />
      Not configured
    </span>
  );
}

function EnvRow({
  variable,
  description,
}: {
  variable: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e0e4dd] bg-[#f4ecdd] px-4 py-3">
      <code className="mt-0.5 shrink-0 rounded bg-[#e0e4dd] px-1.5 py-0.5 font-mono text-[11px] text-[#11272b]">
        {variable}
      </code>
      <p className="text-xs leading-relaxed text-[#5e7279]">{description}</p>
    </div>
  );
}

/**
 * Tiny banner that surfaces ?connected= or ?marketing_error= URL
 * params after an OAuth roundtrip. Auto-clears its own query params
 * on dismiss so admin can re-attempt without a stale notice.
 */
function CallbackBanner() {
  const params = useSearchParams();
  const connected = params.get("connected");
  const error = params.get("marketing_error");
  const warning = params.get("warning");
  if (!connected && !error) return null;
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          OAuth connection failed
        </p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
      <p className="flex items-center gap-2 font-semibold">
        <Check className="h-4 w-4" />
        {connected === "meta"
          ? "Meta connected"
          : connected === "x"
            ? "X connected"
            : connected === "linkedin"
              ? "LinkedIn connected"
              : `${connected} connected`}
      </p>
      {warning && (
        <p className="mt-1 text-amber-700">Warning: {warning}</p>
      )}
    </div>
  );
}

export function MarketingSection() {
  const [meta, setMeta] = useState<ConnState>("checking");
  const [x, setX] = useState<ConnState>("checking");
  const [linkedin, setLinkedin] = useState<ConnState>("checking");
  const [pending, startTransition] = useTransition();
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const refresh = () => {
    setMeta("checking");
    setX("checking");
    setLinkedin("checking");
    fetch("/api/marketing/status")
      .then((r) => r.json())
      .then((d: StatusResponse) => {
        setMeta(deriveState(d.detail?.meta));
        setX(deriveState(d.detail?.x));
        setLinkedin(deriveState(d.detail?.linkedin));
      })
      .catch(() => {
        setMeta("off");
        setX("off");
        setLinkedin("off");
      });
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/marketing/status")
      .then((r) => r.json())
      .then((d: StatusResponse) => {
        if (!alive) return;
        setMeta(deriveState(d.detail?.meta));
        setX(deriveState(d.detail?.x));
        setLinkedin(deriveState(d.detail?.linkedin));
      })
      .catch(() => {
        if (alive) {
          setMeta("off");
          setX("off");
          setLinkedin("off");
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const disconnect = (platform: "meta" | "x" | "linkedin") => {
    if (
      !confirm(
        `Disconnect ${platform === "meta" ? "Meta (Facebook + Instagram)" : platform === "x" ? "X" : "LinkedIn"}? You'll need to re-authorise to publish drafts again.`
      )
    )
      return;
    setActionMsg(null);
    startTransition(async () => {
      try {
        const r = await disconnectSocialPlatformAction(platform);
        if (r.error) {
          setActionMsg(r.error);
        } else {
          refresh();
        }
      } catch (err) {
        setActionMsg(
          err instanceof Error ? err.message : "Network error"
        );
      }
    });
  };

  return (
    <div className="space-y-5">
      <CallbackBanner />

      <div className="rounded-2xl border border-[#5e3aa3]/20 bg-[#5e3aa3]/5 px-5 py-4 text-sm text-[#5e7279]">
        <p className="font-semibold text-[#5e3aa3]">Direct posting via OAuth 2.0</p>
        <p className="mt-1 leading-relaxed">
          Connect each platform to enable direct publishing from{" "}
          <a
            href="/admin/marketing"
            className="font-medium text-[#5e3aa3] underline hover:text-[#4a2e83]"
          >
            /admin/marketing
          </a>
          . Tokens are AES-256-GCM encrypted at rest before they hit the
          DB. Drafts can still be copy-pasted manually if a connection
          isn't available.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1.5 text-xs font-medium text-[#5e7279] hover:bg-[#f4ecdd]"
        >
          <RefreshCw className="h-3 w-3" />
          Re-check connection status
        </button>
        {actionMsg && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {actionMsg}
          </p>
        )}
      </div>

      {/* Meta */}
      <PlatformCard
        title="Meta — Instagram + Facebook"
        description="One OAuth flow covers both. Posting requires the Meta Business app + page admin role + Instagram Business linkage on the same page."
        icons={[
          <Instagram key="ig" className="h-5 w-5 text-pink-500" />,
          <Facebook key="fb" className="h-5 w-5 text-blue-600" />,
        ]}
        state={meta}
        platform="meta"
        connectHref="/api/oauth/meta/start"
        onDisconnect={() => disconnect("meta")}
        pending={pending}
        envVars={[
          { name: "META_APP_ID", desc: "App ID from Meta for Developers → My Apps." },
          { name: "META_APP_SECRET", desc: "App Secret — Settings → Basic." },
        ]}
        platformLink={{
          href: "https://developers.facebook.com/apps",
          label: "Open Meta for Developers",
        }}
      />

      {/* X */}
      <PlatformCard
        title="X (Twitter)"
        description="OAuth 2.0 with PKCE. Requires an X developer app with read + write user permissions and a redirect URL pointing at /api/oauth/x/callback."
        icons={[<Twitter key="x" className="h-5 w-5 text-sky-500" />]}
        state={x}
        platform="x"
        connectHref="/api/oauth/x/start"
        onDisconnect={() => disconnect("x")}
        pending={pending}
        envVars={[
          { name: "TWITTER_OAUTH2_CLIENT_ID", desc: "OAuth 2.0 Client ID — developer.twitter.com → Project → Keys & Tokens." },
          { name: "TWITTER_OAUTH2_CLIENT_SECRET", desc: "OAuth 2.0 Client Secret pair." },
        ]}
        platformLink={{
          href: "https://developer.twitter.com/en/portal/dashboard",
          label: "Open X Developer Portal",
        }}
      />

      {/* LinkedIn */}
      <PlatformCard
        title="LinkedIn"
        description="OAuth 2.0 with org-page posting. Admin must be a verified Page Admin on the LinkedIn Page they want to post to. Token re-issues every 60 days unless using the refresh-token flow."
        icons={[<Linkedin key="li" className="h-5 w-5 text-sky-700" />]}
        state={linkedin}
        platform="linkedin"
        connectHref="/api/oauth/linkedin/start"
        onDisconnect={() => disconnect("linkedin")}
        pending={pending}
        envVars={[
          { name: "LINKEDIN_CLIENT_ID", desc: "Client ID — linkedin.com/developers → Apps → Auth." },
          { name: "LINKEDIN_CLIENT_SECRET", desc: "Primary client secret pair." },
        ]}
        platformLink={{
          href: "https://www.linkedin.com/developers/apps",
          label: "Open LinkedIn Developers",
        }}
      />

      <div className="rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] p-5 text-sm text-[#5e7279]">
        <p className="font-semibold text-[#11272b]">
          What you still need to do platform-side
        </p>
        <ul className="mt-2 space-y-1.5 list-disc pl-5">
          <li>
            <strong>Meta App Review</strong> — apps not in Live mode can
            only post for the developer + test users. Submit for
            <code className="mx-1 rounded bg-[#f4ecdd] px-1 text-[11px]">
              pages_manage_posts
            </code>{" "}
            and
            <code className="mx-1 rounded bg-[#f4ecdd] px-1 text-[11px]">
              instagram_content_publish
            </code>{" "}
            scopes before posting from a public-facing user account.
          </li>
          <li>
            <strong>Instagram requires hosted images</strong> — Instagram's
            API doesn't accept text-only posts. Drafts targeting IG must
            have a public image URL (Cloudinary, S3, your CDN). v1 prompts
            for the URL at publish time; image upload UI is a future
            improvement.
          </li>
          <li>
            <strong>X plan tier</strong> — posting via OAuth 2.0 requires
            at least the Basic plan ($100/mo) under the new X API
            pricing.
          </li>
          <li>
            <strong>LinkedIn token refresh</strong> — access tokens last
            60 days. Re-connect from this page when the refresh fails;
            future improvement is automatic refresh-token rotation.
          </li>
        </ul>
      </div>
    </div>
  );
}

function deriveState(detail?: DetailRow): ConnState {
  if (!detail) return "off";
  if (detail.connected) return "connected";
  if (detail.envConfigured) return "ready";
  return "off";
}

function PlatformCard({
  title,
  description,
  icons,
  state,
  platform,
  connectHref,
  onDisconnect,
  pending,
  envVars,
  platformLink,
}: {
  title: string;
  description: string;
  icons: React.ReactNode[];
  state: ConnState;
  platform: "meta" | "x" | "linkedin";
  connectHref: string;
  onDisconnect: () => void;
  pending: boolean;
  envVars: Array<{ name: string; desc: string }>;
  platformLink: { href: string; label: string };
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e0e4dd] px-6 py-4">
        <div className="flex gap-1">{icons}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#11272b]">{title}</p>
          <p className="text-xs text-[#5e7279]">{description}</p>
        </div>
        <StatusBadge state={state} />
      </div>
      <div className="space-y-3 p-6">
        <div className="flex flex-wrap gap-2">
          {state === "connected" ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unlink className="h-3.5 w-3.5" />
              )}
              Disconnect
            </button>
          ) : state === "ready" ? (
            <a
              href={connectHref}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5e3aa3] px-5 py-2 text-sm font-bold text-[#f6ead6] transition hover:bg-[#4a2e83]"
            >
              Connect {title.split(" ")[0]}
            </a>
          ) : (
            <p className="text-xs text-[#5e7279]">
              Set the env vars below in Vercel before connecting.
            </p>
          )}
          <a
            href={platformLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#5e7279] hover:bg-[#f4ecdd]"
          >
            {platformLink.label} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <p className="text-xs uppercase tracking-wider text-[#8a9ba1]">
          Env vars (Vercel → Settings → Environment Variables)
        </p>
        <div className="space-y-2">
          {envVars.map((env) => (
            <EnvRow key={env.name} variable={env.name} description={env.desc} />
          ))}
        </div>
        {platform === "meta" && (
          <p className="rounded-lg bg-[#f4ecdd] px-3 py-2 text-xs text-[#5e7279]">
            Add{" "}
            <code className="rounded bg-[#e0e4dd] px-1 font-mono">
              {`${typeof window !== "undefined" ? window.location.origin : "https://YOUR_DOMAIN"}/api/oauth/meta/callback`}
            </code>{" "}
            to your Meta app's Valid OAuth Redirect URIs.
          </p>
        )}
        {platform === "x" && (
          <p className="rounded-lg bg-[#f4ecdd] px-3 py-2 text-xs text-[#5e7279]">
            Add{" "}
            <code className="rounded bg-[#e0e4dd] px-1 font-mono">
              {`${typeof window !== "undefined" ? window.location.origin : "https://YOUR_DOMAIN"}/api/oauth/x/callback`}
            </code>{" "}
            to your X app's Callback URI / Redirect URL list.
          </p>
        )}
        {platform === "linkedin" && (
          <p className="rounded-lg bg-[#f4ecdd] px-3 py-2 text-xs text-[#5e7279]">
            Add{" "}
            <code className="rounded bg-[#e0e4dd] px-1 font-mono">
              {`${typeof window !== "undefined" ? window.location.origin : "https://YOUR_DOMAIN"}/api/oauth/linkedin/callback`}
            </code>{" "}
            to your LinkedIn app's Authorized redirect URLs.
          </p>
        )}
      </div>
    </div>
  );
}
