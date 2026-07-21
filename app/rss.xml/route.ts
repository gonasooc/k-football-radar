import { getDataBundle } from "@/lib/data";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, getSiteUrl } from "@/lib/site";

// Route handlers reading remote data must stay dynamic so the feed is built per
// request rather than prerendered at build time (mirrors the app/api routes).
export const dynamic = "force-dynamic";

const MAX_ITEMS = 50;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function categoryLabel(item: { sourceType: string; isOfficial: boolean }): string {
  if (item.sourceType === "youtube") {
    return "유튜브";
  }
  return item.isOfficial ? "공식자료" : "뉴스";
}

export async function GET(): Promise<Response> {
  const data = await getDataBundle();
  const siteUrl = getSiteUrl();

  const items = [...data.items]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, MAX_ITEMS);

  const lastBuildDate = new Date(
    items[0]?.publishedAt ?? data.collectionState.lastCollectedAt
  ).toUTCString();

  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      <dc:creator>${escapeXml(item.publisher)}</dc:creator>
      <category>${escapeXml(categoryLabel(item))}</category>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
      <description>${escapeXml(item.summary)}</description>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${siteUrl}/</link>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
    }
  });
}
