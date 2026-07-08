import { decode } from "html-entities";

const TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;

export function stripHtml(value: string): string {
  return decode(value.replace(TAG_PATTERN, " ")).replace(WHITESPACE_PATTERN, " ").trim();
}

export function stripInlineHtml(value: string): string {
  return decode(value.replace(TAG_PATTERN, "")).replace(WHITESPACE_PATTERN, " ").trim();
}

export function truncateSummary(value: string, maxLength = 220): string {
  const normalized = stripHtml(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function normalizePublisher(originUrl: string, fallback = "출처 미확인"): string {
  try {
    const hostname = new URL(originUrl).hostname.replace(/^www\./, "");
    return hostname || fallback;
  } catch {
    return fallback;
  }
}
