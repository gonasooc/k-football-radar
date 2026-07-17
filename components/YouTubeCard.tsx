"use client";

import Image from "next/image";
import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";

import { formatDate } from "@/lib/date";
import type { FeedItem } from "@/lib/filter";
import type { Issue, Person } from "@/lib/schema";
import { IssueBadge, PersonBadge, SourceBadge } from "./Badges";
import { HighlightedText } from "./HighlightedText";

type YouTubeCardProps = {
  item: FeedItem;
  highlightQuery?: string;
  issues: Issue[];
  people: Person[];
  variant?: "row" | "compact";
};

function formatDuration(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function VideoThumbnail({
  item,
  sizes
}: {
  item: FeedItem;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);
  const thumbnail = item.youtube?.thumbnail;

  return (
    <a
      aria-hidden="true"
      className="focus-ring group relative block aspect-video min-h-11 overflow-hidden bg-panel-strong"
      href={item.url}
      rel="noreferrer"
      tabIndex={-1}
      target="_blank"
    >
      {!failed && thumbnail ? (
        <Image
          alt=""
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
          fill
          onError={() => setFailed(true)}
          sizes={sizes}
          src={thumbnail.url}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-paper text-muted">
          <Play aria-hidden="true" className="size-8" strokeWidth={1.6} />
          <span className="sr-only">썸네일을 불러오지 못했습니다.</span>
        </span>
      )}
      {item.youtube ? (
        <span className="metric-tabular absolute bottom-2 right-2 bg-ink/90 px-1.5 py-0.5 text-[11px] font-black text-canvas">
          {formatDuration(item.youtube.durationSeconds)}
        </span>
      ) : null}
    </a>
  );
}

export function YouTubeCard({
  item,
  highlightQuery = "",
  issues,
  people,
  variant = "row"
}: YouTubeCardProps) {
  const issueMap = new Map(issues.map((issue) => [issue.id, issue]));
  const personMap = new Map(people.map((person) => [person.id, person]));
  const tags = [
    ...item.issueTags.flatMap((id) => {
      const issue = issueMap.get(id);
      return issue ? [{ id: `issue-${id}`, node: <IssueBadge issue={issue} /> }] : [];
    }),
    ...item.personTags.flatMap((id) => {
      const person = personMap.get(id);
      return person ? [{ id: `person-${id}`, node: <PersonBadge person={person} /> }] : [];
    })
  ];
  const tagLimit = variant === "compact" ? 3 : 5;

  const metadata = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
      <SourceBadge item={item} />
      {item.relevanceTier === "secondary" ? (
        <span className="text-ink-soft">보조 수집</span>
      ) : null}
      <span>
        <HighlightedText query={highlightQuery} text={item.publisher} />
      </span>
      <span aria-hidden="true">·</span>
      <time className="metric-tabular" dateTime={item.publishedAt}>
        {formatDate(item.publishedAt)}
      </time>
    </div>
  );

  const content = (
    <div className="flex min-w-0 flex-1 flex-col">
      {metadata}
      <h2 className="mt-2 text-xl font-black leading-snug tracking-[-0.018em] text-ink sm:line-clamp-2 sm:text-[1.375rem]">
        <a
          className="focus-ring decoration-rule underline-offset-4 hover:underline"
          href={item.url}
          rel="noreferrer"
          target="_blank"
        >
          <HighlightedText query={highlightQuery} text={item.title} />
          <ExternalLink aria-hidden="true" className="ml-1.5 inline size-4 -translate-y-px text-muted" />
          <span className="sr-only">, 새 창에서 유튜브 영상 열기</span>
        </a>
      </h2>
      {item.summary ? (
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-summary">
          <HighlightedText query={highlightQuery} text={item.summary} />
        </p>
      ) : null}
      <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 pt-3">
        {tags.slice(0, tagLimit).map((tag) => (
          <span key={tag.id}>{tag.node}</span>
        ))}
        <span
          aria-label={`관련도 ${item.relevanceScore}점`}
          className="inline-flex items-baseline gap-1 whitespace-nowrap text-[11px] font-semibold text-muted"
        >
          관련도
          <span className="metric-tabular font-black text-ink-soft">{item.relevanceScore}</span>
        </span>
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <article className="radar-list-item editorial-hover flex h-full flex-col border-t border-line px-2 py-5 first:border-t-rule sm:px-3 lg:border-t-rule lg:px-5">
        <VideoThumbnail item={item} sizes="(min-width: 1024px) 30vw, 100vw" />
        <div className="mt-4 flex flex-1">{content}</div>
      </article>
    );
  }

  return (
    <article className="radar-list-item editorial-hover border-t border-line px-2 py-5 sm:px-3">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
        <VideoThumbnail item={item} sizes="(min-width: 640px) 220px, 100vw" />
        {content}
      </div>
    </article>
  );
}
