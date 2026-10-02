import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { evaluateReadiness, type ReadinessReport, type WorkflowRun } from "../lib/readiness";

const execFileAsync = promisify(execFile);

type GhRunner = (args: string[]) => Promise<string>;

async function runGh(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args, {
    maxBuffer: 10 * 1024 * 1024
  });
  return stdout;
}

async function getSecretNames(run: GhRunner): Promise<string[]> {
  const output = await run(["secret", "list"]);
  return output
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

async function getVariableNames(run: GhRunner): Promise<string[]> {
  const output = await run(["variable", "list"]);
  return output
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

async function getLatestWorkflowRun(workflowName: string, run: GhRunner): Promise<WorkflowRun> {
  const output = await run([
    "run",
    "list",
    "--workflow",
    workflowName,
    "--branch",
    "main",
    "--status",
    "completed",
    "--limit",
    "1",
    "--json",
    "conclusion,createdAt"
  ]);
  const runs = JSON.parse(output) as WorkflowRun[];
  return { conclusion: runs[0]?.conclusion || "unknown", createdAt: runs[0]?.createdAt };
}

export async function checkReadiness(run: GhRunner = runGh, now?: number): Promise<ReadinessReport> {
  const [
    secretNames,
    variableNames,
    latestCiRun,
    latestCollectRun,
    latestYouTubeCollectRun
  ] =
    await Promise.all([
      getSecretNames(run),
      getVariableNames(run),
      getLatestWorkflowRun("CI", run),
      getLatestWorkflowRun("Collect Korea Football Radar Data", run),
      getLatestWorkflowRun("Collect Korea Football Radar YouTube Data", run)
    ]);

  return evaluateReadiness({
    secretNames,
    variableNames,
    latestCiRun,
    latestCollectRun,
    latestYouTubeCollectRun
  }, now ?? Date.now());
}

async function main(): Promise<void> {
  const report = await checkReadiness();

  for (const check of report.checks) {
    const marker = check.status === "pass" ? "PASS" : "FAIL";
    console.log(`${marker} ${check.label}: ${check.detail}`);
  }

  if (process.argv.includes("--strict") && !report.ready) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
