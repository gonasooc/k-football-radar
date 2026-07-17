import { ZodError } from "zod";

import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readSources,
  readStoryClusters,
  readYouTubeSearchQueries
} from "./data-io";
import { validateDataBundle } from "../lib/validation";
import {
  buildStoryClusters,
  getStoryClusterStats
} from "../lib/story-clusters";

async function validateData(): Promise<void> {
  const [
    items,
    people,
    issues,
    sources,
    collectionState,
    storyClusters,
    youtubeQueries
  ] = await Promise.all([
      readItems(),
      readPeople(),
      readIssues(),
      readSources(),
      readCollectionState(),
      readStoryClusters(),
      readYouTubeSearchQueries()
    ]);

  validateDataBundle({
    items,
    people,
    issues,
    sources,
    collectionState,
    storyClusters
  });
  const youtubeQueryIds = new Set(youtubeQueries.map((query) => query.id));
  if (youtubeQueryIds.size !== youtubeQueries.length) {
    throw new Error("YouTube search query IDs must be unique");
  }
  const enabledYouTubeQueryCount = youtubeQueries.filter((query) => query.enabled).length;
  if (enabledYouTubeQueryCount === 0) {
    throw new Error("At least one YouTube search query must be enabled");
  }
  if (enabledYouTubeQueryCount > 15) {
    throw new Error("At most 15 YouTube search queries can be enabled");
  }
  const rebuiltStoryClusters = buildStoryClusters(items);
  if (JSON.stringify(storyClusters) !== JSON.stringify(rebuiltStoryClusters)) {
    throw new Error(
      "Story clusters are out of date; run pnpm run rebuild:story-clusters"
    );
  }
  const clusterStats = getStoryClusterStats(storyClusters);

  console.log(
    `Data valid: ${items.length} items, ${issues.length} issues, ${people.length} people, ${sources.length} sources, ${enabledYouTubeQueryCount} YouTube queries; ${clusterStats.clusterCount} story clusters, ${clusterStats.clusteredItemCount} clustered news, largest ${clusterStats.largestClusterSize}`
  );
}

validateData().catch((error: unknown) => {
  if (error instanceof ZodError) {
    console.error(error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
