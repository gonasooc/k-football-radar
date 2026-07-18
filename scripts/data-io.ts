import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { readItemShards, writeItemShards } from "../lib/item-shards";
import {
  collectionStateSchema,
  issueSchema,
  personSchema,
  radarItemSchema,
  sourceSchema,
  storyClusterFileSchema,
  youtubeChannelPolicyFileSchema,
  youtubeFormatCacheFileSchema,
  youtubeSearchQuerySchema,
  type CollectionState,
  type Issue,
  type Person,
  type RadarItem,
  type Source,
  type StoryClusterFile,
  type YouTubeChannelPolicyFile,
  type YouTubeFormatCacheFile,
  type YouTubeSearchQuery
} from "../lib/schema";
import { EMPTY_STORY_CLUSTER_FILE } from "../lib/story-clusters";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(filename: string): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, filename), "utf8");
  return JSON.parse(raw) as T;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function writeJson(filename: string, value: unknown): Promise<void> {
  const formatted = `${JSON.stringify(value, null, 2)}\n`;
  const filePath = path.join(DATA_DIR, filename);
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, formatted, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readItems(): Promise<RadarItem[]> {
  return readItemShards(DATA_DIR);
}

export async function writeItems(items: RadarItem[]): Promise<void> {
  await writeItemShards(radarItemSchema.array().parse(items), DATA_DIR);
}

export async function readPeople(): Promise<Person[]> {
  return personSchema.array().parse(await readJson("people.json"));
}

export async function readIssues(): Promise<Issue[]> {
  return issueSchema.array().parse(await readJson("issues.json"));
}

export async function readSources(): Promise<Source[]> {
  return sourceSchema.array().parse(await readJson("sources.json"));
}

export async function readYouTubeSearchQueries(): Promise<YouTubeSearchQuery[]> {
  return youtubeSearchQuerySchema.array().parse(await readJson("youtube-queries.json"));
}

export async function readYouTubeChannelPolicy(): Promise<YouTubeChannelPolicyFile> {
  return youtubeChannelPolicyFileSchema.parse(await readJson("youtube-channels.json"));
}

export async function readYouTubeFormatCache(): Promise<YouTubeFormatCacheFile> {
  return youtubeFormatCacheFileSchema.parse(
    await readJson("youtube-format-cache.json")
  );
}

export async function writeYouTubeFormatCache(
  cache: YouTubeFormatCacheFile
): Promise<void> {
  await writeJson(
    "youtube-format-cache.json",
    youtubeFormatCacheFileSchema.parse(cache)
  );
}

export async function readCollectionState(): Promise<CollectionState> {
  return collectionStateSchema.parse(await readJson("collection-state.json"));
}

export async function writeCollectionState(state: CollectionState): Promise<void> {
  await writeJson("collection-state.json", state);
}

export async function readStoryClusters(): Promise<StoryClusterFile> {
  try {
    return storyClusterFileSchema.parse(await readJson("story-clusters.json"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return EMPTY_STORY_CLUSTER_FILE;
    }
    throw error;
  }
}

export async function writeStoryClusters(
  storyClusters: StoryClusterFile
): Promise<void> {
  await writeJson("story-clusters.json", storyClusterFileSchema.parse(storyClusters));
}
