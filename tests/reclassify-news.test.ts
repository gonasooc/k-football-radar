import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { CollectionState, RadarItem } from "../lib/schema";
import {
  buildNewsReclassificationReport,
  prepareNewsReclassification
} from "../scripts/reclassify-news";

function item(id: string, sourceType: "news" | "official", title: string): RadarItem {
  return {
    id,
    type: sourceType,
    title,
    summary: title,
    url: `https://example.com/${id}`,
    originalUrl: `https://example.com/${id}`,
    publisher: "test source",
    publishedAt: "2026-09-27T00:00:00.000Z",
    collectedAt: "2026-09-27T01:00:00.000Z",
    matchedKeywords: [],
    issueTags: [],
    personTags: [],
    sourceType,
    isOfficial: sourceType === "official",
    relevanceScore: 10
  };
}

describe("stored news reclassification", () => {
  it("recounts collector totals when reclassification removes news", () => {
    const collectorState = {
      lastCollectedAt: "2026-09-27T01:00:00.000Z",
      lastRunStatus: "success",
      lastRunNewItems: 0,
      totalItems: 1
    } as const;
    const previousState: CollectionState = {
      lastCollectedAt: "2026-09-27T01:00:00.000Z",
      lastRunStatus: "success",
      lastRunNewItems: 0,
      totalItems: 2,
      collectors: { naver: collectorState, official: collectorState }
    };

    const next = prepareNewsReclassification({
      items: [
        item("rejected-news", "news", "주말 전국 날씨 맑음"),
        item("official", "official", "공식 발표")
      ],
      issues: [],
      people: [],
      previousState
    });

    assert.deepEqual(
      next.items.map((record) => record.id),
      ["official"]
    );
    assert.deepEqual(next.state, {
      ...previousState,
      totalItems: 1,
      collectors: {
        naver: { ...collectorState, totalItems: 0 },
        official: collectorState
      }
    });
  });

  it("reports removed and re-tiered news by ID without counting other sources", () => {
    const secondary = (record: RadarItem): RadarItem => ({
      ...record,
      relevanceTier: "secondary"
    });
    const kept = item("kept", "news", "유지");
    const demoted = item("demoted", "news", "강등");
    const promoted = secondary(item("promoted", "news", "승격"));
    const removed = item("removed", "news", "제거");
    const official = item("official", "official", "공식 발표");

    const report = buildNewsReclassificationReport({
      items: [kept, demoted, promoted, removed, official],
      reclassifiedItems: [
        kept,
        secondary(demoted),
        { ...promoted, relevanceTier: undefined },
        official
      ],
      now: new Date("2026-09-29T00:00:00.000Z")
    });

    assert.deepEqual(report, {
      generatedAt: "2026-09-29T00:00:00.000Z",
      beforeNews: 4,
      afterNews: 3,
      removed: ["removed"],
      promotedToPrimary: ["promoted"],
      demotedToSecondary: ["demoted"]
    });
  });
});
