import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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

export type NewsReclassificationReport = {
  generatedAt: string;
  beforeNews: number;
  afterNews: number;
  removed: string[];
  promotedToPrimary: string[];
  demotedToSecondary: string[];
};

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

export function buildNewsReclassificationReport({
  items,
  reclassifiedItems,
  now = new Date()
}: {
  items: readonly RadarItem[];
  reclassifiedItems: readonly RadarItem[];
  now?: Date;
}): NewsReclassificationReport {
  const isNews = (item: RadarItem) => item.sourceType === "news";
  const newsBefore = items.filter(isNews);
  const newsAfter = new Map(
    reclassifiedItems.filter(isNews).map((item) => [item.id, item])
  );
  const removed: string[] = [];
  const promotedToPrimary: string[] = [];
  const demotedToSecondary: string[] = [];

  for (const item of newsBefore) {
    const reclassified = newsAfter.get(item.id);
    const wasSecondary = item.relevanceTier === "secondary";
    if (!reclassified) {
      removed.push(item.id);
    } else if (wasSecondary && reclassified.relevanceTier !== "secondary") {
      promotedToPrimary.push(item.id);
    } else if (!wasSecondary && reclassified.relevanceTier === "secondary") {
      demotedToSecondary.push(item.id);
    }
  }

  return {
    generatedAt: now.toISOString(),
    beforeNews: newsBefore.length,
    afterNews: newsAfter.size,
    removed,
    promotedToPrimary,
    demotedToSecondary
  };
}

async function writeReport(
  report: NewsReclassificationReport,
  mode: "dry-run" | "apply"
): Promise<string> {
  const reportPath = path.join(
    process.cwd(),
    "reports",
    `news-reclassification-${mode}.json`
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

export async function reclassifyStoredNews({
  apply = false
}: {
  apply?: boolean;
} = {}): Promise<{ report: NewsReclassificationReport; reportPath: string }> {
  const [items, issues, people, previousState, previousStoryClusters] = await Promise.all([
    readItems(),
    readIssues(),
    readPeople(),
    readCollectionState(),
    readStoryClusters()
  ]);
  const next = prepareNewsReclassification({ items, issues, people, previousState });
  const report = buildNewsReclassificationReport({ items, reclassifiedItems: next.items });

  if (apply) {
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
  }

  // The apply report is written only once the data is, so it never describes
  // a change that was rolled back.
  const reportPath = await writeReport(report, apply ? "apply" : "dry-run");
  return { report, reportPath };
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--confirm")) {
    throw new Error("Applying news reclassification requires --confirm");
  }

  const { report, reportPath } = await reclassifyStoredNews({ apply });
  console.log(
    `News reclassification ${apply ? "apply" : "dry-run"}: ${report.beforeNews} -> ${report.afterNews} news, ${report.removed.length} removed, ${report.promotedToPrimary.length} promoted, ${report.demotedToSecondary.length} demoted; report ${path.relative(process.cwd(), reportPath)}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
