export type WorkflowConclusion = "success" | "failure" | "cancelled" | "skipped" | "unknown";

export type ReadinessInput = {
  secretNames: string[];
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

function hasSecret(secretNames: string[], name: string): boolean {
  return secretNames.includes(name);
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
    {
      id: "naver-client-id",
      label: "GitHub secret NAVER_CLIENT_ID",
      status: hasSecret(input.secretNames, "NAVER_CLIENT_ID") ? "pass" : "fail",
      detail: hasSecret(input.secretNames, "NAVER_CLIENT_ID")
        ? "Repository secret is configured"
        : "Repository secret is missing"
    },
    {
      id: "naver-client-secret",
      label: "GitHub secret NAVER_CLIENT_SECRET",
      status: hasSecret(input.secretNames, "NAVER_CLIENT_SECRET") ? "pass" : "fail",
      detail: hasSecret(input.secretNames, "NAVER_CLIENT_SECRET")
        ? "Repository secret is configured"
        : "Repository secret is missing"
    },
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
