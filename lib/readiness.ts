export type WorkflowConclusion = "success" | "failure" | "cancelled" | "skipped" | "unknown";

export type ReadinessInput = {
  secretNames: string[];
  variableNames: string[];
  latestCiConclusion: WorkflowConclusion;
  latestCollectConclusion: WorkflowConclusion;
};

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

function workflowCheck(id: string, label: string, conclusion: WorkflowConclusion): ReadinessCheck {
  const passed = conclusion === "success";
  return {
    id,
    label,
    status: passed ? "pass" : "fail",
    detail: passed ? "Latest run succeeded" : `Latest run conclusion: ${conclusion}`
  };
}

export function evaluateReadiness(input: ReadinessInput): ReadinessReport {
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
    workflowCheck("ci-workflow", "Latest CI workflow", input.latestCiConclusion),
    workflowCheck(
      "collect-workflow",
      "Latest collect workflow",
      input.latestCollectConclusion
    )
  ];

  return {
    ready: checks.every((check) => check.status === "pass"),
    checks
  };
}
