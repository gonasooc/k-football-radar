import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { radarItemSchema } from "../lib/schema";

describe("radarItemSchema", () => {
  it("rejects non-http original links", () => {
    const result = radarItemSchema.safeParse({
      id: "item_bad",
      type: "official",
      title: "공식자료",
      summary: "짧은 설명",
      url: "javascript:void(0);",
      originalUrl: "javascript:void(0);",
      publisher: "KFA",
      publishedAt: "2026-07-07T00:00:00.000Z",
      collectedAt: "2026-07-07T00:00:00.000Z",
      matchedKeywords: ["대한축구협회"],
      issueTags: [],
      personTags: [],
      sourceType: "official",
      isOfficial: true,
      relevanceScore: 10
    });

    assert.equal(result.success, false);
  });
});
