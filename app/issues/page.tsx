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
        eyebrow="이슈"
        title="이슈별 보기"
      />
      <div className="mt-8 overflow-hidden rounded-panel border border-line bg-panel shadow-panel">
        <div className="grid grid-cols-[64px_1fr_auto] border-b border-line bg-paper px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-muted">
          <span>순위</span>
          <span>이슈</span>
          <span>항목</span>
        </div>
        <div className="divide-y divide-line">
          {data.issues.map((issue, index) => (
            <Link
              className="focus-ring motion-soft grid grid-cols-[64px_1fr_auto] items-center gap-4 px-4 py-4 text-ink hover:bg-blush"
              href={`/issues/${issue.id}`}
              key={issue.id}
            >
              <span className="metric-tabular text-xl font-black text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <span className="block text-base font-black">{issue.name}</span>
                <span className="mt-1 block max-w-3xl text-sm font-medium leading-6 text-ink-soft">
                  {issue.description}
                </span>
              </span>
              <span className="inline-flex items-center gap-3">
                <span className="metric-tabular text-2xl font-black text-ink">
                  {issueCounts.get(issue.id) ?? 0}
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
