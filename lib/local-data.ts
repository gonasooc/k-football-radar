import peopleJson from "@/data/people.json";
import issuesJson from "@/data/issues.json";
import sourcesJson from "@/data/sources.json";
import collectionStateJson from "@/data/collection-state.json";

import { normalizeDataBundle } from "./data-snapshot";
import { readItemShardsSync } from "./item-shards";
import type { DataBundle } from "./schema";

export function readLocalDataBundle(): DataBundle {
  return normalizeDataBundle({
    items: readItemShardsSync(),
    people: peopleJson,
    issues: issuesJson,
    sources: sourcesJson,
    collectionState: collectionStateJson
  });
}
