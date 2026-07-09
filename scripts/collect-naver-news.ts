import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";

import { classifyItemText, getSearchQueries } from "../lib/classify";
import { dedupeItems } from "../lib/dedupe";
import {
  applyItemRetentionPolicy,
  getItemRetentionDays,
  isPublishedAtWithinRetention
} from "../lib/item-retention";
import { normalizePublisher, stripInlineHtml, truncateSummary } from "../lib/normalize";
import type { Issue, Person, RadarItem, RelevanceTier } from "../lib/schema";
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

type NewsCandidateInput = {
  title?: string;
  summary?: string;
  classification: NewsCandidateClassification;
};

type NewsCandidateRelevanceTier = RelevanceTier | "reject";

export const DEFAULT_NAVER_QUERY_DELAY_MS = 800;
export const MAX_NAVER_SEARCH_QUERIES = 100;
export const NAVER_NEWS_DISPLAY_COUNT = 40;
export const NAVER_NEWS_TIMEOUT_MS = 10000;
export const ARTICLE_TITLE_TIMEOUT_MS = 3000;

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

const BROAD_AUDIT_KEYWORDS = new Set([
  "감사",
  "축구협회 감사"
]);

const STRONG_KFA_AUDIT_CONTEXT_KEYWORDS = [
  "문체부",
  "문화체육관광부",
  "대한축구협회",
  "대한 축구협회",
  "KFA",
  "축구협회 감사",
  "축구협회 특정 감사",
  "대표팀 감독",
  "대표팀 감독 선임",
  "감독 선임",
  "전력강화위원회",
  "한국 축구",
  "한국축구",
  "대한민국 축구",
  "대한민국 대표팀"
];

const LOCAL_COMPETITION_CONTEXT_PATTERNS = [
  /(?:고등학교|고교|중학교|초등학교|U-?\d{2}|여성\s*축구\s*단|여자\s*축구\s*단)/u,
  /(?:생활체육|구청|시청|군청|지역\s*리그|지역리그|권역\s*리그|전국대회|도지사배)/u,
  /(?:대구\/경북|대구·경북|충북\s*축구협회|충주시\s*축구협회|시흥시\s*축구협회)/u
];

const COMPETITION_RESULT_PATTERNS = [
  /(?:전승|무패|우승|정상|최강|최종전|승리|대회|리그)/u
];

const LOW_VALUE_PERFORMANCE_CONTEXT_PATTERNS = [
  /(?:월드컵|본선|조별리그|32강|16강|탈락|조기탈락|경기력|패배|참사)/u,
  /(?:원흉|책임자로\s*지목|레전드들|슈퍼스타|외신이\s*본|일본\s*언론|충격진단|탓만|불화|패자|전술\s*문제|쓴소리|골\s*걱정)/u
];

const TRACKED_GOVERNANCE_CONTEXT_KEYWORDS = [
  "문체부",
  "문화체육관광부",
  "대한축구협회장",
  "대한 축구협회장",
  "축구협회장",
  "KFA",
  "K-축구혁신위원회",
  "K-축구 혁신",
  "K- 축구 혁신",
  "축구혁신위",
  "축구 혁신",
  "혁신위",
  "박지성 혁신위",
  "회장 선거",
  "선거인단",
  "정관",
  "감사 결과",
  "특정 감사",
  "행정소송",
  "징계",
  "청문회",
  "이사회",
  "집행부",
  "전력강화위원",
  "전력강화위원회",
  "대표팀 감독 선임",
  "감독 선임 절차",
  "제도 개편",
  "거버넌스",
  "인물보다 구조",
  "후속 조치"
];

