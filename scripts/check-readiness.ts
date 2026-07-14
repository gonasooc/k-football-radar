import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { evaluateReadiness, type WorkflowConclusion } from "../lib/readiness";

const execFileAsync = promisify(execFile);

type RunRecord = {
  conclusion: WorkflowConclusion | "";
  workflowName: string;
};

async function runGh(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: 10 * 1024 * 1024
  });
  return stdout;
}

async function getSecretNames(): Promise<string[]> {
  const output = await runGh(["secret", "list"]);
  return output
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

async function getLatestWorkflowConclusion(workflowName: string): Promise<WorkflowConclusion> {
  const output = await runGh([
    "run",
    "list",
    "--limit",
    "20",
    "--json",
    "workflowName,conclusion"
  ]);
  const runs = JSON.parse(output) as RunRecord[];
  const run = runs.find((candidate) => candidate.workflowName === workflowName);
  return run?.conclusion || "unknown";
}

async function main(): Promise<void> {
  const [secretNames, latestCiConclusion, latestCollectConclusion] =
    await Promise.all([
      getSecretNames(),
      getLatestWorkflowConclusion("CI"),
      getLatestWorkflowConclusion("Collect Korea Football Radar Data")
    ]);

  const report = evaluateReadiness({
    secretNames,
    latestCiConclusion,
    latestCollectConclusion
  });

  for (const check of report.checks) {
    const marker = check.status === "pass" ? "PASS" : "FAIL";
    console.log(`${marker} ${check.label}: ${check.detail}`);
  }

  if (process.argv.includes("--strict") && !report.ready) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
