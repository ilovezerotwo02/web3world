// =============================================================================
// SignGuard 风险引擎：确定性规则判定，纯函数
// =============================================================================

import { decodeCalldata, extractSelector, formatUnits, isUnlimitedAmount, wordToBigInt } from "./decoder";
import { isKnownCourseContract, lookupSelector } from "./selectors";
import { runTxRules } from "./rules";
import type {
  SignGuardConfidence,
  SignGuardDecision,
  SignGuardPermission,
  SignGuardResult,
  SignGuardSeverity,
  SignGuardTriggeredRule,
  TxContext,
} from "./types";
import {
  MONAD_TESTNET_CHAIN_ID,
  SEVERITY_RANK,
  UNLIMITED_APPROVAL_THRESHOLD,
} from "./types";

export const UNKNOWN_DISCLAIMER =
  "No known high-risk rule was triggered. This is not a guarantee that the transaction is safe.（未命中已知高风险规则，但这不代表交易绝对安全。）";

export type AnalyzeTransactionInput = {
  chainId: number;
  to: string | null;
  data?: string;
  value?: string;
  from?: string | null;
  txHash?: string | null;
  expectedChainId?: number;
  knownContracts?: Record<string, string>;
};

export function buildTxContext(input: AnalyzeTransactionInput): TxContext {
  const data = (input.data ?? "0x").trim() || "0x";
  const value = (() => {
    const raw = (input.value ?? "0").trim();
    if (!raw) return "0";
    try {
      return BigInt(raw).toString();
    } catch {
      return "0";
    }
  })();
  const selector = extractSelector(data);
  const decoded = decodeCalldata(data, { valueWei: value });

  return {
    chainId: input.chainId,
    expectedChainId: input.expectedChainId ?? MONAD_TESTNET_CHAIN_ID,
    to: input.to ? input.to.toLowerCase() : null,
    data,
    value,
    selector,
    decoded,
    from: input.from ?? null,
    txHash: input.txHash ?? null,
    knownContracts: input.knownContracts ?? {},
  };
}

function deriveDecision(
  worst: SignGuardSeverity,
  hasExplicitBlock: boolean,
): SignGuardDecision {
  if (hasExplicitBlock) return "BLOCK";
  switch (worst) {
    case "CRITICAL":
      return "BLOCK";
    case "HIGH":
    case "MEDIUM":
      return "REVIEW";
    case "LOW":
    case "INFO":
    default:
      return "ALLOW";
  }
}

function collectPermissions(ctx: TxContext): SignGuardPermission[] {
  const permissions: SignGuardPermission[] = [];
  const decoded = ctx.decoded;

  if (decoded?.signature === "approve(address,uint256)" || decoded?.signature?.startsWith("permit(")) {
    permissions.push({
      kind: "ERC20_APPROVAL",
      target: decoded.args?.spender,
      amount: decoded.args?.amount ?? "0",
    });
  }
  if (
    decoded?.signature === "setApprovalForAll(address,bool)" &&
    decoded.args?.approved === "true"
  ) {
    permissions.push({
      kind: "NFT_ALL",
      target: decoded.args?.operator,
    });
  }
  try {
    if (BigInt(ctx.value) > 0n) {
      permissions.push({
        kind: "NATIVE_TRANSFER",
        target: ctx.to ?? undefined,
        amount: ctx.value,
      });
    }
  } catch {
    // ignore malformed value
  }
  if (!decoded || decoded.unknown) {
    permissions.push({
      kind: "UNKNOWN",
      target: ctx.to ?? undefined,
    });
  }
  return permissions;
}

function confidenceFor(ctx: TxContext, triggered: SignGuardTriggeredRule[]): SignGuardConfidence {
  if (triggered.some((rule) => rule.id === "TX-004")) return "HIGH";
  if (ctx.decoded && !ctx.decoded.unknown) return "HIGH";
  if (ctx.selector === null) return "MEDIUM";
  return "LOW";
}

