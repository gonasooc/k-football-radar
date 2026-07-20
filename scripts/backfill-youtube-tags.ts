import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import type {
  Issue,
  Person,
  RadarItem,
  YouTubeChannelPolicyFile
} from "../lib/schema";
import { buildStoryClusters } from "../lib/story-clusters";
import { reclassifyAndFilterYouTubeItemsForCollection } from "./collect-youtube";
import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readStoryClusters,
  readYouTubeChannelPolicy,
  writeCollectionState,
  writeItems,
  writeStoryClusters
} from "./data-io";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_VIDEO_BATCH_SIZE = 50;

const videoTagsResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        snippet: z.object({ tags: z.array(z.string()).default([]) })
      })
    )
    .default([])
});

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type YouTubeTagBackfillReport = {
  generatedAt: string;
  videosRequested: number;
  videosResolved: number;
  videosMissing: string[];
  itemsTagged: number;
  itemsWithoutTags: number;
  itemsPromoted: string[];
  itemsDemoted: string[];
  itemsRemoved: string[];
  attempted: number;
  succeeded: number;
  failed: number;
};

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function buildVideoTagsUrl(apiKey: string, videoIds: readonly string[]): URL {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/videos`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("maxResults", String(videoIds.length));
  return url;
}

function effectiveTier(item: RadarItem): "primary" | "secondary" {
  return item.relevanceTier === "secondary" ? "secondary" : "primary";
}

export async function backfillYouTubeTags({
  items,
  issues,
  people,
  channelPolicy,
  apiKey = process.env.YOUTUBE_API_KEY,
  fetchImpl = fetch,
  onlyMissing = true,
  now = new Date()
}: {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
  channelPolicy: YouTubeChannelPolicyFile;
  apiKey?: string;
  fetchImpl?: FetchLike;
  onlyMissing?: boolean;
  now?: Date;
}): Promise<{ items: RadarItem[]; report: YouTubeTagBackfillReport }> {
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is required to backfill video tags");
  }

  const targets = items.filter(
    (item) =>
      item.sourceType === "youtube" &&
      item.youtube !== undefined &&
      (!onlyMissing || item.youtube.tags === undefined)
  );
  const videoIds = targets.map((item) => item.youtube?.videoId ?? "").filter(Boolean);
  const requestedVideoIds = new Set(videoIds);
  const tagsByVideoId = new Map<string, string[]>();
  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const batch of chunk(videoIds, YOUTUBE_VIDEO_BATCH_SIZE)) {
    attempted += 1;
    try {
      const response = await fetchImpl(buildVideoTagsUrl(apiKey, batch), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        throw new Error(`YouTube video tags failed with ${response.status}`);
      }
      const parsed = videoTagsResponseSchema.parse(await response.json());
      succeeded += 1;
      for (const video of parsed.items) {
        tagsByVideoId.set(
          video.id,
          video.snippet.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
        );
      }
    } catch (error) {
      failed += 1;
      console.error(error instanceof Error ? error.message : error);
    }
  }

  if (attempted > 0 && succeeded === 0) {
    throw new Error("YouTube tag backfill did not complete any API call");
  }

  let itemsTagged = 0;
  let itemsWithoutTags = 0;
  const videosMissing: string[] = [];
  const tagged = items.map((item): RadarItem => {
    if (item.sourceType !== "youtube" || !item.youtube) return item;
    const resolved = tagsByVideoId.get(item.youtube.videoId);
    if (!resolved) {
      // Only report videos we actually asked about; an untouched item in a
      // `--only-missing` run is not missing upstream.
      if (requestedVideoIds.has(item.youtube.videoId)) {
        videosMissing.push(item.youtube.videoId);
      }
      return item;
    }
    if (resolved.length === 0) {
      itemsWithoutTags += 1;
      return item;
    }
    itemsTagged += 1;
    return { ...item, youtube: { ...item.youtube, tags: resolved } };
  });

  const previousById = new Map(items.map((item) => [item.id, item]));
  const reclassified = reclassifyAndFilterYouTubeItemsForCollection({
    items: tagged,
    issues,
    people,
    channelPolicy
  });
  const reclassifiedIds = new Set(reclassified.map((item) => item.id));
  const itemsRemoved = tagged
    .filter((item) => item.sourceType === "youtube" && !reclassifiedIds.has(item.id))
    .map((item) => item.id)
    .sort();
  const itemsPromoted: string[] = [];
  const itemsDemoted: string[] = [];
  for (const item of reclassified) {
    if (item.sourceType !== "youtube") continue;
    const previous = previousById.get(item.id);
    if (!previous) continue;
    const before = effectiveTier(previous);
    const after = effectiveTier(item);
    if (before === after) continue;
    (after === "primary" ? itemsPromoted : itemsDemoted).push(item.id);
  }

  return {
    items: reclassified,
    report: {
      generatedAt: now.toISOString(),
      videosRequested: videoIds.length,
      videosResolved: tagsByVideoId.size,
      videosMissing: videosMissing.sort(),
      itemsTagged,
      itemsWithoutTags,
      itemsPromoted: itemsPromoted.sort(),
      itemsDemoted: itemsDemoted.sort(),
      itemsRemoved,
      attempted,
      succeeded,
      failed
    }
  };
}

async function writeReport(
  report: YouTubeTagBackfillReport,
  mode: "dry-run" | "apply"
): Promise<string> {
  const reportPath = path.join(
    process.cwd(),
    "reports",
    `youtube-tag-backfill-${mode}.json`
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--confirm")) {
    throw new Error("Applying the YouTube tag backfill requires --confirm");
  }

  const [items, issues, people, channelPolicy, collectionState, storyClusters] =
    await Promise.all([
      readItems(),
      readIssues(),
      readPeople(),
      readYouTubeChannelPolicy(),
      readCollectionState(),
      readStoryClusters()
    ]);
  const result = await backfillYouTubeTags({
    items,
    issues,
    people,
    channelPolicy,
    onlyMissing: !process.argv.includes("--all")
  });
  const reportPath = await writeReport(result.report, apply ? "apply" : "dry-run");
  const summary = `YouTube tag backfill ${apply ? "apply" : "dry-run"}: ${result.report.itemsTagged} tagged, ${result.report.itemsWithoutTags} without tags, ${result.report.videosMissing.length} missing upstream, ${result.report.itemsPromoted.length} promoted, ${result.report.itemsDemoted.length} demoted, ${result.report.itemsRemoved.length} removed (${result.report.succeeded}/${result.report.attempted} API calls succeeded); report ${path.relative(process.cwd(), reportPath)}`;
  if (!apply) {
    console.log(summary);
    return;
  }

  const youtubeTotal = result.items.filter(
    (item) => item.sourceType === "youtube"
  ).length;
  const nextCollectionState = {
    ...collectionState,
    totalItems: result.items.length,
    ...(collectionState.collectors?.youtube
      ? {
          collectors: {
            ...collectionState.collectors,
            youtube: {
              ...collectionState.collectors.youtube,
              totalItems: youtubeTotal
            }
          }
        }
      : {})
  };

  try {
    await writeItems(result.items);
    await writeStoryClusters(buildStoryClusters(result.items));
    await writeCollectionState(nextCollectionState);
  } catch (error) {
    await writeItems(items).catch(() => undefined);
    await writeStoryClusters(storyClusters).catch(() => undefined);
    await writeCollectionState(collectionState).catch(() => undefined);
    throw error;
  }
  console.log(summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
