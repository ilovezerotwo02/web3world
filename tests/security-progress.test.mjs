// =============================================================================
// 安全进度状态机测试（本地缓存 + 温室阶段 + Passport 资格）
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import {
  GREENHOUSE_STAGE_COPY,
  SECURITY_PROGRESS_STORAGE_KEY,
  initialSecurityProgress,
  readStoredSecurityProgress,
  scenarioUnlocked,
  securityCompletion,
  securityLabPassed,
  securityLabStage,
  securityProgressReducer,
} from "../app/game/security/security-progress.ts";
import { LABS, SECURITY_SCENARIOS } from "../lib/security/scenarios.ts";

const SUPPORTED_SCENARIO_COUNT = SECURITY_SCENARIOS.length;

function passScenario(state, scenarioId, score = 100) {
  let next = securityProgressReducer(state, { type: "start-scenario", scenarioId });
  next = securityProgressReducer(next, { type: "complete-scenario", scenarioId, score, passed: true });
  return next;
}

test("初始状态：未解锁、lab 全未通过、温室锁定", () => {
  assert.equal(initialSecurityProgress.unlocked, false);
  assert.deepEqual(initialSecurityProgress.labsPassed, [false, false, false]);
  assert.equal(securityLabStage(initialSecurityProgress), "locked");
  assert.deepEqual(GREENHOUSE_STAGE_COPY.locked.label, "锁定");
});

test("unlock 后温室进入废弃状态（ruined）", () => {
  const state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  assert.equal(state.unlocked, true);
  assert.equal(securityLabStage(state), "ruined");
});

test("Lab 必须按顺序解锁：未完成 Lab 1 时不能进入 Lab 2 / Lab 3", () => {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  assert.equal(scenarioUnlocked(state, "reentrancy-bank-v1"), true);
  assert.equal(scenarioUnlocked(state, "access-control-mint-v1"), false);
  assert.equal(scenarioUnlocked(state, "signature-replay-v1"), false);
  assert.equal(scenarioUnlocked(state, "tx-origin-phish-v1"), false);

  state = passScenario(state, "reentrancy-bank-v1");
  assert.equal(scenarioUnlocked(state, "access-control-mint-v1"), true);
  assert.equal(scenarioUnlocked(state, "signature-replay-v1"), false);
  assert.equal(securityLabStage(state), "frame-repaired");

  state = passScenario(state, "access-control-mint-v1");
  assert.equal(scenarioUnlocked(state, "signature-replay-v1"), true);
  assert.equal(scenarioUnlocked(state, "tx-origin-phish-v1"), false);

  state = passScenario(state, "signature-replay-v1");
  assert.equal(scenarioUnlocked(state, "tx-origin-phish-v1"), true);
  // 文档映射表：secured 要求 Lab 2 + Lab 3 都完成，因此此时仍处于「修复骨架」阶段
  assert.equal(securityLabStage(state), "frame-repaired");
  assert.deepEqual(state.labsPassed, [true, true, false]);

  state = passScenario(state, "tx-origin-phish-v1");
  assert.deepEqual(state.labsPassed, [true, true, true]);
  assert.equal(securityLabStage(state), "secured");
});

test("Lab 未全部通过时不能拿 Security Passport", () => {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  state = passScenario(state, "reentrancy-bank-v1");
  state = securityProgressReducer(state, {
    type: "complete-audit",
    score: 90,
    passed: true,
    reportId: "r1",
    reportHash: "hash",
    falsePositivePenalty: 0,
  });
  assert.equal(state.badgeEligible, false);
  assert.equal(securityLabStage(state), "frame-repaired");
});

test("全部 Lab + Final Audit 通过后才点亮温室并允许领取 Passport", () => {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  for (const scenario of SECURITY_SCENARIOS) {
    state = passScenario(state, scenario.id);
  }
  assert.equal(state.badgeEligible, false, "Final Audit 未通过前不能领取");

  state = securityProgressReducer(state, {
    type: "complete-audit",
    score: 88,
    passed: true,
    reportId: "report-1",
    reportHash: "abc123",
    falsePositivePenalty: 0,
  });
  assert.equal(state.badgeEligible, true);
  assert.equal(securityLabStage(state), "fully-powered");
  assert.equal(securityCompletion(state).finalAuditPassed, true);
  assert.equal(securityCompletion(state).done, SUPPORTED_SCENARIO_COUNT);
});

test("重复提交同一个通过的场景不会重复计分（幂等）", () => {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  state = passScenario(state, "reentrancy-bank-v1", 100);
  const once = JSON.stringify(state.scenarios["reentrancy-bank-v1"]);
  state = passScenario(state, "reentrancy-bank-v1", 100);
  assert.equal(JSON.stringify(state.scenarios["reentrancy-bank-v1"]), once);
  assert.equal(securityCompletion(state).done, 1);
});

test("刷新页面后可以从 localStorage 恢复完成状态", () => {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  state = passScenario(state, "reentrancy-bank-v1");
  const serialized = JSON.stringify(state);
  const restored = readStoredSecurityProgress(serialized);
  assert.equal(restored.unlocked, true);
  assert.equal(restored.scenarios["reentrancy-bank-v1"].status, "passed");
  assert.deepEqual(restored.labsPassed, [true, false, false]);
  assert.equal(securityLabStage(restored), "frame-repaired");
});

test("损坏或未知版本的缓存会被安全地丢弃", () => {
  assert.deepEqual(readStoredSecurityProgress("not-json"), initialSecurityProgress);
  assert.deepEqual(readStoredSecurityProgress(JSON.stringify({ version: 99 })), initialSecurityProgress);
  const filtered = readStoredSecurityProgress(
    JSON.stringify({ version: 1, unlocked: true, scenarios: { "unknown-scenario": { status: "passed", score: 100 } } }),
  );
  assert.deepEqual(Object.keys(filtered.scenarios), []);
});

test("重置会清空安全进度", () => {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  state = passScenario(state, "reentrancy-bank-v1");
  const reset = securityProgressReducer(state, { type: "reset" });
  assert.equal(reset.unlocked, false);
  assert.deepEqual(reset.scenarios, {});
  assert.equal(securityLabStage(reset), "locked");
});

test("存储键与文档约定一致", () => {
  assert.equal(SECURITY_PROGRESS_STORAGE_KEY, "monad-pixel-farm:v1:security-progress");
});

test("每个 Lab 的通过判定与场景列表一致", () => {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  LABS.forEach((lab, index) => {
    assert.equal(securityLabPassed(state, index), false);
  });
  state = passScenario(state, "reentrancy-bank-v1");
  assert.equal(securityLabPassed(state, 0), true);
  assert.equal(securityLabPassed(state, 1), false);
});
