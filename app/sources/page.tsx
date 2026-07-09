import { ExternalLink } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { PublisherStatsPanel, SourceLinksList } from "@/components/SourcesArchiveClient";
import { getDataBundle } from "@/lib/data";

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
        description="수집 대상을 공개하고, 수집 항목의 원문 출처를 확인합니다."
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

        <PublisherStatsPanel publisherStats={publisherStats} />
      </div>

      <SourceLinksList items={data.items} />
    </div>
  );
}
