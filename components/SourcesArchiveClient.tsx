"use client";

import { useState } from "react";

import { formatDate } from "@/lib/date";
import { FeedSnapshotMismatchError, fetchSourceLinkPage } from "@/lib/feed-api";
import type { FeedFilters } from "@/lib/filter";
import type { SourceLinkPage } from "@/lib/source-link-page";
import { SourceBadge } from "./Badges";

const PUBLISHER_PREVIEW_COUNT = 5;

type PublisherStatsPanelProps = {
  publisherStats: Array<[string, number]>;
  title?: string;
  panelId?: string;
};

type SourceLinksListProps = {
  fixedFilters: FeedFilters;
  initialPage: SourceLinkPage;
};

export function PublisherStatsPanel({
  publisherStats,
  title = "발행처 통계",
  panelId = "publisher-stats"
}: PublisherStatsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleStats = showAll
    ? publisherStats
    : publisherStats.slice(0, PUBLISHER_PREVIEW_COUNT);
  const hasMoreStats = publisherStats.length > PUBLISHER_PREVIEW_COUNT;

  return (
    <section aria-labelledby={`${panelId}-heading`}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-2 py-1 sm:px-4">
        <h2
          className="text-sm font-black tracking-[0.14em] text-muted"
          id={`${panelId}-heading`}
        >
          {title}
        </h2>
        {hasMoreStats ? (
          <button
            aria-controls={`${panelId}-ledger`}
            aria-expanded={showAll}
            className="focus-ring motion-soft inline-flex min-h-11 items-center justify-center px-2 text-xs font-black text-ink-soft underline decoration-rule underline-offset-4 hover:text-accent"
            onClick={() => setShowAll((current) => !current)}
            type="button"
          >
            {showAll ? "상위 5개" : "전체 보기"}
          </button>
        ) : null}
      </div>
      <div className="divide-y divide-line" id={`${panelId}-ledger`}>
        {visibleStats.length > 0 ? visibleStats.map(([publisher, count]) => (
          <div
            className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-2 py-3 text-sm font-bold text-ink sm:px-4"
            key={publisher}
          >
            <span>{publisher}</span>
            <span className="metric-tabular text-ink-soft">{count}건</span>
          </div>
        )) : (
          <p className="px-4 py-5 text-sm font-medium leading-6 text-ink-soft">
            아직 집계할 항목이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}

export function SourceLinksList({ fixedFilters, initialPage }: SourceLinksListProps) {
  const [results, setResults] = useState(initialPage);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const remainingCount = Math.max(0, results.total - results.items.length);

  const loadMore = async () => {
    if (isLoadingMore) return;

    const requestedOffset = results.items.length;
    const requestedSnapshot = results.snapshot;
    setIsLoadingMore(true);
    setLoadError(false);

    try {
      const nextPage = await fetchSourceLinkPage(fixedFilters, requestedOffset, {
        snapshot: requestedSnapshot
      });
      setResults((current) => {
        if (
          current.items.length !== requestedOffset ||
          current.snapshot !== requestedSnapshot
        ) {
          return current;
        }

        const items = [...current.items, ...nextPage.items];
        return {
          ...nextPage,
          items,
          offset: 0,
          limit: items.length
        };
      });
    } catch (error) {
      if (error instanceof FeedSnapshotMismatchError) {
        try {
          const freshPage = await fetchSourceLinkPage(fixedFilters, 0, {
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
    <section aria-labelledby="source-links-heading" className="mt-10">
      <div className="flex items-end justify-between gap-3 border-b border-rule pb-3">
        <div>
          <h2 className="text-xl font-black text-ink" id="source-links-heading">
            원문 링크 목록
          </h2>
          <p aria-live="polite" className="mt-1 text-xs font-bold text-muted">
            전체 {results.total}개 중 {results.items.length}개 표시
          </p>
        </div>
      </div>
      <div className="hidden min-h-9 grid-cols-[minmax(0,1fr)_90px_160px_120px] items-center border-b border-line px-3 text-[11px] font-black tracking-[0.14em] text-muted md:grid">
        <span>제목</span>
        <span>유형</span>
        <span>발행처</span>
        <span>발행일</span>
      </div>
      <div className="divide-y divide-line border-b border-rule" id="source-link-ledger">
        {results.items.map((item) => (
          <a
            className="group focus-ring motion-soft grid min-h-11 gap-2 px-2 py-3 text-sm hover:bg-paper md:grid-cols-[minmax(0,1fr)_90px_160px_120px] md:items-baseline md:px-3"
            href={item.url}
            key={item.id}
            rel="noreferrer"
            target="_blank"
          >
            <span className="font-black leading-6 text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">
              {item.title}
              <span className="sr-only">, 새 창에서 원문 열기</span>
            </span>
            <span className="hidden md:block">
              <SourceBadge item={item} />
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:contents md:text-sm">
              <span className="flex items-center gap-2 font-medium">
                <span className="md:hidden"><SourceBadge item={item} /></span>
                {item.publisher}
              </span>
              <span aria-hidden="true" className="md:hidden">
                ·
              </span>
              <time
                className="metric-tabular font-medium"
                dateTime={item.publishedAt}
              >
                {formatDate(item.publishedAt)}
              </time>
            </span>
          </a>
        ))}
      </div>
      <div aria-live="polite">
        {loadError ? (
          <p className="border-b border-rule px-3 py-3 text-center text-sm font-bold text-accent">
            원문 링크를 불러오지 못했습니다. 다시 시도해 주세요.
          </p>
        ) : null}
        {results.hasMore ? (
          <button
            aria-controls="source-link-ledger"
            className="focus-ring motion-soft min-h-11 w-full border-b border-rule bg-canvas px-4 text-sm font-black text-ink-soft hover:bg-paper hover:text-accent disabled:cursor-wait disabled:text-muted"
            disabled={isLoadingMore}
            onClick={loadMore}
            type="button"
          >
            {isLoadingMore ? "불러오는 중" : "원문 더보기"}{" "}
            {!isLoadingMore ? (
              <span className="font-medium text-muted">(남은 {remainingCount}개)</span>
            ) : null}
          </button>
        ) : null}
      </div>
    </section>
  );
}
