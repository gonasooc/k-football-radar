import { canonicalizeUrl } from "./dedupe";
import type {
  CollectionState,
  Issue,
  Person,
  RadarItem,
  Source,
  StoryClusterFile
} from "./schema";
import {
  EMPTY_STORY_CLUSTER_FILE,
  STORY_CLUSTER_WINDOW_MS,
  STORY_YOUTUBE_CLUSTER_WINDOW_MS,
  createStoryFactAnchorModel,
  getStoryClusterId,
  getYouTubeStoryText,
  isBurstStoryPairMatch,
  isStoryPairMatch,
  isYouTubeStoryPairMatch
} from "./story-clusters";
import { createStorySimilarityModel } from "./story-similarity";

const DANGEROUS_LABELS = new Set([
  "비리",
  "범죄",
  "확정 의혹",
  "부패",
  "유착",
  "문제 인물",
  "블랙리스트",
  "논란"
]);

function assertUniqueIds(records: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`Duplicate ${label} id: ${record.id}`);
    }
    ids.add(record.id);
  }
}

export function validateDataBundle({
  items,
  people,
  issues,
  sources,
  collectionState,
  storyClusters = EMPTY_STORY_CLUSTER_FILE
}: {
  items: RadarItem[];
  people: Person[];
  issues: Issue[];
  sources: Source[];
  collectionState: CollectionState;
  storyClusters?: StoryClusterFile;
}): void {
  assertUniqueIds(items, "item");
  assertUniqueIds(issues, "issue");
  assertUniqueIds(people, "person");
  assertUniqueIds(sources, "source");

  const issueIds = new Set(issues.map((issue) => issue.id));
  const personIds = new Set(people.map((person) => person.id));
  const canonicalUrls = new Map<string, string>();

  for (const item of items) {
    const itemCanonicalUrls = new Set([
      canonicalizeUrl(item.url),
      canonicalizeUrl(item.originalUrl)
    ]);

    for (const canonicalUrl of itemCanonicalUrls) {
      const existingItemId = canonicalUrls.get(canonicalUrl);
      if (existingItemId && existingItemId !== item.id) {
        throw new Error(
          `Duplicate canonical item url: ${canonicalUrl} in ${existingItemId} and ${item.id}`
        );
      }
      canonicalUrls.set(canonicalUrl, item.id);
    }

    for (const issueId of item.issueTags) {
      if (!issueIds.has(issueId)) {
        throw new Error(`Unknown issue tag "${issueId}" in ${item.id}`);
      }
    }

    for (const personId of item.personTags) {
      if (!personIds.has(personId)) {
        throw new Error(`Unknown person tag "${personId}" in ${item.id}`);
      }
    }

    for (const label of item.labels ?? []) {
      if (DANGEROUS_LABELS.has(label)) {
        throw new Error(`Dangerous label "${label}" in ${item.id}`);
      }
    }

    if (item.summary.length > 600) {
      throw new Error(`Summary too long in ${item.id}`);
    }
  }

  if (collectionState.totalItems !== items.length) {
    throw new Error(
      `collection-state totalItems=${collectionState.totalItems} does not match items=${items.length}`
    );
  }

  const collectorCounts = {
    naver: items.filter((item) => item.sourceType === "news").length,
    official: items.filter((item) => item.sourceType === "official").length,
    youtube: items.filter((item) => item.sourceType === "youtube").length
  };
  for (const collectorId of ["naver", "official", "youtube"] as const) {
    const collector = collectionState.collectors?.[collectorId];
    if (collector && collector.totalItems !== collectorCounts[collectorId]) {
      throw new Error(
        `collection-state ${collectorId} totalItems=${collector.totalItems} does not match items=${collectorCounts[collectorId]}`
      );
    }
  }

  const enabledOfficialSources = sources.filter(
    (source) => source.enabled && source.type === "official"
  );
  if (enabledOfficialSources.length === 0) {
    throw new Error("At least one enabled official source is required");
  }

  validateStoryClusters(items, storyClusters);
}

