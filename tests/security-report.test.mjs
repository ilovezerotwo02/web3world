// =============================================================================
// 审计报告测试：确定性评分 / canonical JSON / SHA-256 / Markdown
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateFinalAudit,
  evaluateFinding,
  replayAttack,
  auditorRank,
} from "../lib/security/scoring.ts";
import {
  buildAuditReport,
  canonicalJson,
  reportIdFromHash,
  reportToMarkdown,
  sha256Hex,
  withReportHash,
} from "../lib/security/report.ts";
import { FINAL_AUDIT_SCENARIO } from "../lib/security/scenarios.ts";
import { evaluateStep } from "../lib/security/session-steps.ts";
import { getScenario } from "../lib/security/scenarios.ts";

const TARGET = (code) => FINAL_AUDIT_SCENARIO.targets.find((target) => target.code === code);

function goodFinding(code) {
  const target = TARGET(code);
  return {
    title: target.title,
    vulnType: target.vulnType,
    severity: target.expectedSeverity,
    evidenceLines: target.evidenceLines.slice(0, 1),
    rootCause: `根因：${target.rootCauseGroups.map((group) => group[0]).join("，")}`,
    impact: "攻击者可以重复利用这个问题获取不属于自己的资产或权限。",
    remediation: `修复方向：${target.remediationKeywords.join(" / ")}。`,
  };
}

const THREE_REQUIRED = FINAL_AUDIT_SCENARIO.requiredFindingCodes;

test("Finding 缺字段时不能通过校验（标题/根因/影响/修复）", () => {
  const target = TARGET("F-01");
  const missing = evaluateFinding(
    {
      title: "",
      vulnType: "reentrancy",
      severity: "high",
      evidenceLines: [],
      rootCause: "",
      impact: "",
      remediation: "",
    },
    FINAL_AUDIT_SCENARIO.targets,
  );
  assert.equal(missing.rootCauseMatched, false);
  assert.equal(missing.remediationMatched, false);
  assert.ok(target.evidenceLines.length > 0);
});

test("正确 Finding 可以被确定性规则识别，severity / 根因 / 修复都会分别判定", () => {
  const evaluation = evaluateFinding(goodFinding("F-01"), FINAL_AUDIT_SCENARIO.targets);
  assert.equal(evaluation.matchedCode, "F-01");
  assert.equal(evaluation.severityMatched, true);
  assert.equal(evaluation.rootCauseMatched, true);
  assert.equal(evaluation.remediationMatched, true);
  assert.equal(evaluation.falsePositive, false);
});

test("错误 severity 会被指出，但仍然保留命中记录", () => {
  const evaluation = evaluateFinding(
    { ...goodFinding("F-02"), severity: "low" },
    FINAL_AUDIT_SCENARIO.targets,
  );
  assert.equal(evaluation.matchedCode, "F-02");
  assert.equal(evaluation.severityMatched, false);
  assert.match(evaluation.message, /critical/);
});

test("完全无关的 Finding 会被计为误报（-10）", () => {
  const evaluation = evaluateFinding(
    {
      title: "CSS 样式不统一",
      vulnType: "style",
      severity: "low",
      evidenceLines: [999],
      rootCause: "样式没有统一变量管理，维护成本较高。",
      impact: "视觉不一致，但不涉及链上资产安全。",
      remediation: "统一使用 CSS 变量。",
    },
    FINAL_AUDIT_SCENARIO.targets,
  );
  assert.equal(evaluation.falsePositive, true);
  assert.equal(evaluation.matchedCode, null);
});

test("三个必中问题全部命中时可以通过（>= 阈值，且无缺失必中项）", () => {
  const findings = THREE_REQUIRED.map((code) => goodFinding(code));
  const evaluation = evaluateFinalAudit(findings, { labsPassed: true, replayPassed: true });
  assert.deepEqual(evaluation.missingRequired, []);
  assert.ok(evaluation.score >= FINAL_AUDIT_SCENARIO.passThreshold, `score=${evaluation.score}`);
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.breakdown.regression, 15);
});

