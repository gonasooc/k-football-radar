import Link from "next/link";

import type { Issue, Person, RadarItem } from "@/lib/schema";

export function SourceBadge({ item }: { item: RadarItem }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-1 text-xs font-black ${
        item.isOfficial
          ? "border-pine/30 bg-pine/10 text-pine"
          : "border-harbor/30 bg-harbor/10 text-harbor"
      }`}
    >
      {item.isOfficial ? "공식자료" : "뉴스"}
    </span>
  );
}

export function IssueBadge({ issue }: { issue: Issue }) {
  return (
    <Link
      className="focus-ring inline-flex items-center border border-brass/30 bg-brass/10 px-2 py-1 text-xs font-black text-ink transition hover:border-brass"
      href={`/issues/${issue.id}`}
    >
      {issue.name}
    </Link>
  );
}

export function PersonBadge({ person }: { person: Person }) {
  return (
    <Link
      className="focus-ring inline-flex items-center border border-signal/30 bg-signal/10 px-2 py-1 text-xs font-black text-signal transition hover:border-signal"
      href={`/people/${person.id}`}
    >
      {person.name}
    </Link>
  );
}
