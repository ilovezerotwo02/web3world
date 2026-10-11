// =============================================================================
// 安全模块服务端数据流程测试（D1 层，使用内存 sqlite + Drizzle）
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "../db/schema.ts";
import {
  createSecurityReport,
  createSecuritySession,
  createUser,
  getSecurityProgressSnapshot,
  getSecurityReport,
  getSecuritySession,
  getSecuritySessionById,
  listSecurityFindings,
  saveTxRiskCheck,
  submitSecurityFinding,
  updateSecuritySession,
  upsertAgentPolicy,
  getAgentPolicy,
} from "../lib/repositories.ts";
import { isPassportEligible, buildSecurityBadgeMetadata } from "../lib/security/passport.ts";
import { evaluateStep } from "../lib/security/session-steps.ts";
import { getScenario } from "../lib/security/scenarios.ts";
import {
  clampText,
  isCalldata,
  isHexAddress,
  isTxHash,
  rateLimit,
} from "../lib/security/api-helpers.ts";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      avatar_url TEXT,
      wallet_address TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      exp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE security_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scenario_id TEXT NOT NULL,
      scenario_version TEXT NOT NULL DEFAULT '1.0.0',
      lab_id TEXT NOT NULL DEFAULT 'lab-1',
      status TEXT NOT NULL DEFAULT 'in_progress',
      current_step INTEGER NOT NULL DEFAULT 1,
      score INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
    CREATE UNIQUE INDEX unique_security_session_idx
      ON security_sessions (user_id, scenario_id, scenario_version);

    CREATE TABLE security_findings (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES security_sessions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      finding_code TEXT,
      vulnerability_type TEXT NOT NULL DEFAULT 'unknown',
      severity TEXT NOT NULL DEFAULT 'medium',
      title TEXT NOT NULL DEFAULT '',
      evidence_json TEXT NOT NULL DEFAULT '[]',
      root_cause TEXT NOT NULL DEFAULT '',
      impact TEXT NOT NULL DEFAULT '',
      fix TEXT NOT NULL DEFAULT '',
      regression_json TEXT NOT NULL DEFAULT '{}',
      deterministic_score INTEGER NOT NULL DEFAULT 0,
      is_correct INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE security_reports (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      scenario_id TEXT NOT NULL DEFAULT 'greenhouse-vault-audit-v1',
      track_version TEXT NOT NULL DEFAULT '2026.1',
      score INTEGER NOT NULL DEFAULT 0,
      passed INTEGER NOT NULL DEFAULT 0,
      false_positive_penalty INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT NOT NULL DEFAULT '{}',
      report_json TEXT NOT NULL DEFAULT '{}',
      report_markdown TEXT NOT NULL DEFAULT '',
      report_hash TEXT NOT NULL DEFAULT '',
      wallet_address TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
    CREATE UNIQUE INDEX unique_security_report_hash_idx ON security_reports (report_hash);

    CREATE TABLE tx_risk_checks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      chain_id INTEGER NOT NULL,
      tx_hash TEXT,
      to_address TEXT,
      selector TEXT,
      value_wei TEXT NOT NULL DEFAULT '0',
      risk_decision TEXT NOT NULL DEFAULT 'ALLOW',
      risk_severity TEXT NOT NULL DEFAULT 'INFO',
      triggered_rules_json TEXT NOT NULL DEFAULT '[]',
      calldata_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE agent_policies (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wallet_address TEXT,
      policy_json TEXT NOT NULL DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
    CREATE UNIQUE INDEX unique_agent_policy_idx ON agent_policies (user_id);
  `);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

async function seedUsers(db) {
  await createUser(db, "user-a", "alice");
  await createUser(db, "user-b", "bob");
}

test("security_sessions：同一用户 + 同一场景 + 同一版本只能有一条记录（幂等）", async () => {
  const { db } = createTestDb();
  await seedUsers(db);

  const first = await createSecuritySession(db, {
    userId: "user-a",
    scenarioId: "reentrancy-bank-v1",
    scenarioVersion: "1.0.0",
    labId: "lab-1",
  });
  const second = await createSecuritySession(db, {
    userId: "user-a",
    scenarioId: "reentrancy-bank-v1",
    scenarioVersion: "1.0.0",
    labId: "lab-1",
  });
  assert.equal(first.id, second.id);
  assert.equal(first.status, "in_progress");

  const byKey = await getSecuritySession(db, "user-a", "reentrancy-bank-v1", "1.0.0");
  assert.equal(byKey.id, first.id);
  const byId = await getSecuritySessionById(db, first.id, "user-a");
  assert.equal(byId.id, first.id);
  assert.equal(await getSecuritySessionById(db, first.id, "user-b"), null, "不能读取其他用户的 session");
});

test("session step 判定结果可以落库，并且重复提交同一答案结果一致", async () => {
  const { db } = createTestDb();
  await seedUsers(db);
  const session = await createSecuritySession(db, {
    userId: "user-a",
    scenarioId: "reentrancy-bank-v1",
    scenarioVersion: "1.0.0",
    labId: "lab-1",
  });
  const scenario = getScenario("reentrancy-bank-v1");

  let state = {};
  for (const [step, answer] of [
    ["identify", { lines: scenario.dangerLines }],
    ["question", { answer: scenario.identify.correct }],
    ["followup", { answer: scenario.followUp.correct }],
    ["patch", { patchId: scenario.patchOptions.find((option) => option.correct).id }],
    ["verify", {}],
  ]) {
    const evaluation = evaluateStep(scenario, step, answer, state);
    state = evaluation.state;
  }
  const final = evaluateStep(scenario, "verify", {}, state);
  assert.equal(final.passed, true);

  const updated = await updateSecuritySession(db, session.id, {
    status: "passed",
    score: final.score,
    currentStep: 5,
    stateJson: JSON.stringify(final.state),
    completedAt: new Date().toISOString(),
  });
  assert.equal(updated.status, "passed");
  assert.equal(updated.score, 100);

  const reloaded = await getSecuritySessionById(db, session.id, "user-a");
  assert.equal(reloaded.status, "passed");
  const parsed = JSON.parse(reloaded.stateJson);
  assert.equal(parsed.patch.ok, true);
});

test("security_findings：提交后可以按 session 列出，并保存确定性分数", async () => {
  const { db } = createTestDb();
  await seedUsers(db);
  const session = await createSecuritySession(db, {
    userId: "user-a",
    scenarioId: "greenhouse-vault-audit-v1",
    scenarioVersion: "1.0.0",
    labId: "lab-4",
  });

  const record = await submitSecurityFinding(db, {
    sessionId: session.id,
    userId: "user-a",
    findingCode: "F-01",
    vulnerabilityType: "reentrancy",
    severity: "high",
    title: "withdraw() 重入",
    evidenceLines: [20, 22],
    rootCause: "外部调用发生在状态更新之前",
    impact: "攻击者可以重复提款",
    fix: "使用 CEI 或 ReentrancyGuard",
    regression: { rulePassed: true },
    deterministicScore: 100,
    isCorrect: true,
  });
  assert.equal(record.findingCode, "F-01");
  assert.equal(record.evidenceJson, JSON.stringify([20, 22]));

  const list = await listSecurityFindings(db, session.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].isCorrect, 1);
});

test("security_reports：相同 reportHash 不会重复建表记录，且用户之间互相不可读", async () => {
  const { db } = createTestDb();
  await seedUsers(db);

  const payload = {
    userId: "user-a",
    sessionId: null,
    scenarioId: "greenhouse-vault-audit-v1",
    trackVersion: "2026.1",
    score: 88,
    passed: true,
    falsePositivePenalty: 0,
    summaryJson: JSON.stringify({ critical: 1, high: 2, medium: 1, low: 0 }),
    reportJson: JSON.stringify({ version: 1 }),
    reportMarkdown: "# Web3 Security Audit Report",
    reportHash: "deadbeef",
    walletAddress: null,
  };

  const first = await createSecurityReport(db, payload);
  const second = await createSecurityReport(db, payload);
  assert.equal(first.id, second.id);

  const own = await getSecurityReport(db, first.id, "user-a");
  assert.ok(own);
  assert.equal(own.score, 88);
  assert.equal(await getSecurityReport(db, first.id, "user-b"), null, "B 用户不能读取 A 用户的报告");
});

test("getSecurityProgressSnapshot 聚合 Lab 通过情况与最新报告", async () => {
  const { db } = createTestDb();
  await seedUsers(db);

  for (const scenarioId of ["reentrancy-bank-v1", "access-control-mint-v1", "signature-replay-v1", "tx-origin-phish-v1"]) {
    const session = await createSecuritySession(db, {
      userId: "user-a",
      scenarioId,
      scenarioVersion: "1.0.0",
      labId: "lab-1",
    });
    await updateSecuritySession(db, session.id, { status: "passed", score: 100, completedAt: new Date().toISOString() });
  }
  await createSecurityReport(db, {
    userId: "user-a",
    sessionId: null,
    scenarioId: "greenhouse-vault-audit-v1",
    trackVersion: "2026.1",
    score: 88,
    passed: true,
    falsePositivePenalty: 0,
    summaryJson: "{}",
    reportJson: "{}",
    reportMarkdown: "",
    reportHash: "cafebabe",
    walletAddress: null,
  });

  const snapshot = await getSecurityProgressSnapshot(db, "user-a");
  assert.equal(snapshot.passedScenarios.length, 4);
  assert.equal(snapshot.sessions.length, 4);
  assert.ok(snapshot.latestReport);
  assert.equal(snapshot.latestReport.score, 88);
  assert.equal(Boolean(snapshot.latestReport.passed), true);
});

test("tx_risk_checks 只保存必要字段（calldataHash，不保存完整 calldata）", async () => {
  const { db } = createTestDb();
  await seedUsers(db);
  const record = await saveTxRiskCheck(db, {
    userId: "user-a",
    chainId: 10143,
    txHash: null,
    toAddress: "0x0000000000000000000000000000000000005eed",
    selector: "0x095ea7b3",
    valueWei: "0",
    riskDecision: "BLOCK",
    riskSeverity: "HIGH",
    triggeredRules: ["TX-001", "TX-005"],
    calldataHash: "a".repeat(64),
  });
  assert.equal(record.riskDecision, "BLOCK");
  assert.equal(record.calldataHash, "a".repeat(64));
  assert.equal("calldata" in record, false, "表结构中不应存在完整 calldata 字段");
});

test("agent_policies：同一用户只有一条策略，重复保存为更新", async () => {
  const { db } = createTestDb();
  await seedUsers(db);
  const first = await upsertAgentPolicy(db, "user-a", JSON.stringify({ note: "v1" }), null);
  const second = await upsertAgentPolicy(db, "user-a", JSON.stringify({ note: "v2" }), "0xabc");
  assert.equal(first.id, second.id);
  const stored = await getAgentPolicy(db, "user-a");
  assert.equal(JSON.parse(stored.policyJson).note, "v2");
});

test("Passport 资格：四个条件缺一不可", () => {
  const base = { contractHarvested: true, labsPassed: [true, true, true], finalAuditPassed: true, walletVerified: true };
  assert.equal(isPassportEligible(base).eligible, true);
  assert.equal(isPassportEligible({ ...base, contractHarvested: false }).eligible, false);
  assert.equal(isPassportEligible({ ...base, labsPassed: [true, false, true] }).eligible, false);
  assert.equal(isPassportEligible({ ...base, finalAuditPassed: false }).eligible, false);
  assert.equal(isPassportEligible({ ...base, walletVerified: false }).eligible, false);

  const metadata = buildSecurityBadgeMetadata({
    score: 88,
    falsePositivePenalty: 0,
    labPassed: [true, true, true],
    reportHash: "abc",
  });
  assert.equal(metadata.name, "Monad Web3 Security Guardian");
  assert.ok(metadata.attributes.some((attribute) => attribute.trait_type === "Audit Score" && attribute.value === 88));
  assert.ok(metadata.attributes.some((attribute) => attribute.trait_type === "Report Hash"));
});

test("API 输入校验：非法地址 / 非法 txHash / 非法 calldata 都返回 false", () => {
  assert.equal(isHexAddress("0x0000000000000000000000000000000000005eed"), true);
  assert.equal(isHexAddress("0x1234"), false);
  assert.equal(isHexAddress("0xzz00000000000000000000000000000000000000"), false);

  assert.equal(isTxHash(`0x${"a".repeat(64)}`), true);
  assert.equal(isTxHash(`0x${"a".repeat(63)}`), false);
  assert.equal(isTxHash("0x"), false);

  assert.equal(isCalldata("0x095ea7b3"), true);
  assert.equal(isCalldata("0x"), true);
  assert.equal(isCalldata("0x0"), false);
  assert.equal(isCalldata("095ea7b3"), false);

  assert.equal(clampText("  hello  "), "hello");
  assert.equal(clampText("x".repeat(2000)).length, 800);
  assert.equal(clampText(undefined), "");
});

test("限流工具在同窗口内按次数生效", () => {
  const key = `test-${Math.random()}`;
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), false);
});
