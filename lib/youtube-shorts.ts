import type { YouTubeFormatCacheFile } from "./schema";

const EXPLICIT_SHORTS_HASHTAG = /(?:^|\s)#(?:shorts?|쇼츠|숏츠)(?=$|\s|[.,!?])/iu;
const EXPLICIT_SHORTS_TAGS = new Set(["short", "shorts", "쇼츠", "숏츠"]);
const YOUTUBE_SHORTS_PROBE_TIMEOUT_MS = 5000;
const MAX_YOUTUBE_SHORTS_DURATION_SECONDS = 180;
const MAX_YOUTUBE_SHORTS_HTML_BYTES = 1024 * 1024;

export type YouTubeFormatClassification = "shorts" | "regular" | "unknown";

export type YouTubeShortsProbeFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export function hasExplicitShortsEvidence({
  title,
  description,
  tags = []
}: {
  title: string;
  description: string;
  tags?: readonly string[];
}): boolean {
  if (EXPLICIT_SHORTS_HASHTAG.test(`${title} ${description}`)) {
    return true;
  }

  return tags.some((tag) =>
    EXPLICIT_SHORTS_TAGS.has(tag.normalize("NFKC").trim().replace(/^#/, "").toLowerCase())
  );
}

function isMatchingWatchRedirect(location: string | null, videoId: string): boolean {
  if (!location) return false;

  try {
    const url = new URL(location, "https://www.youtube.com");
    return (
      (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") &&
      url.pathname === "/watch" &&
      url.searchParams.get("v") === videoId
    );
  } catch {
    return false;
  }
}

async function hasMatchingShortsCanonical(
  response: Response,
  videoId: string
): Promise<boolean> {
  if (!response.body) return false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const expectedUrl = `https://www.youtube.com/shorts/${videoId}`;
  const expectedCanonical = `<link rel="canonical" href="${expectedUrl}"`;
  const expectedOpenGraph = `<meta property="og:url" content="${expectedUrl}"`;
  let html = "";
  let receivedBytes = 0;

  try {
    while (receivedBytes < MAX_YOUTUBE_SHORTS_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (html.includes(expectedCanonical) && html.includes(expectedOpenGraph)) {
        return true;
      }
    }
    html += decoder.decode();
    return html.includes(expectedCanonical) && html.includes(expectedOpenGraph);
  } catch {
    return false;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function probeYouTubeVideoFormat({
  videoId,
  fetchImpl = fetch,
  timeoutMs = YOUTUBE_SHORTS_PROBE_TIMEOUT_MS
}: {
  videoId: string;
  fetchImpl?: YouTubeShortsProbeFetch;
  timeoutMs?: number;
}): Promise<YouTubeFormatClassification> {
  try {
    const response = await fetchImpl(
      `https://www.youtube.com/shorts/${encodeURIComponent(videoId)}`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent":
            "Mozilla/5.0 (compatible; KoreaFootballRadar/1.0; +https://k-football-radar.app)"
        },
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs)
      }
    );
    const classification: YouTubeFormatClassification =
      response.status === 303 &&
      isMatchingWatchRedirect(response.headers.get("location"), videoId)
        ? "regular"
        : response.status === 200
          ? (await hasMatchingShortsCanonical(response, videoId))
            ? "shorts"
            : "unknown"
          : "unknown";
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
    }
    return classification;
  } catch {
    return "unknown";
  }
}

export async function isYouTubeShortsProbeHealthy({
  cache,
  fetchImpl = fetch
}: {
  cache: YouTubeFormatCacheFile;
  fetchImpl?: YouTubeShortsProbeFetch;
}): Promise<boolean> {
  const cachedEntries = Object.entries(cache.entries);
  const shortsCanary = cachedEntries.find(
    ([, entry]) => entry.classification === "shorts"
  )?.[0];
  const regularCanary = cachedEntries.find(
    ([, entry]) =>
      entry.classification === "regular" && entry.evidence === "redirect"
  )?.[0];

  if (!shortsCanary || !regularCanary) {
    return true;
  }

  const [shortsResult, regularResult] = await Promise.all([
    probeYouTubeVideoFormat({ videoId: shortsCanary, fetchImpl }),
    probeYouTubeVideoFormat({ videoId: regularCanary, fetchImpl })
  ]);
  return shortsResult === "shorts" && regularResult === "regular";
}

export async function classifyYouTubeVideoFormat({
  videoId,
  durationSeconds,
  title,
  description,
  tags,
  cache,
  redirectProbeEnabled,
  fetchImpl = fetch,
  now = new Date()
}: {
  videoId: string;
  durationSeconds: number;
  title: string;
  description: string;
  tags?: readonly string[];
  cache: YouTubeFormatCacheFile;
  redirectProbeEnabled: boolean;
  fetchImpl?: YouTubeShortsProbeFetch;
  now?: Date;
}): Promise<YouTubeFormatClassification> {
  if (durationSeconds > MAX_YOUTUBE_SHORTS_DURATION_SECONDS) {
    cache.entries[videoId] = {
      classification: "regular",
      evidence: "duration",
      checkedAt: now.toISOString()
    };
    return "regular";
  }

  if (hasExplicitShortsEvidence({ title, description, tags })) {
    cache.entries[videoId] = {
      classification: "shorts",
      evidence: "metadata",
      checkedAt: now.toISOString()
    };
    return "shorts";
  }

  const cached = cache.entries[videoId];
  if (cached) {
    return cached.classification;
  }

  if (!redirectProbeEnabled) {
    return "unknown";
  }

  const classification = await probeYouTubeVideoFormat({ videoId, fetchImpl });
  if (classification !== "unknown") {
    cache.entries[videoId] = {
      classification,
      evidence: "redirect",
      checkedAt: now.toISOString()
    };
  }
  return classification;
}
