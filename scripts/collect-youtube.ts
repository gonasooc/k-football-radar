import { pathToFileURL } from "node:url";

import { z } from "zod";

import { classifyItemText, joinSummaryAndTags } from "../lib/classify";
import { dedupeItems } from "../lib/dedupe";
import { getItemRetentionDays, isPublishedAtWithinRetention } from "../lib/item-retention";
import { hasLocalFootballAssociationContext } from "../lib/korean-localities";
import { stripInlineHtml, truncateSummary } from "../lib/normalize";
import type {
  Issue,
  Person,
  RadarItem,
  RelevanceTier,
  YouTubeChannelPolicyFile,
  YouTubeFormatCacheFile,
  YouTubeSearchQuery
} from "../lib/schema";
import {
  getBlockedYouTubeChannelIds,
  getEffectiveYouTubeTier,
  getPreferredYouTubeChannelIds,
  getVisibleYouTubeChannelStatus
} from "../lib/youtube-channel-policy";
import {
  classifyYouTubeVideoFormat,
  isYouTubeShortsProbeHealthy,
  type YouTubeShortsProbeFetch
} from "../lib/youtube-shorts";
import { getNewsCandidateRelevanceTier } from "./collect-naver-news";
import {
  persistCollectionRun,
  type CollectorRunResult
} from "./collection-run";
import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readYouTubeChannelPolicy,
  readYouTubeFormatCache,
  readYouTubeSearchQueries,
  writeYouTubeFormatCache
} from "./data-io";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_RESULTS_PER_PAGE = 50;
const YOUTUBE_VIDEO_BATCH_SIZE = 50;
const YOUTUBE_COLLECTION_OVERLAP_MS = 24 * 60 * 60 * 1000;
const DEFAULT_YOUTUBE_BACKFILL_DAYS = 90;
const DEFAULT_YOUTUBE_MAX_PAGES_PER_QUERY = 2;
const DEFAULT_YOUTUBE_MAX_PAGES_PER_CHANNEL = 5;
const MAX_YOUTUBE_SEARCH_QUERIES = 15;
const YOUTUBE_SHORTS_PROBE_CONCURRENCY = 4;

const thumbnailSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

const snippetSchema = z.object({
  publishedAt: z.string().datetime({ offset: true }),
  channelId: z.string().min(1),
  title: z.string(),
  description: z.string().default(""),
  thumbnails: z.record(thumbnailSchema).default({}),
  channelTitle: z.string().min(1),
  tags: z.array(z.string()).default([]),
  liveBroadcastContent: z.enum(["none", "live", "upcoming"]).optional()
});

const searchResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.object({ videoId: z.string().min(1) }),
        snippet: snippetSchema
      })
    )
    .default([])
});

const videoListResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        snippet: snippetSchema,
        contentDetails: z.object({ duration: z.string().min(1) }),
        status: z
          .object({
            uploadStatus: z.string().optional(),
            privacyStatus: z.string().optional()
          })
          .optional(),
        liveStreamingDetails: z.record(z.unknown()).optional()
      })
    )
    .default([])
});

const channelListResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        contentDetails: z.object({
          relatedPlaylists: z.object({ uploads: z.string().min(1) })
        })
      })
    )
    .default([])
});

const playlistItemsResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z
    .array(
      z.object({
        contentDetails: z.object({
          videoId: z.string().min(1),
          videoPublishedAt: z.string().datetime({ offset: true }).optional()
        }),
        status: z.object({ privacyStatus: z.string().optional() }).optional()
      })
    )
    .default([])
});

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type SearchObservation = {
  videoId: string;
  discoveryQueries: Set<string>;
};

const EMPTY_YOUTUBE_CHANNEL_POLICY: YouTubeChannelPolicyFile = {
  version: 1,
  preferred: [],
  blocked: []
};

