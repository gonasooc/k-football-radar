export const SITE_NAME = "Korea Football Radar";
export const SITE_DESCRIPTION =
  "한국축구 이슈 뉴스·공식자료와 유튜브 영상을 모아 보는 정보 레이더";

// The public origin, without a trailing slash. Set NEXT_PUBLIC_SITE_URL at build
// time in production; falls back to localhost so local dev and tests still work.
export function getSiteUrl(): string {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicitSiteUrl) {
    return explicitSiteUrl.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

// Resolves a root-relative path to an absolute URL for sitemap entries and
// structured data, where relative URLs are not allowed.
export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") {
    return `${base}/`;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const OG_IMAGE = {
  url: "/brand/korea-football-radar-og-wide.png",
  width: 1200,
  height: 630,
  alt: SITE_NAME
} as const;

export const RSS_PATH = "/rss.xml";

// Per-page `alternates`: a canonical URL plus RSS auto-discovery. Metadata
// merging replaces the whole `alternates` object per segment, so pages that set
// a canonical must re-declare the feed link here to keep it on the page.
export function pageAlternates(canonical: string) {
  return {
    canonical,
    types: { "application/rss+xml": RSS_PATH }
  };
}
