import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { evaluateReadiness, type WorkflowConclusion } from "../lib/readiness";

const execFileAsync = promisify(execFile);

type RunRecord = {
  conclusion: WorkflowConclusion | "";
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

async function getVariableNames(): Promise<string[]> {
  const output = await runGh(["variable", "list"]);
  return output
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

async function getLatestWorkflowConclusion(workflowName: string): Promise<WorkflowConclusion> {
  const output = await runGh([
    "run",
    "list",
    "--workflow",
    workflowName,
    "--status",
    "completed",
    "--limit",
    "1",
    "--json",
    "conclusion"
  ]);
  const runs = JSON.parse(output) as RunRecord[];
  return runs[0]?.conclusion || "unknown";
}

async function main(): Promise<void> {
  const [
    secretNames,
    variableNames,
    latestCiConclusion,
    latestCollectConclusion,
    latestYouTubeCollectConclusion
  ] =
    await Promise.all([
      getSecretNames(),
      getVariableNames(),
      getLatestWorkflowConclusion("CI"),
      getLatestWorkflowConclusion("Collect Korea Football Radar Data"),
      getLatestWorkflowConclusion("Collect Korea Football Radar YouTube Data")
    ]);

  const report = evaluateReadiness({
    secretNames,
    variableNames,
    latestCiConclusion,
    latestCollectConclusion,
    latestYouTubeCollectConclusion
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
