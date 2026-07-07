import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

import { classifyItemText, getSearchQueries } from "../lib/classify";
import { dedupeItems } from "../lib/dedupe";
import { normalizePublisher, stripHtml, truncateSummary } from "../lib/normalize";
import type { Issue, Person, RadarItem } from "../lib/schema";
import { readIssues, readItems, readPeople, writeItems } from "./data-io";

type NaverNewsItem = {
  title: string;
  originallink?: string;
  link: string;
  description: string;
  pubDate: string;
};

type NaverNewsResponse = {
  items?: NaverNewsItem[];
};

function stableItemId(url: string): string {
  return `item_${crypto.createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
}

function toIsoDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

async function fetchNaverNews(query: string): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return [];
  }

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", "20");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "date");

  const response = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret
    }
  });

  if (!response.ok) {
    throw new Error(`Naver News API failed for "${query}": ${response.status}`);
  }

  const data = (await response.json()) as NaverNewsResponse;
  return data.items ?? [];
}

export async function collectNaverNews({
  issues,
  people
}: {
  issues: Issue[];
  people: Person[];
}): Promise<RadarItem[]> {
  const queries = getSearchQueries({ issues, people }).slice(0, 30);
  const collectedAt = new Date().toISOString();
  const results: RadarItem[] = [];

  for (const query of queries) {
    try {
      const newsItems = await fetchNaverNews(query);
      for (const newsItem of newsItems) {
        const originalUrl = newsItem.originallink || newsItem.link;
        const title = stripHtml(newsItem.title);
        const summary = truncateSummary(newsItem.description);
        const classification = classifyItemText({
          title,
          summary,
          issues,
          people,
          isOfficial: false
        });

        results.push({
          id: stableItemId(originalUrl),
          type: "news",
          title,
          summary,
          url: originalUrl,
          originalUrl,
          publisher: normalizePublisher(originalUrl),
          publishedAt: toIsoDate(newsItem.pubDate),
          collectedAt,
          matchedKeywords: Array.from(new Set([query, ...classification.matchedKeywords])),
          issueTags: classification.issueTags,
          personTags: classification.personTags,
          sourceType: "news",
          isOfficial: false,
          relevanceScore: classification.relevanceScore,
          labels: classification.labels
        });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  }

  return dedupeItems(results);
}

async function run(): Promise<void> {
  const [items, issues, people] = await Promise.all([readItems(), readIssues(), readPeople()]);
  const collected = await collectNaverNews({ issues, people });
  await writeItems(dedupeItems([...items, ...collected]));
  console.log(`Naver collector merged ${collected.length} candidate items`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
