// =============================================================================
// 安全规则引擎测试（Rule Engine）
// 覆盖：重入、修复版、访问控制、tx.origin、签名重放、call 返回值、随机数
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import {
  SOL_RULES,
  TX_RULES,
  analyzeSource,
  runTxRules,
} from "../lib/security/rules.ts";
import {
  buildTxContext,
  analyzeTransaction,
  SIGNGUARD_SAMPLES,
} from "../lib/security/risk-engine.ts";
import {
  PATCHED_BANK_SOURCE,
  VULNERABLE_BANK_SOURCE,
  FINAL_AUDIT_SOURCE,
  SECURITY_SCENARIOS,
  getScenario,
  scenariosForLab,
} from "../lib/security/scenarios.ts";
import { MONAD_TESTNET_CHAIN_ID } from "../lib/security/types.ts";

const findingFor = (source, ruleId) => analyzeSource(source).find((item) => item.ruleId === ruleId) ?? null;

test("漏洞版 GreenhouseVault 命中 SOL-REENT-001（外部调用先于状态更新）", () => {
  const finding = findingFor(VULNERABLE_BANK_SOURCE, "SOL-REENT-001");
  assert.ok(finding, "漏洞版必须命中重入规则");
  assert.equal(finding.severity, "HIGH");
  assert.ok(finding.lines.length >= 2);
  assert.ok(finding.lines[0] < finding.lines[1], "外部调用行必须早于状态更新行");
});

test("修复版 PatchedBank 不再命中 SOL-REENT-001", () => {
  const finding = findingFor(PATCHED_BANK_SOURCE, "SOL-REENT-001");
  assert.equal(finding, null, "CEI 修复后不应再命中重入规则");
});

test("mint 缺少访问控制命中 SOL-AUTH-001（Critical）", () => {
  const source = `
  contract SeedToken {
      mapping(address => uint256) public balanceOf;
      function mint(address to, uint256 amount) external {
          balanceOf[to] += amount;
      }
  }`;
  const finding = findingFor(source, "SOL-AUTH-001");
  assert.ok(finding);
  assert.equal(finding.severity, "CRITICAL");
});

test("加上 onlyOwner 后不再命中 SOL-AUTH-001", () => {
  const source = `
  contract SeedToken {
      mapping(address => uint256) public balanceOf;
      function mint(address to, uint256 amount) external onlyOwner {
          balanceOf[to] += amount;
      }
  }`;
  assert.equal(findingFor(source, "SOL-AUTH-001"), null);
});

test("tx.origin 鉴权命中 SOL-TXORIGIN-001，msg.sender 安全版不命中", () => {
  const unsafe = `
  contract Vault {
      address owner;
      function withdrawAll() external {
          require(tx.origin == owner, "not owner");
          payable(owner).transfer(address(this).balance);
      }
  }`;
  const safe = unsafe.replace("tx.origin == owner", "msg.sender == owner");
  assert.ok(findingFor(unsafe, "SOL-TXORIGIN-001"));
  assert.equal(findingFor(safe, "SOL-TXORIGIN-001"), null);
});

test("签名缺少 nonce / deadline / domain 命中 SOL-SIGN-001", () => {
  const finding = findingFor(FINAL_AUDIT_SOURCE, "SOL-SIGN-001");
  assert.ok(finding);
  assert.match(finding.evidence, /nonce|deadline|domain/);
});

test("未检查低级 call 返回值命中 SOL-CALL-001", () => {
  const source = `
  contract Router {
      function forward(address target, bytes calldata payload) external payable {
          target.call{value: msg.value}(payload);
      }
  }`;
  const finding = findingFor(source, "SOL-CALL-001");
  assert.ok(finding);
  assert.equal(finding.severity, "MEDIUM");
});

test("可预测随机源命中 SOL-RANDOM-001", () => {
  const source = `
  contract Lottery {
      function draw() external view returns (uint256) {
          uint256 random = uint256(blockhash(block.number - 1)) % 100;
          return random;
      }
  }`;
  assert.ok(findingFor(source, "SOL-RANDOM-001"));
});

test("每条规则都有唯一的 id，并可以被独立调用", () => {
  const ids = [...TX_RULES, ...SOL_RULES].map((rule) => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  TX_RULES.forEach((rule) => {
    assert.equal(typeof rule.match, "function");
    assert.equal(typeof rule.evidence, "function");
  });
  SOL_RULES.forEach((rule) => {
    assert.equal(typeof rule.detect, "function");
  });
});

test("Final Audit 靶场可以被确定性规则检查出 5 类问题", () => {
  const findings = analyzeSource(FINAL_AUDIT_SOURCE).map((item) => item.ruleId);
  for (const ruleId of ["SOL-REENT-001", "SOL-AUTH-001", "SOL-SIGN-001", "SOL-TXORIGIN-001", "SOL-CALL-001"]) {
    assert.ok(findings.includes(ruleId), `Final Audit 靶场应该命中 ${ruleId}`);
  }
});

test("教学场景数据自洽：危险行落在代码范围内，且修复方案至少有一个正确", () => {
  const scenario = getScenario("reentrancy-bank-v1");
  assert.ok(scenario);
  scenario.dangerLines.forEach((line) => {
    assert.ok(line >= 1 && line <= scenario.code.length, `危险行 ${line} 必须在源码范围内`);
  });
  assert.ok(scenario.patchOptions.some((option) => option.correct));
  assert.ok(scenario.trace.length > 0, "重入关卡必须带攻击回放轨迹");
  const trace = scenario.trace;
  assert.equal(trace[0].bankBalance, 7);
  assert.equal(trace[trace.length - 1].bankBalance, 0);
  assert.equal(trace[trace.length - 1].stateUpdated, true);
  assert.ok(trace.some((step) => step.stateUpdated === false && step.bankBalance < 7));
});

test("Lab 顺序与解锁关系正确：Lab 1 单场景，Lab 2 两个场景，Lab 3 一个场景", () => {
  assert.equal(scenariosForLab("lab-1").length, 1);
  assert.equal(scenariosForLab("lab-2").length, 2);
  assert.equal(scenariosForLab("lab-3").length, 1);
  const orders = SECURITY_SCENARIOS.map((scenario) => scenario.order);
  assert.deepEqual(orders, [1, 2, 3, 4]);
});

test("runTxRules + buildTxContext 可以在不联网的情况下产出规则命中", () => {
  const sample = SIGNGUARD_SAMPLES.find((entry) => entry.id === "unlimited-approval");
  assert.ok(sample, "必须存在 unlimited-approval 样例");
  const ctx = buildTxContext(sample.input);
  const ids = runTxRules(ctx).map((rule) => rule.id);
  assert.ok(ids.includes("TX-005"), "已知教学合约应命中 TX-005 上下文规则");
  assert.ok(ids.includes("TX-001"), "MaxUint256 approve 应命中 TX-001");
});

test("analyzeTransaction 对未知 selector + 原生资产给出 REVIEW，而不是“恶意”", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: "0x9999999999999999999999999999999999999999",
    data: "0xdeadbeef",
    value: "1",
  });
  assert.equal(result.decision, "REVIEW");
  assert.ok(result.triggeredRules.some((rule) => rule.id === "TX-003"));
});
