import {
  collectNaverNewsRun,
  reclassifyAndFilterNewsItemsForCollection
} from "./collect-naver-news";
import { collectOfficialSourcesRun } from "./collect-official";
import {
  getBlockingCollectorFailures,
  hasCompleteCollectorFailure,
  persistCollectionRun
} from "./collection-run";
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
    collectorResults: [
      { id: "naver", result: naverResult },
      { id: "official", result: officialResult }
    ],
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

  if (hasCompleteCollectorFailure(officialResult)) {
    console.warn(
      "Official collector completed no sources; preserving the combined run as partial"
    );
  }

  const blockingCollectors = getBlockingCollectorFailures([
    { name: "naver", result: naverResult, blocksCombinedRun: true },
    { name: "official", result: officialResult, blocksCombinedRun: false }
  ]);
  if (blockingCollectors.length > 0) {
    throw new Error(
      `Collector(s) completed nothing this run: ${blockingCollectors.join(", ")}`
    );
  }
}

updateData().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