test("缺少必中问题或 Lab 未通过时不能通过", () => {
  const partial = evaluateFinalAudit([goodFinding("F-01")], { labsPassed: true, replayPassed: true });
  assert.ok(partial.missingRequired.length >= 2);
  assert.equal(partial.passed, false);

  const noLabs = evaluateFinalAudit(
    THREE_REQUIRED.map((code) => goodFinding(code)),
    { labsPassed: false, replayPassed: false },
  );
  assert.equal(noLabs.breakdown.regression, 0);
});

test("score 可重复计算：同样的输入得到同样的分数", () => {
  const findings = THREE_REQUIRED.map((code) => goodFinding(code));
  const first = evaluateFinalAudit(findings, { labsPassed: true, replayPassed: true });
  const second = evaluateFinalAudit(findings, { labsPassed: true, replayPassed: true });
  assert.equal(first.score, second.score);
  assert.deepEqual(first.breakdown, second.breakdown);
});

test("已删除项目的误报会扣分，但总分不会低于 0", () => {
  const findings = THREE_REQUIRED.map((code) => goodFinding(code)).concat(
    Array.from({ length: 6 }, (_, index) => ({
      title: `无关问题 ${index}`,
      vulnType: "noise",
      severity: "low",
      evidenceLines: [400 + index],
      rootCause: "这段描述与靶场漏洞无关，只是凑数的内容而已。",
      impact: "不会造成链上影响，但会污染报告质量。",
      remediation: "删除这条无关的 Finding。",
    })),
  );
  const evaluation = evaluateFinalAudit(findings, { labsPassed: true, replayPassed: true });
  assert.ok(evaluation.score >= 0);
  assert.ok(evaluation.breakdown.penalty >= 10);
});

test("canonical JSON 对键顺序不敏感，相同报告生成相同 hash", async () => {
  const a = { b: 1, a: [2, 3], c: { y: 1, x: 2 } };
  const b = { c: { x: 2, y: 1 }, a: [2, 3], b: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));

  const findings = THREE_REQUIRED.map((code) => goodFinding(code));
  const evaluation = evaluateFinalAudit(findings, { labsPassed: true, replayPassed: true });
  const reportA = await withReportHash(
    buildAuditReport({ auditor: "tester", findings, evaluation, replayPassed: true, completedAt: "2026-01-01T00:00:00.000Z" }),
  );
  const reportB = await withReportHash(
    buildAuditReport({ auditor: "tester", findings, evaluation, replayPassed: true, completedAt: "2026-01-01T00:00:00.000Z" }),
  );
  assert.equal(reportA.reportHash, reportB.reportHash);
  assert.match(reportA.reportHash, /^[0-9a-f]{64}$/);
  assert.equal(reportIdFromHash(reportA.reportHash).length, 7);
});

test("修改 Finding 后 reportHash 必须改变", async () => {
  const findings = THREE_REQUIRED.map((code) => goodFinding(code));
  const evaluation = evaluateFinalAudit(findings, { labsPassed: true, replayPassed: true });
  const base = await withReportHash(
    buildAuditReport({ auditor: "tester", findings, evaluation, replayPassed: true, completedAt: "2026-01-01T00:00:00.000Z" }),
  );
  const changedEvaluation = evaluateFinalAudit(
    [{ ...findings[0], impact: "影响描述被修改了，用来验证哈希敏感性。" }, ...findings.slice(1)],
    { labsPassed: true, replayPassed: true },
  );
  const changed = await withReportHash(
    buildAuditReport({
      auditor: "tester",
      findings: [{ ...findings[0], impact: "影响描述被修改了，用来验证哈希敏感性。" }, ...findings.slice(1)],
      evaluation: changedEvaluation,
      replayPassed: true,
      completedAt: "2026-01-01T00:00:00.000Z",
    }),
  );
  assert.notEqual(base.reportHash, changed.reportHash);
});

