import { createRemoteDataLoader, type RemoteDataStatus } from "./remote-data";
import type { DataBundle } from "./schema";

let localData: DataBundle | null = null;

async function getLocalDataBundle(): Promise<DataBundle> {
  if (!localData) {
    const { readLocalDataBundle } = await import("./local-data");
    localData = readLocalDataBundle();
  }
  return localData;
}

const remoteBaseUrl = process.env.RADAR_DATA_BASE_URL?.trim();
const remoteLoader = remoteBaseUrl
  ? createRemoteDataLoader({ baseUrl: remoteBaseUrl })
  : null;

export async function getDataBundle(): Promise<DataBundle> {
  if (remoteLoader) {
    return remoteLoader.getDataBundle();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("RADAR_DATA_BASE_URL is required in production");
  }
  return getLocalDataBundle();
}

export function getDataStatus(): RemoteDataStatus | {
  source: "local";
  snapshot: string | null;
  refreshedAt: null;
  stale: false;
  lastError: null;
} {
  if (remoteLoader) {
    return remoteLoader.getStatus();
  }
  return {
    source: "local",
    snapshot: localData?.collectionState.lastCollectedAt ?? null,
    refreshedAt: null,
    stale: false,
    lastError: null
  };
}
