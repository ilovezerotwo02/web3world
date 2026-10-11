import { getDb } from "../../../../../db";
import { requireAuth } from "../../../../../lib/auth";
import { createSecuritySession, getSecuritySession } from "../../../../../lib/repositories";
import {
  FINAL_AUDIT_SCENARIO,
  getScenario,
  getSessionScenario,
} from "../../../../../lib/security/scenarios";
import { STEP_ORDER } from "../../../../../lib/security/session-steps";
import { isResponse, jsonError, readJsonBody } from "../../../../../lib/security/api-helpers";

type StartRequest = { scenarioId?: string };

// POST /api/security/session/start — 开始（或恢复）一次安全实验
export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = await readJsonBody<StartRequest>(request);
  if (isResponse(body)) return body;

  const meta = getSessionScenario(body.scenarioId ?? "");
  if (!meta) {
    return jsonError("安全场景编号无效", 400);
  }

  const session = await createSecuritySession(db, {
    userId: auth.userId,
    scenarioId: meta.id,
    scenarioVersion: meta.scenarioVersion,
    labId: meta.labId,
  });

  const base = {
    sessionId: session.id,
    scenarioId: meta.id,
    currentStep: session.currentStep,
    status: session.status,
    score: session.score,
    kind: meta.kind,
    scenarioVersion: meta.scenarioVersion,
    labId: meta.labId,
  };

  // 最终综合审计不用 5 步流程，而是 finding + report 接口
  if (meta.kind === "final-audit") {
    return Response.json({
      ...base,
      stepOrder: [],
      scenario: {
        id: FINAL_AUDIT_SCENARIO.id,
        title: FINAL_AUDIT_SCENARIO.title,
        scenarioVersion: FINAL_AUDIT_SCENARIO.scenarioVersion,
        trackVersion: FINAL_AUDIT_SCENARIO.trackVersion,
        contractName: FINAL_AUDIT_SCENARIO.contractName,
        contractAddress: FINAL_AUDIT_SCENARIO.contractAddress,
        code: FINAL_AUDIT_SCENARIO.code,
        passThreshold: FINAL_AUDIT_SCENARIO.passThreshold,
        requiredFindingCodes: FINAL_AUDIT_SCENARIO.requiredFindingCodes,
      },
      nextAction: "提交 Finding 后调用 POST /api/security/report 生成审计报告",
    });
  }

  const scenario = getScenario(meta.id);
  if (!scenario) return jsonError("安全场景已下线", 409);

  return Response.json({
    ...base,
    stepOrder: STEP_ORDER,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      category: scenario.category,
      difficulty: scenario.difficulty,
      scenarioVersion: scenario.scenarioVersion,
      ruleId: scenario.ruleId,
      objective: scenario.objective,
      contractName: scenario.contractName,
      contractAddress: scenario.contractAddress,
      code: scenario.code,
      dangerLines: scenario.dangerLines,
      identify: scenario.identify,
      followUp: scenario.followUp,
      patchOptions: scenario.patchOptions,
      trace: scenario.trace,
      traceIntro: scenario.traceIntro,
      verifyNote: scenario.verifyNote,
      signGuardSampleId: scenario.signGuardSampleId ?? null,
    },
  });
}

// GET /api/security/session/start?scenarioId=... — 查询已有 session（幂等）
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const scenarioId = new URL(request.url).searchParams.get("scenarioId") ?? "";
  const meta = getSessionScenario(scenarioId);
  if (!meta) return jsonError("安全场景编号无效", 400);

  const session = await getSecuritySession(db, auth.userId, meta.id, meta.scenarioVersion);
  if (!session) {
    return Response.json({ sessionId: null, status: "not_started", currentStep: 1, score: 0 });
  }
  return Response.json({
    sessionId: session.id,
    scenarioId: session.scenarioId,
    status: session.status,
    currentStep: session.currentStep,
    score: session.score,
    state: JSON.parse(session.stateJson || "{}") as unknown,
  });
}