// Publisher tags are useful metadata, but they are also commonly reused as
// channel-wide SEO boilerplate. Only let tags rescue otherwise rejected text
// when the visible title/description already ties a Korean-football subject to
// a governance cue. A broad hashtag or a person's name is not enough because
// both are routinely copied onto match reviews and highlight clips.
const YOUTUBE_TAG_RESCUE_CONTEXT_PATTERN =
  /(?:(?:한국\s*축구|한국축구|대한민국\s*축구).{0,40}(?:개혁|혁신|운영\s*책임|책임\s*(?:구조|규명)|부패|비리|카르텔|인맥|감독\s*선임|청문회|회장\s*선거|선거인단|정관|징계|수사|이사회|감사\s*(?:착수|결과|발표|보고서|처분|지적))|(?:개혁|혁신|운영\s*책임|책임\s*(?:구조|규명)|부패|비리|카르텔|인맥|감독\s*선임|청문회|회장\s*선거|선거인단|정관|징계|수사|이사회|감사\s*(?:착수|결과|발표|보고서|처분|지적)).{0,40}(?:한국\s*축구|한국축구|대한민국\s*축구)|전력강화위원회?|K[-\s]?축구혁신(?:위원회|위))/iu;
const YOUTUBE_ASSOCIATION_GOVERNANCE_RESCUE_PATTERN =
  /(?:축구협회.{0,45}(?:국회(?:의원)?|청문회|회장\s*선거|선거인단|감독\s*선임|전력강화위원|정관|이사회|사퇴|징계|가처분|수사|고발|감사\s*(?:착수|결과|발표|보고서|처분|지적))|(?:국회(?:의원)?|청문회|회장\s*선거|선거인단|감독\s*선임|전력강화위원|정관|이사회|사퇴|징계|가처분|수사|고발|감사\s*(?:착수|결과|발표|보고서|처분|지적)).{0,45}축구협회)/u;
const YOUTUBE_TAG_RESCUE_EXCLUSION_PATTERN =
  /(?:감사\s*(?:합니다|드립니다|드려요|해요)|감사한\s*(?:마음|뜻|인사)|감사의\s*(?:말|뜻|마음|인사)|하이라이트|골\s*모음|경기\s*장면|다시\s*보기|경기\s*리뷰)/u;
const YOUTUBE_MULTILINGUAL_KFA_ANCHOR_PATTERN =
  /(?:Korea(?:n)?\s+Football\s+Association|(?:Asosiasi|Federasi)\s+Sepak\s+Bola\s+Korea\s+Selatan|koreanisch\w*\s+Fußball(?:verband)?|\bKFA\b.{0,140}(?:Shin\s+Tae-yong|Korea\s+Selatan|Sepak\s+Bola\s+Korea|koreanisch\w*\s+Fußball)|(?:Shin\s+Tae-yong|Korea\s+Selatan|Sepak\s+Bola\s+Korea|koreanisch\w*\s+Fußball).{0,140}\bKFA\b)/iu;
const YOUTUBE_MULTILINGUAL_GOVERNANCE_PATTERN =
  /(?:sanction|disciplin|suspension|banned?|sanksi|dihukum|dikenakan\s+sanksi|larangan|disiplin|pemeriksaan\s+disiplin|corrupt\w*|korup\w*|korrupt\w*|skandal\w*|vetternwirtschaft)/iu;
const YOUTUBE_STY_FOOTBALL_CORROBORATOR_PATTERN =
  /(?:Persija|Timnas|pemain|pelatih|sepak\s*bola|FIFA)/iu;

function splitYouTubeEvidenceSegments(...fields: string[]): string[] {
  return fields.flatMap((field) =>
    field
      .split(
        /(?:[\r\n]+|[;；|｜]+|-{2,}|\s+-\s+|(?<![:/])\/+(?!\/)|／+|[‒–—―]|\.{2,}|…+|[!?]+|(?<!\d)\.(?!\d))\s*/u
      )
      .map((segment) => segment.trim())
      .filter(Boolean)
  );
}

