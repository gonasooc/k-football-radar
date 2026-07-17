"use client";

import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";

import { FeedSnapshotMismatchError, fetchFeedPage } from "@/lib/feed-api";
import type { FeedPage } from "@/lib/feed-page";
import type { FeedFilters, FeedTypeFilter } from "@/lib/filter";
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

const TYPE_OPTIONS: readonly [FeedTypeFilter, string][] = [
  ["all", "전체"],
  ["news", "뉴스"],
  ["official", "공식"],
  ["youtube", "유튜브"]
];

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
  const [typeFilter, setTypeFilter] = useState<FeedTypeFilter>(fixedFilters.type);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const filterRequestId = useRef(0);
  const activeFilters = { ...fixedFilters, type: typeFilter };
  const remainingCount = Math.max(0, results.totalEntries - results.entries.length);

  const applyTypeFilter = async (nextType: FeedTypeFilter) => {
    if (nextType === typeFilter || isFiltering) return;
    const previousType = typeFilter;
    const requestId = ++filterRequestId.current;
    setTypeFilter(nextType);
    setIsFiltering(true);
    setLoadError(false);
    setIsLoadingMore(false);

    try {
      const page = await fetchFeedPage({ ...fixedFilters, type: nextType }, 0);
      if (filterRequestId.current === requestId) setResults(page);
    } catch {
      if (filterRequestId.current === requestId) {
        setTypeFilter(previousType);
        setLoadError(true);
      }
    } finally {
      if (filterRequestId.current === requestId) setIsFiltering(false);
    }
  };

  const loadMore = async () => {
    if (isLoadingMore) return;

    const requestedOffset = results.entries.length;
    const requestedSnapshot = results.snapshot;
    setIsLoadingMore(true);
    setLoadError(false);

    try {
      const nextPage = await fetchFeedPage(activeFilters, requestedOffset, {
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
          const freshPage = await fetchFeedPage(activeFilters, 0, {
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
      <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
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
      <div
        aria-label="관련 자료 유형"
        className="mb-4 grid min-h-11 grid-cols-4 overflow-hidden rounded-control border border-rule bg-canvas sm:max-w-sm"
        role="group"
      >
        {TYPE_OPTIONS.map(([value, label]) => {
          const selected = typeFilter === value;
          return (
            <button
              aria-pressed={selected}
              className={`focus-ring motion-soft min-h-11 text-xs font-black ${
                selected
                  ? "bg-accent text-canvas"
                  : "text-ink-soft hover:bg-paper hover:text-ink"
              }`}
              disabled={isFiltering}
              key={value}
              onClick={() => void applyTypeFilter(value)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
      {isFiltering ? (
        <div className="flex min-h-36 items-center justify-center border-y border-line text-sm font-bold text-ink-soft" role="status">
          <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" />
          자료 유형을 적용하고 있습니다.
        </div>
      ) : results.entries.length > 0 ? (
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
