import { ZodError } from "zod";

import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readSources
} from "./data-io";

async function validateData(): Promise<void> {
  const [items, people, issues, sources, collectionState] = await Promise.all([
    readItems(),
    readPeople(),
    readIssues(),
    readSources(),
    readCollectionState()
  ]);

  const issueIds = new Set(issues.map((issue) => issue.id));
  const personIds = new Set(people.map((person) => person.id));
  const itemUrls = new Set<string>();

  for (const item of items) {
    if (itemUrls.has(item.url)) {
      throw new Error(`Duplicate item url: ${item.url}`);
    }
    itemUrls.add(item.url);

    for (const issueId of item.issueTags) {
      if (!issueIds.has(issueId)) {
        throw new Error(`Unknown issue tag "${issueId}" in ${item.id}`);
      }
    }

    for (const personId of item.personTags) {
      if (!personIds.has(personId)) {
        throw new Error(`Unknown person tag "${personId}" in ${item.id}`);
      }
    }

    if (item.summary.length > 600) {
      throw new Error(`Summary too long in ${item.id}`);
    }
  }

  if (collectionState.totalItems !== items.length) {
    throw new Error(
      `collection-state totalItems=${collectionState.totalItems} does not match items=${items.length}`
    );
  }

  const enabledOfficialSources = sources.filter(
    (source) => source.enabled && source.type === "official"
  );
  if (enabledOfficialSources.length === 0) {
    throw new Error("At least one enabled official source is required");
  }

  console.log(
    `Data valid: ${items.length} items, ${issues.length} issues, ${people.length} people, ${sources.length} sources`
  );
}

validateData().catch((error: unknown) => {
  if (error instanceof ZodError) {
    console.error(error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
