import { z } from "zod";

const isoDateString = z.string().datetime({ offset: true });
const httpUrlString = z.string().url().refine(
  (value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  },
  {
    message: "Expected an http or https URL"
  }
);
export const relevanceTierSchema = z.enum(["primary", "secondary"]);

export const radarItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["news", "official"]),
  title: z.string().min(1),
  summary: z.string().max(600),
  url: httpUrlString,
  originalUrl: httpUrlString,
  publisher: z.string().min(1),
  publishedAt: isoDateString,
  collectedAt: isoDateString,
  matchedKeywords: z.array(z.string().min(1)),
  discoveryQueries: z.array(z.string().min(1)).optional(),
  issueTags: z.array(z.string().min(1)),
  personTags: z.array(z.string().min(1)),
  sourceType: z.enum(["news", "official"]),
  isOfficial: z.boolean(),
  relevanceScore: z.number().int().min(0).max(100),
  relevanceTier: relevanceTierSchema.optional(),
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
  searchQueries: z.array(z.string().min(1)).optional(),
  requiredKeywordGroups: z.array(z.array(z.string().min(1)).min(1)).optional(),
  contextKeywords: z.array(z.string().min(1)).optional(),
  excludedKeywords: z.array(z.string().min(1)).optional(),
  priority: z.number().int().min(0)
});

export const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["news-api", "official"]),
  url: httpUrlString,
  enabled: z.boolean()
});

export const collectionStateSchema = z.object({
  lastCollectedAt: isoDateString,
  lastRunStatus: z.enum(["success", "partial", "failed", "never"]),
  lastRunNewItems: z.number().int().min(0),
  totalItems: z.number().int().min(0)
});

export const storyClusterSchema = z.object({
  id: z.string().regex(/^story_[a-f0-9]{20}$/),
  seedItemId: z.string().min(1),
  memberIds: z.array(z.string().min(1)).min(2)
});

export const storyClusterFileSchema = z.object({
  version: z.literal(1),
  clusters: z.array(storyClusterSchema)
});

export const dataBundleSchema = z.object({
  items: z.array(radarItemSchema),
  people: z.array(personSchema),
  issues: z.array(issueSchema),
  sources: z.array(sourceSchema),
  collectionState: collectionStateSchema,
  storyClusters: storyClusterFileSchema.default({ version: 1, clusters: [] })
});

export type RadarItem = z.infer<typeof radarItemSchema>;
export type RelevanceTier = z.infer<typeof relevanceTierSchema>;
export type Person = z.infer<typeof personSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type CollectionState = z.infer<typeof collectionStateSchema>;
export type StoryCluster = z.infer<typeof storyClusterSchema>;
export type StoryClusterFile = z.infer<typeof storyClusterFileSchema>;
export type DataBundle = z.infer<typeof dataBundleSchema>;
