import { ExternalLink } from "lucide-react";

import { formatDate, formatDateTime } from "@/lib/date";
import type { Issue, Person, RadarItem } from "@/lib/schema";
import { IssueBadge, PersonBadge, SourceBadge } from "./Badges";

type ItemCardProps = {
  item: RadarItem;
  issues: Issue[];
  people: Person[];
};

export function ItemCard({ item, issues, people }: ItemCardProps) {
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

  return (
    <article className="radar-list-item motion-soft overflow-hidden rounded-panel border border-line bg-panel hover:border-accent-soft hover:shadow-lift">
      <div className="grid gap-0 md:grid-cols-[150px_1fr]">
        <aside className="border-b border-line bg-paper p-4 md:border-b-0 md:border-r">
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

        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {item.labels?.slice(0, 3).map((label) => (
                <span
                  className="inline-flex items-center rounded-chip border border-line bg-paper px-2 py-1 text-xs font-semibold text-muted"
                  key={label}
                >
                  {label}
                </span>
              ))}
            </div>
            <h2 className="text-lg font-black leading-snug text-ink sm:text-xl">
              {item.title}
            </h2>
            <p className="max-w-4xl text-sm font-medium leading-7 text-ink-soft">{item.summary}</p>
          </div>

          <div className="mt-4 grid gap-3 border-t border-line pt-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {taggedIssues.map((issue) => (
                  <IssueBadge issue={issue} key={issue.id} />
                ))}
                {taggedPeople.map((person) => (
                  <PersonBadge person={person} key={person.id} />
                ))}
              </div>
              <p className="line-clamp-2 text-xs font-medium leading-5 text-muted">
                감지 키워드: {item.matchedKeywords.join(", ") || "없음"} · 관련도{" "}
                <span className="metric-tabular font-bold text-ink">{item.relevanceScore}</span>
              </p>
            </div>
            <a
              className="focus-ring motion-soft inline-flex min-h-11 w-fit items-center gap-2 rounded-control bg-accent px-3 py-2 text-sm font-bold text-canvas hover:bg-ink"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              원문 보기
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
