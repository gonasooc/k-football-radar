"use client";

import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { formatDate } from "@/lib/date";
import type { StoryFeedEntry } from "@/lib/feed-page";
import type { Issue, Person } from "@/lib/schema";
import { HighlightedText } from "./HighlightedText";
import { ItemCard } from "./ItemCard";
import { YouTubeCard } from "./YouTubeCard";

const RELATED_PREVIEW_COUNT = 2;

type StoryFeedEntryCardProps = {
  entry: StoryFeedEntry;
  highlightQuery?: string;
  issues: Issue[];
  people: Person[];
  variant?: "row" | "compact";
};

export function StoryFeedEntryCard({
  entry,
  highlightQuery = "",
  issues,
  people,
  variant = "row"
}: StoryFeedEntryCardProps) {
  const relatedLedgerId = useId();
  const [showAllRelated, setShowAllRelated] = useState(false);
  const shouldFocusExpandedNews = useRef(false);
  const firstExpandedNewsRef = useRef<HTMLAnchorElement>(null);
  const hasRelatedNews = entry.related.length > 0;
  const visibleRelated = showAllRelated
    ? entry.related
    : entry.related.slice(0, RELATED_PREVIEW_COUNT);
  const hiddenRelatedCount = Math.max(0, entry.related.length - RELATED_PREVIEW_COUNT);

  useEffect(() => {
    if (showAllRelated && shouldFocusExpandedNews.current) {
      firstExpandedNewsRef.current?.focus();
    }
    shouldFocusExpandedNews.current = false;
  }, [showAllRelated]);

  if (entry.representative.sourceType === "youtube") {
    return (
      <YouTubeCard
        highlightQuery={highlightQuery}
        item={entry.representative}
        issues={issues}
        people={people}
        variant={variant}
      />
    );
  }

  if (!hasRelatedNews) {
    return (
      <ItemCard
        highlightQuery={highlightQuery}
        item={entry.representative}
        issues={issues}
        people={people}
        variant={variant}
      />
    );
  }

  return (
    <div
      aria-label={`${entry.representative.title} 관련 기사 묶음`}
      className={variant === "compact" ? "h-full" : undefined}
      role="group"
    >
      <ItemCard
        highlightQuery={highlightQuery}
        item={entry.representative}
        issues={issues}
        people={people}
        representative
        variant={variant}
      />

      <div className="mx-2 pb-3 sm:mx-3">
        <div className="ml-1 border-l-2 border-line pl-3 sm:ml-2 sm:pl-4">
          <ul className="divide-y divide-line" id={relatedLedgerId}>
            {visibleRelated.map((item, index) => (
              <li className="@container" key={item.id}>
                <a
                  className="group focus-ring motion-soft grid min-h-11 items-center gap-x-3 gap-y-0.5 px-2 py-2 text-sm hover:bg-paper @md:grid-cols-[minmax(0,1fr)_auto]"
                  href={item.url}
                  ref={index === RELATED_PREVIEW_COUNT ? firstExpandedNewsRef : undefined}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="min-w-0 font-bold leading-5 text-ink-soft group-hover:text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">
                    <HighlightedText query={highlightQuery} text={item.title} />
                    <ExternalLink
                      aria-hidden="true"
                      className="ml-1 inline size-3 -translate-y-px text-muted"
                    />
                    <span className="sr-only">, 새 창에서 원문 열기</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-muted">
                    <span>
                      <HighlightedText query={highlightQuery} text={item.publisher} />
                    </span>
                    <span aria-hidden="true" className="hidden @md:inline">
                      ·
                    </span>
                    <time className="metric-tabular" dateTime={item.publishedAt}>
                      {formatDate(item.publishedAt)}
                    </time>
                  </span>
                </a>
              </li>
            ))}
          </ul>

          {hiddenRelatedCount > 0 ? (
            <button
              aria-controls={relatedLedgerId}
              aria-expanded={showAllRelated}
              aria-label={
                showAllRelated
                  ? `관련 기사 접기: ${entry.representative.title}`
                  : `관련 기사 ${hiddenRelatedCount}건 더보기: ${entry.representative.title}`
              }
              className="focus-ring motion-soft mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-xs font-black text-ink-soft hover:bg-paper hover:text-accent"
              onClick={() => {
                shouldFocusExpandedNews.current = !showAllRelated;
                setShowAllRelated((current) => !current);
              }}
              type="button"
            >
              {showAllRelated ? (
                <ChevronUp aria-hidden="true" className="size-4" />
              ) : (
                <ChevronDown aria-hidden="true" className="size-4" />
              )}
              {showAllRelated ? "접기" : `${hiddenRelatedCount}건 더보기`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
