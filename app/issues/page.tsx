import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";

export default function IssuesPage() {
  const data = getDataBundle();
  const issueCounts = new Map<string, number>();
  for (const item of data.items) {
    for (const issueId of item.issueTags) {
      issueCounts.set(issueId, (issueCounts.get(issueId) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        description="초기 이슈별로 자동 매칭된 뉴스와 공식자료를 모아서 확인합니다."
        eyebrow="Issues"
        title="이슈별 보기"
      />
      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.issues.map((issue) => (
          <Link
            className="focus-ring group flex min-h-52 flex-col justify-between border border-line bg-white/82 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brass"
            href={`/issues/${issue.id}`}
            key={issue.id}
          >
            <span>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-brass">
                {issueCounts.get(issue.id) ?? 0} items
              </span>
              <span className="mt-3 block text-2xl font-black text-ink">{issue.name}</span>
              <span className="mt-3 block text-sm leading-6 text-ink/66">
                {issue.description}
              </span>
            </span>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-ink group-hover:text-brass">
              상세 보기
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
