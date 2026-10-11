"use client";

import { getScenario } from "../../../lib/security/scenarios";
import type { StepName } from "../../../lib/security/session-steps";
import { SecurityLabRunner } from "./SecurityLabRunner";
import type { SecurityLabStepAnswer } from "./types";

/** Lab 1（Hero Lab）：重复提款 + Attack Trace + 修复回归 */
export function ReentrancyLab({
  onComplete,
  onStepSynced,
}: {
  onComplete: (payload: { passed: boolean; score: number; answers: SecurityLabStepAnswer }) => void;
  onStepSynced?: (step: StepName) => void;
}) {
  const scenario = getScenario("reentrancy-bank-v1");
  if (!scenario) {
    return <div className="service-state"><h3>场景数据缺失</h3><p>请检查 lib/security/scenarios.ts。</p></div>;
  }
  return (
    <div className="sec-reentrancy">
      <div className="sec-greenhouse-note">
        <span>温室反馈</span>
        <p>完成本关后，废弃温室会进入「修复骨架」阶段：外部调用不再能重复闯入温室控制系统。</p>
      </div>
      <SecurityLabRunner scenario={scenario} onComplete={onComplete} onStepSynced={onStepSynced} />
    </div>
  );
}
