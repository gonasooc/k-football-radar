import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";

import { FeedSnapshotMismatchError } from "../lib/feed-api";
import type { FeedPage, StoryFeedEntry } from "../lib/feed-page";
import { defaultFeedFilters, type FeedFilters } from "../lib/filter";

type Props = React.ComponentProps<
  typeof import("../components/PaginatedItemList").PaginatedItemList
>;
type Element = React.ReactElement<Record<string, unknown>>;

const componentSource = ts.transpileModule(
  readFileSync(new URL("../components/PaginatedItemList.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }
).outputText;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function page(prefix: string, offset = 0, snapshot = "snapshot-1"): FeedPage {
  return {
    entries: Array.from({ length: 30 }, (_, index) => {
      const id = `${prefix}-${offset + index}`;
      return {
        id,
        representative: {
          id,
          title: id,
          summary: "테스트 자료",
          url: `https://example.com/${id}`,
          publisher: "테스트",
          publishedAt: "2026-10-02T00:00:00.000Z",
          collectedAt: "2026-10-02T01:00:00.000Z",
          issueTags: [],
          personTags: [],
          sourceType: prefix === "news" ? "news" : "youtube",
          relevanceScore: 80,
          searchTerms: ""
        },
        related: [],
        itemCount: 1,
        latestPublishedAt: "2026-10-02T00:00:00.000Z",
        maxRelevanceScore: 80
      };
    }),
    totalEntries: 90,
    totalItems: 90,
    offset,
    limit: 30,
    hasMore: true,
    snapshot
  };
}

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}

// Execute the actual component's event handlers with deterministic state/ref
// storage and controllable network responses. Child rendering and the DOM are
// outside these request-order tests; no copy of the request logic lives here.
function mountList() {
  const slots: unknown[] = [];
  let slot = 0;
  const requests: Array<ReturnType<typeof deferred<FeedPage>> & {
    filters: FeedFilters;
    offset: number;
  }> = [];
  const hooks = {
    useState<T>(initial: T) {
      const index = slot++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index] as T, (next: React.SetStateAction<T>) => {
        slots[index] = typeof next === "function"
          ? (next as (value: T) => T)(slots[index] as T)
          : next;
      }];
    },
    useRef<T>(initial: T) {
      const index = slot++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    }
  };
  const exports = {} as { PaginatedItemList: (props: Props) => React.ReactNode };
  runInNewContext(componentSource, {
    exports,
    React,
    require(name: string) {
      switch (name) {
        case "react": return hooks;
        case "lucide-react": return { LoaderCircle: "LoaderCircle" };
        case "./EmptyState": return { EmptyState: "EmptyState" };
        case "./StoryFeedEntryCard": return { StoryFeedEntryCard: "StoryFeedEntryCard" };
        case "@/lib/feed-api": return {
          FeedSnapshotMismatchError,
          fetchFeedPage(filters: FeedFilters, offset: number) {
            const request = { ...deferred<FeedPage>(), filters, offset };
            requests.push(request);
            return request.promise;
          }
        };
        default: throw new Error(`Unexpected component import: ${name}`);
      }
    }
  });
  function render() {
    slot = 0;
    return elements(exports.PaginatedItemList({
      fixedFilters: defaultFeedFilters,
      initialPage: page("all"),
      issues: [],
      people: [],
      heading: "관련 자료",
      headingId: "related-items",
      emptyTitle: "자료 없음",
      emptyDescription: "새 자료를 기다립니다."
    }));
  }
  function button(predicate: (props: Element["props"]) => boolean) {
    const found = render().find((node) => node.type === "button" && predicate(node.props));
    assert.ok(found, "Expected a rendered button");
    return found;
  }
  function click(node: Element) {
    assert.equal(Boolean(node.props.disabled), false);
    return (node.props.onClick as () => Promise<void> | void)();
  }
  return {
    requests,
    loadMore: () => click(button((props) => props["aria-controls"] === "detail-feed-ledger")),
    chooseNews: () => click(button((props) => props.children === "뉴스")),
    newsSelected: () => button((props) => props.children === "뉴스").props["aria-pressed"],
    loadingMore: () => button((props) => props["aria-controls"] === "detail-feed-ledger").props.disabled,
    ids: () => render()
      .filter((node) => node.type === "StoryFeedEntryCard")
      .map((node) => (node.props.entry as StoryFeedEntry).id),
    hasError: () => render().some((node) =>
      typeof node.props.children === "string" && node.props.children.includes("불러오지 못했습니다")
    )
  };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("detail feed request ordering", () => {
  it("appends a current page normally", async () => {
    const list = mountList();
    const loading = list.loadMore();
    assert.equal(list.requests[0].offset, 30);
    list.requests[0].resolve(page("all", 30));
    await loading;
    assert.deepEqual(list.ids(), [...page("all").entries, ...page("all", 30).entries].map((entry) => entry.id));
    assert.equal(list.loadingMore(), false);
  });

  it("ignores old-type pagination even when the new page has the same length and snapshot", async () => {
    const list = mountList();
    const loading = list.loadMore();
    list.chooseNews();
    assert.equal(list.requests[1].filters.type, "news");
    list.requests[1].resolve(page("news"));
    await flush();
    list.requests[0].resolve(page("all", 30));
    await loading;
    assert.equal(list.newsSelected(), true);
    assert.deepEqual(list.ids(), page("news").entries.map((entry) => entry.id));
  });

  it("ignores stale errors and keeps a newer load-more request busy", async () => {
    const list = mountList();
    const oldLoading = list.loadMore();
    list.chooseNews();
    list.requests[1].resolve(page("news"));
    await flush();
    const newLoading = list.loadMore();
    list.requests[0].reject(new Error("Old request failed"));
    await oldLoading;
    assert.equal(list.hasError(), false);
    assert.equal(list.loadingMore(), true);
    list.requests[2].resolve(page("news", 30));
    await newLoading;
    assert.equal(list.ids().length, 60);
    assert.equal(list.loadingMore(), false);
  });

  it("restores the previous type after a failed filter change while ignoring its old pagination", async () => {
    const list = mountList();
    const loading = list.loadMore();
    list.chooseNews();
    list.requests[1].reject(new Error("Filter request failed"));
    await flush();
    assert.equal(list.newsSelected(), false);
    assert.equal(list.hasError(), true);
    list.requests[0].resolve(page("all", 30));
    await loading;
    assert.deepEqual(list.ids(), page("all").entries.map((entry) => entry.id));
    assert.equal(list.loadingMore(), false);
  });

  it("does not start snapshot recovery for an obsolete type", async () => {
    const list = mountList();
    const loading = list.loadMore();
    list.chooseNews();
    list.requests[1].resolve(page("news"));
    await flush();
    list.requests[0].reject(new FeedSnapshotMismatchError("snapshot-2"));
    await loading;
    assert.equal(list.requests.length, 2);
    assert.equal(list.hasError(), false);
    assert.deepEqual(list.ids(), page("news").entries.map((entry) => entry.id));
  });

  it("recovers the current type after a snapshot change", async () => {
    const list = mountList();
    const loading = list.loadMore();
    list.requests[0].reject(new FeedSnapshotMismatchError("snapshot-2"));
    await flush();
    list.requests[1].resolve(page("fresh", 0, "snapshot-2"));
    await loading;
    assert.deepEqual(list.ids(), page("fresh").entries.map((entry) => entry.id));
    assert.equal(list.hasError(), false);
    assert.equal(list.loadingMore(), false);
  });

  for (const outcome of ["success", "failure"] as const) {
    it(`ignores snapshot recovery ${outcome} after the type changes`, async () => {
      const list = mountList();
      const loading = list.loadMore();
      list.requests[0].reject(new FeedSnapshotMismatchError("snapshot-2"));
      await flush();
      assert.equal(list.requests[1].offset, 0);
      list.chooseNews();
      list.requests[2].resolve(page("news", 0, "snapshot-2"));
      await flush();
      if (outcome === "success") list.requests[1].resolve(page("all", 0, "snapshot-2"));
      else list.requests[1].reject(new Error("Recovery failed"));
      await loading;
      assert.equal(list.newsSelected(), true);
      assert.equal(list.hasError(), false);
      assert.deepEqual(list.ids(), page("news").entries.map((entry) => entry.id));
    });
  }
});
