import Link from "next/link";

import type { Issue, Person, RadarItem } from "@/lib/schema";

export function SourceBadge({ item }: { item: Pick<RadarItem, "sourceType"> }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-chip border px-2 text-[11px] font-black ${
        item.sourceType === "official"
          ? "border-official/25 bg-panel text-official"
          : "border-accent-soft bg-blush text-accent"
      }`}
    >
      {item.sourceType === "official" ? "공식자료" : "뉴스"}
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