function hasMultilingualKfaGovernanceEvidence(
  title: string,
  summary: string
): boolean {
  return splitYouTubeEvidenceSegments(title, summary).some((segment) => {
    const hasFullAnchor = YOUTUBE_MULTILINGUAL_KFA_ANCHOR_PATTERN.test(segment);
    const hasGuardedStyAnchor =
      /\bSTY\b/iu.test(segment) &&
      /\bKFA\b/iu.test(segment) &&
      YOUTUBE_STY_FOOTBALL_CORROBORATOR_PATTERN.test(segment);

    return (
      (hasFullAnchor || hasGuardedStyAnchor) &&
      YOUTUBE_MULTILINGUAL_GOVERNANCE_PATTERN.test(segment)
    );
  });
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function getYouTubeBackfillDays(
  value = process.env.YOUTUBE_BACKFILL_DAYS
): number {
  return parseBoundedInteger(value, DEFAULT_YOUTUBE_BACKFILL_DAYS, 1, 3650);
}

export function getYouTubeMaxPagesPerQuery(
  value = process.env.YOUTUBE_MAX_PAGES_PER_QUERY
): number {
  return parseBoundedInteger(value, DEFAULT_YOUTUBE_MAX_PAGES_PER_QUERY, 1, 5);
}

export function getYouTubeMaxPagesPerChannel(
  value = process.env.YOUTUBE_MAX_PAGES_PER_CHANNEL
): number {
  return parseBoundedInteger(value, DEFAULT_YOUTUBE_MAX_PAGES_PER_CHANNEL, 1, 20);
}

function parseOptionalDate(value: string | undefined, label: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${label} must be an ISO-8601 date`);
  }
  return parsed;
}

export function getYouTubeCollectionWindow({
  now = new Date(),
  lastCollectedAt,
  backfillDays = getYouTubeBackfillDays(),
  explicitAfter = process.env.YOUTUBE_PUBLISHED_AFTER,
  explicitBefore = process.env.YOUTUBE_PUBLISHED_BEFORE
}: {
  now?: Date;
  lastCollectedAt?: string;
  backfillDays?: number;
  explicitAfter?: string;
  explicitBefore?: string;
} = {}): { publishedAfter: string; publishedBefore: string } {
  const explicitAfterDate = parseOptionalDate(explicitAfter, "YOUTUBE_PUBLISHED_AFTER");
  const explicitBeforeDate = parseOptionalDate(explicitBefore, "YOUTUBE_PUBLISHED_BEFORE");
  const fallbackAfter = new Date(now.getTime() - backfillDays * 24 * 60 * 60 * 1000);
  const previousCollection = lastCollectedAt ? new Date(lastCollectedAt) : undefined;
  const overlappingAfter =
    previousCollection && Number.isFinite(previousCollection.getTime())
      ? new Date(previousCollection.getTime() - YOUTUBE_COLLECTION_OVERLAP_MS)
      : fallbackAfter;
  const publishedAfter = explicitAfterDate ?? overlappingAfter;
  const publishedBefore = explicitBeforeDate ?? now;

  if (publishedAfter.getTime() >= publishedBefore.getTime()) {
    throw new Error("YouTube collection start must be earlier than its end");
  }

  return {
    publishedAfter: publishedAfter.toISOString(),
    publishedBefore: publishedBefore.toISOString()
  };
}

export function parseYouTubeDuration(value: string): number {
  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );
  if (!match) return 0;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Math.round(
    Number(days) * 86400 +
      Number(hours) * 3600 +
      Number(minutes) * 60 +
      Number(seconds)
  );
}

function chooseThumbnail(thumbnails: z.infer<typeof snippetSchema>["thumbnails"]) {
  const entries = Object.entries(thumbnails);
  const preferred = ["maxres", "standard", "high", "medium", "default"]
    .map((key) => entries.find(([candidate]) => candidate === key))
    .find((entry) => entry !== undefined);
  const [, thumbnail] =
    preferred ??
    entries.sort(
      ([, left], [, right]) =>
        (right.width ?? 0) * (right.height ?? 0) -
        (left.width ?? 0) * (left.height ?? 0)
    )[0] ??
    [];

  if (!thumbnail) return undefined;
  return {
    url: thumbnail.url,
    width: thumbnail.width ?? 480,
    height: thumbnail.height ?? 360
  };
}

async function fetchYouTubeJson<TSchema extends z.ZodTypeAny>({
  url,
  label,
  schema,
  fetchImpl
}: {
  url: URL;
  label: string;
  schema: TSchema;
  fetchImpl: FetchLike;
}): Promise<z.output<TSchema>> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}`);
  }
  return schema.parse(await response.json()) as z.output<TSchema>;
}

function buildSearchUrl({
  apiKey,
  query,
  publishedAfter,
  publishedBefore,
  pageToken
}: {
  apiKey: string;
  query: string;
  publishedAfter: string;
  publishedBefore: string;
  pageToken?: string;
}): URL {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/search`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "date");
  url.searchParams.set("publishedAfter", publishedAfter);
  url.searchParams.set("publishedBefore", publishedBefore);
  url.searchParams.set("maxResults", String(YOUTUBE_RESULTS_PER_PAGE));
  url.searchParams.set("regionCode", "KR");
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("safeSearch", "moderate");
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url;
}

function buildVideoListUrl(apiKey: string, videoIds: readonly string[]): URL {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/videos`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,contentDetails,status,liveStreamingDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("maxResults", String(videoIds.length));
  return url;
}

