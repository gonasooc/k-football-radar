import { ExternalLink } from "lucide-react";

import { formatDate, formatDateTime } from "@/lib/date";
import type { Issue, Person, RadarItem } from "@/lib/schema";
import { IssueBadge, PersonBadge, SourceBadge } from "./Badges";

const HIDDEN_LABELS = new Set(["자동 수집"]);

type ItemCardProps = {
  item: RadarItem;
  issues: Issue[];
  people: Person[];
  variant?: "row" | "compact";
};

export function ItemCard({ item, issues, people, variant = "row" }: ItemCardProps) {
  const issueMap = new Map(issues.map((issue) => [issue.id, issue]));
  const personMap = new Map(people.map((person) => [person.id, person]));
  const taggedIssues = item.issueTags.flatMap((id) => {
    const issue = issueMap.get(id);
    return issue ? [issue] : [];
  });
  const taggedPeople = item.personTags.flatMap((id) => {
    const person = personMap.get(id);
    return person ? [person] : [];
  });
  const visibleLabels = Array.from(
    new Set([
      ...(item.relevanceTier === "secondary" ? ["보조 수집"] : []),
      ...(item.labels?.filter((label) => !HIDDEN_LABELS.has(label)) ?? [])
    ])
  );
  const keywordText = item.matchedKeywords.join(", ") || "없음";

  const badgeRow = (
    <div className="flex flex-wrap items-center gap-2">
      <SourceBadge item={item} />
      {visibleLabels.slice(0, 2).map((label) => (
        <span
          className="inline-flex items-center rounded-chip border border-line bg-paper px-2 py-1 text-xs font-semibold text-muted"
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
  );

  const tagRow = (
    <div className="flex flex-wrap gap-2">
      {taggedIssues.map((issue) => (
        <IssueBadge issue={issue} key={issue.id} />
      ))}
      {taggedPeople.map((person) => (
        <PersonBadge person={person} key={person.id} />
      ))}
    </div>
  );

  const relevanceRow = (
    <p className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 text-xs font-medium leading-5 text-muted">
      <span className="metric-tabular font-bold text-ink">관련도 {item.relevanceScore}</span>
      <span className="line-clamp-2">감지 키워드: {keywordText}</span>
    </p>
  );

  const sourceLink = (
    <a
      className="focus-ring motion-soft inline-flex min-h-10 w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-rule bg-canvas px-3 py-2 text-sm font-black leading-none text-ink hover:border-accent-soft hover:bg-blush hover:text-accent"
      href={item.url}
      rel="noreferrer"
      target="_blank"
    >
      원문
      <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
    </a>
  );

  if (variant === "compact") {
    return (
      <article className="radar-list-item h-full border-t border-line py-4">
        <div className="flex h-full flex-col gap-3">
          {badgeRow}
          <h2 className="line-clamp-2 text-xl font-black leading-snug text-ink" title={item.title}>
            {item.title}
          </h2>
          <p className="line-clamp-3 text-sm font-medium leading-7 text-ink-soft">
            {item.summary}
          </p>
          <div className="mt-auto space-y-3">
            {tagRow}
            {relevanceRow}
            <div className="flex flex-col gap-3 text-xs font-bold leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                {item.publisher} · {formatDate(item.publishedAt)}
              </span>
              {sourceLink}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="radar-list-item motion-soft border-t border-line py-4">
      <div className="grid gap-4 md:grid-cols-[150px_1fr]">
        <aside>
          <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-start">
            <SourceBadge item={item} />
            <p className="metric-tabular text-xs font-bold text-muted">
              {formatDate(item.publishedAt)}
            </p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-1">
            <div>
              <dt className="font-bold uppercase tracking-[0.12em] text-muted">출처</dt>
              <dd className="mt-1 font-bold text-ink">{item.publisher}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-[0.12em] text-muted">수집</dt>
              <dd className="mt-1 font-medium leading-5 text-ink-soft">
                {formatDateTime(item.collectedAt)}
              </dd>
            </div>
          </dl>
        </aside>

        <div>
          <div className="flex flex-col gap-3">
            {visibleLabels.length ? (
              <div className="flex flex-wrap items-center gap-2">
                {visibleLabels.slice(0, 3).map((label) => (
                  <span
                    className="inline-flex items-center rounded-chip border border-line bg-paper px-2 py-1 text-xs font-semibold text-muted"
                    key={label}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <h2
              className="line-clamp-2 text-xl font-black leading-snug text-ink sm:text-2xl"
              title={item.title}
            >
              {item.title}
            </h2>
            <p className="max-w-4xl text-sm font-medium leading-7 text-ink-soft">{item.summary}</p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
              {tagRow}
              {relevanceRow}
            </div>
            {sourceLink}
          </div>
        </div>
      </div>
    </article>
  );
}
