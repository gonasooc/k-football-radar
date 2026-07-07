import itemsJson from "@/data/items.json";
import peopleJson from "@/data/people.json";
import issuesJson from "@/data/issues.json";
import sourcesJson from "@/data/sources.json";
import collectionStateJson from "@/data/collection-state.json";

import {
  collectionStateSchema,
  dataBundleSchema,
  issueSchema,
  personSchema,
  radarItemSchema,
  sourceSchema,
  type DataBundle,
  type Issue,
  type Person,
  type RadarItem
} from "./schema";
import { sortItemsLatestFirst } from "./dedupe";

const parsedData = dataBundleSchema.parse({
  items: itemsJson,
  people: peopleJson,
  issues: issuesJson,
  sources: sourcesJson,
  collectionState: collectionStateJson
});

export function getDataBundle(): DataBundle {
  return {
    ...parsedData,
    items: sortItemsLatestFirst(parsedData.items),
    issues: [...parsedData.issues].sort((a, b) => a.priority - b.priority),
    people: [...parsedData.people].sort((a, b) => a.priority - b.priority)
  };
}

export function getItemById(id: string): RadarItem | undefined {
  return getDataBundle().items.find((item) => item.id === id);
}

export function getIssueById(id: string): Issue | undefined {
  return getDataBundle().issues.find((issue) => issue.id === id);
}

export function getPersonById(id: string): Person | undefined {
  return getDataBundle().people.find((person) => person.id === id);
}

export function getItemsForIssue(issueId: string): RadarItem[] {
  return getDataBundle().items.filter((item) => item.issueTags.includes(issueId));
}

export function getItemsForPerson(personId: string): RadarItem[] {
  return getDataBundle().items.filter((item) => item.personTags.includes(personId));
}

export const schemas = {
  items: radarItemSchema.array(),
  people: personSchema.array(),
  issues: issueSchema.array(),
  sources: sourceSchema.array(),
  collectionState: collectionStateSchema
};
