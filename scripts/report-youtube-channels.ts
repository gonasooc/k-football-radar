import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildYouTubeChannelCandidateReport } from "../lib/youtube-channel-report";
import {
  readItems,
  readYouTubeChannelPolicy,
  readYouTubeFormatCache
} from "./data-io";

const REPORT_PATH = path.join(
  process.cwd(),
  "reports",
  "youtube-channel-candidates.json"
);

async function run(): Promise<void> {
  const [items, channelPolicy, formatCache] = await Promise.all([
    readItems(),
    readYouTubeChannelPolicy(),
    readYouTubeFormatCache()
  ]);
  const report = buildYouTubeChannelCandidateReport({
    items,
    channelPolicy,
    formatCache
  });

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${report.totals.channels} YouTube channel candidates covering ${report.totals.videos} videos to ${path.relative(process.cwd(), REPORT_PATH)}`
  );
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
