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
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.people
          .filter((person) => person.published)
          .map((person) => (
            <Link
              className="focus-ring group flex min-h-56 flex-col justify-between border border-line bg-white/82 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-signal"
              href={`/people/${person.id}`}
              key={person.id}
            >
              <span>
                <span className="text-xs font-black uppercase tracking-[0.18em] text-signal">
                  {personCounts.get(person.id) ?? 0} mentions
                </span>
                <span className="mt-3 block text-2xl font-black text-ink">{person.name}</span>
                <span className="mt-2 block text-sm font-bold text-ink/58">{person.role}</span>
                <span className="mt-4 block text-xs leading-5 text-ink/58">
                  {person.keywords.join(", ")}
                </span>
              </span>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-ink group-hover:text-signal">
                타임라인 보기
                <ArrowRight aria-hidden="true" className="size-4" />
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}
