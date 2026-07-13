import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { sortItemsLatestFirst } from "./dedupe";
import { radarItemSchema, type RadarItem } from "./schema";

const ITEM_SHARD_FILENAME_PATTERN = /^\d{4}-\d{2}-\d{2}\.json$/;
const ITEM_SHARD_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ITEMS_DIRNAME = "items";

function getItemsDir(dataDir: string): string {
  return path.join(dataDir, ITEMS_DIRNAME);
}

function isItemShardFilename(filename: string): boolean {
  return ITEM_SHARD_FILENAME_PATTERN.test(filename);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function parseItemShard(raw: string, shardPath: string): RadarItem[] {
  try {
    return radarItemSchema.array().parse(JSON.parse(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid item shard ${shardPath}: ${message}`);
  }
}

function formatItems(items: RadarItem[]): string {
  return `${JSON.stringify(items, null, 2)}\n`;
}

async function writeFileAtomically(filePath: string, content: string): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function getItemShardDate(item: Pick<RadarItem, "id" | "publishedAt">): string {
  const shardDate = item.publishedAt.slice(0, 10);
  if (!ITEM_SHARD_DATE_PATTERN.test(shardDate)) {
    throw new Error(`Invalid publishedAt shard date in ${item.id}: ${item.publishedAt}`);
  }
  return shardDate;
}

export function readItemShardsSync(dataDir = path.join(process.cwd(), "data")): RadarItem[] {
  const itemsDir = getItemsDir(dataDir);
  if (!existsSync(itemsDir)) {
    return [];
  }

  const items = readdirSync(itemsDir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isFile() || !isItemShardFilename(entry.name)) {
      return [];
    }

    const shardPath = path.join(itemsDir, entry.name);
    return parseItemShard(readFileSync(shardPath, "utf8"), shardPath);
  });

  return sortItemsLatestFirst(items);
}

export async function readItemShards(dataDir = path.join(process.cwd(), "data")): Promise<RadarItem[]> {
  const itemsDir = getItemsDir(dataDir);
  let entries: Dirent[];
  try {
    entries = await readdir(itemsDir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const shardFiles = entries
    .filter((entry) => entry.isFile() && isItemShardFilename(entry.name))
    .map((entry) => entry.name)
    .sort();
  const shards = await Promise.all(
    shardFiles.map(async (filename) => {
      const shardPath = path.join(itemsDir, filename);
      return parseItemShard(await readFile(shardPath, "utf8"), shardPath);
    })
  );

  return sortItemsLatestFirst(shards.flat());
}

export async function writeItemShards(
  items: RadarItem[],
  dataDir = path.join(process.cwd(), "data")
): Promise<void> {
  const itemsDir = getItemsDir(dataDir);
  await mkdir(itemsDir, { recursive: true });

  const itemsByShard = new Map<string, RadarItem[]>();
  for (const item of sortItemsLatestFirst(items)) {
    const shardDate = getItemShardDate(item);
    itemsByShard.set(shardDate, [...(itemsByShard.get(shardDate) ?? []), item]);
  }

  const expectedFilenames = new Set(
    Array.from(itemsByShard.keys(), (shardDate) => `${shardDate}.json`)
  );
  const existingFilenames = (await readdir(itemsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && isItemShardFilename(entry.name))
    .map((entry) => entry.name);

  await Promise.all(
    Array.from(itemsByShard.entries(), async ([shardDate, shardItems]) => {
      const shardPath = path.join(itemsDir, `${shardDate}.json`);
      const formatted = formatItems(shardItems);

      try {
        if ((await readFile(shardPath, "utf8")) === formatted) {
          return;
        }
      } catch (error) {
        if (!(isNodeError(error) && error.code === "ENOENT")) {
          throw error;
        }
      }

      await writeFileAtomically(shardPath, formatted);
    })
  );

  await Promise.all(
    existingFilenames
      .filter((filename) => !expectedFilenames.has(filename))
      .map((filename) => rm(path.join(itemsDir, filename)))
  );
}
