import {
  DEFAULT_FARM_POLICY,
  evaluatePolicy,
  type AgentPolicy,
  type AgentProposal,
} from "../../../../../lib/security/agent-policy";
import { clampText, isResponse, jsonError, readJsonBody } from "../../../../../lib/security/api-helpers";

type CheckRequest = {
  proposal?: AgentProposal;
  policy?: Partial<AgentPolicy>;
  spentToday?: string;
};

// POST /api/security/agent/check — 确定性 Policy Engine（Allow / Block）
export async function POST(request: Request) {
  const body = await readJsonBody<CheckRequest>(request);
  if (isResponse(body)) return body;

  if (!body.proposal || typeof body.proposal !== "object") {
    return jsonError("proposal 不能为空", 400);
  }
  const contract = clampText(body.proposal.contract, 64);
  if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
    return jsonError("proposal.contract 必须是合法地址", 400);
  }
  if (body.spentToday !== undefined && !/^[0-9]{1,78}$/.test(String(body.spentToday))) {
    return jsonError("spentToday 必须是以 wei 为单位的十进制字符串", 400);
  }

  const policy: AgentPolicy = {
    ...DEFAULT_FARM_POLICY,
    ...body.policy,
    allowUnlimitedApproval: false,
    allowNftApprovalForAll: false,
  };

  const decision = evaluatePolicy(policy, { ...body.proposal, contract }, String(body.spentToday ?? "0"));

  return Response.json({
    decision,
    policy,
    boundary:
      "Policy Engine 是确定性白名单判断，不依赖 LLM；LLM 只负责把用户意图转成结构化 Proposal。",
  });
}
