import type {
  RadarItem,
  RelevanceTier,
  YouTubeChannelPolicyFile,
  YouTubeFormatCacheFile
} from "./schema";
import { getYouTubeChannelStatus } from "./youtube-channel-policy";
import { hasExplicitShortsEvidence } from "./youtube-shorts";

export type YouTubeChannelCandidate = {
  channelId: string;
  name: string;
  status: "preferred" | "unlisted" | "blocked";
  totalVideos: number;
  knownShorts: number;
  atLeastTenMinutes: number;
  medianDurationSeconds: number;
  contentPrimary: number;
  contentSecondary: number;
  representativeVideos: Array<{
    videoId: string;
    title: string;
    url: string;
    publishedAt: string;
    durationSeconds: number;
  }>;
};

export type YouTubeChannelCandidateReport = {
  version: 1;
  generatedAt: string;
  totals: {
    channels: number;
    videos: number;
    preferred: number;
    unlisted: number;
    blocked: number;
  };
  channels: YouTubeChannelCandidate[];
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[midpoint - 1]! + sorted[midpoint]!) / 2)
    : sorted[midpoint]!;
}

function getStoredContentTier(item: RadarItem): RelevanceTier {
  return item.youtube?.contentRelevanceTier ?? item.relevanceTier ?? "primary";
}

function isKnownShorts(
  item: RadarItem,
  cache: YouTubeFormatCacheFile
): boolean {
  if (!item.youtube) return false;
  return (
    cache.entries[item.youtube.videoId]?.classification === "shorts" ||
    hasExplicitShortsEvidence({
      title: item.title,
      description: item.summary
    })
  );
}

export function buildYouTubeChannelCandidateReport({
  items,
  channelPolicy,
  formatCache,
  now = new Date()
}: {
  items: readonly RadarItem[];
  channelPolicy: YouTubeChannelPolicyFile;
  formatCache: YouTubeFormatCacheFile;
  now?: Date;
}): YouTubeChannelCandidateReport {
  const byChannel = new Map<string, RadarItem[]>();
  for (const item of items) {
    if (item.sourceType !== "youtube" || !item.youtube) continue;
    byChannel.set(item.youtube.channelId, [
      ...(byChannel.get(item.youtube.channelId) ?? []),
      item
    ]);
  }

  const channels = [...byChannel].map(([channelId, channelItems]) => {
    const newestFirst = [...channelItems].sort(
      (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
    );
    const status = getYouTubeChannelStatus(channelPolicy, channelId);
    const durations = channelItems.map(
      (item) => item.youtube?.durationSeconds ?? 0
    );
    return {
      channelId,
      name: newestFirst[0]!.publisher,
      status,
      totalVideos: channelItems.length,
      knownShorts: channelItems.filter((item) => isKnownShorts(item, formatCache))
        .length,
      atLeastTenMinutes: durations.filter((duration) => duration >= 600).length,
      medianDurationSeconds: median(durations),
      contentPrimary: channelItems.filter(
        (item) => getStoredContentTier(item) === "primary"
      ).length,
      contentSecondary: channelItems.filter(
        (item) => getStoredContentTier(item) === "secondary"
      ).length,
      representativeVideos: newestFirst.slice(0, 5).map((item) => ({
        videoId: item.youtube!.videoId,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        durationSeconds: item.youtube!.durationSeconds
      }))
    } satisfies YouTubeChannelCandidate;
  });

  channels.sort(
    (left, right) =>
      Number(right.status === "preferred") - Number(left.status === "preferred") ||
      right.atLeastTenMinutes - left.atLeastTenMinutes ||
      right.totalVideos - left.totalVideos ||
      left.name.localeCompare(right.name, "ko-KR")
  );

  return {
    version: 1,
    generatedAt: now.toISOString(),
    totals: {
      channels: channels.length,
      videos: channels.reduce((total, channel) => total + channel.totalVideos, 0),
      preferred: channels.filter((channel) => channel.status === "preferred").length,
      unlisted: channels.filter((channel) => channel.status === "unlisted").length,
      blocked: channels.filter((channel) => channel.status === "blocked").length
    },
    channels
  };
}
