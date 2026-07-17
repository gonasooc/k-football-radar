export const STORY_TITLE_WEIGHT = 0.75;
export const STORY_SUMMARY_WEIGHT = 0.25;

const LEADING_BOILERPLATE =
  /^\s*(?:[[({\u3008\u300a\u3010]?\s*(?:\uc18d\ubcf4|\ub2e8\ub3c5|\uc885\ud569(?:\s*\d+\s*\ubcf4?)?)\s*[\])}\u3009\u300b\u3011]?\s*[:\-\u2013\u2014]?\s*)+/u;
const TRAILING_BOILERPLATE =
  /\s*(?:[[({\u3008\u300a\u3010]?\s*\uc885\ud569(?:\s*\d+\s*\ubcf4?)?\s*[\])}\u3009\u300b\u3011]?)\s*(?:\u2026|\.{3})?\s*$/u;

export type StoryTextFields = {
  title: string;
  summary: string;
};

export type StorySimilarity = {
  title: number;
  summary: number;
  combined: number;
};

export type StorySimilarityModel = {
  compare: (left: StoryTextFields, right: StoryTextFields) => StorySimilarity;
};

type WeightedVector = {
  weights: Map<string, number>;
  totalWeight: number;
};

/** Normalizes Korean news snippets for lexical comparison, not for display. */
export function normalizeStoryText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(LEADING_BOILERPLATE, "")
    .replace(TRAILING_BOILERPLATE, "")
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function getCharacterTrigrams(value: string): string[] {
  const characters = Array.from(value);
  if (characters.length === 0) {
    return [];
  }
  if (characters.length < 3) {
    return [characters.join("")];
  }

  const trigrams: string[] = [];
  for (let index = 0; index <= characters.length - 3; index += 1) {
    trigrams.push(characters.slice(index, index + 3).join(""));
  }
  return trigrams;
}

function getDocumentTrigrams(item: StoryTextFields): Set<string> {
  return new Set([
    ...getCharacterTrigrams(normalizeStoryText(item.title)),
    ...getCharacterTrigrams(normalizeStoryText(item.summary))
  ]);
}

/**
 * Builds an IDF model from the current corpus. Weighted Dice counts repeated
 * trigrams while down-weighting phrases that occur throughout the corpus.
 */
export function createStorySimilarityModel(
  corpusItems: readonly StoryTextFields[]
): StorySimilarityModel {
  const documentFrequency = new Map<string, number>();
  for (const item of corpusItems) {
    for (const trigram of getDocumentTrigrams(item)) {
      documentFrequency.set(trigram, (documentFrequency.get(trigram) ?? 0) + 1);
    }
  }

  const documentCount = corpusItems.length;
  const defaultIdf = Math.log(documentCount + 1) + 1;
  const idf = new Map(
    Array.from(documentFrequency, ([trigram, frequency]) => [
      trigram,
      Math.log((documentCount + 1) / (frequency + 1)) + 1
    ])
  );
  const vectorCache = new Map<string, WeightedVector>();

  function vectorize(value: string): WeightedVector {
    const normalized = normalizeStoryText(value);
    const cached = vectorCache.get(normalized);
    if (cached) {
      return cached;
    }

    const counts = new Map<string, number>();
    for (const trigram of getCharacterTrigrams(normalized)) {
      counts.set(trigram, (counts.get(trigram) ?? 0) + 1);
    }

    let totalWeight = 0;
    const weights = new Map<string, number>();
    for (const [trigram, count] of counts) {
      const weight = count * (idf.get(trigram) ?? defaultIdf);
      weights.set(trigram, weight);
      totalWeight += weight;
    }

    const vector = { weights, totalWeight };
    vectorCache.set(normalized, vector);
    return vector;
  }

  function weightedDice(left: string, right: string): number {
    const leftVector = vectorize(left);
    const rightVector = vectorize(right);
    const denominator = leftVector.totalWeight + rightVector.totalWeight;
    if (denominator === 0) {
      return 0;
    }

    const [smaller, larger] =
      leftVector.weights.size <= rightVector.weights.size
        ? [leftVector.weights, rightVector.weights]
        : [rightVector.weights, leftVector.weights];
    let sharedWeight = 0;
    for (const [trigram, weight] of smaller) {
      const otherWeight = larger.get(trigram);
      if (otherWeight !== undefined) {
        sharedWeight += Math.min(weight, otherWeight);
      }
    }
    return (2 * sharedWeight) / denominator;
  }

  return {
    compare(left, right) {
      const title = weightedDice(left.title, right.title);
      const summary = weightedDice(left.summary, right.summary);
      return {
        title,
        summary,
        combined: STORY_TITLE_WEIGHT * title + STORY_SUMMARY_WEIGHT * summary
      };
    }
  };
}
