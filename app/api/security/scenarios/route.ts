import { LABS, SECURITY_SCENARIOS } from "../../../../lib/security/scenarios";
import { FINAL_AUDIT_SCENARIO } from "../../../../lib/security/scenarios";

// GET /api/security/scenarios — 返回可用安全场景（只读元数据，无用户隐私）
export async function GET() {
  return Response.json({
    labs: LABS.map((lab) => ({
      id: lab.id,
      title: lab.title,
      subtitle: lab.subtitle,
      scenarioIds: lab.scenarioIds,
      greenhouseStage: lab.greenhouseStage,
      unlockNote: lab.unlockNote,
    })),
    scenarios: SECURITY_SCENARIOS.map((scenario) => ({
      id: scenario.id,
      labId: scenario.labId,
      title: scenario.title,
      category: scenario.category,
      difficulty: scenario.difficulty,
      scenarioVersion: scenario.scenarioVersion,
      order: scenario.order,
      ruleId: scenario.ruleId,
      contractName: scenario.contractName,
      contractAddress: scenario.contractAddress,
      objective: scenario.objective,
      hasTrace: scenario.trace.length > 0,
      signGuardSampleId: scenario.signGuardSampleId ?? null,
      greenhouseStage: scenario.greenhouseStage,
    })),
    finalAudit: {
      id: FINAL_AUDIT_SCENARIO.id,
      title: FINAL_AUDIT_SCENARIO.title,
      scenarioVersion: FINAL_AUDIT_SCENARIO.scenarioVersion,
      trackVersion: FINAL_AUDIT_SCENARIO.trackVersion,
      contractName: FINAL_AUDIT_SCENARIO.contractName,
      passThreshold: FINAL_AUDIT_SCENARIO.passThreshold,
      requiredFindingCodes: FINAL_AUDIT_SCENARIO.requiredFindingCodes,
      targetCount: FINAL_AUDIT_SCENARIO.targets.length,
    },
    disclaimer:
      "Security Rules Engine 用于教学型静态检查，结果不替代专业审计；所有靶场仅用于测试网 / 本地沙箱。",
  });
}
