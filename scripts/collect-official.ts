import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";

import { classifyItemText } from "../lib/classify";
import { dedupeItems } from "../lib/dedupe";
import { normalizePublisher, stripHtml, truncateSummary } from "../lib/normalize";
import type { Issue, Person, RadarItem, Source } from "../lib/schema";
import { persistCollectionRun, type CollectorRunResult } from "./collection-run";
import { readIssues, readItems, readPeople, readSources } from "./data-io";

type OfficialCandidateClassification = {
  issueTags: string[];
  personTags: string[];
  matchedKeywords: string[];
  relevanceScore: number;
  labels: string[];
};

type OfficialLinkCandidate = {
  title: string;
  url: string;
  publishedAt?: string;
};

const MAX_OFFICIAL_ITEMS_PER_SOURCE = 20;
export const OFFICIAL_SOURCE_TIMEOUT_MS = 10000;
export const OFFICIAL_SOURCE_MAX_ATTEMPTS = 3;
export const OFFICIAL_SOURCE_RETRY_BASE_DELAY_MS = 1000;

type OfficialSourceRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  wait?: (delayMs: number) => Promise<void>;
  random?: () => number;
};

class OfficialSourceRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "OfficialSourceRequestError";
  }
}

const FOOTBALL_CONTEXT_KEYWORDS = [
  "대한축구협회",
  "대한축구협회장",
  "축구협회",
  "축구협회장",
  "KFA",
  "K-축구혁신위원회",
  "축구혁신위",
  "축구",
  "축구 혁신",
  "한국 축구",
  "한국축구"
];

const KFA_VIEW_CONTENTS_PATTERN =
  /view_contents\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/u;
