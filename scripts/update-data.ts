import { collectNaverNews, filterNewsItemsForCollection } from "./collect-naver-news";
import { collectOfficialSources } from "./collect-official";
import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readSources,
  writeCollectionState,
  writeItems
} from "./data-io";
import { dedupeItems } from "../lib/dedupe";
import { applyItemRetentionPolicy } from "../lib/item-retention";

async function updateData(): Promise<void> {
  const now = new Date();
  const [existingItems, issues, people, sources, previousState] = await Promise.all([
    readItems(),
    readIssues(),
    readPeople(),
    readSources(),
    readCollectionState()
  ]);

  const [naverItems, officialItems] = await Promise.all([
    collectNaverNews({ issues, people }),
    collectOfficialSources({ sources, issues, people })
  ]);

  const dedupedItems = dedupeItems(
    filterNewsItemsForCollection([...existingItems, ...naverItems, ...officialItems])
  );
  const mergedItems = applyItemRetentionPolicy(dedupedItems, { now });
  const prunedItemCount = dedupedItems.length - mergedItems.length;
  const previousIds = new Set(existingItems.map((item) => item.id));
  const newItemCount = mergedItems.filter((item) => !previousIds.has(item.id)).length;
  const hasCollectorInput = Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

  await writeItems(mergedItems);
  await writeCollectionState({
    lastCollectedAt: now.toISOString(),
    lastRunStatus:
      naverItems.length > 0 || officialItems.length > 0 || hasCollectorInput
        ? "success"
        : previousState.lastRunStatus === "never"
          ? "partial"
          : previousState.lastRunStatus,
    lastRunNewItems: newItemCount,
    totalItems: mergedItems.length
  });

  console.log(
    `Updated radar data: ${newItemCount} new, ${mergedItems.length} total, ${naverItems.length} naver candidates, ${officialItems.length} official candidates, ${prunedItemCount} pruned`
  );
}

updateData().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