test("Markdown 报告包含 Overview / Summary / Findings / 回归结果", async () => {
  const findings = THREE_REQUIRED.map((code) => goodFinding(code));
  const evaluation = evaluateFinalAudit(findings, { labsPassed: true, replayPassed: true });
  const report = await withReportHash(
    buildAuditReport({ auditor: "tester", findings, evaluation, replayPassed: true, completedAt: "2026-01-01T00:00:00.000Z" }),
  );
  const markdown = reportToMarkdown(report);
  assert.match(markdown, /# Web3 Security Audit Report/);
  assert.match(markdown, /## Overview/);
  assert.match(markdown, /## Summary/);
  assert.match(markdown, /## Findings/);
  assert.match(markdown, /Regression Result: Passed/);
  assert.match(markdown, /Security Score: \d+\/100/);
  assert.match(markdown, /Report Hash \(sha256\): [0-9a-f]{64}/);
});

test("sha256Hex 输出稳定的 32 字节十六进制", async () => {
  const hash = await sha256Hex("monad-guardian-farm");
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, await sha256Hex("monad-guardian-farm"));
  assert.notEqual(hash, await sha256Hex("monad-guardian-farm "));
});

test("重入攻击回放：修复前后结果是确定性的", () => {
  const vulnerable = replayAttack(false);
  assert.equal(vulnerable.blocked, false);
  assert.equal(vulnerable.bankBalance, 0);
  assert.equal(vulnerable.attackerBalance, 7);
  assert.equal(vulnerable.regression, "FAIL");

  const patched = replayAttack(true);
  assert.equal(patched.blocked, true);
  assert.equal(patched.bankBalance, 7);
  assert.equal(patched.regression, "PASS");
});

test("Lab 步骤判定与攻击回放联动：错误修复方案无法通过回归", () => {
  const scenario = getScenario("reentrancy-bank-v1");
  let state = {};
  state = evaluateStep(scenario, "identify", { lines: scenario.dangerLines }, state).state;
  state = evaluateStep(scenario, "question", { answer: scenario.identify.correct }, state).state;
  state = evaluateStep(scenario, "followup", { answer: scenario.followUp.correct }, state).state;

  const wrong = scenario.patchOptions.find((option) => !option.correct);
  const wrongPatch = evaluateStep(scenario, "patch", { patchId: wrong.id }, state).state;
  const wrongVerify = evaluateStep(scenario, "verify", {}, wrongPatch);
  assert.equal(wrongVerify.ok, false);
  assert.equal(wrongVerify.passed, false);
  assert.equal(wrongVerify.replay.blocked, false);

  const right = scenario.patchOptions.find((option) => option.correct);
  const rightPatch = evaluateStep(scenario, "patch", { patchId: right.id }, state).state;
  const rightVerify = evaluateStep(scenario, "verify", {}, rightPatch);
  assert.equal(rightVerify.ok, true);
  assert.equal(rightVerify.passed, true);
  assert.equal(rightVerify.score, 100);
  assert.equal(rightVerify.replay.regression, "PASS");
});

test("服务端不信任客户端传入的 replayPassed：验证步骤忽略外部标记", () => {
  const scenario = getScenario("reentrancy-bank-v1");
  const state = {
    identify: { lines: scenario.dangerLines, ok: true },
    question: { answer: scenario.identify.correct, ok: true },
    followup: { answer: scenario.followUp.correct, ok: true },
    patch: { patchId: scenario.patchOptions.find((option) => !option.correct).id, ok: false },
  };
  // 即使外部传入 replayPassed: true，也应因为 patch 错误而失败
  const result = evaluateStep(scenario, "verify", { replayPassed: true }, state);
  assert.equal(result.ok, false);
});

test("审计等级映射符合文档命名", () => {
  assert.equal(auditorRank(20, false), "Beginner Auditor");
  assert.equal(auditorRank(50, false), "Security Explorer");
  assert.equal(auditorRank(75, false), "Contract Defender");
  assert.equal(auditorRank(90, true), "Web3 Security Guardian");
  assert.equal(auditorRank(90, false), "Contract Defender");
});