function buildChannelListUrl(apiKey: string, channelIds: readonly string[]): URL {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/channels`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("id", channelIds.join(","));
  url.searchParams.set("maxResults", String(channelIds.length));
  return url;
}

function buildPlaylistItemsUrl({
  apiKey,
  playlistId,
  pageToken
}: {
  apiKey: string;
  playlistId: string;
  pageToken?: string;
}): URL {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/playlistItems`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "contentDetails,status");
  url.searchParams.set("playlistId", playlistId);
  url.searchParams.set("maxResults", String(YOUTUBE_RESULTS_PER_PAGE));
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function observeVideo(
  observations: Map<string, SearchObservation>,
  videoId: string,
  discoveryQuery: string
): void {
  const previous = observations.get(videoId);
  if (previous) {
    previous.discoveryQueries.add(discoveryQuery);
    return;
  }
  observations.set(videoId, {
    videoId,
    discoveryQueries: new Set([discoveryQuery])
  });
}

function classifyYouTubeItem({
  title,
  summary,
  tags,
  issues,
  people
}: {
  title: string;
  summary: string;
  tags?: string[];
  issues: Issue[];
  people: Person[];
}): {
  classification: ReturnType<typeof classifyItemText>;
  contentRelevanceTier: RelevanceTier | "reject";
} {
  const visibleTextClassification = classifyItemText({
    title,
    summary,
    issues,
    people,
    isOfficial: false
  });
  const visibleTextTier = getNewsCandidateRelevanceTier({
    title,
    summary,
    classification: visibleTextClassification
  });
  const classification = classifyItemText({
    title,
    summary,
    tags,
    issues,
    people,
    isOfficial: false
  });
  const relevanceTier = getNewsCandidateRelevanceTier({
    title,
    // The tier gate must see the same text the classifier scored, or a
    // tag-derived match gets discarded by a gate that never saw the tags.
    summary: joinSummaryAndTags(summary, tags),
    classification
  });
  const hasExactKfaTag = (tags ?? []).some((tag) =>
    /^(?:대한\s*축구협회|KFA)$/iu.test(tag.trim())
  );
  const hasNewIssueFromTags = classification.issueTags.some(
    (issueId) => !visibleTextClassification.issueTags.includes(issueId)
  );
  const canTagsRescueRejectedText =
    hasExactKfaTag &&
    hasNewIssueFromTags &&
    !YOUTUBE_TAG_RESCUE_EXCLUSION_PATTERN.test(`${title} ${summary}`) &&
    (YOUTUBE_TAG_RESCUE_CONTEXT_PATTERN.test(`${title} ${summary}`) ||
      (!hasLocalFootballAssociationContext(`${title} ${summary}`) &&
        YOUTUBE_ASSOCIATION_GOVERNANCE_RESCUE_PATTERN.test(
          `${title} ${summary}`
        )));
  if (visibleTextTier !== "reject") {
    return {
      // Once visible text has semantic evidence of its own, tags cannot replace
      // or broaden that meaning.
      classification: visibleTextClassification,
      contentRelevanceTier: visibleTextTier
    };
  }

  if (hasMultilingualKfaGovernanceEvidence(title, summary)) {
    return {
      classification: {
        ...visibleTextClassification,
        matchedKeywords: Array.from(
          new Set([...visibleTextClassification.matchedKeywords, "KFA"])
        ),
        relevanceScore: Math.max(
          visibleTextClassification.relevanceScore,
          /\bKFA\b/iu.test(title) ? 20 : 6
        )
      },
      contentRelevanceTier: "secondary"
    };
  }

  const guardedRelevanceTier = canTagsRescueRejectedText
    ? relevanceTier
    : "reject";
  // Tags are publisher-controlled metadata and may be channel-wide SEO
  // boilerplate. They may preserve a specifically evidenced governance video,
  // but never make rejected visible text a primary item.
  const contentRelevanceTier: RelevanceTier | "reject" =
    guardedRelevanceTier === "reject" ? "reject" : "secondary";
  return { classification, contentRelevanceTier };
}

