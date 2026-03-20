import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

// Only wrap with Sentry when DSN is configured — zero impact when env var is absent
const hasSentry =
  Boolean(process.env.SENTRY_DSN) ||
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default hasSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      telemetry: false,
    })
  : nextConfig;
