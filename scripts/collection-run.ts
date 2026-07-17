import { dedupeItems } from "../lib/dedupe";
import { applyItemRetentionPolicy } from "../lib/item-retention";
import type { CollectionState, RadarItem, StoryClusterFile } from "../lib/schema";
import { buildStoryClusters } from "../lib/story-clusters";
import {
  readCollectionState,
  readStoryClusters,
  writeCollectionState,
  writeItems,
  writeStoryClusters
} from "./data-io";

export type CollectorRunResult = {
  items: RadarItem[];
  attempted: number;
  succeeded: number;
  failed: number;
};

export type CollectorId = "naver" | "official" | "youtube";

export type NamedCollectorRunResult = {
  id: CollectorId;
  result: CollectorRunResult;
};

type CollectionRunStatus = CollectionState["lastRunStatus"];

function countItemsByCollectedAt(items: readonly RadarItem[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.collectedAt, (counts.get(item.collectedAt) ?? 0) + 1);
  }

  return counts;
}

function itemBelongsToCollector(item: RadarItem, collectorId: CollectorId): boolean {
  return collectorId === "naver"
    ? item.sourceType === "news"
    : item.sourceType === collectorId;
}

function updateCollectorStates({
  previousState,
  items,
  retainedExistingItems,
  collectorResults,
  now
}: {
  previousState?: CollectionState;
  items: RadarItem[];
  retainedExistingItems: RadarItem[];
  collectorResults: readonly NamedCollectorRunResult[];
  now: Date;
}): CollectionState["collectors"] {
  if (collectorResults.length === 0 && !previousState?.collectors) {
    return undefined;
  }
  const collectors = { ...(previousState?.collectors ?? {}) };

  for (const { id, result } of collectorResults) {
    const previous = collectors[id];
    const totalItems = items.filter((item) => itemBelongsToCollector(item, id)).length;

    if (result.attempted === 0) {
      collectors[id] = previous
        ? { ...previous, totalItems }
        : {
          lastCollectedAt: now.toISOString(),
          lastRunStatus: "never",
          lastRunNewItems: 0,
          totalItems
        };
      continue;
    }

    const lastRunStatus = getCollectionRunStatus([result]);
    const previousCounts = countItemsByCollectedAt(
      retainedExistingItems.filter((item) => itemBelongsToCollector(item, id))
    );
    const currentCounts = countItemsByCollectedAt(
      items.filter((item) => itemBelongsToCollector(item, id))
    );
    const lastRunNewItems = [...currentCounts].reduce(
      (total, [collectedAt, count]) =>
        total + Math.max(0, count - (previousCounts.get(collectedAt) ?? 0)),
      0
    );
    collectors[id] = {
      lastCollectedAt:
        lastRunStatus === "failed" && previous
          ? previous.lastCollectedAt
          : now.toISOString(),
      lastRunStatus,
      lastRunNewItems,
      totalItems
    };
  }

  return collectors;
}

export type CollectionRunPersistence = {
  readCollectionState: () => Promise<CollectionState>;
  readStoryClusters: () => Promise<StoryClusterFile>;
  writeItems: (items: RadarItem[]) => Promise<void>;
  writeStoryClusters: (storyClusters: StoryClusterFile) => Promise<void>;
  writeCollectionState: (state: CollectionState) => Promise<void>;
};

const defaultPersistence: CollectionRunPersistence = {
  readCollectionState,
  readStoryClusters,
  writeItems,
  writeStoryClusters,
  writeCollectionState
};

export function hasCompleteCollectorFailure(result: CollectorRunResult): boolean {
  return result.attempted > 0 && result.succeeded === 0;
}

export function getBlockingCollectorFailures(
  collectors: readonly {
    name: string;
    result: CollectorRunResult;
    blocksCombinedRun: boolean;
  }[]
): string[] {
  return collectors
    .filter(
      ({ result, blocksCombinedRun }) =>
        blocksCombinedRun && hasCompleteCollectorFailure(result)
    )
    .map(({ name }) => name);
}

export function getCollectionRunStatus(
  results: readonly CollectorRunResult[]
): CollectionRunStatus {
  const attempted = results.reduce((total, result) => total + result.attempted, 0);
  const succeeded = results.reduce((total, result) => total + result.succeeded, 0);
  const failed = results.reduce((total, result) => total + result.failed, 0);

  if (attempted === 0 || succeeded === 0) {
    return "failed";
  }

  return failed > 0 ? "partial" : "success";
}

export function prepareCollectionRun({
  existingItems,
  results,
  now = new Date(),
  filterItems = (items) => items,
  previousState,
  collectorResults = []
}: {
  existingItems: RadarItem[];
  results: readonly CollectorRunResult[];
  now?: Date;
  filterItems?: (items: RadarItem[]) => RadarItem[];
  previousState?: CollectionState;
  collectorResults?: readonly NamedCollectorRunResult[];
}): {
  items: RadarItem[];
  storyClusters: StoryClusterFile;
  state: CollectionState;
  prunedItemCount: number;
} {
  const collectedItems = results.flatMap((result) => result.items);
  const dedupedItems = dedupeItems([...existingItems, ...collectedItems]);
  const filteredItems = filterItems(dedupedItems);
  const items = applyItemRetentionPolicy(filteredItems, { now });
  const retainedExistingItems = applyItemRetentionPolicy(
    filterItems(dedupeItems(existingItems)),
    { now }
  );
  const previousCounts = countItemsByCollectedAt(retainedExistingItems);
  const currentCounts = countItemsByCollectedAt(items);
  const newItemCount = [...currentCounts].reduce(
    (total, [collectedAt, count]) =>
      total + Math.max(0, count - (previousCounts.get(collectedAt) ?? 0)),
    0
  );
  const lastRunStatus = getCollectionRunStatus(results);
  const collectors = updateCollectorStates({
    previousState,
    items,
    retainedExistingItems,
    collectorResults,
    now
  });

  return {
    items,
    storyClusters: buildStoryClusters(items),
    state: {
      lastCollectedAt:
        lastRunStatus === "failed" && previousState
          ? previousState.lastCollectedAt
          : now.toISOString(),
      lastRunStatus,
      lastRunNewItems: newItemCount,
      totalItems: items.length,
      ...(collectors ? { collectors } : {})
    },
    prunedItemCount: dedupedItems.length - items.length
  };
}

export async function persistCollectionRun(options: {
  existingItems: RadarItem[];
  results: readonly CollectorRunResult[];
  now?: Date;
  filterItems?: (items: RadarItem[]) => RadarItem[];
  collectorResults?: readonly NamedCollectorRunResult[];
  persistence?: CollectionRunPersistence;
}): Promise<ReturnType<typeof prepareCollectionRun>> {
  const persistence = options.persistence ?? defaultPersistence;
  const [previousState, previousStoryClusters] = await Promise.all([
    persistence.readCollectionState(),
    persistence.readStoryClusters()
  ]);
  const update = prepareCollectionRun({ ...options, previousState });

  try {
    await persistence.writeItems(update.items);
    await persistence.writeStoryClusters(update.storyClusters);
    await persistence.writeCollectionState(update.state);
    return update;
  } catch (error) {
    const rollbackErrors: unknown[] = [];

    try {
      await persistence.writeItems(options.existingItems);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }

    try {
      await persistence.writeStoryClusters(previousStoryClusters);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }

    try {
      await persistence.writeCollectionState(previousState);
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Collection persistence failed and rollback was incomplete"
      );
    }
    throw error;
  }
}