export function summarize(ctx: TxContext): string {
  const decoded = ctx.decoded;
  if (!decoded || decoded.unknown) {
    if (ctx.selector === null) {
      return ctx.to
        ? "这是一笔不包含 calldata 的普通转账请求。"
        : "这是一笔合约部署请求。";
    }
    return `无法识别的方法调用（selector ${ctx.selector}）。`;
  }
  switch (decoded.signature) {
    case "approve(address,uint256)": {
      const unlimited = decoded.args?.amount === "unlimited";
      return unlimited
        ? `你正在把 ${decoded.args?.spender} 设为 ERC20 支配方，授权额度接近无限。`
        : `你正在允许 ${decoded.args?.spender} 支配 ${decoded.args?.amount} 个代币单位。`;
    }
    case "setApprovalForAll(address,bool)":
      return decoded.args?.approved === "true"
        ? `你把 ${decoded.args?.operator} 设为该 NFT 系列的全量操作者。`
        : `你正在撤销 ${decoded.args?.operator} 的 NFT 系列操作权限。`;
    case "transfer(address,uint256)":
      return `你正在向 ${decoded.args?.to} 转账 ${decoded.args?.amount} 个代币单位。`;
    case "transferFrom(address,address,uint256)":
      return `你正在从 ${decoded.args?.from} 向 ${decoded.args?.to} 划转 ${decoded.args?.amount} 个代币单位。`;
    case "safeTransferFrom(address,address,uint256)":
    case "safeTransferFrom(address,address,uint256,bytes)":
      return `你正在把 NFT #${decoded.args?.tokenId} 从 ${decoded.args?.from} 转到 ${decoded.args?.to}。`;
    case "mint(address,uint256)":
    case "mint(address)":
      return `你正在为 ${decoded.args?.to} 铸造代币 / NFT。`;
    case "deposit()":
      return `你正在向合约存入 ${decoded.valueMon ?? "0"} MON。`;
    case "withdraw()":
    case "withdraw(uint256)":
      return "你正在从合约提取资产。";
    default:
      return `你正在调用 ${decoded.signature}。`;
  }
}

function recommendedActionFor(decision: SignGuardDecision, triggered: SignGuardTriggeredRule[]) {
  if (decision === "BLOCK") {
    const top = [...triggered].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
    return top
      ? `不要签名。先处理 ${top.id}（${top.title}）：${top.evidence}`
      : "不要签名。先向项目方确认这笔交易的语义。";
  }
  if (decision === "REVIEW") {
    return "签名前逐项确认 method / value / permission；如果无法解释这笔调用，就不要签名。";
  }
  return "如果你确认目标地址与方法都是你主动发起的，可以继续；请保留交易回执以便复盘。";
}

export function analyzeTransaction(input: AnalyzeTransactionInput): SignGuardResult {
  const ctx = buildTxContext(input);
  const matchedRules = runTxRules(ctx);
  const triggeredRules: SignGuardTriggeredRule[] = matchedRules.map((rule) => ({
    id: rule.id,
    severity: rule.severity,
    title: rule.title,
    evidence: rule.evidence(ctx),
  }));

  const worst = triggeredRules.reduce<SignGuardSeverity>(
    (accumulator, rule) =>
      SEVERITY_RANK[rule.severity] > SEVERITY_RANK[accumulator] ? rule.severity : accumulator,
    "INFO",
  );
  const hasExplicitBlock = matchedRules.some((rule) => rule.decision === "BLOCK");
  const decision = deriveDecision(worst, hasExplicitBlock);

  return {
    decision,
    severity: worst,
    confidence: confidenceFor(ctx, triggeredRules),
    summary: summarize(ctx),
    decoded: ctx.decoded ?? undefined,
    permissions: collectPermissions(ctx),
    triggeredRules,
    recommendedAction: recommendedActionFor(decision, triggeredRules),
    knownContract: isKnownCourseContract(ctx.to, ctx.knownContracts),
    unknownDisclaimer: triggeredRules.filter((rule) => rule.id !== "TX-005").length === 0,
  };
}

