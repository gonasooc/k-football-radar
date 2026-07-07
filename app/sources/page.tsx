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
        eyebrow="Sources"
        title="출처 아카이브"
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="text-xl font-black text-ink">수집 대상</h2>
          <div className="mt-4 space-y-3">
            {data.sources.map((source) => (
              <a
                className="focus-ring flex items-start justify-between gap-4 border border-line bg-white/82 p-4 text-ink shadow-sm transition hover:border-pine"
                href={source.url}
                key={source.id}
                rel="noreferrer"
                target="_blank"
              >
                <span>
                  <span className="block text-sm font-black">{source.name}</span>
                  <span className="mt-1 block text-xs font-bold text-ink/55">
                    {source.type === "official" ? "공식자료 소스" : "뉴스 API 기반 수집"}
                  </span>
                </span>
                <ExternalLink aria-hidden="true" className="mt-1 size-4 shrink-0 text-pine" />
              </a>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black text-ink">Publisher 통계</h2>
          <div className="mt-4 space-y-2">
            {publisherStats.map(([publisher, count]) => (
              <div
                className="flex items-center justify-between border border-line bg-white/82 px-4 py-3 text-sm font-bold text-ink"
                key={publisher}
              >
                <span>{publisher}</span>
                <span className="text-pine">{count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-black text-ink">원문 링크 목록</h2>
        <div className="mt-4 divide-y divide-line border border-line bg-white/82">
          {data.items.map((item) => (
            <a
              className="focus-ring grid gap-2 p-4 text-sm transition hover:bg-paper md:grid-cols-[1fr_160px_120px]"
              href={item.url}
              key={item.id}
              rel="noreferrer"
              target="_blank"
            >
              <span className="font-black text-ink">{item.title}</span>
              <span className="font-bold text-ink/58">{item.publisher}</span>
              <span className="font-bold text-ink/58">{formatDate(item.publishedAt)}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
