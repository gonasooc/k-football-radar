import { createHash } from "node:crypto";

import { z } from "zod";

import { sortItemsLatestFirst } from "./dedupe";
import { dataBundleSchema, type DataBundle, type RadarItem } from "./schema";
import { validateDataBundle } from "./validation";

const SNAPSHOT_OBJECT_KEY_PATTERN = /^snapshots\/[a-f0-9]{64}\.json$/;

export const dataSnapshotManifestSchema = z.object({
  version: z.literal(1),
  objectKey: z.string().regex(SNAPSHOT_OBJECT_KEY_PATTERN),
  collectedAt: z.string().datetime({ offset: true }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteLength: z.number().int().positive()
});

export type DataSnapshotManifest = z.infer<typeof dataSnapshotManifestSchema>;
export type PublicRadarItem = Omit<RadarItem, "dedupeState">;
export type PublicDataBundle = Omit<DataBundle, "items"> & {
  items: PublicRadarItem[];
};

const publicDataBundleSchema = dataBundleSchema.superRefine((bundle, context) => {
  bundle.items.forEach((item, index) => {
    if (item.dedupeState !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal dedupe state is not allowed in public data snapshots",
        path: ["items", index, "dedupeState"]
      });
    }
  });
});

function normalizeParsedDataBundle(parsed: DataBundle): DataBundle {
  validateDataBundle(parsed);

  return {
    ...parsed,
    items: sortItemsLatestFirst(parsed.items),
    issues: [...parsed.issues].sort((a, b) => a.priority - b.priority),
    people: [...parsed.people].sort((a, b) => a.priority - b.priority)
  };
}

export function normalizeDataBundle(value: unknown): DataBundle {
  return normalizeParsedDataBundle(dataBundleSchema.parse(value));
}

function toPublicRadarItem(item: RadarItem): PublicRadarItem {
  const publicItem = { ...item };
  delete publicItem.dedupeState;
  return publicItem;
}

/**
 * Projects the persisted collection bundle onto its public contract. Dedupe
 * evidence remains available to future collection runs in data/items, but is
 * never part of a published snapshot or a payload derived from one.
 */
export function toPublicDataBundle(value: unknown): PublicDataBundle {
  const bundle = normalizeDataBundle(value);
  return {
    ...bundle,
    items: bundle.items.map(toPublicRadarItem)
  };
}

export function getSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function serializeDataSnapshot(value: unknown): {
  body: string;
  manifest: DataSnapshotManifest;
} {
  const bundle = toPublicDataBundle(value);
  const body = `${JSON.stringify(bundle)}\n`;
  const sha256 = getSha256(body);

  return {
    body,
    manifest: {
      version: 1,
      objectKey: `snapshots/${sha256}.json`,
      collectedAt: bundle.collectionState.lastCollectedAt,
      sha256,
      byteLength: Buffer.byteLength(body, "utf8")
    }
  };
}

export function parseDataSnapshot(
  body: string,
  manifest: DataSnapshotManifest
): PublicDataBundle {
  if (manifest.objectKey !== `snapshots/${manifest.sha256}.json`) {
    throw new Error("R2 snapshot object key does not match its checksum");
  }

  const byteLength = Buffer.byteLength(body, "utf8");
  if (byteLength !== manifest.byteLength) {
    throw new Error(
      `R2 snapshot size mismatch: expected ${manifest.byteLength}, received ${byteLength}`
    );
  }

  const sha256 = getSha256(body);
  if (sha256 !== manifest.sha256) {
    throw new Error(
      `R2 snapshot checksum mismatch: expected ${manifest.sha256}, received ${sha256}`
    );
  }

  const bundle = normalizeParsedDataBundle(
    publicDataBundleSchema.parse(JSON.parse(body) as unknown)
  );
  if (bundle.collectionState.lastCollectedAt !== manifest.collectedAt) {
    throw new Error("R2 snapshot collection time does not match its manifest");
  }
  return {
    ...bundle,
    items: bundle.items.map(toPublicRadarItem)
  };
}
