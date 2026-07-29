import {
  dataSnapshotManifestSchema,
  parseDataSnapshot,
  type DataSnapshotManifest
} from "./data-snapshot";
import type { DataBundle } from "./schema";

const DEFAULT_CACHE_TTL_MS = 60_000;
const FAILED_REFRESH_RETRY_MS = 30_000;
// A refresh no longer blocks a request, so a hung connection would freeze the
// served snapshot with nothing to notice it. The timeout turns that into an
// ordinary failed refresh: reported through the status and retried.
const REFRESH_TIMEOUT_MS = 30_000;

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type RemoteDataStatus = {
  source: "r2";
  snapshot: string | null;
  refreshedAt: string | null;
  stale: boolean;
  lastError: string | null;
};

type CachedSnapshot = {
  bundle: DataBundle;
  manifest: DataSnapshotManifest;
  expiresAt: number;
  refreshedAt: string;
  stale: boolean;
  lastError: string | null;
};

function normalizeBaseUrl(value: string): URL {
  const url = new URL(value.endsWith("/") ? value : `${value}/`);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("RADAR_DATA_BASE_URL must use HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("RADAR_DATA_BASE_URL must not contain credentials, a query, or a hash");
  }
  return url;
}

async function readResponse(response: Response, label: string): Promise<string> {
  if (!response.ok) {
    throw new Error(`${label} request failed with status ${response.status}`);
  }
  return response.text();
}

export function createRemoteDataLoader({
  baseUrl,
  fetchImpl = fetch,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  now = () => Date.now(),
  onRefreshError = (message: string) => {
    console.error(`R2 data refresh failed; serving the last valid snapshot: ${message}`);
  }
}: {
  baseUrl: string;
  fetchImpl?: FetchImplementation;
  cacheTtlMs?: number;
  now?: () => number;
  onRefreshError?: (message: string) => void;
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const effectiveCacheTtlMs = Math.max(1_000, cacheTtlMs);
  let cached: CachedSnapshot | null = null;
  let inFlight: Promise<DataBundle> | null = null;

  async function refresh(): Promise<DataBundle> {
    try {
      const manifestResponse = await fetchImpl(new URL("current.json", normalizedBaseUrl), {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS)
      });
      const manifest = dataSnapshotManifestSchema.parse(
        JSON.parse(await readResponse(manifestResponse, "R2 manifest")) as unknown
      );
      const refreshedAt = new Date(now()).toISOString();
      if (
        cached &&
        cached.manifest.objectKey === manifest.objectKey &&
        cached.manifest.sha256 === manifest.sha256 &&
        cached.manifest.byteLength === manifest.byteLength &&
        cached.manifest.collectedAt === manifest.collectedAt
      ) {
        cached = {
          ...cached,
          expiresAt: now() + effectiveCacheTtlMs,
          refreshedAt,
          stale: false,
          lastError: null
        };
        return cached.bundle;
      }

      const snapshotResponse = await fetchImpl(
        new URL(manifest.objectKey, normalizedBaseUrl),
        {
          cache: "force-cache",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS)
        }
      );
      const bundle = parseDataSnapshot(
        await readResponse(snapshotResponse, "R2 snapshot"),
        manifest
      );
      cached = {
        bundle,
        manifest,
        expiresAt: now() + effectiveCacheTtlMs,
        refreshedAt,
        stale: false,
        lastError: null
      };
      return bundle;
    } catch (error) {
      if (!cached) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      cached = {
        ...cached,
        expiresAt: now() + Math.min(effectiveCacheTtlMs, FAILED_REFRESH_RETRY_MS),
        stale: true,
        lastError: message
      };
      onRefreshError(message);
      return cached.bundle;
    } finally {
      inFlight = null;
    }
  }

  function startRefresh(): Promise<DataBundle> {
    if (!inFlight) {
      inFlight = refresh();
    }
    return inFlight;
  }

  async function getDataBundle(): Promise<DataBundle> {
    // Only the very first request has nothing to serve and has to wait for R2.
    if (!cached) {
      return startRefresh();
    }

    if (cached.expiresAt <= now()) {
      // A refresh costs a round trip to R2 and, when the snapshot changed, a
      // full download and parse. Handing back the snapshot already in memory
      // keeps that off the request path; the next request sees the new one.
      // refresh() only rejects when there is no cached snapshot to fall back
      // on, and here there is one.
      void startRefresh().catch(() => undefined);
    }

    return cached.bundle;
  }

  /** Resolves once a refresh started by getDataBundle has settled. */
  async function whenRefreshed(): Promise<void> {
    await inFlight?.catch(() => undefined);
  }

  function getStatus(): RemoteDataStatus {
    return {
      source: "r2",
      snapshot: cached?.manifest.collectedAt ?? null,
      refreshedAt: cached?.refreshedAt ?? null,
      stale: cached?.stale ?? false,
      lastError: cached?.lastError ?? null
    };
  }

  return { getDataBundle, getStatus, whenRefreshed };
}
