import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { addExp, logAdminAction } from "../../../lib/repositories";
import { EXP_REWARDS } from "../../../lib/exp";
import { requireAuth } from "../../../lib/auth";

// GET /api/wallet?userId=X — 查询用户绑定的钱包地址
// GET /api/wallet?address=0x... — 查询钱包地址绑定的用户
export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const address = searchParams.get("address");

  if (!userId && !address) {
    return Response.json({ error: "userId or address required" }, { status: 400 });
  }

  if (address) {
    const [user] = await db
      .select({ id: users.id, username: users.username, walletAddress: users.walletAddress })
      .from(users)
      .where(eq(users.walletAddress, address))
      .limit(1);
    return Response.json({ user: user ?? null });
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, userId!))
    .limit(1);

  return Response.json({ user: user ?? null });
}

// PUT /api/wallet — 设置/修改钱包地址
export async function PUT(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as {
    address: string;
  };

  const { address } = body;

  if (!address) {
    return Response.json({ error: "address required" }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return Response.json({ error: "Invalid wallet address format" }, { status: 400 });
  }

  // 检查地址是否已被其他用户绑定
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, address))
    .limit(1);

  if (existing && existing.id !== auth.userId) {
    return Response.json({ error: "Address already bound to another account" }, { status: 409 });
  }

  // 获取当前钱包地址，判断是否首次绑定（用来发 EXP 奖励）
  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  const isFirstBind = !currentUser?.walletAddress;

  // 更新钱包地址
  const now = new Date().toISOString();
  const [updated] = await db
    .update(users)
    .set({ walletAddress: address, updatedAt: now })
    .where(eq(users.id, auth.userId))
    .returning();

  // 首次绑定奖励 EXP
  if (isFirstBind) {
    await addExp(db, auth.userId, EXP_REWARDS.BIND_WALLET, "bind_wallet", `bind-wallet-${address}`);
  }

  // 审计日志
  await logAdminAction(
    db,
    isFirstBind ? "wallet_bind" : "wallet_update",
    auth.userId,
    "wallet",
    address,
    currentUser?.walletAddress ? { walletAddress: currentUser.walletAddress } : undefined,
    { walletAddress: address },
    isFirstBind ? "用户绑定钱包" : "用户修改钱包地址",
  );

  console.log(`[Wallet] 钱包${isFirstBind ? "绑定" : "更新"}成功: userId=${auth.userId}, address=${address}`);

  return Response.json({
    user: {
      id: updated.id,
      username: updated.username,
      walletAddress: updated.walletAddress,
    },
    message: isFirstBind ? "Wallet bound successfully" : "Wallet address updated successfully",
  });
}