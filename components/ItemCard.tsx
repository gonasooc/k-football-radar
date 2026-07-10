import { ExternalLink } from "lucide-react";

import { formatDate } from "@/lib/date";
import type { Issue, Person, RadarItem } from "@/lib/schema";
import { IssueBadge, PersonBadge, SourceBadge } from "./Badges";
import { HighlightedText } from "./HighlightedText";

const DIAGNOSTIC_LABELS = new Set([
  "자동 수집",
  "감사 키워드 포함",
  "공식 출처",
  "선거 키워드 포함",
  "인물 언급",
  "해명 키워드 포함"
]);

type ItemCardProps = {
  item: Pick<
    RadarItem,
    | "id"
    | "title"
    | "summary"
    | "url"
    | "publisher"
    | "publishedAt"
    | "issueTags"
    | "personTags"
    | "sourceType"
    | "relevanceTier"
    | "labels"
  >;
  highlightQuery?: string;
  issues: Issue[];
  people: Person[];
  variant?: "row" | "compact";
};

export function ItemCard({
  item,
  highlightQuery = "",
  issues,
  people,
  variant = "row"
}: ItemCardProps) {
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
      ...(item.labels?.filter((label) => !DIAGNOSTIC_LABELS.has(label)) ?? [])
    ])
  );
  const tagLimit = variant === "compact" ? 4 : 6;
  const allTags = [
    ...taggedIssues.map((issue) => ({
      id: `issue-${issue.id}`,
      node: <IssueBadge issue={issue} key={`issue-${issue.id}`} />
    })),
    ...taggedPeople.map((person) => ({
      id: `person-${person.id}`,
      node: <PersonBadge person={person} key={`person-${person.id}`} />
    }))
  ];

  const metadataRow = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
      <SourceBadge item={item} />
      {visibleLabels.slice(0, 1).map((label) => (
        <span className="text-ink-soft" key={label}>
          {label}
        </span>
      ))}
      <span>
        <HighlightedText query={highlightQuery} text={item.publisher} />
      </span>
      <span aria-hidden="true">·</span>
      <time className="metric-tabular" dateTime={item.publishedAt}>
        {formatDate(item.publishedAt)}
      </time>
    </div>
  );

  const tagRow = allTags.length ? (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {allTags.slice(0, tagLimit).map((tag) => (
        <span key={tag.id}>{tag.node}</span>
      ))}
    </div>
  ) : null;

  if (variant === "compact") {
    return (
      <article className="radar-list-item editorial-hover h-full border-t border-line px-2 py-5 first:border-t-rule sm:px-3 lg:border-t-rule lg:px-5">
        <div className="flex h-full flex-col">
          {metadataRow}
          <h2 className="mt-3 text-xl font-black leading-snug tracking-[-0.018em] text-ink sm:line-clamp-2 sm:text-[1.375rem]">
            <a
              className="focus-ring decoration-rule underline-offset-4 hover:underline"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              <HighlightedText query={highlightQuery} text={item.title} />
              <ExternalLink
                aria-hidden="true"
                className="ml-1.5 inline size-4 -translate-y-px text-muted"
              />
              <span className="sr-only">, 새 창에서 원문 열기</span>
            </a>
          </h2>
          <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-summary">
            <HighlightedText query={highlightQuery} text={item.summary} />
          </p>
          {tagRow ? <div className="mt-auto pt-4">{tagRow}</div> : null}
        </div>
      </article>
    );
  }

  return (
    <article className="radar-list-item editorial-hover motion-soft border-t border-line px-2 py-5 sm:px-3">
      <div className="min-w-0">
        {metadataRow}
        <h2 className="mt-2 text-xl font-black leading-snug tracking-[-0.018em] text-ink sm:line-clamp-2 sm:text-[1.375rem]">
          <a
            className="focus-ring decoration-rule underline-offset-4 hover:underline"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            <HighlightedText query={highlightQuery} text={item.title} />
            <ExternalLink
              aria-hidden="true"
              className="ml-1.5 inline size-4 -translate-y-px text-muted"
            />
            <span className="sr-only">, 새 창에서 원문 열기</span>
          </a>
        </h2>
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-summary">
          <HighlightedText query={highlightQuery} text={item.summary} />
        </p>
        {tagRow ? <div className="mt-3">{tagRow}</div> : null}
      </div>
    </article>
  );
}
