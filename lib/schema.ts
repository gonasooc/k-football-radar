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

export const youtubeMetadataSchema = z.object({
  videoId: z.string().min(1),
  channelId: z.string().min(1),
  thumbnail: z.object({
    url: httpUrlString,
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  durationSeconds: z.number().int().min(0)
});

export const radarItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["news", "official", "youtube"]),
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
    sourceType: z.enum(["news", "official", "youtube"]),
    isOfficial: z.boolean(),
    relevanceScore: z.number().int().min(0).max(100),
    relevanceTier: relevanceTierSchema.optional(),
    labels: z.array(z.string().min(1)).optional(),
    youtube: youtubeMetadataSchema.optional()
  })
  .superRefine((item, context) => {
    if (item.type !== item.sourceType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Item type and sourceType must match",
        path: ["sourceType"]
      });
    }
    if (item.type === "official" && !item.isOfficial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Official items must set isOfficial",
        path: ["isOfficial"]
      });
    }
    if (item.type !== "official" && item.isOfficial) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only official items can set isOfficial",
        path: ["isOfficial"]
      });
    }
    if (item.type === "youtube" && !item.youtube) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "YouTube items require video metadata",
        path: ["youtube"]
      });
    }
    if (item.type !== "youtube" && item.youtube) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only YouTube items can include video metadata",
        path: ["youtube"]
      });
    }
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
  type: z.enum(["news-api", "video-api", "official"]),
  url: httpUrlString,
  enabled: z.boolean()
});

export const youtubeSearchQuerySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  query: z.string().min(1).max(500),
  enabled: z.boolean()
});

export const collectorRunStateSchema = z.object({
  lastCollectedAt: isoDateString,
  lastRunStatus: z.enum(["success", "partial", "failed", "never"]),
  lastRunNewItems: z.number().int().min(0),
  totalItems: z.number().int().min(0)
});

export const collectionStateSchema = z.object({
  lastCollectedAt: isoDateString,
  lastRunStatus: z.enum(["success", "partial", "failed", "never"]),
  lastRunNewItems: z.number().int().min(0),
  totalItems: z.number().int().min(0),
  collectors: z
    .object({
      naver: collectorRunStateSchema.optional(),
      official: collectorRunStateSchema.optional(),
      youtube: collectorRunStateSchema.optional()
    })
    .optional()
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
export type YouTubeMetadata = z.infer<typeof youtubeMetadataSchema>;
export type RelevanceTier = z.infer<typeof relevanceTierSchema>;
export type Person = z.infer<typeof personSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type YouTubeSearchQuery = z.infer<typeof youtubeSearchQuerySchema>;
export type CollectionState = z.infer<typeof collectionStateSchema>;
export type CollectorRunState = z.infer<typeof collectorRunStateSchema>;
export type StoryCluster = z.infer<typeof storyClusterSchema>;
export type StoryClusterFile = z.infer<typeof storyClusterFileSchema>;
export type DataBundle = z.infer<typeof dataBundleSchema>;