const SPORTS_BBS_VIEW_PATTERN = /bbsView\(\s*['"]?(\d+)['"]?\s*\)/u;
const OFFICIAL_CANDIDATE_PATHS: Readonly<Record<string, readonly string[]>> = {
  kfa_media: ["/bbs/bbs.php"],
  mcst_press: ["/site/s_notice/press/pressView.jsp"],
  sports_council: ["/sports/bbs/BMSR00001/view.do"]
};

function stableItemId(url: string): string {
  return `item_${crypto.createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
}

export function getOfficialSourceTimeoutMs(
  value = process.env.OFFICIAL_SOURCE_TIMEOUT_MS
): number {
  if (!value) {
    return OFFICIAL_SOURCE_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 30000) {
    return OFFICIAL_SOURCE_TIMEOUT_MS;
  }

  return parsed;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isRetryableOfficialStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function getOfficialRetryDelayMs({
  failedAttempt,
  baseDelayMs,
  random
}: {
  failedAttempt: number;
  baseDelayMs: number;
  random: () => number;
}): number {
  const exponentialDelay = baseDelayMs * 2 ** (failedAttempt - 1);
  const jitter = Math.floor(baseDelayMs * 0.25 * random());
  return exponentialDelay + jitter;
}

export function resolveSourceUrl(href: string, baseUrl: string): string | null {
  try {
    const sourceUrl = new URL(baseUrl);
    const url = new URL(href, sourceUrl);
    if (
      sourceUrl.protocol !== "https:" ||
      url.protocol !== "https:" ||
      url.origin !== sourceUrl.origin
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isAllowedOfficialResponseUrl(
  responseUrl: string,
  sourceUrl: string
): boolean {
  try {
    const source = new URL(sourceUrl);
    const response = new URL(responseUrl || sourceUrl);
    return (
      source.protocol === "https:" &&
      response.protocol === "https:" &&
      response.origin === source.origin
    );
  } catch {
    return false;
  }
}

export function isAllowedOfficialCandidateUrl(
  candidateUrl: string,
  source: Source
): boolean {
  const allowedPaths = OFFICIAL_CANDIDATE_PATHS[source.id];
  if (!allowedPaths) {
    return resolveSourceUrl(candidateUrl, source.url) !== null;
  }

  try {
    const candidate = new URL(candidateUrl);
    return (
      resolveSourceUrl(candidateUrl, source.url) !== null &&
      allowedPaths.includes(candidate.pathname)
    );
  } catch {
    return false;
  }
}

export function parseOfficialDate(value: string, fallback = new Date().toISOString()): string {
  const match = value
    .replace(/\([^)]*\)/g, " ")
    .match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})\.?(?:\s+(\d{1,2}):(\d{2}))?/u);

  if (!match) {
    return fallback;
  }

  const [, year, rawMonth, rawDay, rawHour = "0", rawMinute = "0"] = match;
  const month = rawMonth.padStart(2, "0");
  const day = rawDay.padStart(2, "0");
  const hour = rawHour.padStart(2, "0");
  const minute = rawMinute.padStart(2, "0");
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);

  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function resolveKfaMediaUrl(onclick: string, baseUrl: string): string | null {
  const match = onclick.match(KFA_VIEW_CONTENTS_PATTERN);
  if (!match) {
    return null;
  }

  const [, idx, con] = match;
  return resolveSourceUrl(`/bbs/bbs.php?act=bbs_view&idx=${idx}&con=${con}`, baseUrl);
}

export function resolveSportsCouncilUrl(href: string, baseUrl: string): string | null {
  const match = href.match(SPORTS_BBS_VIEW_PATTERN);
  if (!match) {
    return resolveSourceUrl(href, baseUrl);
  }

  return resolveSourceUrl(`/sports/bbs/BMSR00001/view.do?boardId=${match[1]}&menuNo=200024`, baseUrl);
}

export function shouldKeepOfficialCandidate({
  classification,
  sourceId
}: {
  classification: OfficialCandidateClassification;
  sourceId: string;
}): boolean {
  const hasTag = classification.issueTags.length > 0 || classification.personTags.length > 0;
  if (!hasTag) {
    return false;
  }

  if (sourceId === "kfa_media") {
    return true;
  }

  return classification.matchedKeywords.some((keyword) =>
    FOOTBALL_CONTEXT_KEYWORDS.includes(keyword)
  );
}

function extractKfaMediaCandidates(
  $: cheerio.CheerioAPI,
  source: Source,
  fallbackPublishedAt: string
): OfficialLinkCandidate[] {
  return $("a[onclick*='view_contents']")
    .toArray()
    .flatMap((element) => {
      const url = resolveKfaMediaUrl($(element).attr("onclick") ?? "", source.url);
      const title =
        stripHtml($(element).find(".caption p").first().text()) ||
        stripHtml($(element).text());
      if (!url || title.length < 8) {
        return [];
      }

      const dateText = stripHtml($(element).find(".caption .date").first().text());
      return [
        {
          title,
          url,
          publishedAt: dateText ? parseOfficialDate(dateText, fallbackPublishedAt) : undefined
        }
      ];
    });
}

function extractMcstPressCandidates(
  $: cheerio.CheerioAPI,
  source: Source,
  fallbackPublishedAt: string
): OfficialLinkCandidate[] {
  return $("td.tit_wrap a[href]")
    .toArray()
    .flatMap((element) => {
      const href = $(element).attr("href");
      const url = href ? resolveSourceUrl(href, source.url) : null;
      const titleSource = ($(element).attr("title") ?? $(element).find(".tit").text()) ||
        $(element).text();
      const title = stripHtml(titleSource);
      if (!url || title.length < 8) {
        return [];
      }

      const dateText = stripHtml(
        $(element).closest("tr").find("td[aria-label='게시일']").first().text()
      );
      return [
        {
          title,
          url,
          publishedAt: dateText ? parseOfficialDate(dateText, fallbackPublishedAt) : undefined
        }
      ];
    });
}

function extractSportsCouncilCandidates(
  $: cheerio.CheerioAPI,
  source: Source,
  fallbackPublishedAt: string
): OfficialLinkCandidate[] {
  return $("td.tit a[href]")
    .toArray()
    .flatMap((element) => {
      const href = $(element).attr("href");
      const url = href ? resolveSportsCouncilUrl(href, source.url) : null;
      const title = stripHtml($(element).text());
      if (!url || title.length < 8) {
        return [];
      }

      const row = $(element).closest("tr");
      const mobileDateText = row
        .find("li")
        .toArray()
        .map((item) => stripHtml($(item).text()))
        .find((text) => text.includes("등록일"));
      const dateText =
        mobileDateText?.replace("등록일", "") || stripHtml(row.find("td.pc").last().text());

      return [
        {
          title,
          url,
          publishedAt: dateText ? parseOfficialDate(dateText, fallbackPublishedAt) : undefined
        }
      ];
    });
}

function extractGenericCandidates(
  $: cheerio.CheerioAPI,
  source: Source
): OfficialLinkCandidate[] {
  return $("a[href]")
    .toArray()
    .flatMap((element) => {
      const href = $(element).attr("href");
      const title = stripHtml($(element).text());
      const url = href ? resolveSourceUrl(href, source.url) : null;
      return url && title.length >= 8 ? [{ title, url }] : [];
    });
}

export function extractOfficialCandidates(
  html: string,
  source: Source,
  fallbackPublishedAt = new Date().toISOString()
): OfficialLinkCandidate[] {
  const $ = cheerio.load(html);
  const candidates =
    source.id === "kfa_media"
      ? extractKfaMediaCandidates($, source, fallbackPublishedAt)
      : source.id === "mcst_press"
        ? extractMcstPressCandidates($, source, fallbackPublishedAt)
        : source.id === "sports_council"
          ? extractSportsCouncilCandidates($, source, fallbackPublishedAt)
          : extractGenericCandidates($, source);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (!isAllowedOfficialCandidateUrl(candidate.url, source) || seen.has(candidate.url)) {
      return false;
    }
    seen.add(candidate.url);
    return true;
  });
}

async function fetchOfficialSourceHtml(source: Source): Promise<string> {
  let response: Response;
  try {
    response = await fetch(source.url, {
      headers: {
        "User-Agent": "KoreaFootballRadar/0.1 metadata monitor"
      },
      signal: AbortSignal.timeout(getOfficialSourceTimeoutMs())
    });
  } catch (error) {
    throw new OfficialSourceRequestError(
      `${source.name} request failed: ${describeError(error)}`,
      true,
      { cause: error }
    );
  }

  if (!response.ok) {
    throw new OfficialSourceRequestError(
      `${source.name} responded ${response.status}`,
      isRetryableOfficialStatus(response.status)
    );
  }
  if (!isAllowedOfficialResponseUrl(response.url, source.url)) {
    throw new OfficialSourceRequestError(
      `${source.name} redirected outside its configured HTTPS origin`,
      false
    );
  }

  try {
    return await response.text();
  } catch (error) {
    throw new OfficialSourceRequestError(
      `${source.name} response body failed: ${describeError(error)}`,
      true,
      { cause: error }
    );
  }
}

async function fetchOfficialSourceHtmlWithRetry(
  source: Source,
  options: OfficialSourceRetryOptions = {}
): Promise<string> {
  const maxAttempts = Math.max(
    1,
    Math.floor(options.maxAttempts ?? OFFICIAL_SOURCE_MAX_ATTEMPTS)
  );
  const baseDelayMs = Math.max(
    0,
    options.baseDelayMs ?? OFFICIAL_SOURCE_RETRY_BASE_DELAY_MS
  );
  const waitForRetry = options.wait ?? wait;
  const random = options.random ?? Math.random;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchOfficialSourceHtml(source);
    } catch (error) {
      const shouldRetry =
        error instanceof OfficialSourceRequestError && error.retryable;
      if (!shouldRetry || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = getOfficialRetryDelayMs({
        failedAttempt: attempt,
        baseDelayMs,
        random
      });
      console.warn(
        `Official collector retrying ${source.name} (${attempt + 1}/${maxAttempts}) ` +
          `in ${delayMs}ms: ${describeError(error)}`
      );
      if (delayMs > 0) {
        await waitForRetry(delayMs);
      }
    }
  }

  throw new Error(`${source.name} retry loop completed unexpectedly`);
}

async function collectOfficialSource({
  source,
  issues,
  people,
  retryOptions
}: {
  source: Source;
  issues: Issue[];
  people: Person[];
  retryOptions?: OfficialSourceRetryOptions;
}): Promise<RadarItem[]> {
  if (!isAllowedOfficialResponseUrl(source.url, source.url)) {
    throw new Error(`${source.name} has an invalid source URL`);
  }

  const html = await fetchOfficialSourceHtmlWithRetry(source, retryOptions);
  const collectedAt = new Date().toISOString();
  const items: RadarItem[] = [];

  for (const candidate of extractOfficialCandidates(html, source, collectedAt)) {
    if (items.length >= MAX_OFFICIAL_ITEMS_PER_SOURCE) {
      break;
    }
    const classification = classifyItemText({
      title: candidate.title,
      summary: "",
      issues,
      people,
      isOfficial: true
    });

    if (!shouldKeepOfficialCandidate({ classification, sourceId: source.id })) {
      continue;
    }

    items.push({
      id: stableItemId(candidate.url),
      type: "official",
      title: candidate.title,
      summary: truncateSummary(`${source.name}에서 감지된 공식자료 링크입니다.`),
      url: candidate.url,
      originalUrl: candidate.url,
      publisher: source.name || normalizePublisher(candidate.url),
      publishedAt: candidate.publishedAt ?? collectedAt,
      collectedAt,
      matchedKeywords: classification.matchedKeywords,
      issueTags: classification.issueTags,
      personTags: classification.personTags,
      sourceType: "official",
      isOfficial: true,
      relevanceScore: classification.relevanceScore,
      labels: classification.labels
    });
  }

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
  return (await collectOfficialSourcesRun({ sources, issues, people })).items;
}

export async function collectOfficialSourcesRun({
  sources,
  issues,
  people,
  retryOptions
}: {
  sources: Source[];
  issues: Issue[];
  people: Person[];
  retryOptions?: OfficialSourceRetryOptions;
}): Promise<CollectorRunResult> {
  const enabledSources = sources.filter((item) => item.enabled && item.type === "official");
  const sourceResults = await Promise.allSettled(
    enabledSources.map((source) =>
      collectOfficialSource({ source, issues, people, retryOptions })
    )
  );
  const collected: RadarItem[] = [];
  let succeeded = 0;

  for (const [index, result] of sourceResults.entries()) {
    if (result.status === "fulfilled") {
      collected.push(...result.value);
      succeeded += 1;
    } else {
      const source = enabledSources[index];
      console.error(
        `Official collector skipped ${source.name}: ${describeError(result.reason)}`
      );
    }
  }

  return {
    items: dedupeItems(collected),
    attempted: enabledSources.length,
    succeeded,
    failed: enabledSources.length - succeeded
  };
}

async function run(): Promise<void> {
  const [items, sources, issues, people] = await Promise.all([
    readItems(),
    readSources(),
    readIssues(),
    readPeople()
  ]);
  const result = await collectOfficialSourcesRun({ sources, issues, people });
  const update = await persistCollectionRun({ existingItems: items, results: [result] });
  console.log(
    `Official collector merged ${result.items.length} candidate items (${result.succeeded}/${result.attempted} sources succeeded, status ${update.state.lastRunStatus})`
  );
  if (update.state.lastRunStatus === "failed") {
    throw new Error("Official collector did not complete any source");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
