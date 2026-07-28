import { NextResponse } from "next/server";

import { getDataBundle } from "@/lib/data";
import { getFeedContext } from "@/lib/feed-context";
import {
  getFeedPage,
  getFeedPagination,
  hasFeedSnapshotMismatch
} from "@/lib/feed-page";
import { getFeedFiltersFromSearchParams } from "@/lib/filter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const data = await getDataBundle();
  const { editorialFeedItems, feedItems, revision, similarityModels } =
    getFeedContext(data);
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
  if (hasFeedSnapshotMismatch(searchParams.snapshot, revision, pagination.offset)) {
    return NextResponse.json(
      { error: "feed_snapshot_mismatch", snapshot: revision },
      {
        status: 409,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  const sourceItems =
    searchParams.source === "editorial" ? editorialFeedItems : feedItems;
  const page = getFeedPage(sourceItems, filters, {
    ...pagination,
    snapshot: revision,
    storyClusters: data.storyClusters,
    similarityModels
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
    }
  });
}
