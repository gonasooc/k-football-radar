import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readItemShards, writeItemShards } from "../lib/item-shards";
import {
  collectionStateSchema,
  issueSchema,
  personSchema,
  radarItemSchema,
  sourceSchema,
  type CollectionState,
  type Issue,
  type Person,
  type RadarItem,
  type Source
} from "../lib/schema";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(filename: string): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, filename), "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filename: string, value: unknown): Promise<void> {
  const formatted = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path.join(DATA_DIR, filename), formatted, "utf8");
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

export async function readCollectionState(): Promise<CollectionState> {
  return collectionStateSchema.parse(await readJson("collection-state.json"));
}

export async function writeCollectionState(state: CollectionState): Promise<void> {
  await writeJson("collection-state.json", state);
}
