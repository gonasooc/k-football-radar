import { NextResponse } from "next/server";

import { getDataBundle, getDataStatus } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDataBundle();
    return NextResponse.json(
      {
        status: "ok",
        data: {
          ...getDataStatus(),
          snapshot: data.collectionState.lastCollectedAt
        }
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: "data_unavailable",
        message: error instanceof Error ? error.message : String(error)
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
