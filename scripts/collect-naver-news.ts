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

type NewsCandidateClassification = {
  issueTags: string[];
  personTags: string[];
  matchedKeywords: string[];
  relevanceScore: number;
};

export const DEFAULT_NAVER_QUERY_DELAY_MS = 800;
export const MAX_NAVER_SEARCH_QUERIES = 100;
export const NAVER_NEWS_DISPLAY_COUNT = 40;

const FOOTBALL_CONTEXT_KEYWORDS = [
  "대한축구협회",
  "대한축구협회장",
  "축구협회",
  "축구협회장",
  "KFA",
  "K-축구혁신위원회",
  "축구혁신위",
  "축구 혁신",
  "한국 축구",
  "대표팀 감독",
  "대표팀 감독 선임",
  "전력강화위원회"
];

const GENERIC_ASSOCIATION_KEYWORDS = new Set([
  "축구협회",
  "축구협회장"
]);

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getNaverQueryDelayMs(
  value = process.env.NAVER_QUERY_DELAY_MS
): number {
  if (!value) {
    return DEFAULT_NAVER_QUERY_DELAY_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
    return DEFAULT_NAVER_QUERY_DELAY_MS;
  }

  return parsed;
}

async function fetchNaverNews(query: string): Promise<NaverNewsItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return [];
  }

  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(NAVER_NEWS_DISPLAY_COUNT));
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

export function shouldKeepNewsCandidate({
  classification
}: {
  classification: NewsCandidateClassification;
}): boolean {
  if (classification.personTags.length > 0) {
    return true;
  }

  const hasOnlyGenericAssociationKeywords =
    classification.matchedKeywords.length > 0 &&
    classification.matchedKeywords.every((keyword) =>
      GENERIC_ASSOCIATION_KEYWORDS.has(keyword)
    );

  if (hasOnlyGenericAssociationKeywords) {
    return false;
  }

  const hasFootballContext = classification.matchedKeywords.some((keyword) =>
    FOOTBALL_CONTEXT_KEYWORDS.includes(keyword)
  );

  if (!hasFootballContext) {
    return false;
  }

  return classification.relevanceScore >= 20;
}

export function filterNewsItemsForCollection(items: RadarItem[]): RadarItem[] {
  return items.filter(
    (item) =>
      item.sourceType !== "news" ||
      shouldKeepNewsCandidate({
        classification: item
      })
  );
}

export function getNaverSearchQueries({
  issues,
  people
}: {
  issues: Issue[];
  people: Person[];
}): string[] {
  return getSearchQueries({ issues, people }).slice(0, MAX_NAVER_SEARCH_QUERIES);
}

export async function collectNaverNews({
  issues,
  people
}: {
  issues: Issue[];
  people: Person[];
}): Promise<RadarItem[]> {
  const queries = getNaverSearchQueries({ issues, people });
  const queryDelayMs = getNaverQueryDelayMs();
  const collectedAt = new Date().toISOString();
  const results: RadarItem[] = [];

  for (const [index, query] of queries.entries()) {
    if (index > 0 && queryDelayMs > 0) {
      await wait(queryDelayMs);
    }

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

        if (!shouldKeepNewsCandidate({ classification })) {
          continue;
        }

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
  await writeItems(dedupeItems(filterNewsItemsForCollection([...items, ...collected])));
  console.log(`Naver collector merged ${collected.length} candidate items`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
