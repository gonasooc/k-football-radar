import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { dedupeItems } from "../lib/dedupe";
import {
  applyItemRetentionPolicy,
  getItemRetentionDays,
  isPublishedAtWithinRetention
} from "../lib/item-retention";
import { radarItemSchema, type Issue, type Person, type RadarItem } from "../lib/schema";
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

const execFileAsync = promisify(execFile);
const SHARD_PATH_PATTERN = /^data\/items\/\d{4}-\d{2}-\d{2}\.json$/;

export type RestoreEvictedNewsReport = {
  generatedAt: string;
  retentionDays: number;
  windowStart: string;
  scannedShards: number;
  scannedRevisions: number;
  itemsOnDisk: number;
  /** Editorial items found only in Git history, before any current-rule check. */
  candidates: number;
  candidatesByReason: {
    outsideRetentionWindow: number;
    youtubeSkipped: number;
    duplicateOfRetainedItem: number;
    rejectedByCurrentRules: number;
    restored: number;
  };
  restoredByTier: { primary: number; secondary: number };
  restoredPublishedRange: { oldest: string; newest: string } | null;
  restoredPublishedDays: number;
  totals: {
    before: { items: number; primary: number; secondary: number; youtube: number };
    after: { items: number; primary: number; secondary: number; youtube: number };
  };
  storyClusters: { before: number; after: number };
  sampleRestoredTitles: string[];
};

function isPrimaryEditorial(item: RadarItem): boolean {
  return (
    item.sourceType !== "youtube" &&
    (item.sourceType === "official" || item.relevanceTier !== "secondary")
  );
}

function isSecondaryEditorial(item: RadarItem): boolean {
  return item.sourceType !== "youtube" && !isPrimaryEditorial(item);
}

function countTotals(items: readonly RadarItem[]) {
  return {
    items: items.length,
    primary: items.filter(isPrimaryEditorial).length,
    secondary: items.filter(isSecondaryEditorial).length,
    youtube: items.filter((item) => item.sourceType === "youtube").length
  };
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    maxBuffer: 256 * 1024 * 1024
  });
  return stdout;
}

/**
 * Collects every item that ever appeared in an item shard. Retention removes
 * items from a shard and only deletes the file once it is empty, so evicted
 * items live in older revisions of shards that still exist as well as in shards
 * that were deleted outright.
 */
async function readItemsFromHistory(): Promise<{
  items: Map<string, RadarItem>;
  scannedShards: number;
  scannedRevisions: number;
}> {
  const shardPaths = [
    ...new Set(
      (await git(["log", "--all", "--name-only", "--format=", "--", "data/items/*.json"]))
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => SHARD_PATH_PATTERN.test(line))
    )
  ].sort();

  const items = new Map<string, RadarItem>();
  let scannedRevisions = 0;

  for (const shardPath of shardPaths) {
    const commits = (await git(["log", "--format=%H", "--", shardPath]))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const seenBlobs = new Set<string>();

    for (const commit of commits) {
      let blob: string;
      try {
        blob = (await git(["rev-parse", `${commit}:${shardPath}`])).trim();
      } catch {
        // The shard does not exist in this revision, which is expected for the
        // commit that deleted it and for commits before it was first written.
        continue;
      }
      if (seenBlobs.has(blob)) {
        continue;
      }
      seenBlobs.add(blob);
      scannedRevisions += 1;

      let parsed: unknown;
      try {
        parsed = JSON.parse(await git(["cat-file", "blob", blob]));
      } catch {
        continue;
      }
      const shardItems = radarItemSchema.array().safeParse(parsed);
      if (!shardItems.success) {
        continue;
      }
      for (const item of shardItems.data) {
        if (!items.has(item.id)) {
          items.set(item.id, item);
        }
      }
    }
  }

  return { items, scannedShards: shardPaths.length, scannedRevisions };
}

export async function planNewsRestore({
  currentItems,
  issues,
  people,
  historyItems,
  now = new Date(),
  retentionDays = getItemRetentionDays()
}: {
  currentItems: RadarItem[];
  issues: Issue[];
  people: Person[];
  historyItems: Map<string, RadarItem>;
  now?: Date;
  retentionDays?: number;
}): Promise<{
  items: RadarItem[];
  restored: RadarItem[];
  counts: RestoreEvictedNewsReport["candidatesByReason"];
  candidates: number;
}> {
  const onDisk = new Set(currentItems.map((item) => item.id));
  const evicted = [...historyItems.values()].filter((item) => !onDisk.has(item.id));

  let outsideRetentionWindow = 0;
  let youtubeSkipped = 0;
  const eligible: RadarItem[] = [];

  for (const item of evicted) {
    // Video removals are not attributable to the editorial caps, so restoring
    // them could undo a deliberate channel or format decision.
    if (item.sourceType === "youtube") {
      youtubeSkipped += 1;
      continue;
    }
    if (!isPublishedAtWithinRetention({ publishedAt: item.publishedAt, now, retentionDays })) {
      outsideRetentionWindow += 1;
      continue;
    }
    eligible.push(item);
  }

  // Dedupe against what is already retained, then re-judge with today's
  // relevance rules so nothing that current rules reject comes back.
  const deduped = dedupeItems([...currentItems, ...eligible]);
  const dedupedIds = new Set(deduped.map((item) => item.id));
  const duplicateOfRetainedItem = eligible.filter((item) => !dedupedIds.has(item.id)).length;

  const reclassified = reclassifyAndFilterNewsItemsForCollection({
    items: deduped,
    issues,
    people
  });
  const items = applyItemRetentionPolicy(reclassified, { now, retentionDays });
  const finalIds = new Set(items.map((item) => item.id));
  const restored = eligible.filter((item) => finalIds.has(item.id));
  const rejectedByCurrentRules =
    eligible.length - duplicateOfRetainedItem - restored.length;

  return {
    items,
    restored,
    candidates: evicted.length,
    counts: {
      outsideRetentionWindow,
      youtubeSkipped,
      duplicateOfRetainedItem,
      rejectedByCurrentRules,
      restored: restored.length
    }
  };
}

