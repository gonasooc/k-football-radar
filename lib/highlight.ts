export type HighlightPart = {
  highlighted: boolean;
  start: number;
  text: string;
};

const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(value: string): string {
  return value.replace(REGEXP_SPECIAL_CHARACTERS, "\\$&");
}

export function getHighlightParts(text: string, query: string): HighlightPart[] {
  const trimmedQuery = query.trim();

  if (!text || !trimmedQuery) {
    return [{ highlighted: false, start: 0, text }];
  }

  const matcher = new RegExp(escapeRegExp(trimmedQuery), "giu");
  const parts: HighlightPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(matcher)) {
    const matchStart = match.index;
    const matchText = match[0];

    if (matchStart > cursor) {
      parts.push({ highlighted: false, start: cursor, text: text.slice(cursor, matchStart) });
    }

    parts.push({ highlighted: true, start: matchStart, text: matchText });
    cursor = matchStart + matchText.length;
  }

  if (parts.length === 0) {
    return [{ highlighted: false, start: 0, text }];
  }

  if (cursor < text.length) {
    parts.push({ highlighted: false, start: cursor, text: text.slice(cursor) });
  }

  return parts;
}
