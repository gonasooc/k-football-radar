"use client";

import { useState } from "react";

import { formatDate } from "@/lib/date";
import type { RadarItem } from "@/lib/schema";

const PUBLISHER_PREVIEW_COUNT = 10;
const LINK_PAGE_SIZE = 30;

type PublisherStatsPanelProps = {
  publisherStats: Array<[string, number]>;
};

type SourceLinksListProps = {
  items: RadarItem[];
};

export function PublisherStatsPanel({ publisherStats }: PublisherStatsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleStats = showAll
    ? publisherStats
    : publisherStats.slice(0, PUBLISHER_PREVIEW_COUNT);
  const hasMoreStats = publisherStats.length > PUBLISHER_PREVIEW_COUNT;

  return (
    <section className="overflow-hidden border-y border-rule bg-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-muted">
          발행처 통계
        </h2>
        {hasMoreStats ? (
          <button
            className="focus-ring motion-soft min-h-9 rounded-control border border-rule bg-canvas px-3 text-xs font-black text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
            onClick={() => setShowAll((current) => !current)}
            type="button"
          >
            {showAll ? "상위 10개" : "전체 보기"}
          </button>
        ) : null}
      </div>
      <div className="divide-y divide-line">
        {visibleStats.map(([publisher, count]) => (
          <div
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-bold text-ink"
            key={publisher}
          >
            <span>{publisher}</span>
            <span className="metric-tabular text-accent">{count}</span>
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

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-xl font-black text-ink">원문 링크 목록</h2>
          <p className="mt-1 text-xs font-bold text-muted">
            전체 {items.length}개 중 {visibleItems.length}개 표시
          </p>
        </div>
        <p className="hidden text-sm font-medium text-muted sm:block">
          원문 확인 가능한 링크만 보관합니다.
        </p>
      </div>
      <div className="mt-4 divide-y divide-line border-y border-rule bg-panel">
        {visibleItems.map((item) => (
          <a
            className="focus-ring motion-soft grid gap-2 p-4 text-sm hover:bg-paper md:grid-cols-[1fr_160px_120px]"
            href={item.url}
            key={item.id}
            rel="noreferrer"
            target="_blank"
          >
            <span className="font-black text-ink">{item.title}</span>
            <span className="font-medium text-muted">{item.publisher}</span>
            <span className="metric-tabular font-medium text-muted">
              {formatDate(item.publishedAt)}
            </span>
          </a>
        ))}
      </div>
      {hasMoreItems ? (
        <div className="mt-4 flex justify-center">
          <button
            className="focus-ring motion-soft min-h-11 rounded-control border border-rule bg-canvas px-4 text-sm font-black text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
            onClick={() =>
              setVisibleCount((current) => Math.min(current + LINK_PAGE_SIZE, items.length))
            }
            type="button"
          >
            더보기
          </button>
        </div>
      ) : null}
    </section>
  );
}
