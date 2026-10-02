import { z } from "zod";

export type WorkflowConclusion = "success" | "failure" | "cancelled" | "skipped" | "unknown";

export type WorkflowRun = {
  conclusion: WorkflowConclusion;
  createdAt?: string;
};

export type ReadinessInput = {
  secretNames: string[];
  variableNames: string[];
  latestCiRun: WorkflowRun;
  latestCollectRun: WorkflowRun;
  latestYouTubeCollectRun: WorkflowRun;
};

const workflowTimestampSchema = z.string().datetime({ offset: true });
const HOUR_MS = 60 * 60 * 1000;
// collect.yml runs hourly: allow two intervals plus one hour for scheduling/queue delays.
const COLLECT_MAX_AGE_MS = 3 * HOUR_MS;
// collect-youtube.yml runs every 12 hours: allow two intervals plus two hours of delay.
const YOUTUBE_COLLECT_MAX_AGE_MS = 26 * HOUR_MS;

export type ReadinessCheck = {
  id: string;
  label: string;
  status: "pass" | "fail";
  detail: string;
};

export type ReadinessReport = {
  ready: boolean;
  checks: ReadinessCheck[];
};

function configurationCheck({
  id,
  label,
  names,
  requiredName,
  type
}: {
  id: string;
  label: string;
  names: string[];
  requiredName: string;
  type: "secret" | "variable";
}): ReadinessCheck {
  const passed = names.includes(requiredName);
  return {
    id,
    label,
    status: passed ? "pass" : "fail",
    detail: passed ? `Repository ${type} is configured` : `Repository ${type} is missing`
  };
}

function workflowCheck(
  id: string,
  label: string,
  run: WorkflowRun,
  now: number,
  maxAgeMs?: number
): ReadinessCheck {
  if (run.conclusion !== "success") {
    return { id, label, status: "fail", detail: `Latest main run conclusion: ${run.conclusion}` };
  }

  const timestamp = workflowTimestampSchema.safeParse(run.createdAt);
  if (!timestamp.success || !Number.isFinite(now)) {
    return { id, label, status: "fail", detail: "Latest main run has a missing or invalid timestamp" };
  }
  const ageMs = now - Date.parse(timestamp.data);
  if (!Number.isFinite(ageMs)) {
    return { id, label, status: "fail", detail: "Latest main run has an invalid timestamp" };
  }
  if (ageMs < 0) {
    return { id, label, status: "fail", detail: "Latest main run timestamp is in the future" };
  }
  if (maxAgeMs !== undefined && ageMs > maxAgeMs) {
    return {
      id,
      label,
      status: "fail",
      detail: `Latest main run is too old: created ${timestamp.data} (limit ${maxAgeMs / HOUR_MS}h)`
    };
  }
  return {
    id,
    label,
    status: "pass",
    detail: `Latest main run succeeded: created ${timestamp.data}`
  };
}

export function evaluateReadiness(input: ReadinessInput, now = Date.now()): ReadinessReport {
  const checks: ReadinessCheck[] = [
    configurationCheck({
      id: "naver-client-id",
      label: "GitHub secret NAVER_CLIENT_ID",
      names: input.secretNames,
      requiredName: "NAVER_CLIENT_ID",
      type: "secret"
    }),
    configurationCheck({
      id: "naver-client-secret",
      label: "GitHub secret NAVER_CLIENT_SECRET",
      names: input.secretNames,
      requiredName: "NAVER_CLIENT_SECRET",
      type: "secret"
    }),
    configurationCheck({
      id: "youtube-api-key",
      label: "GitHub secret YOUTUBE_API_KEY",
      names: input.secretNames,
      requiredName: "YOUTUBE_API_KEY",
      type: "secret"
    }),
    configurationCheck({
      id: "r2-access-key-id",
      label: "GitHub secret R2_ACCESS_KEY_ID",
      names: input.secretNames,
      requiredName: "R2_ACCESS_KEY_ID",
      type: "secret"
    }),
    configurationCheck({
      id: "r2-secret-access-key",
      label: "GitHub secret R2_SECRET_ACCESS_KEY",
      names: input.secretNames,
      requiredName: "R2_SECRET_ACCESS_KEY",
      type: "secret"
    }),
    configurationCheck({
      id: "cloudflare-account-id",
      label: "GitHub variable CLOUDFLARE_ACCOUNT_ID",
      names: input.variableNames,
      requiredName: "CLOUDFLARE_ACCOUNT_ID",
      type: "variable"
    }),
    configurationCheck({
      id: "r2-bucket-name",
      label: "GitHub variable R2_BUCKET_NAME",
      names: input.variableNames,
      requiredName: "R2_BUCKET_NAME",
      type: "variable"
    }),
    workflowCheck("ci-workflow", "Latest CI workflow", input.latestCiRun, now),
    workflowCheck(
      "collect-workflow",
      "Latest collect workflow",
      input.latestCollectRun,
      now,
      COLLECT_MAX_AGE_MS
    ),
    workflowCheck(
      "youtube-collect-workflow",
      "Latest YouTube collect workflow",
      input.latestYouTubeCollectRun,
      now,
      YOUTUBE_COLLECT_MAX_AGE_MS
    )
  ];

  return {
    ready: checks.every((check) => check.status === "pass"),
    checks
  };
}
