import { createHash } from "node:crypto";

import type { RadarItem, StoryClusterFile } from "./schema";
import {
  createStorySimilarityModel,
  normalizeStoryText,
  type StorySimilarityModel
} from "./story-similarity";

export const STORY_CLUSTER_VERSION = 1 as const;
export const STORY_CLUSTER_WINDOW_MS = 36 * 60 * 60 * 1_000;
export const STORY_STRONG_TITLE_SIMILARITY = 0.65;
export const STORY_FACT_ANCHOR_MIN_ITEMS = 3;
export const STORY_FACT_ANCHOR_MAX_ITEMS = 30;
export const EMPTY_STORY_CLUSTER_FILE: StoryClusterFile = {
  version: STORY_CLUSTER_VERSION,
  clusters: []
};

const STORY_FACT_ANCHOR_PATTERN =
  /\d+(?:\s*만\s*\d+)?(?:\.\d+)?\s*(?:배|명|개월|년|일|곳|개|건|표|%|억\s*원|만\s*원)/gu;
const STORY_DURATION_ANCHOR_PATTERN = /(?:년|개월|일)$/u;
const STORY_OPINION_TITLE_PATTERN =
  /(?:칼럼|사설|기고|오피니언|데스크|유레카|시론|논설)/u;

export type StoryClusterItem = Pick<
  RadarItem,
  | "id"
  | "type"
  | "title"
  | "summary"
  | "publisher"
  | "publishedAt"
  | "issueTags"
  | "personTags"
>;

export type StoryFactAnchorModel = {
  anchorsByItemId: ReadonlyMap<string, ReadonlySet<string>>;
  membersByAnchor: ReadonlyMap<string, readonly StoryClusterItem[]>;
  qualifyingAnchors: ReadonlySet<string>;
};

export function getStoryClusterId(seedItemId: string): string {
  const digest = createHash("sha256")
    .update(`cluster-v1:${seedItemId}`, "utf8")
    .digest("hex");
  return `story_${digest.slice(0, 20)}`;
}

function hasSharedTag(left: StoryClusterItem, right: StoryClusterItem): boolean {
  const rightTags = new Set([...right.issueTags, ...right.personTags]);
  return [...left.issueTags, ...left.personTags].some((tag) => rightTags.has(tag));
}

