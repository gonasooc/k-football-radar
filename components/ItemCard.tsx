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
    <article className="radar-list-item border border-line bg-white/82 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge item={item} />
          {item.labels?.slice(0, 3).map((label) => (
            <span
              className="inline-flex items-center border border-line bg-paper px-2 py-1 text-xs font-bold text-ink/68"
              key={label}
            >
              {label}
            </span>
          ))}
          <span className="ml-auto text-xs font-bold text-ink/55">
            관련도 {item.relevanceScore}
          </span>
        </div>
        <div>
          <h2 className="text-lg font-black leading-snug text-ink sm:text-xl">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">{item.summary}</p>
        </div>
        <dl className="grid gap-2 text-xs text-ink/62 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-black text-ink/45">출처</dt>
            <dd className="mt-1 font-bold text-ink">{item.publisher}</dd>
          </div>
          <div>
            <dt className="font-black text-ink/45">발행일</dt>
            <dd className="mt-1">{formatDate(item.publishedAt)}</dd>
          </div>
          <div>
            <dt className="font-black text-ink/45">수집일</dt>
            <dd className="mt-1">{formatDateTime(item.collectedAt)}</dd>
          </div>
          <div>
            <dt className="font-black text-ink/45">감지 키워드</dt>
            <dd className="mt-1 line-clamp-2">{item.matchedKeywords.join(", ") || "없음"}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {taggedIssues.map((issue) => (
            <IssueBadge issue={issue} key={issue.id} />
          ))}
          {taggedPeople.map((person) => (
            <PersonBadge person={person} key={person.id} />
          ))}
        </div>
        <a
          className="focus-ring inline-flex w-fit items-center gap-2 border border-ink bg-ink px-3 py-2 text-sm font-black text-paper transition hover:bg-pine"
          href={item.url}
          rel="noreferrer"
          target="_blank"
        >
          원문 보기
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
    </article>
  );
}
