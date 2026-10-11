import { FARM_BOT_DEMO_PROPOSALS, type AgentProposal } from "../../../../../lib/security/agent-policy";
import { clampText, isResponse, jsonError, readJsonBody } from "../../../../../lib/security/api-helpers";
import { MONAD_TESTNET_CHAIN_ID } from "../../../../../lib/security/types";

type ProposeRequest = { intent?: string; proposalId?: string };

const SEED_SHOP = "0x0000000000000000000000000000000000005eed";

/**
 * POST /api/security/agent/propose
 * 把自然语言意图转成结构化 Proposal（确定性映射，不使用 LLM 做安全判断）。
 * 注意：AI 只负责“把意图结构化”，是否允许执行由 Policy Engine 决定。
 */
export async function POST(request: Request) {
  const body = await readJsonBody<ProposeRequest>(request);
  if (isResponse(body)) return body;

  if (body.proposalId) {
    const sample = FARM_BOT_DEMO_PROPOSALS.find((entry) => entry.id === body.proposalId);
    if (!sample) return jsonError("演示提案不存在", 400);
    return Response.json({
      proposalId: sample.id,
      title: sample.title,
      description: sample.description,
      proposal: sample.proposal,
      source: "demo-sample",
    });
  }

  const intent = clampText(body.intent, 200).toLowerCase();
  if (!intent) return jsonError("请提供自然语言意图或提案编号", 400);

  let proposal: AgentProposal;
  if (/(buy|买|seed|种子)/.test(intent) && !/approve|授权/.test(intent)) {
    proposal = {
      intent: "buy_seed",
      contract: SEED_SHOP,
      function: "mint(address,uint256)",
      value: "5000000000000000",
      data: `0x40c10f190000000000000000000000001234567890abcdef1234567890abcdef123456780000000000000000000000000000000000000000000000000000000000000001`,
      chainId: MONAD_TESTNET_CHAIN_ID,
    };
  } else if (/(approve|授权|allowance)/.test(intent)) {
    proposal = {
      intent: "approve_unknown",
      contract: "0x9999999999999999999999999999999999999999",
      function: "approve(address,uint256)",
      value: "0",
      data: `0x095ea7b30000000000000000000000009999999999999999999999999999999999999999${"f".repeat(64)}`,
      chainId: MONAD_TESTNET_CHAIN_ID,
    };
  } else {
    proposal = {
      intent: "unknown_request",
      contract: "0x9999999999999999999999999999999999999999",
      function: "unknown",
      value: "0",
      data: "0xdeadbeef",
      chainId: MONAD_TESTNET_CHAIN_ID,
    };
  }

  return Response.json({
    proposal,
    source: "rule-based-intent-parser",
    note: "AI 只把自然语言转成结构化 Proposal，安全判断交由确定性 Policy Engine。",
  });
}
