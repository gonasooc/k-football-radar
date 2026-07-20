import Link from "next/link";
import { BadgeCheck, Newspaper, Youtube } from "lucide-react";

import type { Issue, Person, RadarItem } from "@/lib/schema";

export function SourceBadge({ item }: { item: Pick<RadarItem, "sourceType"> }) {
  const label =
    item.sourceType === "official"
      ? "공식자료"
      : item.sourceType === "youtube"
        ? "유튜브"
        : "뉴스";
  const Icon =
    item.sourceType === "official"
      ? BadgeCheck
      : item.sourceType === "youtube"
        ? Youtube
        : Newspaper;

  return (
    <span className="inline-flex shrink-0 items-center justify-center text-ink-soft">
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function IssueBadge({ issue }: { issue: Issue }) {
  return (
    <Link
      className="focus-ring motion-soft inline-flex min-h-11 items-center rounded-control bg-paper px-2 text-xs font-bold text-ink-soft hover:bg-blush hover:text-accent"
      href={`/issues/${issue.id}`}
    >
      #{issue.name}
    </Link>
  );
}

export function PersonBadge({ person }: { person: Person }) {
  return (
    <Link
      className="focus-ring motion-soft inline-flex min-h-11 items-center rounded-control bg-paper px-2 text-xs font-bold text-ink-soft hover:bg-blush hover:text-accent"
      href={`/people/${person.id}`}
    >
      @{person.name}
    </Link>
  );
}
