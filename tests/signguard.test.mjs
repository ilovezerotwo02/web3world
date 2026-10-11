// =============================================================================
// SignGuard 测试矩阵（对应文档 0.20 验收清单）
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import {
  SIGNGUARD_SAMPLES,
  UNKNOWN_DISCLAIMER,
  analyzeTransaction,
} from "../lib/security/risk-engine.ts";
import { decodeCalldata, extractSelector, isUnlimitedAmount } from "../lib/security/decoder.ts";
import { MONAD_TESTNET_CHAIN_ID } from "../lib/security/types.ts";

const SPENDER = "0x1234567890abcdef1234567890abcdef12345678";
const OPERATOR = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const TOKEN = "0x0000000000000000000000000000000000005eed";

function approveCalldata(amountHex) {
  return `0x095ea7b3${SPENDER.slice(2).padStart(64, "0")}${amountHex}`;
}

test("[TX-001] approve(maxUint256) 命中 BLOCK", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: TOKEN,
    data: approveCalldata("f".repeat(64)),
    value: "0",
  });
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.severity, "HIGH");
  assert.ok(result.triggeredRules.some((rule) => rule.id === "TX-001"));
  assert.ok(result.permissions.some((permission) => permission.kind === "ERC20_APPROVAL"));
  assert.ok(result.permissions.some((permission) => permission.amount === "unlimited"));
});

test("[TX-001] 正常有限额度 approve 不命中 TX-001", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: TOKEN,
    data: approveCalldata((1000000n).toString(16).padStart(64, "0")),
    value: "0",
  });
  assert.ok(!result.triggeredRules.some((rule) => rule.id === "TX-001"));
  assert.equal(result.decision, "ALLOW");
  assert.ok(!result.permissions.some((permission) => permission.amount === "unlimited"));
});

test("[TX-002] setApprovalForAll(operator, true) 命中 BLOCK", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f",
    data: `0xa22cb465${OPERATOR.slice(2).padStart(64, "0")}${"0".repeat(63)}1`,
    value: "0",
  });
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.triggeredRules.some((rule) => rule.id === "TX-002"));
  assert.ok(result.permissions.some((permission) => permission.kind === "NFT_ALL"));
  assert.equal(result.knownContract !== null, true, "已知徽章合约应被标记");
});

test("[TX-002] setApprovalForAll(operator, false) 不应报高危授权", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f",
    data: `0xa22cb465${OPERATOR.slice(2).padStart(64, "0")}${"0".repeat(64)}`,
    value: "0",
  });
  assert.ok(!result.triggeredRules.some((rule) => rule.id === "TX-002"));
  assert.notEqual(result.decision, "BLOCK");
});

test("[TX-003] unknown selector + value > 0 命中 REVIEW", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: "0x9999999999999999999999999999999999999999",
    data: "0xdeadbeef",
    value: "10000000000000000",
  });
  assert.equal(result.decision, "REVIEW");
  assert.ok(result.triggeredRules.some((rule) => rule.id === "TX-003"));
  assert.equal(result.confidence, "LOW");
  assert.equal(result.decoded?.unknown, true);
});

test("[TX-004] chain mismatch 命中 BLOCK", () => {
  const result = analyzeTransaction({
    chainId: 1,
    to: "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f",
    data: "0x3ccfd60b",
    value: "0",
  });
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.severity, "CRITICAL");
  assert.ok(result.triggeredRules.some((rule) => rule.id === "TX-004"));
});

test("没有命中规则时必须带“不保证绝对安全”说明", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: OPERATOR,
    data: "0x",
    value: "5000000000000000",
  });
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.unknownDisclaimer, true);
  assert.match(UNKNOWN_DISCLAIMER, /not a guarantee that the transaction is safe/);
  assert.match(UNKNOWN_DISCLAIMER, /不代表交易绝对安全/);
});

test("全部固定样例都与期望结论一致", () => {
  for (const sample of SIGNGUARD_SAMPLES) {
    const result = analyzeTransaction(sample.input);
    assert.equal(
      result.decision,
      sample.expectation,
      `${sample.id} 期望 ${sample.expectation}，实际 ${result.decision}`,
    );
  }
});

test("解码器：unlimited 判定与 selector 提取", () => {
  const selector = extractSelector(approveCalldata("f".repeat(64)));
  assert.equal(selector, "0x095ea7b3");
  const decoded = decodeCalldata(approveCalldata("f".repeat(64)), { valueWei: "0" });
  assert.equal(decoded.functionName, "approve");
  assert.equal(decoded.args.spender, SPENDER);
  assert.equal(decoded.args.amount, "unlimited");
  assert.equal(isUnlimitedAmount(1n << 255n), true, ">= 2^255 视为无限授权");
  assert.equal(isUnlimitedAmount((1n << 255n) - 1n), false, "低于 2^255 不属于无限授权");
  assert.equal(isUnlimitedAmount(1000000n), false);
});

test("解码器：非法 calldata 不会崩溃，也不会臆测语义", () => {
  assert.equal(extractSelector("not-hex"), null);
  assert.equal(extractSelector("0x"), null);
  const decoded = decodeCalldata("0x12345678", { valueWei: "0" });
  assert.equal(decoded.unknown, true);
});

test("结构化输出字段完整（decision + severity + confidence + permissions + triggeredRules）", () => {
  const result = analyzeTransaction({
    chainId: MONAD_TESTNET_CHAIN_ID,
    to: TOKEN,
    data: approveCalldata("f".repeat(64)),
    value: "0",
  });
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      "confidence",
      "decision",
      "decoded",
      "knownContract",
      "permissions",
      "recommendedAction",
      "severity",
      "summary",
      "triggeredRules",
      "unknownDisclaimer",
    ].sort(),
  );
  assert.ok(result.summary.length > 0);
  assert.ok(result.recommendedAction.length > 0);
});