function compareItemsChronologically(left: RadarItem, right: RadarItem): number {
  const timeDifference = Date.parse(left.publishedAt) - Date.parse(right.publishedAt);
  return timeDifference || left.id.localeCompare(right.id);
}

export function validateStoryClusters(
  items: readonly RadarItem[],
  storyClusters: StoryClusterFile
): void {
  assertUniqueIds(storyClusters.clusters, "story cluster");

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const newsItems = items.filter((item) => item.type === "news");
  const similarityModel = createStorySimilarityModel(newsItems);
  const factAnchorModel = createStoryFactAnchorModel(newsItems);
  const youtubeSimilarityModel = createStorySimilarityModel(
    items.filter((item) => item.type === "youtube").map(getYouTubeStoryText)
  );
  const assignedItemIds = new Set<string>();

  for (const cluster of storyClusters.clusters) {
    if (cluster.memberIds.length < 2) {
      throw new Error(`Story cluster ${cluster.id} must contain at least two items`);
    }

    const uniqueMemberIds = new Set(cluster.memberIds);
    if (uniqueMemberIds.size !== cluster.memberIds.length) {
      throw new Error(`Duplicate member id in story cluster ${cluster.id}`);
    }
    if (!uniqueMemberIds.has(cluster.seedItemId)) {
      throw new Error(`Story cluster ${cluster.id} does not contain its seed item`);
    }
    if (cluster.id !== getStoryClusterId(cluster.seedItemId)) {
      throw new Error(`Story cluster id does not match seed ${cluster.seedItemId}`);
    }

    const members = cluster.memberIds.map((memberId) => {
      const item = itemsById.get(memberId);
      if (!item) {
        throw new Error(`Unknown story cluster member "${memberId}" in ${cluster.id}`);
      }
      if (item.type === "official") {
        throw new Error(`Official item "${memberId}" cannot belong to a story cluster`);
      }
      if (assignedItemIds.has(memberId)) {
        throw new Error(`Story cluster member "${memberId}" is assigned more than once`);
      }
      assignedItemIds.add(memberId);
      return item;
    });

    const clusterType = members[0]!.type;
    if (members.some((member) => member.type !== clusterType)) {
      throw new Error(`Story cluster ${cluster.id} mixes item types`);
    }

    const chronologicalMembers = [...members].sort(compareItemsChronologically);
    if (chronologicalMembers[0]?.id !== cluster.seedItemId) {
      throw new Error(`Story cluster ${cluster.id} seed is not its earliest item`);
    }
    if (
      chronologicalMembers.some(
        (member, index) => member.id !== cluster.memberIds[index]
      )
    ) {
      throw new Error(`Story cluster ${cluster.id} members are not chronological`);
    }

    const windowMs =
      clusterType === "youtube"
        ? STORY_YOUTUBE_CLUSTER_WINDOW_MS
        : STORY_CLUSTER_WINDOW_MS;
    const windowHours = Math.round(windowMs / (60 * 60 * 1_000));
    for (let leftIndex = 0; leftIndex < members.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < members.length; rightIndex += 1) {
        const left = members[leftIndex];
        const right = members[rightIndex];
        const publishedDistance = Math.abs(
          Date.parse(left.publishedAt) - Date.parse(right.publishedAt)
        );
        if (publishedDistance > windowMs) {
          throw new Error(
            `Story cluster ${cluster.id} exceeds the ${windowHours}-hour window`
          );
        }
        const isPairValid =
          clusterType === "youtube"
            ? isYouTubeStoryPairMatch(left, right, youtubeSimilarityModel)
            : isStoryPairMatch(left, right, similarityModel) ||
              isBurstStoryPairMatch(left, right, factAnchorModel);
        if (!isPairValid) {
          throw new Error(`Story cluster ${cluster.id} violates complete-link similarity`);
        }
      }
    }
  }
}
