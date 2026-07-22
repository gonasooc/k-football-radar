import {
  STORY_CLUSTER_WINDOW_MS,
  createStoryFactAnchorModel,
  isBurstStoryPairMatch,
  isStoryPairMatch,
  type StoryClusterItem
} from "../lib/story-clusters";
import { createStorySimilarityModel } from "../lib/story-similarity";
import { readItems, readStoryClusters } from "./data-io";

const DEFAULT_MIN_TITLE_SIMILARITY = 0.45;
const DEFAULT_PAIR_LIMIT = 100;

type NearMissPair = {
  titleSimilarity: number;
  summarySimilarity: number;
  hasSharedTag: boolean;
  left: StoryClusterItem;
  right: StoryClusterItem;
};

function getNumberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix));
  const parsed = Number(raw?.slice(prefix.length));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function hasSharedTag(left: StoryClusterItem, right: StoryClusterItem): boolean {
  const rightTags = new Set([...right.issueTags, ...right.personTags]);
  return [...left.issueTags, ...left.personTags].some((tag) => rightTags.has(tag));
}

function formatPair(pair: NearMissPair): string {
  const header = [
    `title=${pair.titleSimilarity.toFixed(3)}`,
    `summary=${pair.summarySimilarity.toFixed(3)}`,
    `sharedTag=${pair.hasSharedTag ? "yes" : "no"}`
  ].join(" ");
  const line = (item: StoryClusterItem): string =>
    `  ${item.publishedAt} | ${item.publisher} | ${item.id}\n    ${item.title}`;
  return `${header}\n${line(pair.left)}\n${line(pair.right)}`;
}

async function run(): Promise<void> {
  const minTitleSimilarity = getNumberFlag("min-title", DEFAULT_MIN_TITLE_SIMILARITY);
  const pairLimit = getNumberFlag("limit", DEFAULT_PAIR_LIMIT);
  const [items, storyClusters] = await Promise.all([readItems(), readStoryClusters()]);

  const newsItems = items
    .filter((item) => item.type === "news")
    .sort(
      (left, right) =>
        Date.parse(left.publishedAt) - Date.parse(right.publishedAt) ||
        left.id.localeCompare(right.id)
    );
  const similarityModel = createStorySimilarityModel(newsItems);
  const factAnchorModel = createStoryFactAnchorModel(newsItems);
  const clusterIdByItemId = new Map<string, string>();
  for (const cluster of storyClusters.clusters) {
    for (const memberId of cluster.memberIds) {
      clusterIdByItemId.set(memberId, cluster.id);
    }
  }

  const nearMisses: NearMissPair[] = [];
  for (let leftIndex = 0; leftIndex < newsItems.length; leftIndex += 1) {
    const left = newsItems[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < newsItems.length; rightIndex += 1) {
      const right = newsItems[rightIndex]!;
      const publishedDistance =
        Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
      if (publishedDistance > STORY_CLUSTER_WINDOW_MS) {
        break;
      }

      const leftClusterId = clusterIdByItemId.get(left.id);
      if (leftClusterId !== undefined && leftClusterId === clusterIdByItemId.get(right.id)) {
        continue;
      }
      if (
        isStoryPairMatch(left, right, similarityModel) ||
        isBurstStoryPairMatch(left, right, factAnchorModel)
      ) {
        continue;
      }

      const similarity = similarityModel.compare(left, right);
      if (similarity.title < minTitleSimilarity) {
        continue;
      }
      nearMisses.push({
        titleSimilarity: similarity.title,
        summarySimilarity: similarity.summary,
        hasSharedTag: hasSharedTag(left, right),
        left,
        right
      });
    }
  }

  nearMisses.sort(
    (previous, next) =>
      next.titleSimilarity - previous.titleSimilarity ||
      next.summarySimilarity - previous.summarySimilarity ||
      previous.left.id.localeCompare(next.left.id)
  );
  const visiblePairs = nearMisses.slice(0, pairLimit);

  console.log(
    `Found ${nearMisses.length} near-miss pairs (title similarity >= ${minTitleSimilarity}, within the cluster window, not co-clustered); showing ${visiblePairs.length}.`
  );
  for (const pair of visiblePairs) {
    console.log("");
    console.log(formatPair(pair));
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
