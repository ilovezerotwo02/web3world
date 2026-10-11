// =============================================================================
// 安全温室 UI 渲染测试：用 react-dom/server 真实渲染组件并断言关键标记
// 覆盖 Demo Moment A（攻击回放）/ B（SignGuard BLOCK）/ C（Passport）的画面文案
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AttackTrace } from "../app/game/security/AttackTrace.tsx";
import { CodeDiff } from "../app/game/security/CodeDiff.tsx";
import { FindingForm } from "../app/game/security/FindingForm.tsx";
import { SecurityGreenhousePanel } from "../app/game/security/SecurityGreenhousePanel.tsx";
import { SignGuardPanel } from "../app/game/security/SignGuardPanel.tsx";
import { SecurityPassportPanel } from "../app/game/security/SecurityPassportPanel.tsx";
import { FarmBotGuardianPanel } from "../app/game/security/FarmBotGuardianPanel.tsx";
import { SecurityLabRunner } from "../app/game/security/SecurityLabRunner.tsx";
import { WebSecurityTrainingPanel } from "../app/game/security/WebSecurityTrainingPanel.tsx";
import { Web3SecurityModule } from "../app/game/security/Web3SecurityModule.tsx";
import {
  initialSecurityProgress,
  securityProgressReducer,
} from "../app/game/security/security-progress.ts";
import { SECURITY_SCENARIOS, getScenario } from "../lib/security/scenarios.ts";

const noop = () => {};

function fullProgress() {
  let state = securityProgressReducer(initialSecurityProgress, { type: "unlock" });
  for (const scenario of SECURITY_SCENARIOS) {
    state = securityProgressReducer(state, {
      type: "complete-scenario",
      scenarioId: scenario.id,
      score: 100,
      passed: true,
    });
  }
  return securityProgressReducer(state, {
    type: "complete-audit",
    score: 88,
    passed: true,
    reportId: "r1",
    reportHash: "a".repeat(64),
    falsePositivePenalty: 0,
  });
}

test("安全温室：未解锁时提示锁定，解锁后显示 Lab 卡片", () => {
  const locked = renderToStaticMarkup(
    createElement(SecurityGreenhousePanel, {
      progress: initialSecurityProgress,
      dispatch: noop,
      contractHarvested: false,
      walletAddress: null,
      auditor: "tester",
      onMessage: noop,
    }),
  );
  assert.match(locked, /锁定|安全路线/);
  assert.match(locked, /Lab 1 · 重入/);
  assert.match(locked, /SignGuard 安检门/);

  const unlocked = renderToStaticMarkup(
    createElement(SecurityGreenhousePanel, {
      progress: securityProgressReducer(initialSecurityProgress, { type: "unlock" }),
      dispatch: noop,
      contractHarvested: true,
      walletAddress: null,
      auditor: "tester",
      onMessage: noop,
    }),
  );
  assert.match(unlocked, /web3world|MONAD|Monad Guardian Farm|Web3 安全温室/);
  assert.match(unlocked, /LEARN/);
  assert.match(unlocked, /BREAK/);
  assert.match(unlocked, /FIX/);
  assert.match(unlocked, /GUARD/);
  assert.match(unlocked, /PROVE/);
  assert.match(unlocked, /Web 安全训练场/);
  assert.match(unlocked, /进入关卡|回顾这一关/);
});

test("安全温室：全部通过后显示完全点亮与 Passport 可领取", () => {
  const markup = renderToStaticMarkup(
    createElement(SecurityGreenhousePanel, {
      progress: fullProgress(),
      dispatch: noop,
      contractHarvested: true,
      walletAddress: null,
      auditor: "tester",
      onMessage: noop,
    }),
  );
  assert.match(markup, /完全点亮/);
  assert.match(markup, /Passport 可领取/);
  assert.match(markup, /Lab 4\/4/);
});

test("Demo Moment A：Attack Trace 渲染出调用深度、两侧余额与 STATE UPDATED", () => {
  const scenario = getScenario("reentrancy-bank-v1");
  const markup = renderToStaticMarkup(
    createElement(AttackTrace, {
      steps: scenario.trace,
      intro: scenario.traceIntro,
      maxBankBalance: 7,
      maxAttackerBalance: 7,
    }),
  );
  assert.match(markup, /ATTACK TRACE/);
  assert.match(markup, /CALL DEPTH/);
  assert.match(markup, /CALLER/);
  assert.match(markup, /CALLEE/);
  assert.match(markup, /BANK BALANCE/);
  assert.match(markup, /ATTACKER BALANCE/);
  assert.match(markup, /STATE UPDATED \?/);
  assert.match(markup, /播放回放/);
  assert.match(markup, /重置/);
});

test("Lab 1 首屏渲染出漏洞代码与可点击行", () => {
  const scenario = getScenario("reentrancy-bank-v1");
  const markup = renderToStaticMarkup(
    createElement(SecurityLabRunner, { scenario, onComplete: noop }),
  );
  assert.match(markup, /GreenhouseVault/);
  assert.match(markup, /找出为什么攻击者可以反复提款/);
  assert.match(markup, /找出危险代码行/);
  assert.match(markup, /msg\.sender\.call\{value: amount\}/);
  assert.match(markup, /提交定位并进入下一步/);
});

