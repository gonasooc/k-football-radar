import { createHash } from "node:crypto";

import { joinSummaryAndTags } from "./classify";
import type { RadarItem, StoryClusterFile } from "./schema";
import {
  createStorySimilarityModel,
  normalizeStoryText,
  type StorySimilarityModel,
  type StoryTextFields
} from "./story-similarity";

export const STORY_CLUSTER_VERSION = 1 as const;
export const STORY_CLUSTER_WINDOW_MS = 36 * 60 * 60 * 1_000;
export const STORY_STRONG_TITLE_SIMILARITY = 0.65;
export const STORY_EXACT_TITLE_MIN_LENGTH = 10;
export const STORY_FACT_ANCHOR_MIN_ITEMS = 3;
export const STORY_FACT_ANCHOR_MAX_ITEMS = 30;
// Videos about one event spread wider than news: re-airs land the next morning
// and commentary channels lag one to three days behind the broadcast.
export const STORY_YOUTUBE_CLUSTER_WINDOW_MS = 72 * 60 * 60 * 1_000;
export const STORY_YOUTUBE_STRONG_TITLE_SIMILARITY = 0.55;
export const STORY_YOUTUBE_TITLE_SIMILARITY = 0.35;
export const STORY_YOUTUBE_CONTENT_SIMILARITY = 0.3;
export const EMPTY_STORY_CLUSTER_FILE: StoryClusterFile = {
  version: STORY_CLUSTER_VERSION,
  clusters: []
};

const STORY_FACT_ANCHOR_PATTERN =
  /\d+(?:\s*만\s*\d+)?(?:\.\d+)?\s*(?:배|명|개월|년|일|곳|개|건|표|%|억\s*원|만\s*원)/gu;
const STORY_DURATION_ANCHOR_PATTERN = /(?:년|개월|일)$/u;
const STORY_OPINION_TITLE_PATTERN =
  /(?:칼럼|사설|기고|오피니언|데스크|유레카|시론|논설)/u;
// Only match titles that are effectively a recurring programme label plus
// date/episode metadata. Event-specific titles may still contain "뉴스9" or
// "하이라이트" without being mistaken for another episode of the programme.
const STORY_RECURRING_SERIES_TITLE_PATTERN =
  /^(?:(?:뉴스9|스포츠뉴스|오늘의(?:한국)?축구(?:뉴스|소식|브리핑)?|(?:축구|스포츠)?경기하이라이트)|(?:주간|월간|데일리)(?:한국)?(?:축구|스포츠|축구협회)(?:뉴스|소식|브리핑)?)(?:(?:20\d{2}년)?\d{1,2}월\d{1,2}일|(?:20\d{2})?\d{3,4}|다시보기|full|제?\d+(?:회|화|편)|\d+부)*$/iu;

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
  | "youtube"
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

function isLikelyRecurringSeriesTitle(value: string): boolean {
  return STORY_RECURRING_SERIES_TITLE_PATTERN.test(normalizeStoryText(value));
}

function hasMinimumExactTitleInformation(normalizedTitle: string): boolean {
  return Array.from(normalizedTitle).length >= STORY_EXACT_TITLE_MIN_LENGTH;
}

function hasLexicalTitleGuard(
  left: StoryClusterItem,
  right: StoryClusterItem
): boolean {
  return (
    isLikelyOpinionTitle(left.title) ||
    isLikelyOpinionTitle(right.title) ||
    isLikelyRecurringSeriesTitle(left.title) ||
    isLikelyRecurringSeriesTitle(right.title)
  );
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
  if (normalizedLeftTitle.length > 0 && normalizedLeftTitle === normalizedRightTitle) {
    // A recurring programme can reuse one exact title for separate episodes,
    // including inside the story window. This is not a duplicate signal even
    // when the publisher is the same.
    if (
      isLikelyRecurringSeriesTitle(left.title) ||
      isLikelyRecurringSeriesTitle(right.title)
    ) {
      return false;
    }
    if (normalizePublisher(left.publisher) === normalizePublisher(right.publisher)) {
      return true;
    }
    // Cross-publisher identical titles are wire copy, except syndicated columns
    // and degenerate short titles that collide by coincidence.
    return (
      hasMinimumExactTitleInformation(normalizedLeftTitle) &&
      !isLikelyOpinionTitle(left.title) &&
      !isLikelyOpinionTitle(right.title)
    );
  }

  // Tags are rule-derived and often disagree on the same event, so the strong
  // title bar stands alone. Editorial/recurring-series markers are a hard guard
  // for every lexical fallback, not just the strongest-title branch.
  if (hasLexicalTitleGuard(left, right)) {
    return false;
  }
  const similarity = similarityModel.compare(left, right);
  return (
    similarity.title >= STORY_STRONG_TITLE_SIMILARITY ||
    (similarity.title >= 0.42 && similarity.summary >= 0.12) ||
    (similarity.title >= 0.3 &&
      similarity.summary >= 0.34 &&
      hasSharedTag(left, right))
  );
}