export function reclassifyAndFilterYouTubeItemsForCollection({
  items,
  issues,
  people,
  channelPolicy = EMPTY_YOUTUBE_CHANNEL_POLICY
}: {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
  channelPolicy?: YouTubeChannelPolicyFile;
}): RadarItem[] {
  return items.flatMap((item) => {
    if (item.sourceType !== "youtube") return [item];
    if (!item.youtube) return [];
    const channelStatus = getVisibleYouTubeChannelStatus(
      channelPolicy,
      item.youtube.channelId
    );
    if (!channelStatus) return [];
    const { classification, contentRelevanceTier } = classifyYouTubeItem({
      title: item.title,
      summary: item.summary,
      tags: item.youtube.tags,
      issues,
      people
    });
    if (contentRelevanceTier === "reject") return [];
    const effectiveTier = getEffectiveYouTubeTier({
      channelStatus,
      contentRelevanceTier
    });
    if (effectiveTier === "reject") return [];
    return [
      {
        ...item,
        matchedKeywords: classification.matchedKeywords,
        issueTags: classification.issueTags,
        personTags: classification.personTags,
        relevanceScore: classification.relevanceScore,
        relevanceTier: effectiveTier === "secondary" ? "secondary" : undefined,
        youtube: {
          ...item.youtube,
          channelStatus,
          contentRelevanceTier
        },
        labels: classification.labels
      }
    ];
  });
}

export type YouTubeCollectorRunResult = CollectorRunResult & {
  formatCache: YouTubeFormatCacheFile;
  shortsExcluded: number;
  unknownFormats: number;
  redirectProbeHealthy: boolean;
};

