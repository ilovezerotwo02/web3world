// =============================================================================
// 确定性评分（不做 LLM 判定）
// 漏洞识别 30 / 根因理解 25 / 修复方案 20 / 回归验证 15 / 风险表达 10
// =============================================================================

import { getScenario, FINAL_AUDIT_SCENARIO, type AuditTarget, type LabScenario } from "./scenarios";

export type FindingDraft = {
  title: string;
  vulnType: string;
  severity: string;
  evidenceLines: number[];
  rootCause: string;
  impact: string;
  remediation: string;
};

export type FindingEvaluation = {
  matchedCode: string | null;
  matchedTitle: string | null;
  identityMatched: boolean;
  severityMatched: boolean;
  rootCauseMatched: boolean;
  remediationMatched: boolean;
  rootCauseHits: string[];
  remediationHits: string[];
  falsePositive: boolean;
  message: string;
};

export type AuditEvaluation = {
  score: number;
  passed: boolean;
  breakdown: {
    identification: number;
    rootCause: number;
    remediation: number;
    regression: number;
    expression: number;
    penalty: number;
  };
  evaluations: FindingEvaluation[];
  identifiedCodes: string[];
  missingRequired: string[];
  summary: { critical: number; high: number; medium: number; low: number };
};

const WEIGHTS = {
  identification: 30,
  rootCause: 25,
  remediation: 20,
  regression: 15,
  expression: 10,
} as const;

const FALSE_POSITIVE_PENALTY = 10;
export const MIN_TEXT_LENGTH = 12;

function normalize(value: string) {
  return (value ?? "").toString().toLowerCase();
}

function groupHits(text: string, groups: string[][]) {
  const hits: string[] = [];
  for (const group of groups) {
    const matched = group.find((keyword) => text.includes(normalize(keyword)));
    if (matched) hits.push(matched);
  }
  return hits;
}

export function linesOverlap(a: number[], b: number[]) {
  return a.some((line) => b.includes(line));
}

export function matchTarget(
  finding: FindingDraft,
  targets: AuditTarget[],
): AuditTarget | null {
  const byCode = targets.find(
    (target) =>
      target.code.toLowerCase() === normalize(finding.vulnType) ||
      normalize(finding.title).includes(normalize(target.vulnType)),
  );
  if (byCode) return byCode;
  const byLines = targets.find((target) => linesOverlap(finding.evidenceLines, target.evidenceLines));
  return byLines ?? null;
}

export function evaluateFinding(finding: FindingDraft, targets: AuditTarget[]): FindingEvaluation {
  const target = matchTarget(finding, targets);
  const rootCauseText = normalize(finding.rootCause);
  const remediationText = normalize(finding.remediation);

  if (!target) {
    return {
      matchedCode: null,
      matchedTitle: null,
      identityMatched: false,
      severityMatched: false,
      rootCauseMatched: false,
      remediationMatched: false,
      rootCauseHits: [],
      remediationHits: [],
      falsePositive: true,
      message: "没有匹配到内置靶场的漏洞类型或行号区间，可能定位不准确。",
    };
  }

  const rootCauseHits = groupHits(rootCauseText, target.rootCauseGroups);
  const rootCauseRequired = target.rootCauseGroups.length;
  const rootCauseMatched = rootCauseHits.length >= Math.max(1, Math.ceil(rootCauseRequired / 2));
  const severityMatched = normalize(finding.severity) === target.expectedSeverity;
  const remediationHits = target.remediationKeywords.filter((keyword) =>
    remediationText.includes(normalize(keyword)),
  );
  const remediationMatched = remediationHits.length > 0;

  const messages: string[] = [];
  messages.push(
    severityMatched
      ? `严重级别判定正确（${target.expectedSeverity}）。`
      : `建议重新确认严重级别：该问题预期为 ${target.expectedSeverity}。`,
  );
  messages.push(
    rootCauseMatched
      ? "根因描述命中关键点。"
      : "根因描述还缺少关键点，建议补充“为什么会发生”。",
  );
  messages.push(
    remediationMatched
      ? "修复方向可接受。"
      : "修复建议还需要更具体的可执行方案（例如 CEI / onlyOwner / nonce + deadline）。",
  );

  return {
    matchedCode: target.code,
    matchedTitle: target.title,
    identityMatched: true,
    severityMatched,
    rootCauseMatched,
    remediationMatched,
    rootCauseHits,
    remediationHits,
    falsePositive: false,
    message: messages.join(" "),
  };
}

export type AuditContext = {
  /** 三个 Lab 是否全部通过 */
  labsPassed: boolean;
  /** 重入 Lab 的回归验证是否通过 */
  replayPassed: boolean;
};