test("修复 Diff 组件同时渲染 Before / After", () => {
  const markup = renderToStaticMarkup(
    createElement(CodeDiff, {
      before: ["(bool ok, ) = msg.sender.call{value: amount}(\"\");"],
      after: ["balances[msg.sender] = 0;"],
    }),
  );
  assert.match(markup, /Before/);
  assert.match(markup, /After/);
  assert.match(markup, /is-removed/);
  assert.match(markup, /is-added/);
});

test("Demo Moment B：SignGuard 默认展示固定样例与风险解释框架", () => {
  const markup = renderToStaticMarkup(createElement(SignGuardPanel));
  assert.match(markup, /固定样例/);
  assert.match(markup, /无限授权（危险样例）/);
  assert.match(markup, /NFT 全局授权/);
  assert.match(markup, /网络不匹配/);
  assert.match(markup, /Monad Testnet 交易哈希/);
  assert.match(markup, /先给结论，再给分数/);
  assert.match(markup, /不等同于完整智能合约审计或安全保证/);
});

test("SignGuard 可导入最近真实池塘回执，且无真实回执时禁用入口", () => {
  const txHash = `0x${"ab".repeat(32)}`;
  const available = renderToStaticMarkup(
    createElement(SignGuardPanel, { recentFishingTxHash: txHash }),
  );
  assert.match(available, /回执池塘 · 最近一次真实交易/);
  assert.match(available, /导入最近交易/);
  assert.match(available, /0xabababab…abababab/);

  const empty = renderToStaticMarkup(
    createElement(SignGuardPanel, { recentFishingTxHash: null }),
  );
  assert.match(empty, /演示记录不会作为链上交易分析/);
  assert.match(empty, /disabled=""[^>]*>等待真实回执/);
});

test("Final Audit：Finding 编辑器要求结构化字段，并提供证据行选择", () => {
  const markup = renderToStaticMarkup(createElement(FindingForm, { onSubmit: noop }));
  assert.match(markup, /Title（一句话说明问题）/);
  assert.match(markup, /Root Cause（为什么会发生）/);
  assert.match(markup, /Impact（会造成什么后果）/);
  assert.match(markup, /Remediation（修复方向）/);
  assert.match(markup, /Evidence Lines/);
  assert.match(markup, /提交 Finding/);
  assert.match(markup, /让安全助教评阅/);
  assert.match(markup, /GreenhouseVaultAudit/);
});

test("Demo Moment C：Passport 面板显示条件清单与服务端校验说明", () => {
  const markup = renderToStaticMarkup(
    createElement(SecurityPassportPanel, {
      contractHarvested: true,
      labsPassed: [true, true, true],
      finalAuditPassed: true,
      finalScore: 88,
      reportHash: "b".repeat(64),
      auditor: "tester",
      onMessage: noop,
    }),
  );
  assert.match(markup, /SECURITY PASSPORT · Type ID 3/);
  assert.match(markup, /Web3 Security Guardian/);
  assert.match(markup, /智能合约课程已收获/);
  assert.match(markup, /Final Audit 通过/);
  assert.match(markup, /签名只用于证明接收地址/);
  assert.match(markup, /不可转让/);
});

test("FarmBot：策略白名单与阻断说明可见", () => {
  const markup = renderToStaticMarkup(createElement(FarmBotGuardianPanel));
  assert.match(markup, /FARMBOT GUARDIAN/);
  assert.match(markup, /每日最多支出/);
  assert.match(markup, /无限 approve：NEVER/);
  assert.match(markup, /NFT setApprovalForAll：NEVER/);
  assert.match(markup, /Agent Proposal → SignGuard → Policy Engine → Allow \/ Block → 用户确认/);
  assert.match(markup, /REVIEW · 等待用户确认|ALLOW · 可以执行|BLOCK · 拒绝执行/);
});

test("Web 安全训练场：展示五类 Web 漏洞的识别、修复与验证内容", () => {
  const markup = renderToStaticMarkup(createElement(WebSecurityTrainingPanel));
  assert.match(markup, /WEB SECURITY TRAINING/);
  assert.match(markup, /Web 安全训练场/);
  assert.match(markup, /反射型 XSS/);
  assert.match(markup, /CSRF 跨站请求伪造/);
  assert.match(markup, /SQL 注入/);
  assert.match(markup, /IDOR 越权读取/);
  assert.match(markup, /SSRF 服务端请求伪造/);
  assert.match(markup, /找到危险信号/);
  assert.match(markup, /修复边界/);
  assert.match(markup, /回归验证/);
  assert.match(markup, /不会向真实目标发送请求/);
});

test("地图地点都能看到对应的 Web3 安全模块", () => {
  const contexts = [
    ["land", "课程土地", "安全田埂"],
    ["pond", "回执池塘", "回执和网络核验"],
    ["seeds", "种子小铺", "来源和授权边界"],
  ];
  for (const [context, label, expected] of contexts) {
    const markup = renderToStaticMarkup(
      createElement(Web3SecurityModule, {
        context,
        securityStage: "locked",
        onOpenSecurity: noop,
      }),
    );
    assert.match(markup, new RegExp(label));
    assert.match(markup, new RegExp(expected));
    assert.match(markup, /训练场锁定/);
    assert.match(markup, /进入 Web3 安全训练场|打开安全训练场与 SignGuard|查看五类 Web 安全训练/);
  }
});
