import { ExternalLink } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { formatDate } from "@/lib/date";

export default function SourcesPage() {
  const data = getDataBundle();
  const publisherStats = Array.from(
    data.items.reduce((counts, item) => {
      counts.set(item.publisher, (counts.get(item.publisher) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        description="공식자료 감시 대상과 뉴스 API 기반 수집 방식을 공개하고, 수집된 원문 출처를 확인합니다."
        eyebrow="출처"
        title="출처 아카이브"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-panel border border-line bg-panel shadow-panel">
          <div className="border-b border-line bg-paper px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-muted">
              수집 대상
            </h2>
          </div>
          <div className="divide-y divide-line">
            {data.sources.map((source) => (
              <a
                className="focus-ring motion-soft grid gap-3 p-4 text-ink hover:bg-blush sm:grid-cols-[1fr_auto]"
                href={source.url}
                key={source.id}
                rel="noreferrer"
                target="_blank"
              >
                <span>
                  <span className="block text-sm font-black">{source.name}</span>
                  <span className="mt-1 block text-xs font-medium text-muted">
                    {source.type === "official" ? "공식자료 소스" : "뉴스 API 기반 수집"}
                  </span>
                </span>
                <ExternalLink aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" />
              </a>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-panel border border-line bg-panel shadow-panel">
          <div className="border-b border-line bg-paper px-4 py-3">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-muted">
              발행처 통계
            </h2>
          </div>
          <div className="divide-y divide-line">
            {publisherStats.map(([publisher, count]) => (
              <div
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-bold text-ink"
                key={publisher}
              >
                <span>{publisher}</span>
                <span className="metric-tabular text-accent">{count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
              출처 원장
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">원문 링크 목록</h2>
          </div>
          <p className="hidden text-sm font-medium text-muted sm:block">
            원문 확인 가능한 링크만 보관합니다.
          </p>
        </div>
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-panel border border-line bg-panel">
          {data.items.map((item) => (
            <a
              className="focus-ring motion-soft grid gap-2 p-4 text-sm hover:bg-paper md:grid-cols-[1fr_160px_120px]"
              href={item.url}
              key={item.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="font-black text-ink">{item.title}</span>
              <span className="font-medium text-muted">{item.publisher}</span>
              <span className="metric-tabular font-medium text-muted">
                {formatDate(item.publishedAt)}
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