/**
 * Video descriptions are often bare hashtags while the governance signal lives
 * in the publisher tags, so similarity compares the same joined text the
 * classifier scores.
 */
export function getYouTubeStoryText(
  item: Pick<StoryClusterItem, "title" | "summary" | "youtube">
): StoryTextFields {
  return {
    title: item.title,
    summary: joinSummaryAndTags(item.summary, item.youtube?.tags)
  };
}

export function isYouTubeStoryPairMatch(
  left: StoryClusterItem,
  right: StoryClusterItem,
  similarityModel: StorySimilarityModel
): boolean {
  if (left.type !== "youtube" || right.type !== "youtube") {
    return false;
  }

  const publishedDistance = Math.abs(
    Date.parse(left.publishedAt) - Date.parse(right.publishedAt)
  );
  if (
    !Number.isFinite(publishedDistance) ||
    publishedDistance > STORY_YOUTUBE_CLUSTER_WINDOW_MS
  ) {
    return false;
  }

  // Cross-channel identical titles are the syndication/re-air case, so no
  // publisher requirement. Short labels and editorial/recurring programme
  // titles do not contain enough event information to prove a re-air.
  const normalizedLeftTitle = normalizeStoryText(left.title);
  const normalizedRightTitle = normalizeStoryText(right.title);
  if (
    normalizedLeftTitle.length > 0 &&
    normalizedLeftTitle === normalizedRightTitle
  ) {
    return (
      hasMinimumExactTitleInformation(normalizedLeftTitle) &&
      !hasLexicalTitleGuard(left, right)
    );
  }

  if (hasLexicalTitleGuard(left, right)) {
    return false;
  }

  const similarity = similarityModel.compare(
    getYouTubeStoryText(left),
    getYouTubeStoryText(right)
  );
  return (
    (similarity.title >= STORY_YOUTUBE_STRONG_TITLE_SIMILARITY &&
      hasSharedTag(left, right)) ||
    (similarity.title >= STORY_YOUTUBE_TITLE_SIMILARITY &&
      similarity.summary >= STORY_YOUTUBE_CONTENT_SIMILARITY &&
      hasSharedTag(left, right))
  );
}

type WorkingCluster = {
  seed: StoryClusterItem;
  members: StoryClusterItem[];
};

type BurstCandidateCluster = WorkingCluster & {
  anchor: string;
  anchorMemberIds: ReadonlySet<string>;
  anchorSupport: number;
  atoms: (readonly StoryClusterItem[])[];
  atomCount: number;
};

function compareTextTotal(left: string, right: string): number {
  const localizedDifference = left.localeCompare(right, "ko-KR");
  return localizedDifference || (left < right ? -1 : left > right ? 1 : 0);
}

function compareChronologically(left: StoryClusterItem, right: StoryClusterItem): number {
  const timeDifference = Date.parse(left.publishedAt) - Date.parse(right.publishedAt);
  return timeDifference || compareTextTotal(left.id, right.id);
}

function createBurstCandidateCluster(
  anchor: string,
  anchorMemberIds: ReadonlySet<string>,
  atoms: readonly (readonly StoryClusterItem[])[]
): BurstCandidateCluster {
  const members = atoms.flatMap((atom) => [...atom]).sort(compareChronologically);
  return {
    anchor,
    anchorMemberIds,
    anchorSupport: members.filter((member) => anchorMemberIds.has(member.id)).length,
    atoms: [...atoms],
    atomCount: atoms.length,
    seed: members[0]!,
    members
  };
}

function compareBurstCandidates(
  left: BurstCandidateCluster,
  right: BurstCandidateCluster
): number {
  const atomDifference = right.atomCount - left.atomCount;
  const memberDifference = right.members.length - left.members.length;
  const supportDifference = right.anchorSupport - left.anchorSupport;
  const seedDifference = compareChronologically(left.seed, right.seed);
  const anchorDifference = compareTextTotal(left.anchor, right.anchor);
  const leftMemberKey = left.members.map((member) => member.id).join("\u0000");
  const rightMemberKey = right.members.map((member) => member.id).join("\u0000");
  return (
    atomDifference ||
    memberDifference ||
    supportDifference ||
    seedDifference ||
    anchorDifference ||
    compareTextTotal(leftMemberKey, rightMemberKey)
  );
}

