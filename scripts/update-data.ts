import { collectNaverNews } from "./collect-naver-news";
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
import { limitItems } from "../lib/dedupe";

async function updateData(): Promise<void> {
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

  const mergedItems = limitItems([...existingItems, ...naverItems, ...officialItems]);
  const previousIds = new Set(existingItems.map((item) => item.id));
  const newItemCount = mergedItems.filter((item) => !previousIds.has(item.id)).length;
  const hasCollectorInput = Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

  await writeItems(mergedItems);
  await writeCollectionState({
    lastCollectedAt: new Date().toISOString(),
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
    `Updated radar data: ${newItemCount} new, ${mergedItems.length} total, ${naverItems.length} naver candidates, ${officialItems.length} official candidates`
  );
}

updateData().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
