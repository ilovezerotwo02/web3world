import { getDb } from "../../../../../db";
import { requireAuth } from "../../../../../lib/auth";
import {
  getSecuritySessionById,
  updateSecuritySession,
} from "../../../../../lib/repositories";
import { getScenario, isFinalAuditScenario } from "../../../../../lib/security/scenarios";
import {
  evaluateStep,
  STEP_ORDER,
  type SessionState,
  type StepName,
} from "../../../../../lib/security/session-steps";
import { isResponse, jsonError, readJsonBody } from "../../../../../lib/security/api-helpers";

type StepRequest = {
  sessionId?: string;
  step?: string;
  answer?: Record<string, unknown>;
};

// POST /api/security/session/step — 服务端判定单个步骤（幂等）
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = await readJsonBody<StepRequest>(request);
  if (isResponse(body)) return body;

  if (!body.sessionId) return jsonError("sessionId 不能为空", 400);
  const step = body.step as StepName | undefined;
  if (!step || !STEP_ORDER.includes(step)) {
    return jsonError("步骤名称无效", 400);
  }

  const session = await getSecuritySessionById(db, body.sessionId, auth.userId);
  if (!session) return jsonError("安全实验记录不存在", 404);

  if (isFinalAuditScenario(session.scenarioId)) {
    return jsonError(
      "最终综合审计不使用步骤接口，请通过 POST /api/security/finding 与 POST /api/security/report 完成",
      409,
    );
  }

  const scenario = getScenario(session.scenarioId);
  if (!scenario) return jsonError("安全场景已下线", 409);

  const prior = JSON.parse(session.stateJson || "{}") as SessionState;
  const evaluation = evaluateStep(scenario, step, body.answer ?? {}, prior);

  const nextStepIndex = evaluation.nextStep ? STEP_ORDER.indexOf(evaluation.nextStep) : STEP_ORDER.length;
  const status = evaluation.complete
    ? evaluation.passed
      ? "passed"
      : "failed"
    : "in_progress";

  const updated = await updateSecuritySession(db, session.id, {
    status,
    score: evaluation.score,
    currentStep: nextStepIndex + 1,
    stateJson: JSON.stringify(evaluation.state),
    completedAt: evaluation.complete ? new Date().toISOString() : null,
  });

  return Response.json({
    sessionId: session.id,
    scenarioId: scenario.id,
    step,
    ok: evaluation.ok,
    points: evaluation.points,
    maxPoints: evaluation.maxPoints,
    score: evaluation.score,
    passed: evaluation.passed,
    complete: evaluation.complete,
    status: updated?.status ?? status,
    nextStep: evaluation.nextStep,
    feedback: evaluation.feedback,
    checklist: STEP_ORDER.map((item) => ({
      step: item,
      done: Boolean(evaluation.state[item as keyof SessionState]),
      ok: Boolean((evaluation.state[item as keyof SessionState] as { ok?: boolean } | undefined)?.ok),
    })),
    replay: evaluation.replay ?? null,
    greenStage: scenario.greenhouseStage,
  });
}
