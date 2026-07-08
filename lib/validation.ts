import { canonicalizeUrl } from "./dedupe";
import type { CollectionState, Issue, Person, RadarItem, Source } from "./schema";

const DANGEROUS_LABELS = new Set([
  "비리",
  "범죄",
  "확정 의혹",
  "부패",
  "유착",
  "문제 인물",
  "블랙리스트",
  "논란"
]);

function assertUniqueIds(records: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`Duplicate ${label} id: ${record.id}`);
    }
    ids.add(record.id);
  }
}

export function validateDataBundle({
  items,
  people,
  issues,
  sources,
  collectionState
}: {
  items: RadarItem[];
  people: Person[];
  issues: Issue[];
  sources: Source[];
  collectionState: CollectionState;
}): void {
  assertUniqueIds(items, "item");
  assertUniqueIds(issues, "issue");
  assertUniqueIds(people, "person");
  assertUniqueIds(sources, "source");

  const issueIds = new Set(issues.map((issue) => issue.id));
  const personIds = new Set(people.map((person) => person.id));
  const canonicalUrls = new Map<string, string>();

  for (const item of items) {
    const itemCanonicalUrls = new Set([
      canonicalizeUrl(item.url),
      canonicalizeUrl(item.originalUrl)
    ]);

    for (const canonicalUrl of itemCanonicalUrls) {
      const existingItemId = canonicalUrls.get(canonicalUrl);
      if (existingItemId && existingItemId !== item.id) {
        throw new Error(
          `Duplicate canonical item url: ${canonicalUrl} in ${existingItemId} and ${item.id}`
        );
      }
      canonicalUrls.set(canonicalUrl, item.id);
    }

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

    for (const label of item.labels ?? []) {
      if (DANGEROUS_LABELS.has(label)) {
        throw new Error(`Dangerous label "${label}" in ${item.id}`);
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
}
