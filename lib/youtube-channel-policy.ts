import type {
  RelevanceTier,
  YouTubeChannelPolicyFile,
  YouTubeChannelStatus,
  YouTubeVisibleChannelStatus
} from "./schema";

export type EffectiveYouTubeTier = RelevanceTier | "reject";

export function getYouTubeChannelStatus(
  policy: YouTubeChannelPolicyFile,
  channelId: string
): YouTubeChannelStatus {
  if (policy.blocked.includes(channelId)) return "blocked";
  if (policy.preferred.includes(channelId)) return "preferred";
  return "unlisted";
}

export function getVisibleYouTubeChannelStatus(
  policy: YouTubeChannelPolicyFile,
  channelId: string
): YouTubeVisibleChannelStatus | undefined {
  const status = getYouTubeChannelStatus(policy, channelId);
  return status === "blocked" ? undefined : status;
}

export function getEffectiveYouTubeTier({
  channelStatus,
  contentRelevanceTier
}: {
  channelStatus: YouTubeChannelStatus;
  contentRelevanceTier: RelevanceTier;
}): EffectiveYouTubeTier {
  if (channelStatus === "blocked") return "reject";
  return channelStatus === "preferred" && contentRelevanceTier === "primary"
    ? "primary"
    : "secondary";
}

export function getPreferredYouTubeChannelIds(
  policy: YouTubeChannelPolicyFile
): string[] {
  return policy.preferred;
}

export function getBlockedYouTubeChannelIds(
  policy: YouTubeChannelPolicyFile
): Set<string> {
  return new Set(policy.blocked);
}
