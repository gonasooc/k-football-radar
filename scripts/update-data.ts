import {
  collectNaverNewsRun,
  reclassifyAndFilterNewsItemsForCollection
} from "./collect-naver-news";
import { collectOfficialSourcesRun } from "./collect-official";
import { persistCollectionRun } from "./collection-run";
import {
  readIssues,
  readItems,
  readPeople,
  readSources
} from "./data-io";

async function updateData(): Promise<void> {
  const now = new Date();
  const [existingItems, issues, people, sources] = await Promise.all([
    readItems(),
    readIssues(),
    readPeople(),
    readSources()
  ]);

  const [naverResult, officialResult] = await Promise.all([
    collectNaverNewsRun({ issues, people }),
    collectOfficialSourcesRun({ sources, issues, people })
  ]);

  const update = await persistCollectionRun({
    existingItems,
    results: [naverResult, officialResult],
    now,
    filterItems: (items) =>
      reclassifyAndFilterNewsItemsForCollection({ items, issues, people })
  });

  console.log(
    `Updated radar data: ${update.state.lastRunNewItems} new, ${update.items.length} total, ${naverResult.items.length} naver candidates, ${officialResult.items.length} official candidates, ${update.prunedItemCount} pruned, status ${update.state.lastRunStatus}`
  );
  if (update.state.lastRunStatus === "failed") {
    throw new Error("All configured collectors failed");
  }
}

updateData().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
