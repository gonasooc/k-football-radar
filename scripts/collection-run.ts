import { dedupeItems } from "../lib/dedupe";
import { applyItemRetentionPolicy } from "../lib/item-retention";
import type { CollectionState, RadarItem } from "../lib/schema";
import {
  readCollectionState,
  writeCollectionState,
  writeItems
} from "./data-io";

export type CollectorRunResult = {
  items: RadarItem[];
  attempted: number;
  succeeded: number;
  failed: number;
};

type CollectionRunStatus = CollectionState["lastRunStatus"];

function countItemsByCollectedAt(items: readonly RadarItem[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.collectedAt, (counts.get(item.collectedAt) ?? 0) + 1);
  }

  return counts;
}

export type CollectionRunPersistence = {
  readCollectionState: () => Promise<CollectionState>;
  writeItems: (items: RadarItem[]) => Promise<void>;
  writeCollectionState: (state: CollectionState) => Promise<void>;
};

const defaultPersistence: CollectionRunPersistence = {
  readCollectionState,
  writeItems,
  writeCollectionState
};

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
  previousState
}: {
  existingItems: RadarItem[];
  results: readonly CollectorRunResult[];
  now?: Date;
  filterItems?: (items: RadarItem[]) => RadarItem[];
  previousState?: CollectionState;
}): {
  items: RadarItem[];
  state: CollectionState;
  prunedItemCount: number;
} {
  const collectedItems = results.flatMap((result) => result.items);
  const dedupedItems = dedupeItems(filterItems([...existingItems, ...collectedItems]));
  const items = applyItemRetentionPolicy(dedupedItems, { now });
  const retainedExistingItems = applyItemRetentionPolicy(
    dedupeItems(filterItems(existingItems)),
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

  return {
    items,
    state: {
      lastCollectedAt:
        lastRunStatus === "failed" && previousState
          ? previousState.lastCollectedAt
          : now.toISOString(),
      lastRunStatus,
      lastRunNewItems: newItemCount,
      totalItems: items.length
    },
    prunedItemCount: dedupedItems.length - items.length
  };
}

export async function persistCollectionRun(options: {
  existingItems: RadarItem[];
  results: readonly CollectorRunResult[];
  now?: Date;
  filterItems?: (items: RadarItem[]) => RadarItem[];
  persistence?: CollectionRunPersistence;
}): Promise<ReturnType<typeof prepareCollectionRun>> {
  const persistence = options.persistence ?? defaultPersistence;
  const previousState = await persistence.readCollectionState();
  const update = prepareCollectionRun({ ...options, previousState });

  try {
    await persistence.writeItems(update.items);
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
