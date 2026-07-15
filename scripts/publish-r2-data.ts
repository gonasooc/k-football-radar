import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput
} from "@aws-sdk/client-s3";

import { serializeDataSnapshot } from "../lib/data-snapshot";
import {
  readCollectionState,
  readIssues,
  readItems,
  readPeople,
  readSources
} from "./data-io";

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function isPreconditionFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    typeof error.$metadata === "object" &&
    error.$metadata !== null &&
    "httpStatusCode" in error.$metadata &&
    error.$metadata.httpStatusCode === 412
  );
}

function verifySnapshotObject(
  object: HeadObjectCommandOutput,
  expected: { byteLength: number; sha256: string }
): void {
  if (object.ContentLength !== expected.byteLength) {
    throw new Error(
      `R2 snapshot size verification failed: expected ${expected.byteLength}, received ${object.ContentLength ?? "unknown"}`
    );
  }
  if (object.Metadata?.sha256 !== expected.sha256) {
    throw new Error("R2 snapshot checksum metadata verification failed");
  }
}

async function publishR2Data(): Promise<void> {
  const accountId = requireEnvironment("CLOUDFLARE_ACCOUNT_ID");
  const bucket = requireEnvironment("R2_BUCKET_NAME");
  const accessKeyId = requireEnvironment("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnvironment("R2_SECRET_ACCESS_KEY");
  const [items, people, issues, sources, collectionState] = await Promise.all([
    readItems(),
    readPeople(),
    readIssues(),
    readSources(),
    readCollectionState()
  ]);
  const { body, manifest } = serializeDataSnapshot({
    items,
    people,
    issues,
    sources,
    collectionState
  });
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 3
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: manifest.objectKey,
        Body: body,
        ContentType: "application/json; charset=utf-8",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: {
          sha256: manifest.sha256,
          collectedat: manifest.collectedAt
        },
        IfNoneMatch: "*"
      })
    );
  } catch (error) {
    if (!isPreconditionFailure(error)) {
      throw error;
    }
  }

  const snapshotObject = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: manifest.objectKey })
  );
  verifySnapshotObject(snapshotObject, manifest);

  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "current.json",
      Body: manifestBody,
      ContentType: "application/json; charset=utf-8",
      CacheControl: "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      Metadata: {
        sha256: manifest.sha256,
        collectedat: manifest.collectedAt
      }
    })
  );

  console.log(
    `Published R2 snapshot ${manifest.objectKey} (${manifest.byteLength} bytes, collected ${manifest.collectedAt})`
  );
}

publishR2Data().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
