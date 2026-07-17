import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatDateTime } from "@/lib/date";
import type { FeedPage } from "@/lib/feed-page";
import type { Issue, Person } from "@/lib/schema";
import { EmptyState } from "./EmptyState";
import { StoryFeedEntryCard } from "./StoryFeedEntryCard";

type HomeFeedSectionProps = {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  href: "/news" | "/youtube";
  issues: Issue[];
  lastCollectedAt?: string;
  page: FeedPage;
  people: Person[];
  title: string;
};

export function HomeFeedSection({
  description,
  emptyDescription,
  emptyTitle,
  href,
  issues,
  lastCollectedAt,
  page,
  people,
  title
}: HomeFeedSectionProps) {
  const featured = page.entries.slice(0, 3);
  const remaining = page.entries.slice(3, 6);
  const headingId = `${href.slice(1)}-section-title`;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-2xl font-black leading-tight tracking-[-0.02em] text-ink sm:text-3xl"
            id={headingId}
          >
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-ink-soft">
            {description}
          </p>
          <p className="metric-tabular mt-1 text-xs font-bold text-muted">
            {lastCollectedAt
              ? `업데이트 ${formatDateTime(lastCollectedAt)}`
              : "첫 수집을 준비하고 있습니다."}
          </p>
        </div>
        <Link
          aria-label={`${title} 더보기`}
          className="focus-ring motion-soft inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start text-sm font-black text-ink-soft underline decoration-rule underline-offset-4 hover:text-accent sm:self-auto"
          href={href}
        >
          더보기
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {page.entries.length > 0 ? (
        <div className="space-y-6">
          <div className="grid border-b border-rule lg:grid-cols-3 lg:divide-x lg:divide-line">
            {featured.map((entry) => (
              <StoryFeedEntryCard
                entry={entry}
                issues={issues}
                key={entry.id}
                people={people}
                variant="compact"
              />
            ))}
          </div>
          {remaining.length > 0 ? (
            <div className="grid border-b border-rule lg:grid-cols-3 lg:divide-x lg:divide-line">
              {remaining.map((entry) => (
                <StoryFeedEntryCard
                  entry={entry}
                  issues={issues}
                  key={entry.id}
                  people={people}
                  variant="compact"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState description={emptyDescription} title={emptyTitle} />
      )}
    </section>
  );
}
