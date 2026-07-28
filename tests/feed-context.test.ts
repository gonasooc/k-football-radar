import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDataBundle } from "../lib/data";
import { createFeedContext, getFeedContext } from "../lib/feed-context";
import { getFeedPage } from "../lib/feed-page";
import { getFeedContentRevision } from "../lib/feed-snapshot";
import { defaultFeedFilters, type FeedItem } from "../lib/filter";
import type { StoryClusterFile } from "../lib/schema";

const emptyClusters: StoryClusterFile = { version: 1, clusters: [] };

describe("feed context", () => {
  it("derives the pagination revision and the editorial item set from the bundle", async () => {
    const data = await getDataBundle();
    const context = getFeedContext(data);

    assert.equal(
      context.revision,
      getFeedContentRevision(data.items, data.storyClusters)
    );
    assert.equal(context.feedItems.length, data.items.length);
    assert.equal(
      context.editorialFeedItems.every((item) => item.sourceType !== "youtube"),
      true
    );
    assert.equal(
      context.editorialFeedItems.length,
      data.items.filter((item) => item.sourceType !== "youtube").length
    );
  });

  it("reuses one context per bundle so the IDF corpus is built once", async () => {
    const data = await getDataBundle();

    assert.equal(getFeedContext(data), getFeedContext(data));
    // A new snapshot is a new bundle object, so it must not reuse the old entry.
    assert.notEqual(getFeedContext(data), createFeedContext(data));
  });

  it("produces the same pages with cached models as with per-call models", async () => {
    const data = await getDataBundle();
    const { editorialFeedItems, feedItems, similarityModels } = getFeedContext(data);

    for (const [label, items, filters] of [
      ["editorial", editorialFeedItems, defaultFeedFilters],
      ["all", feedItems, defaultFeedFilters],
      ["youtube", feedItems, { ...defaultFeedFilters, type: "youtube" as const }]
    ] as const) {
      assert.deepEqual(
        getFeedPage(items, filters, {
          storyClusters: data.storyClusters,
          similarityModels
        }),
        getFeedPage(items, filters, { storyClusters: data.storyClusters }),
        `${label} feed page changed when the similarity models were cached`
      );
    }
  });

  it("keeps a lone secondary item as its own representative", () => {
    const secondary: FeedItem = {
      id: "item-1",
      title: "기사 제목",
      summary: "기사 요약입니다.",
      url: "https://example.com/1",
      publisher: "테스트뉴스",
      publishedAt: "2026-07-13T00:00:00.000Z",
      collectedAt: "2026-07-13T01:00:00.000Z",
      issueTags: [],
      personTags: [],
      sourceType: "news",
      relevanceScore: 10,
      relevanceTier: "secondary",
      labels: [],
      searchTerms: ""
    };
    const page = getFeedPage(
      [secondary],
      { ...defaultFeedFilters, scope: "all" },
      { storyClusters: emptyClusters }
    );

    assert.equal(page.entries.length, 1);
    assert.equal(page.entries[0]?.representative.id, "item-1");
    assert.deepEqual(page.entries[0]?.related, []);
  });
});
