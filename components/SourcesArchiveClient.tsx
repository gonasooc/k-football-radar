"use client";

import { useState } from "react";

import { formatDate } from "@/lib/date";

const PUBLISHER_PREVIEW_COUNT = 5;
const LINK_PAGE_SIZE = 30;

type PublisherStatsPanelProps = {
  publisherStats: Array<[string, number]>;
};

type SourceLinksListProps = {
  items: Array<{
    id: string;
    url: string;
    title: string;
    publisher: string;
    publishedAt: string;
  }>;
};

export function PublisherStatsPanel({ publisherStats }: PublisherStatsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleStats = showAll
    ? publisherStats
    : publisherStats.slice(0, PUBLISHER_PREVIEW_COUNT);
  const hasMoreStats = publisherStats.length > PUBLISHER_PREVIEW_COUNT;

  return (
    <section aria-labelledby="publisher-stats-heading">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-2 py-1 sm:px-4">
        <h2
          className="text-sm font-black tracking-[0.14em] text-muted"
          id="publisher-stats-heading"
        >
          발행처 통계
        </h2>
        {hasMoreStats ? (
          <button
            aria-controls="publisher-stats-ledger"
            aria-expanded={showAll}
            className="focus-ring motion-soft inline-flex min-h-11 items-center justify-center px-2 text-xs font-black text-ink-soft underline decoration-rule underline-offset-4 hover:text-accent"
            onClick={() => setShowAll((current) => !current)}
            type="button"
          >
            {showAll ? "상위 5개" : "전체 보기"}
          </button>
        ) : null}
      </div>
      <div className="divide-y divide-line" id="publisher-stats-ledger">
        {visibleStats.map(([publisher, count]) => (
          <div
            className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-2 py-3 text-sm font-bold text-ink sm:px-4"
            key={publisher}
          >
            <span>{publisher}</span>
            <span className="metric-tabular text-ink-soft">{count}건</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SourceLinksList({ items }: SourceLinksListProps) {
  const [visibleCount, setVisibleCount] = useState(LINK_PAGE_SIZE);
  const visibleItems = items.slice(0, visibleCount);
  const hasMoreItems = visibleCount < items.length;
  const remainingCount = items.length - visibleItems.length;

  return (
    <section aria-labelledby="source-links-heading" className="mt-10">
      <div className="flex items-end justify-between gap-3 border-b border-rule pb-3">
        <div>
          <h2 className="text-xl font-black text-ink" id="source-links-heading">
            원문 링크 목록
          </h2>
          <p aria-live="polite" className="mt-1 text-xs font-bold text-muted">
            전체 {items.length}개 중 {visibleItems.length}개 표시
          </p>
        </div>
      </div>
      <div className="hidden min-h-9 grid-cols-[minmax(0,1fr)_160px_120px] items-center border-b border-line px-3 text-[11px] font-black tracking-[0.14em] text-muted md:grid">
        <span>제목</span>
        <span>발행처</span>
        <span>발행일</span>
      </div>
      <div className="divide-y divide-line border-b border-rule" id="source-link-ledger">
        {visibleItems.map((item) => (
          <a
            className="group focus-ring motion-soft grid min-h-11 gap-2 px-2 py-3 text-sm hover:bg-paper md:grid-cols-[minmax(0,1fr)_160px_120px] md:items-baseline md:px-3"
            href={item.url}
            key={item.id}
            rel="noreferrer"
            target="_blank"
          >
            <span className="font-black leading-6 text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">
              {item.title}
              <span className="sr-only">, 새 창에서 원문 열기</span>
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:contents md:text-sm">
              <span className="font-medium">{item.publisher}</span>
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
      {hasMoreItems ? (
        <button
          aria-controls="source-link-ledger"
          className="focus-ring motion-soft min-h-11 w-full border-b border-rule bg-canvas px-4 text-sm font-black text-ink-soft hover:bg-paper hover:text-accent"
          onClick={() =>
            setVisibleCount((current) => Math.min(current + LINK_PAGE_SIZE, items.length))
          }
          type="button"
        >
          원문 더보기 <span className="font-medium text-muted">(남은 {remainingCount}개)</span>
        </button>
      ) : null}
    </section>
  );
}
