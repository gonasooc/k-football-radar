import { ZodError } from "zod";

import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readSources,
  readStoryClusters
} from "./data-io";
import { validateDataBundle } from "../lib/validation";
import {
  buildStoryClusters,
  getStoryClusterStats
} from "../lib/story-clusters";

async function validateData(): Promise<void> {
  const [items, people, issues, sources, collectionState, storyClusters] = await Promise.all([
    readItems(),
    readPeople(),
    readIssues(),
    readSources(),
    readCollectionState(),
    readStoryClusters()
  ]);

  validateDataBundle({
    items,
    people,
    issues,
    sources,
    collectionState,
    storyClusters
  });
  const rebuiltStoryClusters = buildStoryClusters(items);
  if (JSON.stringify(storyClusters) !== JSON.stringify(rebuiltStoryClusters)) {
    throw new Error(
      "Story clusters are out of date; run pnpm run rebuild:story-clusters"
    );
  }
  const clusterStats = getStoryClusterStats(storyClusters);

  console.log(
    `Data valid: ${items.length} items, ${issues.length} issues, ${people.length} people, ${sources.length} sources; ${clusterStats.clusterCount} story clusters, ${clusterStats.clusteredItemCount} clustered news, largest ${clusterStats.largestClusterSize}`
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
