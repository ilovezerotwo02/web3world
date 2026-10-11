import { FINAL_AUDIT_SCENARIO } from "../../../../lib/security/scenarios";
import { evaluateFinding, type FindingDraft } from "../../../../lib/security/scoring";
import { clampText, isResponse, jsonError, parseJsonArray, readJsonBody } from "../../../../lib/security/api-helpers";

type ReviewRequest = {
  finding?: {
    title?: string;
    type?: string;
    severity?: string;
    evidenceLines?: unknown;
    rootCause?: string;
    impact?: string;
    fix?: string;
  };
};

/**
 * POST /api/agent/security-review
 * Agent 只做语义评阅与表达建议，通过条件始终由确定性规则控制。
 * 当 LLM 不可用时降级为规则评阅模式，返回 mode: "rule"。
 */
export async function POST(request: Request) {
  const body = await readJsonBody<ReviewRequest>(request);
  if (isResponse(body)) return body;
  if (!body.finding) return jsonError("finding 不能为空", 400);

  const draft: FindingDraft = {
    title: clampText(body.finding.title, 120),
    vulnType: clampText(body.finding.type, 64).toLowerCase(),
    severity: clampText(body.finding.severity, 16).toLowerCase() || "medium",
    evidenceLines: parseJsonArray(body.finding.evidenceLines)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
    rootCause: clampText(body.finding.rootCause, 600),
    impact: clampText(body.finding.impact, 600),
    remediation: clampText(body.finding.fix, 600),
  };

  const evaluation = evaluateFinding(draft, FINAL_AUDIT_SCENARIO.targets);
  const missingPoints: string[] = [];
  if (!draft.rootCause) missingPoints.push("rootCause");
  if (!draft.impact) missingPoints.push("impact");
  if (!draft.remediation) missingPoints.push("fix");
  if (!draft.evidenceLines.length) missingPoints.push("evidenceLines");
  if (draft.rootCause && !evaluation.rootCauseMatched) missingPoints.push("rootCause 关键点");
  if (draft.remediation && !evaluation.remediationMatched) missingPoints.push("可执行的修复方向");

  const followUp = evaluation.matchedCode
    ? `如果先把状态更新提前、再发起外部调用，攻击为什么会失效？`
    : `先确认这段代码属于哪一类风险，再补充根因。`;

  return Response.json({
    mode: "rule",
    understood: evaluation.rootCauseMatched && evaluation.identityMatched,
    missingPoints,
    riskLevelSuggestion: FINAL_AUDIT_SCENARIO.targets.find((target) => target.code === evaluation.matchedCode)
      ?.expectedSeverity ?? draft.severity,
    matchedFindingCode: evaluation.matchedCode,
    deterministicScore: evaluation.identityMatched ? 60 + (evaluation.rootCauseMatched ? 25 : 0) : 0,
    feedback: evaluation.message,
    followUp,
    boundary:
      "Agent 只做语义评阅与表达建议，通过条件由确定性规则控制；Agent 故障不会阻断主流程。",
    notice: "当前使用规则评阅模式（未连接外部 LLM）。",
  });
}
