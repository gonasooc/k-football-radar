import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";

import { AppNav } from "@/components/AppNav";
import "./globals.css";

const siteName = "Korea Football Radar";
const siteDescription = "한국축구 이슈 뉴스와 공식자료 메타데이터를 모아 보는 정보 레이더";
const openGraphImage = {
  url: "/brand/korea-football-radar-og.png",
  width: 800,
  height: 800,
  alt: siteName
};

function getSiteUrl() {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicitSiteUrl) {
    return explicitSiteUrl;
  }

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionUrl) {
    return `https://${productionUrl}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: siteName,
  description: siteDescription,
  openGraph: {
    title: siteName,
    description: siteDescription,
    type: "website",
    locale: "ko_KR",
    siteName,
    images: [openGraphImage]
  },
  twitter: {
    card: "summary",
    title: siteName,
    description: siteDescription,
    images: [openGraphImage]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-canvas text-ink">
          <header className="border-b border-rule bg-canvas">
            <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <Link
                aria-label="Korea Football Radar 홈"
                className="focus-ring inline-flex shrink-0 items-center"
                href="/"
              >
                <Image
                  alt="Korea Football Radar"
                  className="h-auto w-[200px] sm:w-[240px] lg:w-[280px]"
                  height={500}
                  priority
                  src="/brand/korea-football-radar-logo-header-transparent.png"
                  width={1830}
                />
              </Link>
              <p className="hidden max-w-md text-right text-xs font-bold leading-5 text-ink-soft sm:block">
                한국축구 이슈와 공식자료를 한곳에 모은 뉴스 레이더
              </p>
            </div>

            <AppNav />
          </header>
          <main className="pb-20">{children}</main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
