// =============================================================================
// FarmBot Guardian 策略引擎（P1 / AI Track）
// 白名单策略：AI 只把自然语言转成结构化 Proposal，
// 是否允许执行由确定性 Policy Engine 决定，绝不让 LLM 自行放行。
// =============================================================================

import { extractSelector, decodeCalldata } from "./decoder";
import type { DecodedCall } from "./types";
import { MONAD_TESTNET_CHAIN_ID } from "./types";

export type AgentPolicy = {
  chainId: number;
  allowedContracts: string[];
  allowedSelectors: string[];
  maxNativeValuePerTx: string;
  maxNativeValuePerDay: string;
  allowUnlimitedApproval: false;
  allowNftApprovalForAll: false;
  requireHumanConfirmation: boolean;
};

export type AgentProposal = {
  intent: string;
  contract: string;
  function?: string;
  args?: unknown[];
  value?: string;
  data?: string;
  chainId?: number;
};

export type PolicyDecision = {
  allowed: boolean;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  reasons: string[];
  triggeredPolicyIds: string[];
  requiresHumanConfirmation: boolean;
  decoded: DecodedCall | null;
  selector: string | null;
};

export const DEFAULT_FARM_POLICY: AgentPolicy = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  allowedContracts: ["0x0000000000000000000000000000000000005eed"],
  allowedSelectors: ["0x40c10f19", "0xd0e30db0"],
  maxNativeValuePerTx: "20000000000000000", // 0.02 MON
  maxNativeValuePerDay: "20000000000000000",
  allowUnlimitedApproval: false,
  allowNftApprovalForAll: false,
  requireHumanConfirmation: true,
};

export const FARM_BOT_DEMO_PROPOSALS: Array<{
  id: string;
  title: string;
  description: string;
  proposal: AgentProposal;
}> = [
  {
    id: "normal-buy-seed",
    title: "正常：购买一颗种子",
    description: "FarmBot 提议在 SeedShop 花 0.005 MON 买种子。",
    proposal: {
      intent: "buy_seed",
      contract: "0x0000000000000000000000000000000000005eed",
      function: "mint(address,uint256)",
      value: "5000000000000000",
      data: `0x40c10f190000000000000000000000001234567890abcdef1234567890abcdef123456780000000000000000000000000000000000000000000000000000000000000002`,
    },
  },
  {
    id: "malicious-approve",
    title: "异常：无限授权陌生地址",
    description: "FarmBot 提议 approve(UnknownSpender, MaxUint256)。",
    proposal: {
      intent: "approve_unknown",
      contract: "0x9999999999999999999999999999999999999999",
      function: "approve(address,uint256)",
      value: "0",
      data: `0x095ea7b30000000000000000000000009999999999999999999999999999999999999999${"f".repeat(64)}`,
    },
  },
  {
    id: "over-budget",
    title: "异常：单笔超额支出",
    description: "FarmBot 提议花 0.5 MON，超过每日 0.02 MON 上限。",
    proposal: {
      intent: "buy_fertilizer",
      contract: "0x0000000000000000000000000000000000005eed",
      function: "deposit()",
      value: "500000000000000000",
      data: "0xd0e30db0",
    },
  },
];

function toBigInt(value: string | undefined) {
  try {
    return BigInt(value ?? "0");
  } catch {
    return 0n;
  }
}

export function evaluatePolicy(
  policy: AgentPolicy,
  proposal: AgentProposal,
  spentToday = "0",
): PolicyDecision {
  const reasons: string[] = [];
  const triggeredPolicyIds: string[] = [];
  const selector = proposal.data ? extractSelector(proposal.data) : null;
  const decoded = proposal.data ? decodeCalldata(proposal.data, { valueWei: proposal.value ?? "0" }) : null;
  const contract = proposal.contract.toLowerCase();

  if (proposal.chainId !== undefined && proposal.chainId !== policy.chainId) {
    triggeredPolicyIds.push("POL-001");
    reasons.push(`chainId ${proposal.chainId} 与策略网络 ${policy.chainId} 不一致`);
  }

  if (!policy.allowedContracts.map((entry) => entry.toLowerCase()).includes(contract)) {
    triggeredPolicyIds.push("POL-002");
    reasons.push(`目标合约 ${proposal.contract} 不在允许清单内`);
  }

  if (selector && !policy.allowedSelectors.includes(selector)) {
    triggeredPolicyIds.push("POL-003");
    reasons.push(`selector ${selector} 不在允许方法清单内`);
  }

  const value = toBigInt(proposal.value);
  if (value > toBigInt(policy.maxNativeValuePerTx)) {
    triggeredPolicyIds.push("POL-004");
    reasons.push(`单笔金额 ${value} wei 超过上限 ${policy.maxNativeValuePerTx} wei`);
  }
  const total = value + toBigInt(spentToday);
  if (total > toBigInt(policy.maxNativeValuePerDay)) {
    triggeredPolicyIds.push("POL-005");
    reasons.push(`当日累计 ${total} wei 超过每日上限 ${policy.maxNativeValuePerDay} wei`);
  }

  const isUnlimitedApprove =
    decoded?.signature === "approve(address,uint256)" && decoded.args?.amount === "unlimited";
  if (isUnlimitedApprove && !policy.allowUnlimitedApproval) {
    triggeredPolicyIds.push("POL-006");
    reasons.push("策略禁止无限额度 approve");
  }

  const isNftApprovalForAll =
    decoded?.signature === "setApprovalForAll(address,bool)" && decoded.args?.approved === "true";
  if (isNftApprovalForAll && !policy.allowNftApprovalForAll) {
    triggeredPolicyIds.push("POL-007");
    reasons.push("策略禁止 NFT setApprovalForAll");
  }

  const blocked = triggeredPolicyIds.some((id) =>
    ["POL-001", "POL-002", "POL-003", "POL-004", "POL-005", "POL-006", "POL-007"].includes(id),
  );

  const requiresHumanConfirmation = policy.requireHumanConfirmation;
  const decision: PolicyDecision["decision"] = blocked
    ? "BLOCK"
    : requiresHumanConfirmation
      ? "REVIEW"
      : "ALLOW";

  if (!blocked && reasons.length === 0) {
    reasons.push("提案命中全部白名单策略，可在用户确认后执行。");
  }

  return {
    allowed: !blocked,
    decision,
    reasons,
    triggeredPolicyIds,
    requiresHumanConfirmation,
    decoded: decoded ?? null,
    selector,
  };
}