const KFA_ACCOUNTABILITY_CONTEXT_PATTERNS = [
  /(?:대한\s*축구협회|축구협회|KFA|한국\s*축구|한국축구|대한민국\s*축구).{0,50}(?:청문회|감사|조사|해명|사퇴|선거|선거인단|정관|징계|소송|가처분|이사회|집행부|전력강화위원회|감독\s*선임|선임\s*절차|제도\s*개편|거버넌스|혁신|쇄신|대수술|대변혁|구조|카르텔|무원칙|책임|논란|비판|직격|후속\s*조치)/u,
  /(?:청문회|감사|조사|해명|사퇴|선거|선거인단|정관|징계|소송|가처분|이사회|집행부|전력강화위원회|감독\s*선임|선임\s*절차|제도\s*개편|거버넌스|혁신|쇄신|대수술|대변혁|구조|카르텔|무원칙|책임|논란|비판|직격|후속\s*조치).{0,50}(?:대한\s*축구협회|축구협회|KFA|한국\s*축구|한국축구|대한민국\s*축구)/u
];

const PERSON_GOVERNANCE_CONTEXT_PATTERNS = [
  /(?:문체부|문화체육관광부|문체위|국회|청문회|전력강화위원회|감독\s*선임|선임\s*절차|회장\s*선거|선거인단|정관|징계|소송|가처분|이사회|집행부|후속\s*조치|해명|사퇴)/u,
  /전력강화위원/u,
  /(?:감독|사령탑|홍명보).{0,24}(?:선임|후보|후임|차기|지원|관심|러브콜|의혹|수사|논란)/u,
  /(?:선임|후보|후임|차기|지원설|러브콜|의혹|수사|논란).{0,24}(?:감독|사령탑|홍명보)/u,
  /선거\s*(?:운동|사무원|후보|캠프|득표|투표|대의원|인단)/u,
  /(?:정몽규|허정무).{0,40}선거|선거.{0,40}(?:정몽규|허정무)/u,
  /감사(?!\s*(?:합니다|드립니다|인사|패))/u
];

const STRONG_PERSON_ISSUE_KEYWORDS = new Set([
  "감독 선임",
  "감독 후보",
  "전력강화위원회",
  "문체부 감사",
  "문화체육관광부 감사",
  "조사 결과",
  "회장 선거",
  "선거인단",
  "선거인",
  "후보 등록",
  "정관",
  "정관 개정",
  "규정 개정",
  "제도 개편",
  "K-축구혁신위원회",
  "축구혁신위",
  "혁신위원회",
  "축구 혁신"
]);

const KOREAN_FOOTBALL_CONTEXT_KEYWORDS = [
  "대한축구협회",
  "대한 축구협회",
  "대한축구협회장",
  "대한 축구협회장",
  "KFA",
  "K-축구혁신위원회",
  "축구혁신위",
  "한국 축구",
  "한국축구",
  "대한민국 축구",
  "대한민국 대표팀"
];

const FOREIGN_FOOTBALL_CONTEXT_PATTERNS = [
  /(?:독일|이탈리아|일본|이집트|포르투갈|스페인|프랑스|잉글랜드|브라질|아르헨티나|네덜란드|벨기에|크로아티아|튀르키예|터키|미국|멕시코|캐나다|호주|중국|대만|베트남|태국|인도네시아|말레이시아|사우디|카타르|이라크|이란|우즈베키스탄|북한)\s*(?:축구협회|대표팀|국가대표|사령탑|감독)/u,
  /\b(?:DFB|JFA|FIGC|EFA)\b/u,
  /전차\s*군단/u
];