export async function collectYouTubeRun({
  issues,
  people,
  queries,
  channelPolicy = EMPTY_YOUTUBE_CHANNEL_POLICY,
  formatCache = { version: 1, entries: {} },
  now = new Date(),
  lastCollectedAt,
  apiKey = process.env.YOUTUBE_API_KEY,
  fetchImpl = fetch,
  shortsFetchImpl = fetch,
  redirectProbeEnabled = process.env.YOUTUBE_SHORTS_REDIRECT_PROBE !== "false",
  maxPagesPerQuery = getYouTubeMaxPagesPerQuery(),
  maxPagesPerChannel = getYouTubeMaxPagesPerChannel(),
  publishedAfter,
  publishedBefore
}: {
  issues: Issue[];
  people: Person[];
  queries: YouTubeSearchQuery[];
  channelPolicy?: YouTubeChannelPolicyFile;
  formatCache?: YouTubeFormatCacheFile;
  now?: Date;
  lastCollectedAt?: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  shortsFetchImpl?: YouTubeShortsProbeFetch;
  redirectProbeEnabled?: boolean;
  maxPagesPerQuery?: number;
  maxPagesPerChannel?: number;
  publishedAfter?: string;
  publishedBefore?: string;
}): Promise<YouTubeCollectorRunResult> {
  if (!apiKey) {
    return {
      items: [],
      attempted: 1,
      succeeded: 0,
      failed: 1,
      formatCache,
      shortsExcluded: 0,
      unknownFormats: 0,
      redirectProbeHealthy: true
    };
  }

  const window =
    publishedAfter && publishedBefore
      ? { publishedAfter, publishedBefore }
      : getYouTubeCollectionWindow({ now, lastCollectedAt });
  const activeQueries = queries.filter((query) => query.enabled).slice(0, MAX_YOUTUBE_SEARCH_QUERIES);
  const preferredChannelIds = getPreferredYouTubeChannelIds(channelPolicy);
  const blockedChannelIds = getBlockedYouTubeChannelIds(channelPolicy);
  const observations = new Map<string, SearchObservation>();
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  const uploadsPlaylists = new Map<string, string>();
  for (const channelIds of chunk(preferredChannelIds, YOUTUBE_VIDEO_BATCH_SIZE)) {
    attempted += 1;
    try {
      const response = await fetchYouTubeJson({
        url: buildChannelListUrl(
          apiKey,
          channelIds
        ),
        label: "YouTube preferred channels",
        schema: channelListResponseSchema,
        fetchImpl
      });
      succeeded += 1;
      for (const channel of response.items) {
        uploadsPlaylists.set(
          channel.id,
          channel.contentDetails.relatedPlaylists.uploads
        );
      }
    } catch (error) {
      failed += 1;
      console.error(error instanceof Error ? error.message : error);
    }
  }

  const publishedAfterTimestamp = Date.parse(window.publishedAfter);
  const publishedBeforeTimestamp = Date.parse(window.publishedBefore);
  for (const channelId of preferredChannelIds) {
    const playlistId = uploadsPlaylists.get(channelId);
    if (!playlistId) continue;
    let pageToken: string | undefined;
    for (let page = 0; page < maxPagesPerChannel; page += 1) {
      attempted += 1;
      try {
        const response = await fetchYouTubeJson({
          url: buildPlaylistItemsUrl({ apiKey, playlistId, pageToken }),
          label: `YouTube uploads "${channelId}"`,
          schema: playlistItemsResponseSchema,
          fetchImpl
        });
        succeeded += 1;
        let reachedWindowStart = false;
        for (const item of response.items) {
          const publishedAt = item.contentDetails.videoPublishedAt;
          if (!publishedAt) continue;
          const publishedTimestamp = Date.parse(publishedAt);
          if (publishedTimestamp < publishedAfterTimestamp) {
            reachedWindowStart = true;
            continue;
          }
          if (
            publishedTimestamp >= publishedBeforeTimestamp ||
            (item.status?.privacyStatus && item.status.privacyStatus !== "public")
          ) {
            continue;
          }
          observeVideo(
            observations,
            item.contentDetails.videoId,
            `channel:${channelId}`
          );
        }
        pageToken = response.nextPageToken;
        if (reachedWindowStart || !pageToken) break;
      } catch (error) {
        failed += 1;
        console.error(error instanceof Error ? error.message : error);
        break;
      }
    }
  }

  for (const query of activeQueries) {
    let pageToken: string | undefined;
    for (let page = 0; page < maxPagesPerQuery; page += 1) {
      attempted += 1;
      try {
        const response = await fetchYouTubeJson({
          url: buildSearchUrl({
            apiKey,
            query: query.query,
            publishedAfter: window.publishedAfter,
            publishedBefore: window.publishedBefore,
            pageToken
          }),
          label: `YouTube search "${query.id}"`,
          schema: searchResponseSchema,
          fetchImpl
        });
        succeeded += 1;
        for (const result of response.items) {
          if (blockedChannelIds.has(result.snippet.channelId)) continue;
          if (result.snippet.liveBroadcastContent && result.snippet.liveBroadcastContent !== "none") {
            continue;
          }
          observeVideo(observations, result.id.videoId, query.query);
        }
        pageToken = response.nextPageToken;
        if (!pageToken) break;
      } catch (error) {
        failed += 1;
        console.error(error instanceof Error ? error.message : error);
        break;
      }
    }
  }

  const detailItems: z.infer<typeof videoListResponseSchema>["items"] = [];
  for (const videoIds of chunk([...observations.keys()], YOUTUBE_VIDEO_BATCH_SIZE)) {
    attempted += 1;
    try {
      const response = await fetchYouTubeJson({
        url: buildVideoListUrl(apiKey, videoIds),
        label: "YouTube video details",
        schema: videoListResponseSchema,
        fetchImpl
      });
      succeeded += 1;
      detailItems.push(...response.items);
    } catch (error) {
      failed += 1;
      console.error(error instanceof Error ? error.message : error);
    }
  }

  const retentionDays = getItemRetentionDays();
  const collectedAt = now.toISOString();
  const redirectProbeHealthy = redirectProbeEnabled
    ? await isYouTubeShortsProbeHealthy({ cache: formatCache, fetchImpl: shortsFetchImpl })
    : true;
  if (redirectProbeEnabled && !redirectProbeHealthy) {
    console.error(
      "YouTube Shorts redirect probe canaries changed; keeping ambiguous videos"
    );
  }

  let shortsExcluded = 0;
  let unknownFormats = 0;
  const items: RadarItem[] = [];
  for (const videos of chunk(detailItems, YOUTUBE_SHORTS_PROBE_CONCURRENCY)) {
    const processed = await Promise.all(
      videos.map(async (video): Promise<RadarItem | undefined> => {
        const observation = observations.get(video.id);
        const thumbnail = chooseThumbnail(video.snippet.thumbnails);
        if (!observation || !thumbnail) return undefined;
        if (
          video.snippet.liveBroadcastContent &&
          video.snippet.liveBroadcastContent !== "none"
        ) {
          return undefined;
        }
        if (video.liveStreamingDetails) return undefined;
        if (
          video.status?.privacyStatus &&
          video.status.privacyStatus !== "public"
        ) {
          return undefined;
        }
        if (
          video.status?.uploadStatus &&
          video.status.uploadStatus !== "processed"
        ) {
          return undefined;
        }
        if (
          !isPublishedAtWithinRetention({
            publishedAt: video.snippet.publishedAt,
            now,
            retentionDays
          })
        ) {
          return undefined;
        }

        const channelStatus = getVisibleYouTubeChannelStatus(
          channelPolicy,
          video.snippet.channelId
        );
        if (!channelStatus) return undefined;

        const title = stripInlineHtml(video.snippet.title);
        const summary = truncateSummary(video.snippet.description, 400);
        const tags = video.snippet.tags
          .map((tag) => stripInlineHtml(tag).trim())
          .filter((tag) => tag.length > 0);
        const { classification, contentRelevanceTier } = classifyYouTubeItem({
          title,
          summary,
          tags,
          issues,
          people
        });
        if (contentRelevanceTier === "reject") return undefined;

        const format = await classifyYouTubeVideoFormat({
          videoId: video.id,
          durationSeconds: parseYouTubeDuration(video.contentDetails.duration),
          title,
          description: video.snippet.description,
          tags: video.snippet.tags,
          cache: formatCache,
          redirectProbeEnabled: redirectProbeEnabled && redirectProbeHealthy,
          fetchImpl: shortsFetchImpl,
          now
        });
        if (format === "shorts") {
          shortsExcluded += 1;
          return undefined;
        }
        if (format === "unknown") unknownFormats += 1;

        const effectiveTier = getEffectiveYouTubeTier({
          channelStatus,
          contentRelevanceTier
        });
        if (effectiveTier === "reject") return undefined;

        const url = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
        return {
          id: `youtube_${video.id}`,
          type: "youtube",
          title,
          summary,
          url,
          originalUrl: url,
          publisher: stripInlineHtml(video.snippet.channelTitle),
          publishedAt: video.snippet.publishedAt,
          collectedAt,
          matchedKeywords: classification.matchedKeywords,
          discoveryQueries: [...observation.discoveryQueries].sort((left, right) =>
            left.localeCompare(right, "ko-KR")
          ),
          issueTags: classification.issueTags,
          personTags: classification.personTags,
          sourceType: "youtube",
          isOfficial: false,
          relevanceScore: classification.relevanceScore,
          relevanceTier: effectiveTier === "secondary" ? "secondary" : undefined,
          labels: classification.labels,
          youtube: {
            videoId: video.id,
            channelId: video.snippet.channelId,
            channelStatus,
            contentRelevanceTier,
            ...(tags.length > 0 ? { tags } : {}),
            thumbnail,
            durationSeconds: parseYouTubeDuration(video.contentDetails.duration)
          }
        };
      })
    );
    items.push(...processed.filter((item) => item !== undefined));
  }

  return {
    items: dedupeItems(items),
    attempted,
    succeeded,
    failed,
    formatCache,
    shortsExcluded,
    unknownFormats,
    redirectProbeHealthy
  };
}

