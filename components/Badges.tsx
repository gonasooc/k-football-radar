import Link from "next/link";

import type { Issue, Person, RadarItem } from "@/lib/schema";

export function SourceBadge({ item }: { item: RadarItem }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip border px-2.5 py-1 text-xs font-bold ${
        item.isOfficial
          ? "border-official/25 bg-panel text-official"
          : "border-accent-soft bg-blush text-accent"
      }`}
    >
      {item.isOfficial ? "공식자료" : "뉴스"}
    </span>
  );
}

export function IssueBadge({ issue }: { issue: Issue }) {
  return (
    <Link
      className="focus-ring motion-soft inline-flex items-center rounded-chip border border-line bg-panel px-2.5 py-1 text-xs font-bold text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
      href={`/issues/${issue.id}`}
    >
      {issue.name}
    </Link>
  );
}

export function PersonBadge({ person }: { person: Person }) {
  return (
    <Link
      className="focus-ring motion-soft inline-flex items-center rounded-chip border border-line bg-panel px-2.5 py-1 text-xs font-bold text-ink-soft hover:border-accent-soft hover:bg-blush hover:text-accent"
      href={`/people/${person.id}`}
    >
      {person.name}
    </Link>
  );
}
