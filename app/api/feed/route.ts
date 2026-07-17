import { NextResponse } from "next/server";

import { getDataBundle } from "@/lib/data";
import {
  getFeedPage,
  getFeedPagination,
  hasFeedSnapshotMismatch
} from "@/lib/feed-page";
import { getFeedContentRevision } from "@/lib/feed-snapshot";
import { getFeedFiltersFromSearchParams, toFeedItems } from "@/lib/filter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const data = await getDataBundle();
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);
  const filters = getFeedFiltersFromSearchParams(searchParams, {
    issueIds: new Set(data.issues.map((issue) => issue.id)),
    personIds: new Set(data.people.map((person) => person.id))
  });
  const pagination = getFeedPagination({
    offset: searchParams.offset,
    limit: searchParams.limit
  });
  const snapshot = getFeedContentRevision(data.items, data.storyClusters);

  if (hasFeedSnapshotMismatch(searchParams.snapshot, snapshot, pagination.offset)) {
    return NextResponse.json(
      { error: "feed_snapshot_mismatch", snapshot },
      {
        status: 409,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  const sourceItems =
    searchParams.source === "editorial"
      ? data.items.filter((item) => item.sourceType !== "youtube")
      : data.items;
  const page = getFeedPage(toFeedItems(sourceItems), filters, {
    ...pagination,
    snapshot,
    storyClusters: data.storyClusters
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
    }
  });
}