const LISTING_TITLE_PATTERNS = [
  /^\s*(?:\[)?오늘의\s*주요일정/u,
  /^\s*(?:\[)?오늘의\s*일정/u,
  /^\s*(?:\[)?주요일정/u
];

const ATHLETE_ROSTER_OR_PROFILE_PATTERNS = [
  /\bMLS\b/u,
  /올스타전|로스터|와일드카드|최종\s*엔트리|엔트리|병역\s*혜택/u,
  /득점왕|축구인생|뽈터뷰|유망주/u
];

const POLITICAL_ANALOGY_CONTEXT_PATTERNS = [
  /(?:정청래|김어준|김민석|장성철|송영길|민주당|국민의힘|당대표|전당대회|당무위|선호투표|한판승부|체포방해|윤석열)/u
];

const TRAILING_ELLIPSIS_PATTERN = /(?:\.\.\.|…)\s*$/u;
const SITE_TITLE_SEPARATOR_PATTERN = /\s+(?:[-|:·])\s+/u;

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

export function getNaverFetchTimeoutMs(
  value = process.env.NAVER_FETCH_TIMEOUT_MS
): number {
  if (!value) {
    return NAVER_NEWS_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 30000) {
    return NAVER_NEWS_TIMEOUT_MS;
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
    },
    signal: AbortSignal.timeout(getNaverFetchTimeoutMs())
  });

  if (!response.ok) {
    throw new Error(`Naver News API failed for "${query}": ${response.status}`);
  }

  const data = (await response.json()) as NaverNewsResponse;
  return data.items ?? [];
}

export function shouldResolveArticleTitle(title: string): boolean {
  return TRAILING_ELLIPSIS_PATTERN.test(title.trim());
}

function titlePrefix(title: string): string {
  return title.replace(TRAILING_ELLIPSIS_PATTERN, "").trim();
}

function pickMatchingArticleTitlePart(articleTitle: string, prefix: string): string {
  const parts = articleTitle
    .split(SITE_TITLE_SEPARATOR_PATTERN)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.find((part) => part.startsWith(prefix)) ?? articleTitle;
}

export function pickArticleTitle(apiTitle: string, articleTitle: string | null): string {
  if (!articleTitle || !shouldResolveArticleTitle(apiTitle)) {
    return apiTitle;
  }

  const prefix = titlePrefix(apiTitle);
  const normalizedArticleTitle = stripInlineHtml(articleTitle);
  const candidate = pickMatchingArticleTitlePart(normalizedArticleTitle, prefix);

  if (candidate.length <= apiTitle.length || !candidate.startsWith(prefix)) {
    return apiTitle;
  }

  return candidate;
}

function extractJsonLdHeadline(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const headline = extractJsonLdHeadline(item);
      if (headline) {
        return headline;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.headline === "string" && record.headline.trim()) {
    return record.headline;
  }

  return extractJsonLdHeadline(record["@graph"]);
}

export function extractArticleTitle(html: string): string | null {
  const $ = cheerio.load(html);
  const metaTitle =
    $("meta[property='og:title']").attr("content") ??
    $("meta[name='og:title']").attr("content") ??
    $("meta[name='twitter:title']").attr("content");

  if (metaTitle?.trim()) {
    return stripInlineHtml(metaTitle);
  }

  for (const element of $("script[type='application/ld+json']").toArray()) {
    const rawJson = $(element).contents().text().trim();
    if (!rawJson) {
      continue;
    }

    try {
      const headline = extractJsonLdHeadline(JSON.parse(rawJson));
      if (headline) {
        return stripInlineHtml(headline);
      }
    } catch {
      continue;
    }
  }

  const title = $("title").first().text();
  return title.trim() ? stripInlineHtml(title) : null;
}

async function fetchArticleTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "KoreaFootballRadar/0.1 metadata monitor"
      },
      signal: AbortSignal.timeout(ARTICLE_TITLE_TIMEOUT_MS)
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html")) {
      return null;
    }

    return extractArticleTitle(await response.text());
  } catch {
    return null;
  }
}

async function resolveArticleTitle(apiTitle: string, url: string): Promise<string> {
  if (!shouldResolveArticleTitle(apiTitle)) {
    return apiTitle;
  }

  return pickArticleTitle(apiTitle, await fetchArticleTitle(url));
}

