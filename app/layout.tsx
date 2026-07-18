import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";

import { AppNav } from "@/components/AppNav";
import { EditorialContact } from "@/components/EditorialContact";
import "./globals.css";

const siteName = "Korea Football Radar";
const siteDescription = "한국축구 이슈 뉴스·공식자료와 유튜브 영상을 모아 보는 정보 레이더";
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

  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`
  },
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <a
          className="focus-ring motion-soft fixed left-4 top-3 z-[60] -translate-y-20 rounded-control bg-ink px-4 py-3 text-sm font-black text-canvas focus:translate-y-0"
          href="#main-content"
        >
          본문으로 건너뛰기
        </a>
        <div className="flex min-h-screen flex-col bg-canvas text-ink">
          <header className="border-b border-rule bg-canvas">
            <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
              <Link
                aria-label="Korea Football Radar 홈"
                className="focus-ring mx-auto inline-flex shrink-0 items-center lg:mx-0"
                href="/"
              >
                <Image
                  alt="Korea Football Radar"
                  className="h-auto w-[190px] max-w-[calc(100vw-2rem)] sm:w-[220px] lg:w-[250px]"
                  height={500}
                  priority
                  src="/brand/korea-football-radar-logo-header-transparent.png"
                  width={1830}
                />
              </Link>
              <p className="hidden max-w-md text-right text-xs font-semibold leading-5 text-ink-soft lg:block">
                한국축구 이슈의 뉴스와 영상을 한곳에 모은 정보 레이더
              </p>
            </div>

            <AppNav />
          </header>
          <main className="flex-1" id="main-content">
            {children}
          </main>
          <EditorialContact />
        </div>
      </body>
    </html>
  );
}
