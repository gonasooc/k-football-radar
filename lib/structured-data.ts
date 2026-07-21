import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, getSiteUrl } from "./site";

// Aggregator-appropriate schema.org objects. The site collects metadata and
// links out to originals, so it never claims authorship (no Article/NewsArticle
// on collected items) — only site identity, search, and collection framing.

type JsonLdObject = Record<string, unknown>;

export function buildOrganizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: `${getSiteUrl()}/`,
    logo: absoluteUrl("/brand/korea-football-radar-logo.png"),
    description: SITE_DESCRIPTION
  };
}

export function buildWebSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${getSiteUrl()}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/news?q={search_term_string}")
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path)
    }))
  };
}

export function buildCollectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: "ko-KR",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: `${getSiteUrl()}/`
    }
  };
}
