import type { MetadataRoute } from "next";

import { getDataBundle } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

// Data is loaded from a remote source at request time in production, so the
// sitemap must be generated per-request rather than at build time.
export const dynamic = "force-dynamic";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

function trackLatest(map: Map<string, string>, ids: string[], when: string): void {
  for (const id of ids) {
    const previous = map.get(id);
    if (!previous || Date.parse(when) > Date.parse(previous)) {
      map.set(id, when);
    }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getDataBundle();
  const fallback = data.collectionState.lastCollectedAt;

  // Freshness signal per issue/person: the most recent related item timestamp.
  const issueLastModified = new Map<string, string>();
  const personLastModified = new Map<string, string>();
  for (const item of data.items) {
    const when = item.collectedAt ?? item.publishedAt;
    if (!when) {
      continue;
    }
    trackLatest(issueLastModified, item.issueTags, when);
    trackLatest(personLastModified, item.personTags, when);
  }

  // Redirect-only routes (/issues, /people, /feed) are intentionally excluded.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: fallback, changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/news"), lastModified: fallback, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/youtube"), lastModified: fallback, changeFrequency: "hourly", priority: 0.8 },
    { url: absoluteUrl("/tracking"), lastModified: fallback, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/sources"), lastModified: fallback, changeFrequency: "weekly", priority: 0.4 }
  ];

  const detailFrequency: ChangeFrequency = "daily";

  const issueRoutes: MetadataRoute.Sitemap = data.issues.map((issue) => ({
    url: absoluteUrl(`/issues/${issue.id}`),
    lastModified: issueLastModified.get(issue.id) ?? fallback,
    changeFrequency: detailFrequency,
    priority: 0.7
  }));

  const personRoutes: MetadataRoute.Sitemap = data.people
    .filter((person) => person.published)
    .map((person) => ({
      url: absoluteUrl(`/people/${person.id}`),
      lastModified: personLastModified.get(person.id) ?? fallback,
      changeFrequency: detailFrequency,
      priority: 0.6
    }));

  return [...staticRoutes, ...issueRoutes, ...personRoutes];
}
