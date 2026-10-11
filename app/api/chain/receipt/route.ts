import { getDb } from "../../../../db";
import { requireAuth } from "../../../../lib/auth";
import { MONAD_TESTNET } from "../../../../lib/monad-chain";
import { isTxHash, jsonError } from "../../../../lib/security/api-helpers";

const RPC_URL = () =>
  (typeof process !== "undefined" && process.env?.MONAD_RPC_URL) ||
  MONAD_TESTNET.rpcUrls.default.http[0];

// GET /api/chain/receipt?hash=0x... — 读取交易回执（判断成功/失败）
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const hash = new URL(request.url).searchParams.get("hash");
  if (!isTxHash(hash)) {
    return jsonError("hash 必须是 32 字节 0x 交易哈希", 400);
  }

  try {
    const response = await fetch(RPC_URL(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [hash],
      }),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = (await response.json()) as {
      result?: {
        status: string;
        blockNumber: string;
        gasUsed: string;
        effectiveGasPrice?: string;
        contractAddress: string | null;
        logs: unknown[];
        from: string;
        to: string | null;
      } | null;
      error?: { message?: string };
    };
    if (payload.error) throw new Error(payload.error.message ?? "RPC 错误");
    if (!payload.result) {
      return Response.json({ error: "回执不存在（交易可能尚未确认）" }, { status: 404 });
    }
    const receipt = payload.result;
    return Response.json({
      status: receipt.status === "0x1" ? "success" : "failed",
      blockNumber: Number.parseInt(receipt.blockNumber, 16),
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice ?? null,
      contractAddress: receipt.contractAddress,
      logsCount: Array.isArray(receipt.logs) ? receipt.logs.length : 0,
      from: receipt.from,
      to: receipt.to,
      chainId: MONAD_TESTNET.id,
      explorerUrl: `${MONAD_TESTNET.blockExplorers.default.url}/tx/${hash}`,
    });
  } catch (error) {
    return Response.json(
      {
        error: "链上读取暂时不可用",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 503 },
    );
  }
}
