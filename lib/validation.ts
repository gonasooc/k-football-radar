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
  const issueIds = new Set(issues.map((issue) => issue.id));
  const personIds = new Set(people.map((person) => person.id));
  const canonicalUrls = new Set<string>();

  for (const item of items) {
    const canonicalUrl = canonicalizeUrl(item.url);
    if (canonicalUrls.has(canonicalUrl)) {
      throw new Error(`Duplicate canonical item url: ${item.url}`);
    }
    canonicalUrls.add(canonicalUrl);

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
