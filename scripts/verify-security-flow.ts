#!/usr/bin/env node
/**
 * Monad Guardian Farm · 安全流程端到端验收脚本
 *
 * 用法：
 *   1. 启动本地服务：npm run dev
 *   2. 准备一个已登录会话 token（例如本地 D1 中插入 sessions 记录）
 *   3. SECURITY_E2E_TOKEN=mpx_xxx npm run security:verify
 *
 * 默认地址 http://localhost:3000，可用 SECURITY_E2E_BASE_URL 覆盖。
 * 脚本只调用本项目自己的接口，不会连接主网，也不会发送真实交易。
 */

import { FINAL_AUDIT_SCENARIO, SECURITY_SCENARIOS } from "../lib/security/scenarios.ts";

const BASE_URL = process.env.SECURITY_E2E_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.SECURITY_E2E_TOKEN;

if (!TOKEN) {
  console.error("缺少 SECURITY_E2E_TOKEN，请先提供一个已登录会话 token。");
  process.exit(2);
}

let passed = 0;
let failed = 0;
const results = [];

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    results.push(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    results.push(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function api(path, { method = "GET", body, token = TOKEN } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, ok: response.ok, json, text };
}

function findingFor(code) {
  const target = FINAL_AUDIT_SCENARIO.targets.find((entry) => entry.code === code);
  return {
    title: target.title,
    type: target.vulnType,
    severity: target.expectedSeverity,
    evidenceLines: target.evidenceLines.slice(0, 1),
    rootCause: `根因：${target.rootCauseGroups.map((group) => group[0]).join("，")}`,
    impact: "攻击者可以重复利用这个问题获取不属于自己的资产或权限。",
    fix: `修复方向：${target.remediationKeywords.join(" / ")}。`,
  };
}

async function runLab(scenario) {
  const start = await api("/api/security/session/start", {
    method: "POST",
    body: { scenarioId: scenario.id },
  });
  if (!start.ok || !start.json?.sessionId) {
    check(`Lab ${scenario.id} 可以开始`, false, start.json?.error ?? `HTTP ${start.status}`);
    return null;
  }
  const sessionId = start.json.sessionId;

  const correctPatch = scenario.patchOptions.find((option) => option.correct);
  const steps = [
    ["identify", { lines: scenario.dangerLines }],
    ["question", { answer: scenario.identify.correct }],
    ["followup", { answer: scenario.followUp.correct }],
    ["patch", { patchId: correctPatch.id }],
    ["verify", {}],
  ];

  let last = null;
  for (const [step, answer] of steps) {
    const result = await api("/api/security/session/step", {
      method: "POST",
      body: { sessionId, step, answer },
    });
    last = result;
    if (!result.ok) break;
  }

  check(
    `Lab ${scenario.id} 全部步骤可判定且通过`,
    Boolean(last?.json?.passed) && last.json.status === "passed",
    last?.json ? `score=${last.json.score} status=${last.json.status}` : last?.json?.error,
  );
  if (scenario.trace.length > 0) {
    check(
      "重入关卡回归验证返回 ATTACK BLOCKED",
      last?.json?.replay?.blocked === true && last?.json?.replay?.regression === "PASS",
      last?.json?.replay?.headline,
    );
  }
  return sessionId;
}

async function main() {
  console.log(`\nMonad Guardian Farm · 安全流程验收 @ ${BASE_URL}\n`);

  const scenarios = await api("/api/security/scenarios", { token: null });
  check("GET /api/security/scenarios 可用", scenarios.ok && (scenarios.json?.scenarios?.length ?? 0) > 0,
    `scenarios=${scenarios.json?.scenarios?.length ?? 0}`);

  for (const scenario of SECURITY_SCENARIOS) {
    const label = `Lab ${scenario.order} · ${scenario.title}`;
    const started = await runLab(scenario);
    check(`${label} 会话已建立`, Boolean(started));
  }

  const status = await api("/api/security/session/status");
  check(
    "GET /api/security/session/status 三个 Lab 全部通过",
    Array.isArray(status.json?.labPassed) && status.json.labPassed.every(Boolean),
    JSON.stringify(status.json?.labPassed),
  );

  // ---- Final Audit ----
  const auditStart = await api("/api/security/session/start", {
    method: "POST",
    body: { scenarioId: FINAL_AUDIT_SCENARIO.id },
  });
  const auditSessionId = auditStart.json?.sessionId;
  check("Final Audit 会话已建立", Boolean(auditSessionId), auditStart.json?.error);

  const findings = FINAL_AUDIT_SCENARIO.requiredFindingCodes.map((code) => findingFor(code));
  for (const finding of findings) {
    const submitted = await api("/api/security/finding", {
      method: "POST",
      body: { sessionId: auditSessionId, finding },
    });
    check(
      `Finding 提交并命中靶场规则（${finding.type}）`,
      submitted.ok && Boolean(submitted.json?.findingCode) && !submitted.json?.falsePositive,
      submitted.json ? `${submitted.json.findingCode} score=${submitted.json.deterministicScore}` : submitted.json?.error,
    );
  }

  const report = await api("/api/security/report", {
    method: "POST",
    body: { sessionId: auditSessionId, auditor: "e2e-verifier", findings },
  });
  check(
    "生成 Audit Report 且通过阈值",
    report.ok && report.json?.passed === true && report.json?.score >= FINAL_AUDIT_SCENARIO.passThreshold,
    report.json ? `score=${report.json.score} hash=${String(report.json.reportHash).slice(0, 12)}…` : report.json?.error,
  );

  if (report.json?.reportId) {
    const own = await api(`/api/security/report/${report.json.reportId}`);
    check("可以读取自己的报告", own.ok && own.json?.score === report.json.score);

    const markdown = await fetch(`${BASE_URL}/api/security/report/${report.json.reportId}?format=md`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const markdownText = await markdown.text();
    check(
      "Markdown 报告可下载",
      markdown.ok && markdownText.includes("# Web3 Security Audit Report") && markdownText.includes("Regression Result: Passed"),
    );

    const unauthenticated = await api(`/api/security/report/${report.json.reportId}`, { token: null });
    check("未登录不能读取报告（401）", unauthenticated.status === 401);
  }

  // ---- Passport 资格（完全由服务端计算） ----
  const eligibility = await api("/api/security/passport/eligibility", { method: "POST", body: {} });
  if (eligibility.status === 200 && eligibility.json?.eligible) {
    check(
      "Passport 资格由服务端判定为可领取",
      eligibility.json.badgeTypeId === 3 && Array.isArray(eligibility.json.metadata?.attributes),
      `typeId=${eligibility.json.badgeTypeId} score=${eligibility.json.score}`,
    );
  } else {
    console.log(
      `  · Passport 暂不可领取（需要智能合约课程收获 + 钱包绑定）：${JSON.stringify(
        eligibility.json?.missing ?? eligibility.json?.error,
      )}`,
    );
  }

  // ---- SignGuard ----
  const maxUint = "f".repeat(64);
  const spender = "0".repeat(24) + "1234567890abcdef1234567890abcdef12345678";
  const signGuardCases = [
    ["无限授权", { mode: "request", chainId: 10143, to: "0x0000000000000000000000000000000000005eed", data: `0x095ea7b3${spender}${maxUint}`, value: "0" }, "BLOCK"],
    ["未知调用 + value", { mode: "request", chainId: 10143, to: "0x9999999999999999999999999999999999999999", data: "0xdeadbeef", value: "10000000000000000" }, "REVIEW"],
    ["网络不匹配", { mode: "request", chainId: 1, to: "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f", data: "0x3ccfd60b", value: "0" }, "BLOCK"],
    ["普通转账", { mode: "request", chainId: 10143, to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", data: "0x", value: "5000000000000000" }, "ALLOW"],
  ];
  for (const [label, payload, expectation] of signGuardCases) {
    const result = await api("/api/security/tx-analyze", { method: "POST", body: payload, token: null });
    check(`SignGuard · ${label} → ${expectation}`, result.json?.result?.decision === expectation, `实际 ${result.json?.result?.decision}`);
  }

  // ---- FarmBot Policy Engine ----
  const approvedNormal = await api("/api/security/agent/check", {
    method: "POST",
    body: {
      proposal: { intent: "buy_seed", contract: "0x0000000000000000000000000000000000005eed", data: "0xd0e30db0", value: "5000000000000000" },
    },
    token: null,
  });
  check("FarmBot 正常提案进入用户确认", approvedNormal.json?.decision?.decision === "REVIEW", approvedNormal.json?.decision?.decision);

  const blocked = await api("/api/security/agent/check", {
    method: "POST",
    body: {
      proposal: { intent: "approve_unknown", contract: "0x9999999999999999999999999999999999999999", data: `0x095ea7b3${spender}${maxUint}`, value: "0" },
    },
    token: null,
  });
  check("FarmBot 高风险提案被策略阻断", blocked.json?.decision?.decision === "BLOCK", blocked.json?.decision?.reason?.[0] ?? blocked.json?.decision?.decision);

  console.log(results.join("\n"));
  console.log(`\n通过 ${passed} 项，失败 ${failed} 项\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("验收脚本执行失败：", error);
  process.exit(1);
});
