import { notFound } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { ItemCard } from "@/components/ItemCard";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle, getIssueById, getItemsForIssue } from "@/lib/data";

export function generateStaticParams() {
  return getDataBundle().issues.map((issue) => ({ id: issue.id }));
}

export default async function IssueDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = getDataBundle();
  const issue = getIssueById(id);

  if (!issue) {
    notFound();
  }

  const items = getItemsForIssue(issue.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        description={issue.description}
        eyebrow={`${items.length} matched items`}
        title={issue.name}
      />
      <div className="mt-6 rounded-panel border border-line bg-panel p-4 shadow-panel">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-muted">
          감지 키워드
        </p>
        <div className="flex flex-wrap gap-2">
          {issue.keywords.map((keyword) => (
            <span
              className="rounded-chip border border-line bg-paper px-2.5 py-1 text-xs font-bold text-ink-soft"
              key={keyword}
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <ItemCard item={item} issues={data.issues} key={item.id} people={data.people} />
          ))
        ) : (
          <EmptyState title="이 이슈에 매칭된 수집 항목이 없습니다." />
        )}
      </div>
    </div>
  );
}
