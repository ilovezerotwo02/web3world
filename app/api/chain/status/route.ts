import { getDb } from "../../../../db";
import { requireAuth } from "../../../../lib/auth";
import { MONAD_TESTNET } from "../../../../lib/monad-chain";

// GET /api/chain/status — Monad 网络状态
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const rpcUrl = process.env.MONAD_RPC_URL || MONAD_TESTNET.rpcUrls.default.http[0];

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });

    const data = (await response.json()) as { result?: string };

    return Response.json({
      network: "monad-testnet",
      rpcUrl,
      blockNumber: data.result ? parseInt(data.result, 16) : null,
      connected: !!data.result,
    });
  } catch {
    return Response.json({
      network: "monad-testnet",
      rpcUrl,
      blockNumber: null,
      connected: false,
      error: "RPC 连接失败",
    });
  }
}
