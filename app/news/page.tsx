import type { Metadata } from "next";

import { DashboardStats } from "@/components/DashboardStats";
import { FeedClient } from "@/components/FeedClient";
import { SectionHeader } from "@/components/SectionHeader";
import { getDataBundle } from "@/lib/data";
import { formatDateTime } from "@/lib/date";
import { getFeedPage } from "@/lib/feed-page";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { getFeedFiltersFromSearchParams, toFeedItems, type FeedTypeFilter } from "@/lib/filter";
import { pageAlternates } from "@/lib/site";
import { getDashboardStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "뉴스",
  description: "한국축구 이슈 뉴스와 공식자료를 검색하고 확인합니다.",
  alternates: pageAlternates("/news")
};

export const dynamic = "force-dynamic";

const NEWS_TYPES = new Set<FeedTypeFilter>(["all", "news", "official"]);

type NewsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const data = await getDataBundle();
  const newsItems = data.items.filter((item) => item.sourceType !== "youtube");
  const stats = getDashboardStats({
    items: newsItems,
    collectionState: data.collectionState
  });
  const newsCollectorTimes = [
    data.collectionState.collectors?.naver?.lastCollectedAt,
    data.collectionState.collectors?.official?.lastCollectedAt
  ].flatMap((value) => (value ? [value] : []));
  const lastNewsCollectedAt = newsCollectorTimes.sort(
    (left, right) => Date.parse(right) - Date.parse(left)
  )[0] ?? stats.lastCollectedAt;
  const initialFilters = getFeedFiltersFromSearchParams(await searchParams, {
    issueIds: new Set(data.issues.map((issue) => issue.id)),
    personIds: new Set(data.people.map((person) => person.id)),
    allowedTypes: NEWS_TYPES
  });
  const initialPage = getFeedPage(toFeedItems(newsItems), initialFilters, {
    snapshot: getFeedContentRevision(data.items, data.storyClusters),
    storyClusters: data.storyClusters
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <SectionHeader
        action={
          <time
            className="metric-tabular text-xs font-bold text-muted"
            dateTime={lastNewsCollectedAt}
          >
            업데이트 {formatDateTime(lastNewsCollectedAt)}
          </time>
        }
        description="한국축구 이슈와 관련된 뉴스와 공식자료를 검색하고 확인합니다."
        title="뉴스"
      />

      <DashboardStats stats={stats} />

      <div className="mt-6">
        <FeedClient
          initialFilters={initialFilters}
          initialPage={initialPage}
          issues={data.issues}
          mode="news"
          people={data.people}
        />
      </div>
    </div>
  );
}
