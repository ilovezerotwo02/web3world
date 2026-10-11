import { getDb } from "../../../../db";
import { getSessionByToken, extractToken } from "../../../../lib/auth";
import { saveTxRiskCheck } from "../../../../lib/repositories";
import { MONAD_TESTNET } from "../../../../lib/monad-chain";
import { analyzeTransaction, UNKNOWN_DISCLAIMER } from "../../../../lib/security/risk-engine";
import { sha256Hex } from "../../../../lib/security/report";
import {
  clientKey,
  isCalldata,
  isHexAddress,
  isResponse,
  isTxHash,
  jsonError,
  rateLimit,
  readJsonBody,
} from "../../../../lib/security/api-helpers";
import { MONAD_TESTNET_CHAIN_ID, type SignGuardResult } from "../../../../lib/security/types";

type AnalyzeRequest = {
  mode?: "request" | "txHash";
  chainId?: number;
  to?: string;
  data?: string;
  value?: string;
  txHash?: string;
};

type RpcTransaction = {
  to?: string | null;
  input?: string;
  value?: string;
  from?: string;
  blockNumber?: string | null;
};

const RPC_URL = () =>
  (typeof process !== "undefined" && process.env?.MONAD_RPC_URL) ||
  MONAD_TESTNET.rpcUrls.default.http[0];

async function fetchTransaction(txHash: string): Promise<RpcTransaction | null> {
  const response = await fetch(RPC_URL(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [txHash],
    }),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const payload = (await response.json()) as {
    result?: RpcTransaction | null;
    error?: { message?: string };
  };
  if (payload.error) throw new Error(payload.error.message ?? "RPC 返回错误");
  return payload.result ?? null;
}

async function optionalUserId(request: Request): Promise<string | null | Response> {
  const token = extractToken(request);
  if (!token) return null;
  const db = getDb();
  const session = await getSessionByToken(db, token);
  if (!session) return jsonError("登录已过期，请重新登录", 401);
  return session.userId;
}

// POST /api/security/tx-analyze — SignGuard 交易风险解释（确定性规则）
export async function POST(request: Request) {
  if (!rateLimit(`tx-analyze:${clientKey(request)}`, 60, 60_000)) {
    return jsonError("请求过于频繁，请稍后再试", 429);
  }

  const userId = await optionalUserId(request);
  if (userId instanceof Response) return userId;

  const body = await readJsonBody<AnalyzeRequest>(request);
  if (isResponse(body)) return body;

  const mode = body.mode ?? "request";
  const chainId = Number(body.chainId ?? MONAD_TESTNET_CHAIN_ID);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return jsonError("chainId 无效", 400);
  }

  let to: string | null = null;
  let data = "0x";
  let value = "0";
  let txHash: string | null = null;
  let degraded: string | null = null;

  if (mode === "txHash") {
    if (!isTxHash(body.txHash)) {
      return jsonError("txHash 必须是 32 字节 0x 哈希", 400);
    }
    txHash = body.txHash;
    try {
      const tx = await fetchTransaction(body.txHash);
      if (!tx) {
        return Response.json(
          {
            error: "在 Monad Testnet 上没有找到这笔交易（可能尚未上链或哈希有误）",
            mode,
            txHash: body.txHash,
          },
          { status: 404 },
        );
      }
      to = tx.to ?? null;
      data = tx.input && isCalldata(tx.input) ? tx.input : "0x";
      value = tx.value && /^0x[0-9a-fA-F]+$/.test(tx.value) ? BigInt(tx.value).toString() : "0";
    } catch (error) {
      degraded = error instanceof Error ? error.message : "RPC 不可用";
      return Response.json(
        {
          error: "链上读取暂时不可用，已降级为规则说明模式",
          degraded: true,
          detail: degraded,
          hint: "可以改用「待签名交易 / raw calldata」模式，或稍后重试。",
        },
        { status: 503 },
      );
    }
  } else {
    if (!isHexAddress(body.to)) {
      return jsonError("to 必须是合法的 20 字节地址", 400);
    }
    to = body.to;
    if (body.data !== undefined && !isCalldata(body.data)) {
      return jsonError("data 必须是 0x 前缀的十六进制 calldata", 400);
    }
    data = body.data && isCalldata(body.data) ? body.data : "0x";
    if (body.value !== undefined) {
      if (typeof body.value !== "string" || !/^[0-9]{1,78}$/.test(body.value)) {
        return jsonError("value 必须是以 wei 为单位的十进制字符串", 400);
      }
      value = body.value;
    }
  }

  const result: SignGuardResult = analyzeTransaction({
    chainId,
    to,
    data,
    value,
    txHash,
  });

  if (userId) {
    try {
      await saveTxRiskCheck(getDb(), {
        userId,
        chainId,
        txHash,
        toAddress: to,
        selector: result.decoded?.selector ?? null,
        valueWei: value,
        riskDecision: result.decision,
        riskSeverity: result.severity,
        triggeredRules: result.triggeredRules.map((rule) => rule.id),
        calldataHash: await sha256Hex(`${to ?? ""}:${data}:${value}`),
      });
    } catch (error) {
      console.error("save tx risk check failed", error);
    }
  }

  return Response.json({
    mode,
    chainId,
    txHash,
    result,
    disclaimer: UNKNOWN_DISCLAIMER,
    boundary:
      "SignGuard 只做交易前规则解释，不接收私钥 / 助记词，也不会替用户签名，不等同于完整智能合约审计。",
  });
}