/** 展示用：把 wei 金额格式化为 MON 字符串 */
export function formatValueMon(valueWei: string): string {
  try {
    return `${formatUnits(BigInt(valueWei || "0"))} MON`;
  } catch {
    return "0 MON";
  }
}

export { UNLIMITED_APPROVAL_THRESHOLD, wordToBigInt, isUnlimitedAmount, lookupSelector };

/** 结构化的预设样例：用于演示与测试 */
export type SignGuardSample = {
  id: string;
  title: string;
  description: string;
  expectation: "ALLOW" | "REVIEW" | "BLOCK";
  input: AnalyzeTransactionInput;
};

const SPENDER = "0x1234567890abcdef1234567890abcdef12345678";
const OPERATOR = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

export const SIGNGUARD_SAMPLES: SignGuardSample[] = [
  {
    id: "unlimited-approval",
    title: "无限授权（危险样例）",
    description: "approve(未知地址, MaxUint256)：一次性交出接近无限额度。",
    expectation: "BLOCK",
    input: {
      chainId: MONAD_TESTNET_CHAIN_ID,
      to: "0x0000000000000000000000000000000000005eed",
      data: `0x095ea7b3${SPENDER.slice(2).padStart(64, "0")}${"f".repeat(64)}`,
      value: "0",
    },
  },
  {
    id: "bounded-approval",
    title: "有限授权（正常样例）",
    description: "approve(地址, 1000000)：只授权本次需要的额度。",
    expectation: "ALLOW",
    input: {
      chainId: MONAD_TESTNET_CHAIN_ID,
      to: "0x0000000000000000000000000000000000005eed",
      data: `0x095ea7b3${SPENDER.slice(2).padStart(64, "0")}${(1000000n).toString(16).padStart(64, "0")}`,
      value: "0",
    },
  },
  {
    id: "nft-approval-for-all",
    title: "NFT 全局授权",
    description: "setApprovalForAll(operator, true)：授权整个 NFT 系列。",
    expectation: "BLOCK",
    input: {
      chainId: MONAD_TESTNET_CHAIN_ID,
      to: "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f",
      data: `0xa22cb465${OPERATOR.slice(2).padStart(64, "0")}${"0".repeat(63)}1`,
      value: "0",
    },
  },
  {
    id: "nft-revoke",
    title: "撤销 NFT 全局授权",
    description: "setApprovalForAll(operator, false)：不应报高危授权。",
    expectation: "ALLOW",
    input: {
      chainId: MONAD_TESTNET_CHAIN_ID,
      to: "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f",
      data: `0xa22cb465${OPERATOR.slice(2).padStart(64, "0")}${"0".repeat(64)}`,
      value: "0",
    },
  },
  {
    id: "unknown-with-value",
    title: "未知调用 + 附带原生资产",
    description: "无法识别的 selector，同时携带 0.01 MON。",
    expectation: "REVIEW",
    input: {
      chainId: MONAD_TESTNET_CHAIN_ID,
      to: "0x9999999999999999999999999999999999999999",
      data: "0xdeadbeef",
      value: "10000000000000000",
    },
  },
  {
    id: "chain-mismatch",
    title: "网络不匹配",
    description: "钱包仍在以太坊主网，却要签名 Monad 交易。",
    expectation: "BLOCK",
    input: {
      chainId: 1,
      to: "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f",
      data: "0x3ccfd60b",
      value: "0",
    },
  },
  {
    id: "plain-transfer",
    title: "普通转账",
    description: "只发送 0.005 MON，没有 calldata。",
    expectation: "ALLOW",
    input: {
      chainId: MONAD_TESTNET_CHAIN_ID,
      to: OPERATOR,
      data: "0x",
      value: "5000000000000000",
    },
  },
];
