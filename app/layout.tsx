import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { GoogleAnalytics } from "@next/third-parties/google";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";

import { AppNav } from "@/components/AppNav";
import { EditorialContact } from "@/components/EditorialContact";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OG_IMAGE, RSS_PATH, SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/site";
import "./globals.css";

// Runs before first paint so the stored/system theme is applied without a flash.
// Kept in sync with ThemeToggle (data-theme + color-scheme + theme-color meta).
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#211f1b':'#fdfbf7');}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  alternates: {
    types: { "application/rss+xml": RSS_PATH }
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    images: [OG_IMAGE]
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdfbf7"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inlined at build time; GA only loads when a measurement ID is provided.
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <a
          className="focus-ring motion-soft fixed left-4 top-3 z-[60] -translate-y-20 rounded-control bg-ink px-4 py-3 text-sm font-black text-canvas focus:translate-y-0"
          href="#main-content"
        >
          본문으로 건너뛰기
        </a>
        <div className="flex min-h-screen flex-col bg-canvas text-ink">
          <header className="border-b border-rule bg-canvas">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
              {/* Balances the toggle so the logo stays centered on mobile; removed on desktop. */}
              <div aria-hidden="true" className="w-8 shrink-0 lg:hidden" />
              <Link
                aria-label="Korea Football Radar 홈"
                className="focus-ring inline-flex shrink-0 items-center"
                href="/"
              >
                <Image
                  alt="Korea Football Radar"
                  className="h-auto w-[190px] max-w-[calc(100vw-2rem)] sm:w-[220px] lg:w-[250px] dark:invert dark:hue-rotate-180"
                  height={500}
                  priority
                  src="/brand/korea-football-radar-logo-header-transparent.png"
                  width={1830}
                />
              </Link>
              <div className="flex flex-col items-end gap-2">
                <ThemeToggle />
                <p className="hidden max-w-md text-right text-xs font-semibold leading-5 text-ink-soft lg:block">
                  한국축구 이슈의 뉴스와 영상을 한곳에 모은 정보 레이더
                </p>
              </div>
            </div>

            <AppNav />
          </header>
          <main className="flex-1" id="main-content">
            {children}
          </main>
          <EditorialContact />
        </div>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
