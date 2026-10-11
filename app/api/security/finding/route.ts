import { getDb } from "../../../../db";
import { requireAuth } from "../../../../lib/auth";
import { getSecuritySessionById, submitSecurityFinding } from "../../../../lib/repositories";
import { FINAL_AUDIT_SCENARIO } from "../../../../lib/security/scenarios";
import { evaluateFinding, type FindingDraft } from "../../../../lib/security/scoring";
import {
  clampText,
  isResponse,
  jsonError,
  parseJsonArray,
  readJsonBody,
} from "../../../../lib/security/api-helpers";

type FindingRequest = {
  sessionId?: string;
  finding?: {
    title?: string;
    type?: string;
    vulnType?: string;
    severity?: string;
    evidenceLines?: unknown;
    rootCause?: string;
    impact?: string;
    fix?: string;
    remediation?: string;
  };
};

const ALLOWED_SEVERITY = new Set(["critical", "high", "medium", "low"]);

// POST /api/security/finding — 提交审计 Finding（服务端确定性判分）
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = await readJsonBody<FindingRequest>(request);
  if (isResponse(body)) return body;

  if (!body.sessionId) return jsonError("sessionId 不能为空", 400);
  if (!body.finding) return jsonError("finding 不能为空", 400);

  const session = await getSecuritySessionById(db, body.sessionId, auth.userId);
  if (!session) return jsonError("审计记录不存在", 404);
  if (session.scenarioId !== FINAL_AUDIT_SCENARIO.id) {
    return jsonError("Finding 提交仅用于最终综合审计", 409);
  }

  const severity = clampText(body.finding.severity, 16).toLowerCase();
  if (!ALLOWED_SEVERITY.has(severity)) {
    return jsonError("severity 只能是 critical / high / medium / low", 400);
  }

  const evidenceLines = parseJsonArray(body.finding.evidenceLines)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 500);

  const draft: FindingDraft = {
    title: clampText(body.finding.title, 120),
    vulnType: clampText(body.finding.type ?? body.finding.vulnType, 64).toLowerCase(),
    severity,
    evidenceLines,
    rootCause: clampText(body.finding.rootCause, 600),
    impact: clampText(body.finding.impact, 600),
    remediation: clampText(body.finding.fix ?? body.finding.remediation, 600),
  };

  if (draft.rootCause.length < 8 || draft.impact.length < 8 || draft.remediation.length < 8) {
    return jsonError("rootCause / impact / fix 都需要至少 8 个字符的描述", 400);
  }

  const evaluation = evaluateFinding(draft, FINAL_AUDIT_SCENARIO.targets);
  const score =
    (evaluation.identityMatched ? 40 : 0) +
    (evaluation.severityMatched ? 15 : 0) +
    (evaluation.rootCauseMatched ? 25 : 0) +
    (evaluation.remediationMatched ? 20 : 0);

  await submitSecurityFinding(db, {
    sessionId: session.id,
    userId: auth.userId,
    findingCode: evaluation.matchedCode,
    vulnerabilityType: draft.vulnType || "unknown",
    severity: draft.severity,
    title: draft.title,
    evidenceLines: draft.evidenceLines,
    rootCause: draft.rootCause,
    impact: draft.impact,
    fix: draft.remediation,
    regression: { rulePassed: evaluation.identityMatched, evaluatedAt: new Date().toISOString() },
    deterministicScore: score,
    isCorrect: evaluation.identityMatched && evaluation.rootCauseMatched,
  });

  return Response.json({
    findingCode: evaluation.matchedCode,
    matchedTitle: evaluation.matchedTitle,
    deterministicScore: score,
    identityMatched: evaluation.identityMatched,
    severityMatched: evaluation.severityMatched,
    rootCauseMatched: evaluation.rootCauseMatched,
    remediationMatched: evaluation.remediationMatched,
    falsePositive: evaluation.falsePositive,
    feedback: evaluation.message,
    ruleFeedbackMode: "rule",
  });
}
