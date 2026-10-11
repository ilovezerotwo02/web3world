import { getDb } from "../../../../db";
import { requireAuth } from "../../../../lib/auth";
import { MONAD_TESTNET } from "../../../../lib/monad-chain";
import { isTxHash, jsonError } from "../../../../lib/security/api-helpers";

const RPC_URL = () =>
  (typeof process !== "undefined" && process.env?.MONAD_RPC_URL) ||
  MONAD_TESTNET.rpcUrls.default.http[0];

// GET /api/chain/tx?hash=0x... — 读取真实 Monad Testnet 交易（服务端固定 RPC）
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
        method: "eth_getTransactionByHash",
        params: [hash],
      }),
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = (await response.json()) as {
      result?: {
        hash: string;
        from: string;
        to: string | null;
        input: string;
        value: string;
        blockNumber: string | null;
        nonce: string;
      } | null;
      error?: { message?: string };
    };
    if (payload.error) throw new Error(payload.error.message ?? "RPC 错误");
    if (!payload.result) {
      return Response.json({ error: "交易不存在" }, { status: 404 });
    }
    const tx = payload.result;
    return Response.json({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      input: tx.input,
      value: tx.value,
      valueMon: (() => {
        try {
          return Number(BigInt(tx.value)) / 1e18;
        } catch {
          return 0;
        }
      })(),
      blockNumber: tx.blockNumber ? Number.parseInt(tx.blockNumber, 16) : null,
      nonce: tx.nonce,
      chainId: MONAD_TESTNET.id,
      explorerUrl: `${MONAD_TESTNET.blockExplorers.default.url}/tx/${tx.hash}`,
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
