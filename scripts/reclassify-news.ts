import { pathToFileURL } from "node:url";

import { buildStoryClusters } from "../lib/story-clusters";
import { reclassifyAndFilterNewsItemsForCollection } from "./collect-naver-news";
import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readStoryClusters,
  writeCollectionState,
  writeItems,
  writeStoryClusters
} from "./data-io";

export async function reclassifyStoredNews(): Promise<{
  before: number;
  after: number;
  removed: number;
}> {
  const [items, issues, people, previousState, previousStoryClusters] = await Promise.all([
    readItems(),
    readIssues(),
    readPeople(),
    readCollectionState(),
    readStoryClusters()
  ]);
  const reclassifiedItems = reclassifyAndFilterNewsItemsForCollection({
    items,
    issues,
    people
  });
  const nextState = {
    ...previousState,
    totalItems: reclassifiedItems.length
  };
  const nextStoryClusters = buildStoryClusters(reclassifiedItems);

  try {
    await writeItems(reclassifiedItems);
    await writeStoryClusters(nextStoryClusters);
    await writeCollectionState(nextState);
  } catch (error) {
    const rollbackResults = await Promise.allSettled([
      writeItems(items),
      writeStoryClusters(previousStoryClusters),
      writeCollectionState(previousState)
    ]);
    const rollbackErrors = rollbackResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : []
    );
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "News reclassification persistence failed and rollback was incomplete"
      );
    }
    throw error;
  }

  return {
    before: items.length,
    after: reclassifiedItems.length,
    removed: items.length - reclassifiedItems.length
  };
}

async function run(): Promise<void> {
  const result = await reclassifyStoredNews();
  console.log(
    `Reclassified stored news: ${result.before} before, ${result.after} after, ${result.removed} removed`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
