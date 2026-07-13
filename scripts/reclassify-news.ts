import { pathToFileURL } from "node:url";

import { reclassifyAndFilterNewsItemsForCollection } from "./collect-naver-news";
import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  writeCollectionState,
  writeItems
} from "./data-io";

export async function reclassifyStoredNews(): Promise<{
  before: number;
  after: number;
  removed: number;
}> {
  const [items, issues, people, previousState] = await Promise.all([
    readItems(),
    readIssues(),
    readPeople(),
    readCollectionState()
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

  try {
    await writeItems(reclassifiedItems);
    await writeCollectionState(nextState);
  } catch (error) {
    await writeItems(items).catch(() => undefined);
    await writeCollectionState(previousState).catch(() => undefined);
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