function normalizePublisher(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

function isLikelyOpinionTitle(value: string): boolean {
  return STORY_OPINION_TITLE_PATTERN.test(value.normalize("NFKC"));
}

export function extractStoryFactAnchors(
  item: Pick<StoryClusterItem, "title" | "summary">
): Set<string> {
  const matches = `${item.title} ${item.summary}`
    .normalize("NFKC")
    .match(STORY_FACT_ANCHOR_PATTERN);
  return new Set((matches ?? []).map((value) => value.replace(/\s+/gu, "")));
}

/**
 * Finds uncommon numeric facts that appear as a short multi-publisher burst.
 * Duration-like values are excluded because they recur across unrelated stories.
 */
export function createStoryFactAnchorModel(
  items: readonly StoryClusterItem[]
): StoryFactAnchorModel {
  const anchorsByItemId = new Map<string, Set<string>>();
  const allMembersByAnchor = new Map<string, StoryClusterItem[]>();

  for (const item of items) {
    if (item.type !== "news") {
      continue;
    }

    const anchors = extractStoryFactAnchors(item);
    anchorsByItemId.set(item.id, anchors);
    for (const anchor of anchors) {
      const members = allMembersByAnchor.get(anchor) ?? [];
      members.push(item);
      allMembersByAnchor.set(anchor, members);
    }
  }

  const qualifyingAnchors = new Set<string>();
  const membersByAnchor = new Map<string, readonly StoryClusterItem[]>();

  for (const [anchor, members] of allMembersByAnchor) {
    const publishedTimes = members.map((item) => Date.parse(item.publishedAt));
    const hasValidTimes = publishedTimes.every(Number.isFinite);
    const publishedSpan = hasValidTimes
      ? Math.max(...publishedTimes) - Math.min(...publishedTimes)
      : Number.POSITIVE_INFINITY;
    const publisherCount = new Set(
      members.map((item) => normalizePublisher(item.publisher))
    ).size;

    if (
      members.length >= STORY_FACT_ANCHOR_MIN_ITEMS &&
      members.length <= STORY_FACT_ANCHOR_MAX_ITEMS &&
      !STORY_DURATION_ANCHOR_PATTERN.test(anchor) &&
      publisherCount >= 2 &&
      publishedSpan <= STORY_CLUSTER_WINDOW_MS
    ) {
      qualifyingAnchors.add(anchor);
      membersByAnchor.set(anchor, [...members].sort(compareChronologically));
    }
  }

  return { anchorsByItemId, membersByAnchor, qualifyingAnchors };
}

export function isBurstStoryPairMatch(
  left: StoryClusterItem,
  right: StoryClusterItem,
  factAnchorModel: StoryFactAnchorModel
): boolean {
  if (left.type !== "news" || right.type !== "news" || !hasSharedTag(left, right)) {
    return false;
  }

  const publishedDistance = Math.abs(
    Date.parse(left.publishedAt) - Date.parse(right.publishedAt)
  );
  if (!Number.isFinite(publishedDistance) || publishedDistance > STORY_CLUSTER_WINDOW_MS) {
    return false;
  }

  const leftAnchors = factAnchorModel.anchorsByItemId.get(left.id);
  const rightAnchors = factAnchorModel.anchorsByItemId.get(right.id);
  if (!leftAnchors || !rightAnchors) {
    return false;
  }

  return [...leftAnchors].some(
    (anchor) =>
      factAnchorModel.qualifyingAnchors.has(anchor) && rightAnchors.has(anchor)
  );
}

export function isStoryPairMatch(
  left: StoryClusterItem,
  right: StoryClusterItem,
  similarityModel: StorySimilarityModel
): boolean {
  if (left.type !== "news" || right.type !== "news") {
    return false;
  }

  const publishedDistance = Math.abs(
    Date.parse(left.publishedAt) - Date.parse(right.publishedAt)
  );
  if (!Number.isFinite(publishedDistance) || publishedDistance > STORY_CLUSTER_WINDOW_MS) {
    return false;
  }

  const normalizedLeftTitle = normalizeStoryText(left.title);
  const normalizedRightTitle = normalizeStoryText(right.title);
  if (
    normalizedLeftTitle.length > 0 &&
    normalizedLeftTitle === normalizedRightTitle &&
    normalizePublisher(left.publisher) === normalizePublisher(right.publisher)
  ) {
    return true;
  }

  const similarity = similarityModel.compare(left, right);
  return (
    (similarity.title >= STORY_STRONG_TITLE_SIMILARITY &&
      hasSharedTag(left, right) &&
      !isLikelyOpinionTitle(left.title) &&
      !isLikelyOpinionTitle(right.title)) ||
    (similarity.title >= 0.42 && similarity.summary >= 0.12) ||
    (similarity.title >= 0.3 &&
      similarity.summary >= 0.34 &&
      hasSharedTag(left, right))
  );
}

type WorkingCluster = {
  seed: StoryClusterItem;
  members: StoryClusterItem[];
};

function compareChronologically(left: StoryClusterItem, right: StoryClusterItem): number {
  const timeDifference = Date.parse(left.publishedAt) - Date.parse(right.publishedAt);
  return timeDifference || left.id.localeCompare(right.id);
}

function buildBurstAnchorClusters(
  newsItems: readonly StoryClusterItem[],
  factAnchorModel: StoryFactAnchorModel
): { assignedIds: Set<string>; clusters: WorkingCluster[] } {
  const assignedIds = new Set<string>();
  const clusters: WorkingCluster[] = [];
  const orderedAnchors = [...factAnchorModel.qualifyingAnchors].sort((left, right) => {
    const sizeDifference =
      (factAnchorModel.membersByAnchor.get(right)?.length ?? 0) -
      (factAnchorModel.membersByAnchor.get(left)?.length ?? 0);
    return sizeDifference || left.localeCompare(right);
  });
  const newsById = new Map(newsItems.map((item) => [item.id, item]));

  for (const anchor of orderedAnchors) {
    const anchorItems = (factAnchorModel.membersByAnchor.get(anchor) ?? [])
      .flatMap((item) => {
        const current = newsById.get(item.id);
        return current && !assignedIds.has(current.id) ? [current] : [];
      })
      .sort(compareChronologically);
    const anchorClusters: WorkingCluster[] = [];

    for (const item of anchorItems) {
      const selectedCluster = anchorClusters.find((cluster) =>
        cluster.members.every((member) =>
          isBurstStoryPairMatch(item, member, factAnchorModel)
        )
      );

      if (selectedCluster) {
        selectedCluster.members.push(item);
      } else {
        anchorClusters.push({ seed: item, members: [item] });
      }
    }

    for (const cluster of anchorClusters) {
      if (cluster.members.length < 2) {
        continue;
      }
      clusters.push(cluster);
      for (const member of cluster.members) {
        assignedIds.add(member.id);
      }
    }
  }

  return { assignedIds, clusters };
}

/**
 * Rebuilds all story relationships from scratch. A candidate must match every
 * member, preventing transitive A-B-C chains from collapsing unrelated events.
 */
export function buildStoryClusters(items: readonly StoryClusterItem[]): StoryClusterFile {
  const newsItems = items
    .filter((item) => item.type === "news")
    .sort(compareChronologically);
  const similarityModel = createStorySimilarityModel(newsItems);
  const factAnchorModel = createStoryFactAnchorModel(newsItems);
  const {
    assignedIds,
    clusters: burstAnchorClusters
  } = buildBurstAnchorClusters(newsItems, factAnchorModel);
  const workingClusters: WorkingCluster[] = [];

  for (const item of newsItems) {
    if (assignedIds.has(item.id)) {
      continue;
    }

    let selectedCluster: WorkingCluster | null = null;
    let selectedScore = -1;

    for (const cluster of workingClusters) {
      if (
        !cluster.members.every((member) =>
          isStoryPairMatch(item, member, similarityModel)
        )
      ) {
        continue;
      }

      const averageSimilarity =
        cluster.members.reduce(
          (total, member) => total + similarityModel.compare(item, member).combined,
          0
        ) / cluster.members.length;
      if (
        averageSimilarity > selectedScore ||
        (averageSimilarity === selectedScore &&
          selectedCluster !== null &&
          cluster.seed.id.localeCompare(selectedCluster.seed.id) < 0)
      ) {
        selectedCluster = cluster;
        selectedScore = averageSimilarity;
      }
    }

    if (selectedCluster) {
      selectedCluster.members.push(item);
    } else {
      workingClusters.push({ seed: item, members: [item] });
    }
  }

  return {
    version: STORY_CLUSTER_VERSION,
    clusters: [...burstAnchorClusters, ...workingClusters]
      .filter((cluster) => cluster.members.length >= 2)
      .sort((left, right) => compareChronologically(left.seed, right.seed))
      .map((cluster) => ({
        id: getStoryClusterId(cluster.seed.id),
        seedItemId: cluster.seed.id,
        memberIds: cluster.members.map((member) => member.id)
      }))
  };
}

export function getStoryClusterStats(storyClusters: StoryClusterFile): {
  clusterCount: number;
  clusteredItemCount: number;
  largestClusterSize: number;
} {
  return {
    clusterCount: storyClusters.clusters.length,
    clusteredItemCount: storyClusters.clusters.reduce(
      (total, cluster) => total + cluster.memberIds.length,
      0
    ),
    largestClusterSize: storyClusters.clusters.reduce(
      (largest, cluster) => Math.max(largest, cluster.memberIds.length),
      0
    )
  };
}