export function evaluateFinalAudit(
  findings: FindingDraft[],
  context: AuditContext,
): AuditEvaluation {
  const targets = FINAL_AUDIT_SCENARIO.targets;
  const evaluations = findings.map((finding) => evaluateFinding(finding, targets));

  const matchedTargets = new Set(evaluations.map((item) => item.matchedCode).filter(Boolean));
  const identifiedCodes = Array.from(matchedTargets) as string[];

  const requiredTargets = targets.filter((target) => target.required);
  const optionalTargets = targets.filter((target) => !target.required);
  const allTargets = [...requiredTargets, ...optionalTargets];

  const identification = allTargets.length
    ? (allTargets.filter((target) => identifiedCodes.includes(target.code)).length / allTargets.length) *
      WEIGHTS.identification
    : 0;

  const rootCauseMatches = evaluations.filter((item) => item.rootCauseMatched).length;
  const rootCause = allTargets.length
    ? Math.min(1, rootCauseMatches / Math.max(1, requiredTargets.length)) * WEIGHTS.rootCause
    : 0;

  const remediationMatches = evaluations.filter((item) => item.remediationMatched).length;
  const remediation = allTargets.length
    ? Math.min(1, remediationMatches / Math.max(1, requiredTargets.length)) * WEIGHTS.remediation
    : 0;

  const regression = context.labsPassed && context.replayPassed ? WEIGHTS.regression : context.labsPassed ? 8 : 0;

  const substantive = findings.filter(
    (finding) =>
      finding.rootCause.trim().length >= MIN_TEXT_LENGTH &&
      finding.impact.trim().length >= MIN_TEXT_LENGTH &&
      finding.remediation.trim().length >= MIN_TEXT_LENGTH,
  ).length;
  const expression = findings.length
    ? (Math.min(1, substantive / Math.max(1, requiredTargets.length))) * WEIGHTS.expression
    : 0;

  const falsePositives = evaluations.filter((item) => item.falsePositive).length;
  const penalty = falsePositives * FALSE_POSITIVE_PENALTY;

  const raw =
    identification + rootCause + remediation + regression + expression - penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const missingRequired = requiredTargets
    .filter((target) => !identifiedCodes.includes(target.code))
    .map((target) => target.code);

  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  evaluations.forEach((item) => {
    if (!item.matchedCode) return;
    const target = targets.find((entry) => entry.code === item.matchedCode);
    if (!target) return;
    summary[target.expectedSeverity] += 1;
  });

  const passed = score >= FINAL_AUDIT_SCENARIO.passThreshold && missingRequired.length === 0;

  return {
    score,
    passed,
    breakdown: {
      identification: Math.round(identification * 100) / 100,
      rootCause: Math.round(rootCause * 100) / 100,
      remediation: Math.round(remediation * 100) / 100,
      regression,
      expression: Math.round(expression * 100) / 100,
      penalty,
    },
    evaluations,
    identifiedCodes,
    missingRequired,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Lab 评分
// ---------------------------------------------------------------------------

export type LabSubmission = {
  scenarioId: string;
  identifiedLines: number[];
  identifyAnswer: string;
  followUpAnswer: string;
  patchId: string;
  replayPassed: boolean;
};

export type LabEvaluation = {
  scenarioId: string;
  passed: boolean;
  score: number;
  checklist: Array<{ label: string; ok: boolean; points: number }>;
  feedback: string[];
  greenStage: LabScenario["greenhouseStage"];
};

export function evaluateLab(submission: LabSubmission): LabEvaluation {
  const scenario = getScenario(submission.scenarioId);
  const checklist: Array<{ label: string; ok: boolean; points: number }> = [];
  const feedback: string[] = [];

  if (!scenario) {
    return {
      scenarioId: submission.scenarioId,
      passed: false,
      score: 0,
      checklist: [],
      feedback: ["未找到该安全场景。"],
      greenStage: "secured",
    };
  }

  const lineHit = linesOverlap(submission.identifiedLines, scenario.dangerLines);
  checklist.push({ label: "定位危险代码行", ok: lineHit, points: 30 });
  if (!lineHit) {
    feedback.push(`危险行应命中 ${scenario.dangerLines.join(" / ")}。`);
  }

  const identifyOk = submission.identifyAnswer === scenario.identify.correct;
  checklist.push({ label: "判断漏洞成因", ok: identifyOk, points: 25 });

  const followUpOk = submission.followUpAnswer === scenario.followUp.correct;
  checklist.push({ label: "边界追问", ok: followUpOk, points: 10 });

  const patch = scenario.patchOptions.find((option) => option.id === submission.patchId);
  const patchOk = Boolean(patch?.correct);
  checklist.push({ label: "选择修复方案", ok: patchOk, points: 20 });
  feedback.push(patch ? patch.feedback : "请选择一个修复方案。");

  const replayOk = scenario.trace.length === 0 ? true : submission.replayPassed;
  checklist.push({ label: "回归验证", ok: replayOk, points: 15 });

  const score = checklist.reduce((total, item) => (item.ok ? total + item.points : total), 0);
  const passed = lineHit && identifyOk && patchOk && replayOk;

  if (scenario.trace.length > 0 && submission.replayPassed) {
    feedback.push("REPLAY ATTACK → ATTACK BLOCKED，Bank balance protected，Regression Test PASS。");
  }
  if (scenario.trace.length === 0 && patchOk) {
    feedback.push("回归测试通过：危险调用已被拒绝。");
  }

  return {
    scenarioId: scenario.id,
    passed,
    score,
    checklist,
    feedback,
    greenStage: scenario.greenhouseStage,
  };
}

/** 重入攻击回放：修复后再次攻击的确定性结果 */
export function replayAttack(patched: boolean) {
  if (patched) {
    return {
      blocked: true,
      bankBalance: 7,
      attackerBalance: 1,
      headline: "ATTACK BLOCKED",
      detail: "第二次 withdraw() 触发 require(amount > 0) 失败并回滚，Bank balance protected。",
      regression: "PASS" as const,
    };
  }
  return {
    blocked: false,
    bankBalance: 0,
    attackerBalance: 7,
    headline: "ATTACK SUCCEEDED",
    detail: "Vault 余额被重入调用逐格抽干：7 ETH → 0 ETH。",
    regression: "FAIL" as const,
  };
}

// ---------------------------------------------------------------------------
// Security Score 等级
// ---------------------------------------------------------------------------

export type AuditorRank =
  | "Beginner Auditor"
  | "Security Explorer"
  | "Contract Defender"
  | "Web3 Security Guardian";

export function auditorRank(score: number, finalPassed: boolean): AuditorRank {
  if (finalPassed && score >= 85) return "Web3 Security Guardian";
  if (score >= 70) return "Contract Defender";
  if (score >= 40) return "Security Explorer";
  return "Beginner Auditor";
}
