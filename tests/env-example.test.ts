import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  getItemRetentionDays,
  getMaxRetainedItems,
  getMaxRetainedSecondaryItems,
  getMaxRetainedYouTubeItems
} from "../lib/item-retention";
import {
  getNaverFetchTimeoutMs,
  getNaverQueryDelayMs
} from "../scripts/collect-naver-news";
import { getOfficialSourceTimeoutMs } from "../scripts/collect-official";
import {
  getYouTubeBackfillDays,
  getYouTubeMaxPagesPerChannel,
  getYouTubeMaxPagesPerQuery
} from "../scripts/collect-youtube";

const exampleSource = readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8"
);

function documentedValues(): Map<string, string> {
  return new Map(
    exampleSource
      .split("\n")
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

// Each getter defaults its argument to process.env, and passing undefined still
// triggers that default, so a stray local .env would otherwise leak in here.
function withoutEnvironment<T>(names: readonly string[], run: () => T): T {
  const saved = names.map((name) => [name, process.env[name]] as const);
  for (const name of names) {
    delete process.env[name];
  }

  try {
    return run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

// Every variable the code reads, so a new one cannot be added without also
// documenting it. Secrets and per-machine values are listed with no value.
const DOCUMENTED_WITHOUT_VALUE = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_GA_ID",
  "RADAR_DATA_BASE_URL",
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "YOUTUBE_API_KEY",
  "YOUTUBE_PUBLISHED_AFTER",
  "YOUTUBE_PUBLISHED_BEFORE"
];

describe(".env.example", () => {
  it("documents the default of every tunable the collectors read", () => {
    const documented = documentedValues();
    const defaults = withoutEnvironment(
      [
        "NAVER_QUERY_DELAY_MS",
        "NAVER_FETCH_TIMEOUT_MS",
        "OFFICIAL_SOURCE_TIMEOUT_MS",
        "YOUTUBE_BACKFILL_DAYS",
        "YOUTUBE_MAX_PAGES_PER_QUERY",
        "YOUTUBE_MAX_PAGES_PER_CHANNEL",
        "ITEM_RETENTION_DAYS",
        "MAX_RETAINED_ITEMS",
        "MAX_RETAINED_SECONDARY_ITEMS",
        "MAX_RETAINED_YOUTUBE_ITEMS"
      ],
      () => ({
        NAVER_QUERY_DELAY_MS: getNaverQueryDelayMs(),
        NAVER_FETCH_TIMEOUT_MS: getNaverFetchTimeoutMs(),
        OFFICIAL_SOURCE_TIMEOUT_MS: getOfficialSourceTimeoutMs(),
        YOUTUBE_BACKFILL_DAYS: getYouTubeBackfillDays(),
        YOUTUBE_MAX_PAGES_PER_QUERY: getYouTubeMaxPagesPerQuery(),
        YOUTUBE_MAX_PAGES_PER_CHANNEL: getYouTubeMaxPagesPerChannel(),
        ITEM_RETENTION_DAYS: getItemRetentionDays(),
        MAX_RETAINED_ITEMS: getMaxRetainedItems(),
        MAX_RETAINED_SECONDARY_ITEMS: getMaxRetainedSecondaryItems(),
        MAX_RETAINED_YOUTUBE_ITEMS: getMaxRetainedYouTubeItems()
      })
    );

    for (const [name, value] of Object.entries(defaults)) {
      assert.equal(
        documented.get(name),
        String(value),
        `.env.example must document ${name}=${value}`
      );
    }
  });

  it("lists the secrets and per-machine values with no value", () => {
    const documented = documentedValues();

    for (const name of DOCUMENTED_WITHOUT_VALUE) {
      assert.equal(
        documented.get(name),
        "",
        `.env.example must list ${name} with an empty value`
      );
    }
  });

  it("keeps the Shorts probe documented as opt-out", () => {
    // Only the exact string "false" disables the probe, so the template shows
    // the enabled state rather than implying a boolean parse.
    assert.equal(documentedValues().get("YOUTUBE_SHORTS_REDIRECT_PROBE"), "true");
    assert.match(exampleSource, /Set to `false` to skip/);
  });
});
