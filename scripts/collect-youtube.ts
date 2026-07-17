import { pathToFileURL } from "node:url";

import { z } from "zod";

import { classifyItemText } from "../lib/classify";
import { dedupeItems } from "../lib/dedupe";
import { getItemRetentionDays, isPublishedAtWithinRetention } from "../lib/item-retention";
import { stripInlineHtml, truncateSummary } from "../lib/normalize";
import type { Issue, Person, RadarItem, YouTubeSearchQuery } from "../lib/schema";
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
  readYouTubeSearchQueries
} from "./data-io";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_RESULTS_PER_PAGE = 50;
const YOUTUBE_VIDEO_BATCH_SIZE = 50;
const YOUTUBE_COLLECTION_OVERLAP_MS = 24 * 60 * 60 * 1000;
const DEFAULT_YOUTUBE_BACKFILL_DAYS = 90;
const DEFAULT_YOUTUBE_MAX_PAGES_PER_QUERY = 2;
const MAX_YOUTUBE_SEARCH_QUERIES = 15;

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

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type SearchObservation = {
  videoId: string;
  discoveryQueries: Set<string>;
};

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

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function classifyYouTubeItem({
  title,
  summary,
  issues,
  people
}: {
  title: string;
  summary: string;
  issues: Issue[];
  people: Person[];
}) {
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
  return { classification, relevanceTier };
}

export function reclassifyAndFilterYouTubeItemsForCollection({
  items,
  issues,
  people
}: {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
}): RadarItem[] {
  return items.flatMap((item) => {
    if (item.sourceType !== "youtube") return [item];
    const { classification, relevanceTier } = classifyYouTubeItem({
      title: item.title,
      summary: item.summary,
      issues,
      people
    });
    if (relevanceTier === "reject") return [];
    return [
      {
        ...item,
        matchedKeywords: classification.matchedKeywords,
        issueTags: classification.issueTags,
        personTags: classification.personTags,
        relevanceScore: classification.relevanceScore,
        relevanceTier: relevanceTier === "secondary" ? "secondary" : undefined,
        labels: classification.labels
      }
    ];
  });
}

export async function collectYouTubeRun({
  issues,
  people,
  queries,
  now = new Date(),
  lastCollectedAt,
  apiKey = process.env.YOUTUBE_API_KEY,
  fetchImpl = fetch,
  maxPagesPerQuery = getYouTubeMaxPagesPerQuery(),
  publishedAfter,
  publishedBefore
}: {
  issues: Issue[];
  people: Person[];
  queries: YouTubeSearchQuery[];
  now?: Date;
  lastCollectedAt?: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
  maxPagesPerQuery?: number;
  publishedAfter?: string;
  publishedBefore?: string;
}): Promise<CollectorRunResult> {
  if (!apiKey) return { items: [], attempted: 1, succeeded: 0, failed: 1 };

  const window =
    publishedAfter && publishedBefore
      ? { publishedAfter, publishedBefore }
      : getYouTubeCollectionWindow({ now, lastCollectedAt });
  const activeQueries = queries.filter((query) => query.enabled).slice(0, MAX_YOUTUBE_SEARCH_QUERIES);
  const observations = new Map<string, SearchObservation>();
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

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
          if (result.snippet.liveBroadcastContent && result.snippet.liveBroadcastContent !== "none") {
            continue;
          }
          const previous = observations.get(result.id.videoId);
          if (previous) {
            previous.discoveryQueries.add(query.query);
          } else {
            observations.set(result.id.videoId, {
              videoId: result.id.videoId,
              discoveryQueries: new Set([query.query])
            });
          }
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
  const items = detailItems.flatMap((video): RadarItem[] => {
    const observation = observations.get(video.id);
    const thumbnail = chooseThumbnail(video.snippet.thumbnails);
    if (!observation || !thumbnail) return [];
    if (video.snippet.liveBroadcastContent && video.snippet.liveBroadcastContent !== "none") return [];
    if (video.liveStreamingDetails) return [];
    if (video.status?.privacyStatus && video.status.privacyStatus !== "public") return [];
    if (video.status?.uploadStatus && video.status.uploadStatus !== "processed") return [];
    if (
      !isPublishedAtWithinRetention({
        publishedAt: video.snippet.publishedAt,
        now,
        retentionDays
      })
    ) {
      return [];
    }

    const title = stripInlineHtml(video.snippet.title);
    const summary = truncateSummary(video.snippet.description, 400);
    const { classification, relevanceTier } = classifyYouTubeItem({
      title,
      summary,
      issues,
      people
    });
    if (relevanceTier === "reject") return [];

    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    return [
      {
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
        relevanceTier: relevanceTier === "secondary" ? "secondary" : undefined,
        labels: classification.labels,
        youtube: {
          videoId: video.id,
          channelId: video.snippet.channelId,
          thumbnail,
          durationSeconds: parseYouTubeDuration(video.contentDetails.duration)
        }
      }
    ];
  });

  return { items: dedupeItems(items), attempted, succeeded, failed };
}

async function run(): Promise<void> {
  const [existingItems, issues, people, queries, collectionState] = await Promise.all([
    readItems(),
    readIssues(),
    readPeople(),
    readYouTubeSearchQueries(),
    readCollectionState()
  ]);
  const previousYouTubeState = collectionState.collectors?.youtube;
  const result = await collectYouTubeRun({
    issues,
    people,
    queries,
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
      reclassifyAndFilterYouTubeItemsForCollection({ items, issues, people })
  });

  console.log(
    `YouTube collector merged ${result.items.length} videos (${result.succeeded}/${result.attempted} API calls succeeded, status ${update.state.lastRunStatus})`
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
