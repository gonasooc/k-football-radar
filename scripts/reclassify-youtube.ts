import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildStoryClusters } from "../lib/story-clusters";
import type {
  Issue,
  Person,
  RadarItem,
  YouTubeChannelPolicyFile,
  YouTubeFormatCacheFile
} from "../lib/schema";
import { getYouTubeChannelStatus } from "../lib/youtube-channel-policy";
import {
  classifyYouTubeVideoFormat,
  isYouTubeShortsProbeHealthy,
  type YouTubeShortsProbeFetch
} from "../lib/youtube-shorts";
import { reclassifyAndFilterYouTubeItemsForCollection } from "./collect-youtube";
import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readStoryClusters,
  readYouTubeChannelPolicy,
  readYouTubeFormatCache,
  writeCollectionState,
  writeItems,
  writeStoryClusters,
  writeYouTubeFormatCache
} from "./data-io";

const SHORTS_PROBE_CONCURRENCY = 4;

export type YouTubeReclassificationReport = {
  generatedAt: string;
  beforeVideos: number;
  afterVideos: number;
  removedShorts: string[];
  removedBlocked: string[];
  removedContentRejects: string[];
  unknownFormats: string[];
  preferredPrimary: number;
  secondary: number;
  redirectProbeHealthy: boolean;
};

export async function reclassifyExistingYouTubeItems({
  items,
  issues,
  people,
  channelPolicy,
  formatCache,
  shortsFetchImpl = fetch,
  redirectProbeEnabled = true,
  now = new Date()
}: {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
  channelPolicy: YouTubeChannelPolicyFile;
  formatCache: YouTubeFormatCacheFile;
  shortsFetchImpl?: YouTubeShortsProbeFetch;
  redirectProbeEnabled?: boolean;
  now?: Date;
}): Promise<{
  items: RadarItem[];
  formatCache: YouTubeFormatCacheFile;
  report: YouTubeReclassificationReport;
}> {
  const redirectProbeHealthy = redirectProbeEnabled
    ? await isYouTubeShortsProbeHealthy({ cache: formatCache, fetchImpl: shortsFetchImpl })
    : true;
  const keptItems: RadarItem[] = [];
  const removedShorts: string[] = [];
  const removedBlocked: string[] = [];
  const unknownFormats: string[] = [];
  const youtubeItems = items.filter(
    (item) => item.sourceType === "youtube" && item.youtube
  );
  const nonYouTubeItems = items.filter((item) => item.sourceType !== "youtube");

  for (let index = 0; index < youtubeItems.length; index += SHORTS_PROBE_CONCURRENCY) {
    const batch = youtubeItems.slice(index, index + SHORTS_PROBE_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (item): Promise<RadarItem | undefined> => {
        if (!item.youtube) return undefined;
        if (
          getYouTubeChannelStatus(channelPolicy, item.youtube.channelId) ===
          "blocked"
        ) {
          removedBlocked.push(item.id);
          return undefined;
        }

        const format = await classifyYouTubeVideoFormat({
          videoId: item.youtube.videoId,
          durationSeconds: item.youtube.durationSeconds,
          title: item.title,
          description: item.summary,
          cache: formatCache,
          redirectProbeEnabled: redirectProbeEnabled && redirectProbeHealthy,
          fetchImpl: shortsFetchImpl,
          now
        });
        if (format === "shorts") {
          removedShorts.push(item.id);
          return undefined;
        }
        if (format === "unknown") unknownFormats.push(item.id);
        return item;
      })
    );
    keptItems.push(...results.filter((item) => item !== undefined));
  }

  const reclassified = reclassifyAndFilterYouTubeItemsForCollection({
    items: [...nonYouTubeItems, ...keptItems],
    issues,
    people,
    channelPolicy
  });
  const reclassifiedIds = new Set(reclassified.map((item) => item.id));
  const removedContentRejects = keptItems
    .filter((item) => !reclassifiedIds.has(item.id))
    .map((item) => item.id);
  const finalYouTubeItems = reclassified.filter(
    (item) => item.sourceType === "youtube"
  );

  return {
    items: reclassified,
    formatCache,
    report: {
      generatedAt: now.toISOString(),
      beforeVideos: youtubeItems.length,
      afterVideos: finalYouTubeItems.length,
      removedShorts: removedShorts.sort(),
      removedBlocked: removedBlocked.sort(),
      removedContentRejects: removedContentRejects.sort(),
      unknownFormats: unknownFormats.sort(),
      preferredPrimary: finalYouTubeItems.filter(
        (item) => item.relevanceTier !== "secondary"
      ).length,
      secondary: finalYouTubeItems.filter(
        (item) => item.relevanceTier === "secondary"
      ).length,
      redirectProbeHealthy
    }
  };
}

async function writeReport(
  report: YouTubeReclassificationReport,
  mode: "dry-run" | "apply"
): Promise<string> {
  const reportPath = path.join(
    process.cwd(),
    "reports",
    `youtube-reclassification-${mode}.json`
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--confirm")) {
    throw new Error("Applying YouTube reclassification requires --confirm");
  }

  const [
    items,
    issues,
    people,
    channelPolicy,
    formatCache,
    collectionState,
    storyClusters
  ] = await Promise.all([
      readItems(),
      readIssues(),
      readPeople(),
      readYouTubeChannelPolicy(),
      readYouTubeFormatCache(),
      readCollectionState(),
      readStoryClusters()
    ]);
  const originalFormatCache = structuredClone(formatCache);
  const result = await reclassifyExistingYouTubeItems({
    items,
    issues,
    people,
    channelPolicy,
    formatCache,
    redirectProbeEnabled: process.env.YOUTUBE_SHORTS_REDIRECT_PROBE !== "false"
  });
  const reportPath = await writeReport(result.report, apply ? "apply" : "dry-run");
  const summary = `YouTube reclassification ${apply ? "apply" : "dry-run"}: ${result.report.beforeVideos} -> ${result.report.afterVideos}, ${result.report.removedShorts.length} Shorts, ${result.report.removedBlocked.length} blocked, ${result.report.removedContentRejects.length} content rejects, ${result.report.secondary} secondary; report ${path.relative(process.cwd(), reportPath)}`;
  if (!apply) {
    console.log(summary);
    return;
  }

  const nextStoryClusters = buildStoryClusters(result.items);
  const youtubeTotal = result.items.filter(
    (item) => item.sourceType === "youtube"
  ).length;
  const nextCollectionState = {
    ...collectionState,
    totalItems: result.items.length,
    ...(collectionState.collectors
      ? {
          collectors: {
            ...collectionState.collectors,
            ...(collectionState.collectors.youtube
              ? {
                  youtube: {
                    ...collectionState.collectors.youtube,
                    totalItems: youtubeTotal
                  }
                }
              : {})
          }
        }
      : {})
  };

  try {
    await writeItems(result.items);
    await writeStoryClusters(nextStoryClusters);
    await writeCollectionState(nextCollectionState);
    await writeYouTubeFormatCache(result.formatCache);
  } catch (error) {
    await writeItems(items).catch(() => undefined);
    await writeStoryClusters(storyClusters).catch(() => undefined);
    await writeCollectionState(collectionState).catch(() => undefined);
    await writeYouTubeFormatCache(originalFormatCache).catch(() => undefined);
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
