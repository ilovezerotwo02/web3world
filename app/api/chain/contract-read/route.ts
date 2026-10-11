import { getDb } from "../../../../db";
import { requireAuth } from "../../../../lib/auth";
import { MONAD_TESTNET } from "../../../../lib/monad-chain";

// GET /api/chain/contract-read — 合约读取代理
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const contractAddress = searchParams.get("address");
  const method = searchParams.get("method");
  const data = searchParams.get("data");

  if (!contractAddress || !method) {
    return Response.json({
      error: "address、method 参数不能为空",
      example: "/api/chain/contract-read?address=0x...&method=symbol&data=0x...",
    }, { status: 400 });
  }

  const rpcUrl = process.env.MONAD_RPC_URL || MONAD_TESTNET.rpcUrls.default.http[0];

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          { to: contractAddress, data: data || "" },
          "latest",
        ],
      }),
    });

    const result = (await response.json()) as { result?: string; error?: { message: string } };

    return Response.json({
      contractAddress,
      method,
      result: result.result || null,
      error: result.error?.message || null,
    });
  } catch {
    return Response.json({
      contractAddress,
      method,
      result: null,
      error: "合约读取失败",
    });
  }
}