async function run(): Promise<void> {
  const [
    existingItems,
    issues,
    people,
    queries,
    channelPolicy,
    formatCache,
    collectionState
  ] = await Promise.all([
      readItems(),
      readIssues(),
      readPeople(),
      readYouTubeSearchQueries(),
      readYouTubeChannelPolicy(),
      readYouTubeFormatCache(),
      readCollectionState()
    ]);
  const previousYouTubeState = collectionState.collectors?.youtube;
  const result = await collectYouTubeRun({
    issues,
    people,
    queries,
    channelPolicy,
    formatCache,
    lastCollectedAt:
      previousYouTubeState?.lastRunStatus === "never"
        ? undefined
        : previousYouTubeState?.lastCollectedAt
  });
  const update = await persistCollectionRun({
    existingItems,
    results: [result],
    collectorResults: [{ id: "youtube", result }],
    filterItems: (items) =>
      reclassifyAndFilterYouTubeItemsForCollection({
        items,
        issues,
        people,
        channelPolicy
      })
  });
  await writeYouTubeFormatCache(result.formatCache);

  console.log(
    `YouTube collector merged ${result.items.length} videos, excluded ${result.shortsExcluded} Shorts, kept ${result.unknownFormats} unknown formats (${result.succeeded}/${result.attempted} API calls succeeded, redirect probe ${result.redirectProbeHealthy ? "healthy" : "disabled"}, status ${update.state.lastRunStatus})`
  );
  if (update.state.lastRunStatus === "failed") {
    throw new Error("YouTube collector did not complete any API call");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
