import { z } from "zod";

const isoDateString = z.string().datetime({ offset: true });

export const radarItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["news", "official"]),
  title: z.string().min(1),
  summary: z.string().max(600),
  url: z.string().url(),
  originalUrl: z.string().url(),
  publisher: z.string().min(1),
  publishedAt: isoDateString,
  collectedAt: isoDateString,
  matchedKeywords: z.array(z.string().min(1)),
  issueTags: z.array(z.string().min(1)),
  personTags: z.array(z.string().min(1)),
  sourceType: z.enum(["news", "official"]),
  isOfficial: z.boolean(),
  relevanceScore: z.number().int().min(0).max(100),
  labels: z.array(z.string().min(1)).optional()
});

export const personSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  role: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  priority: z.number().int().min(0),
  published: z.boolean()
});

export const issueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  priority: z.number().int().min(0)
});

export const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["news-api", "official"]),
  url: z.string().url(),
  enabled: z.boolean()
});

export const collectionStateSchema = z.object({
  lastCollectedAt: isoDateString,
  lastRunStatus: z.enum(["success", "partial", "failed", "never"]),
  lastRunNewItems: z.number().int().min(0),
  totalItems: z.number().int().min(0)
});

export const dataBundleSchema = z.object({
  items: z.array(radarItemSchema),
  people: z.array(personSchema),
  issues: z.array(issueSchema),
  sources: z.array(sourceSchema),
  collectionState: collectionStateSchema
});

export type RadarItem = z.infer<typeof radarItemSchema>;
export type Person = z.infer<typeof personSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type CollectionState = z.infer<typeof collectionStateSchema>;
export type DataBundle = z.infer<typeof dataBundleSchema>;