function hasKoreanFootballContext(text: string): boolean {
  return KOREAN_FOOTBALL_CONTEXT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasForeignFootballContext(text: string): boolean {
  return FOREIGN_FOOTBALL_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function hasStrongKfaAuditContext(text: string): boolean {
  return STRONG_KFA_AUDIT_CONTEXT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasTrackedGovernanceContext(text: string): boolean {
  return TRACKED_GOVERNANCE_CONTEXT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasKfaAccountabilityContext(text: string): boolean {
  return KFA_ACCOUNTABILITY_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function hasPersonGovernanceContext(text: string): boolean {
  return PERSON_GOVERNANCE_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function hasStrongPersonIssueKeyword(
  classification: NewsCandidateClassification
): boolean {
  return classification.matchedKeywords.some((keyword) =>
    STRONG_PERSON_ISSUE_KEYWORDS.has(keyword)
  );
}

function hasLocalCompetitionResultContext(text: string): boolean {
  return (
    LOCAL_COMPETITION_CONTEXT_PATTERNS.some((pattern) => pattern.test(text)) &&
    COMPETITION_RESULT_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function hasLowValuePerformanceContext(text: string): boolean {
  return LOW_VALUE_PERFORMANCE_CONTEXT_PATTERNS.every((pattern) => pattern.test(text));
}

function hasListingTitle(title: string): boolean {
  return LISTING_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function hasAthleteRosterOrProfileContext(text: string): boolean {
  return ATHLETE_ROSTER_OR_PROFILE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasPoliticalAnalogyContext(text: string): boolean {
  return POLITICAL_ANALOGY_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function hasOnlyBroadAuditAndGenericAssociationKeywords(
  classification: NewsCandidateClassification
): boolean {
  return (
    classification.matchedKeywords.length > 0 &&
    classification.matchedKeywords.every(
      (keyword) =>
        BROAD_AUDIT_KEYWORDS.has(keyword) || GENERIC_ASSOCIATION_KEYWORDS.has(keyword)
    )
  );
}

function hasPrimaryPersonContext({
  text,
  classification
}: {
  text: string;
  classification: NewsCandidateClassification;
}): boolean {
  return (
    classification.personTags.length > 0 &&
    (hasTrackedGovernanceContext(text) ||
      hasKfaAccountabilityContext(text) ||
      hasPersonGovernanceContext(text) ||
      hasStrongPersonIssueKeyword(classification))
  );
}

function hasPrimaryIssueContext({
  text,
  classification
}: {
  text: string;
  classification: NewsCandidateClassification;
}): boolean {
  if (classification.issueTags.length === 0) {
    return false;
  }

  const hasOnlyGenericAssociationKeywords =
    classification.matchedKeywords.length > 0 &&
    classification.matchedKeywords.every((keyword) =>
      GENERIC_ASSOCIATION_KEYWORDS.has(keyword)
    );

  if (hasOnlyGenericAssociationKeywords) {
    return false;
  }

  if (
    classification.issueTags.includes("mcst-audit") &&
    hasOnlyBroadAuditAndGenericAssociationKeywords(classification) &&
    !hasStrongKfaAuditContext(text)
  ) {
    return false;
  }

  const hasFootballContext = classification.matchedKeywords.some((keyword) =>
    FOOTBALL_CONTEXT_KEYWORDS.includes(keyword)
  );

  return hasFootballContext && classification.relevanceScore >= 20;
}

function hasSecondaryCollectionContext({
  text,
  classification
}: {
  text: string;
  classification: NewsCandidateClassification;
}): boolean {
  if (!text.trim()) {
    return false;
  }

  if (classification.personTags.length > 0 || classification.issueTags.length > 0) {
    const hasFootballContext = classification.matchedKeywords.some((keyword) =>
      FOOTBALL_CONTEXT_KEYWORDS.includes(keyword)
    );
    return (
      classification.personTags.length > 0 ||
      hasFootballContext ||
      hasTrackedGovernanceContext(text) ||
      hasKfaAccountabilityContext(text) ||
      hasPersonGovernanceContext(text) ||
      hasStrongPersonIssueKeyword(classification)
    );
  }

  return (
    classification.relevanceScore >= 20 &&
    classification.matchedKeywords.some((keyword) =>
      FOOTBALL_CONTEXT_KEYWORDS.includes(keyword)
    )
  );
}

export function getNewsCandidateRelevanceTier({
  title,
  summary,
  classification
}: NewsCandidateInput): NewsCandidateRelevanceTier {
  const text = `${title ?? ""} ${summary ?? ""}`;
  const titleText = title ?? "";
  const hasGovernanceContext =
    hasTrackedGovernanceContext(text) ||
    hasKfaAccountabilityContext(text) ||
    hasPersonGovernanceContext(text);

  if (hasListingTitle(titleText) && !hasKfaAccountabilityContext(titleText)) {
    return "reject";
  }

  if (text && hasForeignFootballContext(text) && !hasKoreanFootballContext(text)) {
    return "reject";
  }

  if (hasAthleteRosterOrProfileContext(text) && !hasGovernanceContext) {
    return "reject";
  }

  if (
    hasPoliticalAnalogyContext(text) &&
    !hasKfaAccountabilityContext(text) &&
    !hasKfaAccountabilityContext(titleText)
  ) {
    return "reject";
  }

  if (hasLocalCompetitionResultContext(text) && !hasTrackedGovernanceContext(text)) {
    return "reject";
  }

  if (hasLowValuePerformanceContext(text) && !hasTrackedGovernanceContext(text)) {
    return "reject";
  }

  if (
    classification.issueTags.includes("mcst-audit") &&
    hasOnlyBroadAuditAndGenericAssociationKeywords(classification) &&
    !hasStrongKfaAuditContext(text)
  ) {
    return "reject";
  }

  if (hasPrimaryPersonContext({ text, classification })) {
    return "primary";
  }

  if (hasPrimaryIssueContext({ text, classification })) {
    return "primary";
  }

  if (hasSecondaryCollectionContext({ text, classification })) {
    return "secondary";
  }

  return "reject";
}

export function shouldKeepNewsCandidate(input: NewsCandidateInput): boolean {
  return getNewsCandidateRelevanceTier(input) !== "reject";
}

export function filterNewsItemsForCollection(items: RadarItem[]): RadarItem[] {
  return items.filter(
    (item) => {
      if (item.sourceType !== "news") {
        return true;
      }

      return shouldKeepNewsCandidate({
        title: item.title,
        summary: item.summary,
        classification: item
      });
    }
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
  const collectedDate = new Date();
  const collectedAt = collectedDate.toISOString();
  const retentionDays = getItemRetentionDays();
  const results: RadarItem[] = [];

  for (const [index, query] of queries.entries()) {
    if (index > 0 && queryDelayMs > 0) {
      await wait(queryDelayMs);
    }

    try {
      const newsItems = await fetchNaverNews(query);
      for (const newsItem of newsItems) {
        const originalUrl = newsItem.originallink || newsItem.link;
        const publishedAt = toIsoDate(newsItem.pubDate);
        if (
          !isPublishedAtWithinRetention({
            publishedAt,
            now: collectedDate,
            retentionDays
          })
        ) {
          continue;
        }

        const apiTitle = stripInlineHtml(newsItem.title);
        const title = await resolveArticleTitle(apiTitle, originalUrl);
        const summary = truncateSummary(newsItem.description);
        const classification = classifyItemText({
          title,
          summary,
          issues,
          people,
          isOfficial: false
        });
        const relevanceTier = getNewsCandidateRelevanceTier({
          title,
          summary,
          classification
        });

        if (relevanceTier === "reject") {
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
          publishedAt,
          collectedAt,
          matchedKeywords: Array.from(new Set([query, ...classification.matchedKeywords])),
          issueTags: classification.issueTags,
          personTags: classification.personTags,
          sourceType: "news",
          isOfficial: false,
          relevanceScore: classification.relevanceScore,
          relevanceTier: relevanceTier === "secondary" ? "secondary" : undefined,
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
  await writeItems(
    applyItemRetentionPolicy(dedupeItems(filterNewsItemsForCollection([...items, ...collected])))
  );
  console.log(`Naver collector merged ${collected.length} candidate items`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
