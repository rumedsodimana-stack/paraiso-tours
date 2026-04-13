import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { defaultThemeId } from "@/components/theme/theme-config";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getAppSettings, getDisplayCompanyName } from "@/lib/app-config";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  const brandName = getDisplayCompanyName(settings);

  const description =
    settings.company.tagline ||
    `Curated Sri Lanka tours — coast, culture, and tea country`;

  return {
    title: `${brandName} | Travel Operations`,
    description,
    icons: settings.company.logoUrl
      ? {
          icon: [{ url: settings.company.logoUrl }],
          apple: [{ url: settings.company.logoUrl }],
        }
      : undefined,
    openGraph: {
      title: brandName,
      description: "Curated Sri Lanka tours — coast, culture, and tea country",
      type: "website",
      locale: "en_US",
      siteName: brandName,
    },
    twitter: {
      card: "summary_large_image",
      title: brandName,
      description: "Curated Sri Lanka tours — coast, culture, and tea country",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme={defaultThemeId} suppressHydrationWarning>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <ThemeScript />
        <ThemeProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
