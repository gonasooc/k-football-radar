import { pathToFileURL } from "node:url";

import { buildStoryClusters, getStoryClusterStats } from "../lib/story-clusters";
import { readItems, writeStoryClusters } from "./data-io";

export async function rebuildStoryClusters(): Promise<
  ReturnType<typeof getStoryClusterStats>
> {
  const items = await readItems();
  const storyClusters = buildStoryClusters(items);
  await writeStoryClusters(storyClusters);
  return getStoryClusterStats(storyClusters);
}

async function run(): Promise<void> {
  const stats = await rebuildStoryClusters();
  console.log(
    `Rebuilt story clusters: ${stats.clusterCount} clusters, ${stats.clusteredItemCount} clustered items, largest ${stats.largestClusterSize}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
