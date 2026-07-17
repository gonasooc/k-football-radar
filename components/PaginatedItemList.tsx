"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { FeedSnapshotMismatchError, fetchFeedPage } from "@/lib/feed-api";
import type { FeedPage } from "@/lib/feed-page";
import type { FeedFilters } from "@/lib/filter";
import type { Issue, Person } from "@/lib/schema";
import { EmptyState } from "./EmptyState";
import { StoryFeedEntryCard } from "./StoryFeedEntryCard";

type PaginatedItemListProps = {
  fixedFilters: FeedFilters;
  initialPage: FeedPage;
  issues: Issue[];
  people: Person[];
  heading: string;
  headingId: string;
  emptyDescription: string;
  emptyTitle: string;
};

export function PaginatedItemList({
  fixedFilters,
  initialPage,
  issues,
  people,
  heading,
  headingId,
  emptyDescription,
  emptyTitle
}: PaginatedItemListProps) {
  const [results, setResults] = useState(initialPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const remainingCount = Math.max(0, results.totalEntries - results.entries.length);

  const loadMore = async () => {
    if (isLoadingMore) return;

    const requestedOffset = results.entries.length;
    const requestedSnapshot = results.snapshot;
    setIsLoadingMore(true);
    setLoadError(false);

    try {
      const nextPage = await fetchFeedPage(fixedFilters, requestedOffset, {
        snapshot: requestedSnapshot
      });
      setResults((current) => {
        if (
          current.entries.length !== requestedOffset ||
          current.snapshot !== requestedSnapshot
        ) {
          return current;
        }

        const entries = [...current.entries, ...nextPage.entries];
        return {
          ...nextPage,
          entries,
          offset: 0,
          limit: entries.length
        };
      });
    } catch (error) {
      if (error instanceof FeedSnapshotMismatchError) {
        try {
          const freshPage = await fetchFeedPage(fixedFilters, 0, {
            snapshot: error.snapshot
          });
          setResults(freshPage);
          return;
        } catch {
          setLoadError(true);
          return;
        }
      }
      setLoadError(true);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 pb-2">
        <h2 className="text-sm font-black text-ink" id={headingId}>
          {heading}
        </h2>
        <span
          aria-atomic="true"
          aria-live="polite"
          className="metric-tabular text-xs font-bold text-ink-soft"
        >
          {results.totalEntries}개 주제·자료 · 원문 {results.totalItems}건
        </span>
      </div>
      {results.entries.length > 0 ? (
        <>
          <div className="border-b border-rule" id="detail-feed-ledger">
            {results.entries.map((entry) => (
              <StoryFeedEntryCard
                entry={entry}
                issues={issues}
                key={entry.id}
                people={people}
              />
            ))}
          </div>
          <div aria-live="polite">
            {loadError ? (
              <p className="border-b border-rule px-3 py-3 text-center text-sm font-bold text-accent">
                자료를 불러오지 못했습니다. 다시 시도해 주세요.
              </p>
            ) : null}
            {results.hasMore ? (
              <button
                aria-controls="detail-feed-ledger"
                className="focus-ring motion-soft flex min-h-11 w-full items-center justify-center gap-2 border-b border-rule bg-canvas px-4 text-sm font-black text-ink-soft hover:bg-paper hover:text-accent disabled:cursor-wait disabled:text-muted"
                disabled={isLoadingMore}
                onClick={loadMore}
                type="button"
              >
                {isLoadingMore ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : null}
                {isLoadingMore ? "불러오는 중" : "더보기"}
                {!isLoadingMore ? (
                  <span className="font-medium text-muted">
                    (남은 {remainingCount}개 주제·자료)
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState description={emptyDescription} title={emptyTitle} />
      )}
    </>
  );
}
