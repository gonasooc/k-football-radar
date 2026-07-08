import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";

export default function PeoplePage() {
  const data = getDataBundle();
  const personCounts = new Map<string, number>();
  for (const item of data.items) {
    for (const personId of item.personTags) {
      personCounts.set(personId, (personCounts.get(personId) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        description="자동 수집 항목에서 인물명이 언급된 기록을 중립적으로 모아 봅니다."
        eyebrow="People"
        title="인물별 언급 기록"
      />
      <div className="mt-8 overflow-hidden rounded-panel border border-line bg-panel shadow-panel">
        <div className="grid grid-cols-[1fr_auto] border-b border-line bg-paper px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-muted md:grid-cols-[1fr_1fr_auto]">
          <span>person</span>
          <span className="hidden md:block">keywords</span>
          <span>mentions</span>
        </div>
        <div className="divide-y divide-line">
          {data.people
            .filter((person) => person.published)
            .map((person) => (
              <Link
                className="focus-ring motion-soft grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 text-ink hover:bg-blush md:grid-cols-[1fr_1fr_auto]"
                href={`/people/${person.id}`}
                key={person.id}
              >
                <span>
                  <span className="block text-base font-black">{person.name}</span>
                  <span className="mt-1 block text-sm font-medium leading-6 text-ink-soft">
                    {person.role}
                  </span>
                </span>
                <span className="hidden text-xs font-medium leading-5 text-muted md:block">
                  {person.keywords.join(", ")}
                </span>
                <span className="inline-flex items-center gap-3">
                  <span className="metric-tabular text-xl font-black text-accent">
                    {personCounts.get(person.id) ?? 0}
                  </span>
                  <ArrowRight aria-hidden="true" className="hidden size-4 text-accent sm:block" />
                </span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