async function writeReport(report: RestoreEvictedNewsReport, mode: "dry-run" | "apply") {
  const reportPath = path.join(
    process.cwd(),
    "reports",
    `news-restore-${mode}.json`
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--confirm")) {
    throw new Error("Applying the news restore requires --confirm");
  }

  const now = new Date();
  const retentionDays = getItemRetentionDays();
  const [currentItems, issues, people, collectionState, storyClusters] = await Promise.all([
    readItems(),
    readIssues(),
    readPeople(),
    readCollectionState(),
    readStoryClusters()
  ]);

  console.log("Scanning item shard history...");
  const history = await readItemsFromHistory();
  const plan = await planNewsRestore({
    currentItems,
    issues,
    people,
    historyItems: history.items,
    now,
    retentionDays
  });

  const restoredDays = new Set(plan.restored.map((item) => item.publishedAt.slice(0, 10)));
  const restoredTimes = plan.restored
    .map((item) => Date.parse(item.publishedAt))
    .sort((left, right) => left - right);
  const nextStoryClusters = buildStoryClusters(plan.items);
  const report: RestoreEvictedNewsReport = {
    generatedAt: now.toISOString(),
    retentionDays,
    windowStart: new Date(now.getTime() - retentionDays * 86_400_000)
      .toISOString()
      .slice(0, 10),
    scannedShards: history.scannedShards,
    scannedRevisions: history.scannedRevisions,
    itemsOnDisk: currentItems.length,
    candidates: plan.candidates,
    candidatesByReason: plan.counts,
    restoredByTier: {
      primary: plan.restored.filter(isPrimaryEditorial).length,
      secondary: plan.restored.filter(isSecondaryEditorial).length
    },
    restoredPublishedRange:
      restoredTimes.length > 0
        ? {
            oldest: new Date(restoredTimes[0]!).toISOString().slice(0, 10),
            newest: new Date(restoredTimes.at(-1)!).toISOString().slice(0, 10)
          }
        : null,
    restoredPublishedDays: restoredDays.size,
    totals: {
      before: countTotals(currentItems),
      after: countTotals(plan.items)
    },
    storyClusters: {
      before: storyClusters.clusters.length,
      after: nextStoryClusters.clusters.length
    },
    sampleRestoredTitles: plan.restored.slice(0, 20).map((item) => item.title)
  };

  const reportPath = await writeReport(report, apply ? "apply" : "dry-run");
  const summary =
    `News restore ${apply ? "apply" : "dry-run"}: ` +
    `${report.candidates} evicted candidates, ${report.candidatesByReason.restored} restored ` +
    `(${report.restoredByTier.primary} primary, ${report.restoredByTier.secondary} secondary), ` +
    `${report.totals.before.items} -> ${report.totals.after.items} items; ` +
    `report ${path.relative(process.cwd(), reportPath)}`;

  if (!apply) {
    console.log(summary);
    return;
  }

  // Per-collector totals are validated against the stored items, so they have to
  // move with the restore. Only the counts change; each collector keeps its own
  // last run time and status.
  const collectorTotals = {
    naver: plan.items.filter((item) => item.sourceType === "news").length,
    official: plan.items.filter((item) => item.sourceType === "official").length,
    youtube: plan.items.filter((item) => item.sourceType === "youtube").length
  };
  const previousCollectors = collectionState.collectors;
  const nextCollectionState = {
    ...collectionState,
    totalItems: plan.items.length,
    ...(previousCollectors
      ? {
          collectors: Object.fromEntries(
            (["naver", "official", "youtube"] as const).flatMap((collectorId) => {
              const collector = previousCollectors[collectorId];
              return collector
                ? [[collectorId, { ...collector, totalItems: collectorTotals[collectorId] }]]
                : [];
            })
          )
        }
      : {})
  };
  try {
    await writeItems(plan.items);
    await writeStoryClusters(nextStoryClusters);
    await writeCollectionState(nextCollectionState);
  } catch (error) {
    await writeItems(currentItems).catch(() => undefined);
    await writeStoryClusters(storyClusters).catch(() => undefined);
    await writeCollectionState(collectionState).catch(() => undefined);
    throw error;
  }
  console.log(summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