function buildBurstAnchorClusters(
  newsItems: readonly StoryClusterItem[],
  factAnchorModel: StoryFactAnchorModel,
  exactTitleAtoms: readonly (readonly StoryClusterItem[])[]
): { assignedIds: Set<string>; clusters: WorkingCluster[] } {
  const orderedAnchors = [...factAnchorModel.qualifyingAnchors].sort((left, right) => {
    const sizeDifference =
      (factAnchorModel.membersByAnchor.get(right)?.length ?? 0) -
      (factAnchorModel.membersByAnchor.get(left)?.length ?? 0);
    return sizeDifference || compareTextTotal(left, right);
  });
  const newsById = new Map(newsItems.map((item) => [item.id, item]));
  const exactTitleAtomByItemId = new Map(
    exactTitleAtoms.flatMap((atom) =>
      atom.map((item) => [item.id, atom] as const)
    )
  );
  const assignedIds = new Set<string>();
  const clusters: WorkingCluster[] = [];

  while (true) {
    const candidates: BurstCandidateCluster[] = [];

    for (const anchor of orderedAnchors) {
      // Rare-fact clustering works on exact-title atoms rather than individual
      // articles. Otherwise one member of an identical wire-copy pair can be
      // claimed by a burst first, leaving its must-link peer behind. Array
      // identity makes the Set de-duplicate atoms when several members carry
      // the same fact anchor.
      const anchorMembers = factAnchorModel.membersByAnchor.get(anchor) ?? [];
      const anchorMemberIds = new Set(anchorMembers.map((item) => item.id));
      const anchorAtoms = [
        ...new Set(
          anchorMembers.flatMap((item) => {
            const current = newsById.get(item.id);
            const atom = current
              ? exactTitleAtomByItemId.get(current.id)
              : undefined;
            return atom &&
              atom.every((member) => !assignedIds.has(member.id))
              ? [atom]
              : [];
          })
        )
      ].sort((left, right) => compareChronologically(left[0]!, right[0]!));
      const anchorClusters: BurstCandidateCluster[] = [];

      for (const atom of anchorAtoms) {
        const selectedClusterIndex = anchorClusters.findIndex((cluster) =>
          atom.every((candidate) =>
            cluster.members.every((member) =>
              isBurstStoryPairMatch(candidate, member, factAnchorModel)
            )
          )
        );

        if (selectedClusterIndex >= 0) {
          const selectedCluster = anchorClusters[selectedClusterIndex]!;
          anchorClusters[selectedClusterIndex] = createBurstCandidateCluster(
            anchor,
            anchorMemberIds,
            [...selectedCluster.atoms, atom]
          );
        } else {
          anchorClusters.push(
            createBurstCandidateCluster(anchor, anchorMemberIds, [atom])
          );
        }
      }

      for (const cluster of anchorClusters) {
        // Multiple wire copies with one exact title are only one independent
        // story signal. Do not let that atom reserve itself as a fact burst.
        if (cluster.atomCount >= 2) {
          candidates.push(cluster);
        }
      }
    }

    // Rebuild every anchor partition after each winner. Merely filtering an
    // old candidate can miss atoms that were previously left in another
    // complete-link partition but become compatible after the overlap leaves.
    candidates.sort(compareBurstCandidates);
    const winner = candidates[0];
    if (!winner) {
      break;
    }
    clusters.push({ seed: winner.seed, members: winner.members });
    for (const member of winner.members) {
      assignedIds.add(member.id);
    }
  }

  return { assignedIds, clusters };
}

