import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";

import { classifyItemText } from "../lib/classify";
import { dedupeItems } from "../lib/dedupe";
import { normalizePublisher, stripHtml, truncateSummary } from "../lib/normalize";
import type { Issue, Person, RadarItem, Source } from "../lib/schema";
import { readIssues, readItems, readPeople, readSources, writeItems } from "./data-io";

type OfficialCandidateClassification = {
  issueTags: string[];
  personTags: string[];
  matchedKeywords: string[];
  relevanceScore: number;
  labels: string[];
};

function stableItemId(url: string): string {
  return `item_${crypto.createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
}

export function resolveSourceUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function shouldKeepOfficialCandidate(
  classification: OfficialCandidateClassification
): boolean {
  return classification.issueTags.length > 0 || classification.personTags.length > 0;
}

async function collectOfficialSource({
  source,
  issues,
  people
}: {
  source: Source;
  issues: Issue[];
  people: Person[];
}): Promise<RadarItem[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "KoreaFootballRadar/0.1 metadata monitor"
    }
  });

  if (!response.ok) {
    throw new Error(`${source.name} responded ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const collectedAt = new Date().toISOString();
  const items: RadarItem[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, element) => {
    if (items.length >= 20) {
      return false;
    }

    const href = $(element).attr("href");
    const title = stripHtml($(element).text());
    if (!href || title.length < 8) {
      return;
    }

    const url = resolveSourceUrl(href, source.url);
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);

    const classification = classifyItemText({
      title,
      summary: "",
      issues,
      people,
      isOfficial: true
    });

    if (!shouldKeepOfficialCandidate(classification)) {
      return;
    }

    items.push({
      id: stableItemId(url),
      type: "official",
      title,
      summary: truncateSummary(`${source.name}에서 감지된 공식자료 링크입니다.`),
      url,
      originalUrl: url,
      publisher: source.name || normalizePublisher(url),
      publishedAt: collectedAt,
      collectedAt,
      matchedKeywords: classification.matchedKeywords,
      issueTags: classification.issueTags,
      personTags: classification.personTags,
      sourceType: "official",
      isOfficial: true,
      relevanceScore: classification.relevanceScore,
      labels: classification.labels
    });
  });

  return items;
}

export async function collectOfficialSources({
  sources,
  issues,
  people
}: {
  sources: Source[];
  issues: Issue[];
  people: Person[];
}): Promise<RadarItem[]> {
  const collected: RadarItem[] = [];

  for (const source of sources.filter((item) => item.enabled && item.type === "official")) {
    try {
      collected.push(...(await collectOfficialSource({ source, issues, people })));
    } catch (error) {
      console.error(
        `Official collector skipped ${source.name}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return dedupeItems(collected);
}

async function run(): Promise<void> {
  const [items, sources, issues, people] = await Promise.all([
    readItems(),
    readSources(),
    readIssues(),
    readPeople()
  ]);
  const collected = await collectOfficialSources({ sources, issues, people });
  await writeItems(dedupeItems([...items, ...collected]));
  console.log(`Official collector merged ${collected.length} candidate items`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
