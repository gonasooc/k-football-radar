import { pathToFileURL } from "node:url";

import type {
  CollectionState,
  Issue,
  Person,
  RadarItem,
  StoryClusterFile
} from "../lib/schema";
import { buildStoryClusters } from "../lib/story-clusters";
import { reclassifyAndFilterNewsItemsForCollection } from "./collect-naver-news";
import { refreshCollectorTotals } from "./collection-run";
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

export function prepareNewsReclassification({
  items,
  issues,
  people,
  previousState
}: {
  items: RadarItem[];
  issues: Issue[];
  people: Person[];
  previousState: CollectionState;
}): { items: RadarItem[]; storyClusters: StoryClusterFile; state: CollectionState } {
  const reclassifiedItems = reclassifyAndFilterNewsItemsForCollection({
    items,
    issues,
    people
  });
  const collectors = refreshCollectorTotals(previousState.collectors, reclassifiedItems);

  return {
    items: reclassifiedItems,
    storyClusters: buildStoryClusters(reclassifiedItems),
    state: {
      ...previousState,
      totalItems: reclassifiedItems.length,
      ...(collectors ? { collectors } : {})
    }
  };
}

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
  const next = prepareNewsReclassification({ items, issues, people, previousState });

  try {
    await writeItems(next.items);
    await writeStoryClusters(next.storyClusters);
    await writeCollectionState(next.state);
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
    after: next.items.length,
    removed: items.length - next.items.length
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
