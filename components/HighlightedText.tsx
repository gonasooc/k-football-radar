import * as React from "react";

import { getHighlightParts } from "@/lib/highlight";

type HighlightedTextProps = {
  query: string;
  text: string;
};

export function HighlightedText({ query, text }: HighlightedTextProps) {
  const parts = getHighlightParts(text, query);

  if (parts.length === 1 && !parts[0].highlighted) {
    return text;
  }

  return parts.map((part) =>
    part.highlighted ? (
      <mark
        className="box-decoration-clone rounded-[2px] bg-accent-soft px-0.5 text-inherit"
        key={`match-${part.start}`}
      >
        {part.text}
      </mark>
    ) : (
      <React.Fragment key={`text-${part.start}`}>{part.text}</React.Fragment>
    )
  );
}
