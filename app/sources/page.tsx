import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { PublisherStatsPanel, SourceLinksList } from "@/components/SourcesArchiveClient";
import { getDataBundle } from "@/lib/data";
import { defaultFeedFilters, toFeedItems } from "@/lib/filter";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { getSourceLinkPage } from "@/lib/source-link-page";

export const metadata: Metadata = {
  title: "출처 아카이브",
  description: "한국축구 뉴스·공식자료·유튜브의 수집 대상, 발행처, 채널과 원문 링크를 확인합니다."
};

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const data = await getDataBundle();
  const toPublisherStats = (sourceType: "youtube" | "editorial") => Array.from(
    data.items.reduce((counts, item) => {
      const matches =
        sourceType === "youtube"
          ? item.sourceType === "youtube"
          : item.sourceType !== "youtube";
      if (!matches) return counts;
      counts.set(item.publisher, (counts.get(item.publisher) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);
  const publisherStats = toPublisherStats("editorial");
  const youtubeChannelStats = toPublisherStats("youtube");
  const fixedFilters = { ...defaultFeedFilters, scope: "all" as const };
  const initialPage = getSourceLinkPage(
    toFeedItems(data.items),
    fixedFilters,
    { snapshot: getFeedContentRevision(data.items, data.storyClusters) }
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeader
        description="뉴스·공식자료·유튜브의 수집 대상과 원문 출처를 확인합니다."
        title="출처 아카이브"
      />

      <SourceLinksList fixedFilters={fixedFilters} initialPage={initialPage} />

      <div className="mt-10 divide-y divide-rule border-y border-rule lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:divide-x lg:divide-y-0">
        <section aria-labelledby="collection-sources-heading">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-2 py-1 sm:px-4">
            <h2
              className="text-sm font-black tracking-[0.14em] text-muted"
              id="collection-sources-heading"
            >
              수집 대상
            </h2>
            <span className="metric-tabular text-xs font-bold text-muted">
              {data.sources.length}곳
            </span>
          </div>
          <div className="divide-y divide-line">
            {data.sources.map((source) => (
              <a
                className="focus-ring motion-soft grid min-h-11 items-center gap-2 px-2 py-3 text-ink hover:bg-paper sm:grid-cols-[1fr_auto] sm:px-4"
                href={source.url}
                key={source.id}
                rel="noreferrer"
                target="_blank"
              >
                <span>
                  <span className="block text-sm font-black">{source.name}</span>
                  <span className="mt-1 block text-xs font-medium text-muted">
                    {source.type === "official"
                      ? "공식자료 소스"
                      : source.type === "video-api"
                        ? "영상 API 기반 수집"
                        : "뉴스 API 기반 수집"}
                  </span>
                  <span className="sr-only">, 새 창에서 열기</span>
                </span>
                <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </a>
            ))}
          </div>
        </section>

        <div className="divide-y divide-rule">
          <PublisherStatsPanel
            panelId="publisher-stats"
            publisherStats={publisherStats}
            title="뉴스 발행처 통계"
          />
          <PublisherStatsPanel
            panelId="youtube-channel-stats"
            publisherStats={youtubeChannelStats}
            title="유튜브 채널 통계"
          />
        </div>
      </div>
    </div>
  );
}
