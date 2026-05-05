"use client";

/**
 * /admin/settings → Marketing section.
 *
 * Documents the OAuth credentials required for direct auto-posting
 * to Instagram, Facebook, X, and LinkedIn. v1 of the marketing
 * agent uses copy-paste workflow — these env vars don't enable
 * direct posting yet, but they're documented + status-checked here
 * so admin can prepare the credentials in advance.
 *
 * The settings page itself is server-rendered; this component is a
 * client island that polls /api/marketing/status to render
 * Connected / Not configured chips per platform.
 */

import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  RefreshCw,
  Twitter,
  X,
} from "lucide-react";

type ConnStatus = "idle" | "checking" | "ok" | "off";

function StatusBadge({ status }: { status: ConnStatus }) {
  if (status === "checking")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4ecdd] px-3 py-1 text-xs font-medium text-[#5e7279]">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking…
      </span>
    );
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        <Check className="h-3 w-3" />
        Connected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4ecdd] px-3 py-1 text-xs font-medium text-[#5e7279]">
      <X className="h-3 w-3" />
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

export function MarketingSection() {
  const [statuses, setStatuses] = useState<{
    instagram: ConnStatus;
    facebook: ConnStatus;
    x: ConnStatus;
    linkedin: ConnStatus;
  }>({
    instagram: "checking",
    facebook: "checking",
    x: "checking",
    linkedin: "checking",
  });

  const refresh = () => {
    setStatuses({
      instagram: "checking",
      facebook: "checking",
      x: "checking",
      linkedin: "checking",
    });
    fetch("/api/marketing/status")
      .then((r) => r.json())
      .then(
        (d: {
          instagram: boolean;
          facebook: boolean;
          x: boolean;
          linkedin: boolean;
        }) => {
          setStatuses({
            instagram: d.instagram ? "ok" : "off",
            facebook: d.facebook ? "ok" : "off",
            x: d.x ? "ok" : "off",
            linkedin: d.linkedin ? "ok" : "off",
          });
        }
      )
      .catch(() =>
        setStatuses({
          instagram: "off",
          facebook: "off",
          x: "off",
          linkedin: "off",
        })
      );
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/marketing/status")
      .then((r) => r.json())
      .then(
        (d: {
          instagram: boolean;
          facebook: boolean;
          x: boolean;
          linkedin: boolean;
        }) => {
          if (!alive) return;
          setStatuses({
            instagram: d.instagram ? "ok" : "off",
            facebook: d.facebook ? "ok" : "off",
            x: d.x ? "ok" : "off",
            linkedin: d.linkedin ? "ok" : "off",
          });
        }
      )
      .catch(() => {
        if (alive)
          setStatuses({
            instagram: "off",
            facebook: "off",
            x: "off",
            linkedin: "off",
          });
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* Note about v1 scope */}
      <div className="rounded-2xl border border-[#5e3aa3]/20 bg-[#5e3aa3]/5 px-5 py-4 text-sm text-[#5e7279]">
        <p className="font-semibold text-[#5e3aa3]">v1: copy-paste workflow</p>
        <p className="mt-1 leading-relaxed">
          The marketing agent currently generates drafts at{" "}
          <a
            href="/admin/marketing"
            className="font-medium text-[#5e3aa3] underline hover:text-[#4a2e83]"
          >
            /admin/marketing
          </a>{" "}
          that you copy-paste into each platform's app. The OAuth
          credentials below are <em>not required</em> to use the agent.
          They're documented here so you can prepare them ahead of a
          future auto-posting capability.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#e0e4dd] bg-[#fffbf4] px-2.5 py-1.5 text-xs font-medium text-[#5e7279] hover:bg-[#f4ecdd]"
        >
          <RefreshCw className="h-3 w-3" />
          Re-check connection status
        </button>
      </div>

      {/* Meta (Instagram + Facebook) */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e0e4dd] px-6 py-4">
          <Instagram className="h-5 w-5 text-pink-500" />
          <Facebook className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <p className="font-semibold text-[#11272b]">
              Meta — Instagram + Facebook
            </p>
            <p className="text-xs text-[#5e7279]">
              One set of credentials covers both Instagram Business +
              Facebook Page posting via the Meta Graph API.
            </p>
          </div>
          <StatusBadge status={statuses.instagram} />
        </div>
        <div className="space-y-3 p-6">
          <p className="text-sm text-[#5e7279]">
            Required env vars (set in Vercel → Settings → Environment
            Variables):
          </p>
          <div className="space-y-2">
            <EnvRow
              variable="META_APP_ID"
              description="App ID from your Meta Business app (developers.facebook.com → My Apps)."
            />
            <EnvRow
              variable="META_APP_SECRET"
              description="App secret from the same Meta Business app — Settings → Basic."
            />
            <EnvRow
              variable="META_PAGE_ACCESS_TOKEN"
              description="Long-lived Page Access Token for the Facebook Page that owns your Instagram Business account. Generated via Graph API Explorer or your app's OAuth flow."
            />
            <EnvRow
              variable="INSTAGRAM_BUSINESS_ACCOUNT_ID"
              description="Numeric ID of your Instagram Business / Creator account (linked to the Facebook Page). Find it via /me/accounts in Graph API Explorer."
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Open Meta for Developers <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://developers.facebook.com/docs/instagram-api/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#5e7279] hover:bg-[#f4ecdd]"
            >
              Instagram API setup guide{" "}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* X (Twitter) */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#e0e4dd] px-6 py-4">
          <Twitter className="h-5 w-5 text-sky-500" />
          <div className="flex-1">
            <p className="font-semibold text-[#11272b]">X (Twitter)</p>
            <p className="text-xs text-[#5e7279]">
              X API v2. Either OAuth 1.0a (4 keys) or OAuth 2.0 bearer
              token works for posting on behalf of the brand account.
            </p>
          </div>
          <StatusBadge status={statuses.x} />
        </div>
        <div className="space-y-3 p-6">
          <p className="text-sm font-semibold text-[#11272b]">
            Option A — OAuth 1.0a (recommended for posting)
          </p>
          <div className="space-y-2">
            <EnvRow
              variable="TWITTER_API_KEY"
              description="API Key from your X developer app (developer.twitter.com → Project → Keys & Tokens)."
            />
            <EnvRow
              variable="TWITTER_API_SECRET"
              description="API Secret pair for the API Key above."
            />
            <EnvRow
              variable="TWITTER_ACCESS_TOKEN"
              description="Access Token for the brand account that will post. Generated under Keys & Tokens → Authentication Tokens."
            />
            <EnvRow
              variable="TWITTER_ACCESS_SECRET"
              description="Access Token Secret pair for the Access Token above."
            />
          </div>
          <p className="pt-3 text-sm font-semibold text-[#11272b]">
            Option B — OAuth 2.0 bearer (read + limited write)
          </p>
          <div className="space-y-2">
            <EnvRow
              variable="TWITTER_BEARER_TOKEN"
              description="App-only bearer token. Sufficient for read endpoints; full posting may still require OAuth 1.0a depending on the X API plan."
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="https://developer.twitter.com/en/portal/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Open X Developer Portal{" "}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* LinkedIn */}
      <div className="overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#fffbf4] shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#e0e4dd] px-6 py-4">
          <Linkedin className="h-5 w-5 text-sky-700" />
          <div className="flex-1">
            <p className="font-semibold text-[#11272b]">LinkedIn</p>
            <p className="text-xs text-[#5e7279]">
              LinkedIn Marketing API for posting on the brand company page.
              Requires a LinkedIn Developer App + the "w_organization_social"
              scope and a verified company page.
            </p>
          </div>
          <StatusBadge status={statuses.linkedin} />
        </div>
        <div className="space-y-3 p-6">
          <p className="text-sm text-[#5e7279]">Required env vars:</p>
          <div className="space-y-2">
            <EnvRow
              variable="LINKEDIN_CLIENT_ID"
              description="Client ID from your LinkedIn Developer App (linkedin.com/developers → Apps → Auth)."
            />
            <EnvRow
              variable="LINKEDIN_CLIENT_SECRET"
              description="Primary client secret pair for the Client ID."
            />
            <EnvRow
              variable="LINKEDIN_ACCESS_TOKEN"
              description="3-legged OAuth access token granted by the company-page admin. Required scopes: w_organization_social, r_organization_social. Re-issue every 60 days unless using refresh-token flow."
            />
            <EnvRow
              variable="LINKEDIN_ORGANIZATION_URN"
              description='URN of the LinkedIn Company Page that will post. Format: "urn:li:organization:12345" — find via /me/organizationalEntityAcls.'
            />
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="https://www.linkedin.com/developers/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#12343b] px-4 py-2 text-sm font-medium text-[#f6ead6] transition hover:bg-[#1a474f]"
            >
              Open LinkedIn Developers{" "}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/share-api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#e0e4dd] bg-[#fffbf4] px-4 py-2 text-sm font-medium text-[#5e7279] hover:bg-[#f4ecdd]"
            >
              LinkedIn Share API docs{" "}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