function buildExactTitleAtoms(
  items: readonly StoryClusterItem[],
  skipIds: ReadonlySet<string>,
  isPair: (left: StoryClusterItem, right: StoryClusterItem) => boolean
): StoryClusterItem[][] {
  const exactTitleAtoms: StoryClusterItem[][] = [];
  const atomsByNormalizedTitle = new Map<string, StoryClusterItem[][]>();

  // Build safe must-link atoms before fuzzy clustering. Every member still has
  // to satisfy the type-specific pair predicate with every other member, so
  // short/editorial/recurring-title guards and the full time window remain in
  // force. Empty normalized titles are deliberately kept as singletons.
  for (const item of items) {
    if (skipIds.has(item.id)) {
      continue;
    }

    const normalizedTitle = normalizeStoryText(item.title);
    if (normalizedTitle.length === 0) {
      exactTitleAtoms.push([item]);
      continue;
    }

    const titleAtoms = atomsByNormalizedTitle.get(normalizedTitle) ?? [];
    const selectedAtom = titleAtoms.find((atom) =>
      atom.every((member) => isPair(item, member))
    );
    if (selectedAtom) {
      selectedAtom.push(item);
    } else {
      const atom = [item];
      titleAtoms.push(atom);
      atomsByNormalizedTitle.set(normalizedTitle, titleAtoms);
      exactTitleAtoms.push(atom);
    }
  }

  exactTitleAtoms.sort((left, right) =>
    compareChronologically(left[0]!, right[0]!)
  );

  return exactTitleAtoms;
}

function buildGreedyCompleteLinkClusters(
  items: readonly StoryClusterItem[],
  skipIds: ReadonlySet<string>,
  isPair: (left: StoryClusterItem, right: StoryClusterItem) => boolean,
  combinedSimilarity: (left: StoryClusterItem, right: StoryClusterItem) => number
): WorkingCluster[] {
  const exactTitleAtoms = buildExactTitleAtoms(items, skipIds, isPair);
  const workingClusters: WorkingCluster[] = [];

  for (const atom of exactTitleAtoms) {
    let selectedCluster: WorkingCluster | null = null;
    let selectedScore = -1;

    for (const cluster of workingClusters) {
      if (
        !atom.every((candidate) =>
          cluster.members.every((member) => isPair(candidate, member))
        )
      ) {
        continue;
      }

      const similarityTotal = atom.reduce(
        (atomTotal, candidate) =>
          atomTotal +
          cluster.members.reduce(
            (memberTotal, member) =>
              memberTotal + combinedSimilarity(candidate, member),
            0
          ),
        0
      );
      const averageSimilarity =
        similarityTotal / (atom.length * cluster.members.length);
      if (
        averageSimilarity > selectedScore ||
        (averageSimilarity === selectedScore &&
          selectedCluster !== null &&
          compareTextTotal(cluster.seed.id, selectedCluster.seed.id) < 0)
      ) {
        selectedCluster = cluster;
        selectedScore = averageSimilarity;
      }
    }

    if (selectedCluster) {
      selectedCluster.members.push(...atom);
      selectedCluster.members.sort(compareChronologically);
      selectedCluster.seed = selectedCluster.members[0]!;
    } else {
      workingClusters.push({ seed: atom[0]!, members: [...atom] });
    }
  }

  return workingClusters;
}

/**
 * Rebuilds all story relationships from scratch. A candidate must match every
 * member, preventing transitive A-B-C chains from collapsing unrelated events.
 * News and YouTube items cluster separately with type-specific rules.
 */
export function buildStoryClusters(items: readonly StoryClusterItem[]): StoryClusterFile {
  const newsItems = items
    .filter((item) => item.type === "news")
    .sort(compareChronologically);
  const similarityModel = createStorySimilarityModel(newsItems);
  const factAnchorModel = createStoryFactAnchorModel(newsItems);
  const isNewsPair = (left: StoryClusterItem, right: StoryClusterItem) =>
    isStoryPairMatch(left, right, similarityModel);
  const exactTitleAtoms = buildExactTitleAtoms(
    newsItems,
    new Set(),
    isNewsPair
  );
  const {
    assignedIds,
    clusters: burstAnchorClusters
  } = buildBurstAnchorClusters(newsItems, factAnchorModel, exactTitleAtoms);
  const newsClusters = buildGreedyCompleteLinkClusters(
    newsItems,
    assignedIds,
    isNewsPair,
    (left, right) => similarityModel.compare(left, right).combined
  );

  const youtubeItems = items
    .filter((item) => item.type === "youtube")
    .sort(compareChronologically);
  const youtubeSimilarityModel = createStorySimilarityModel(
    youtubeItems.map(getYouTubeStoryText)
  );
  const youtubeClusters = buildGreedyCompleteLinkClusters(
    youtubeItems,
    new Set(),
    (left, right) => isYouTubeStoryPairMatch(left, right, youtubeSimilarityModel),
    (left, right) =>
      youtubeSimilarityModel.compare(
        getYouTubeStoryText(left),
        getYouTubeStoryText(right)
      ).combined
  );

  return {
    version: STORY_CLUSTER_VERSION,
    clusters: [...burstAnchorClusters, ...newsClusters, ...youtubeClusters]
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
