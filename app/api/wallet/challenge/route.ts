import { and, eq, isNull, sql } from "drizzle-orm";
import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { getDb } from "../../../../db";
import { users, walletChallenges } from "../../../../db/schema";
import { createSession } from "../../../../lib/auth";
import { MONAD_TESTNET } from "../../../../lib/monad-chain";

const CHALLENGE_DURATION_MS = 5 * 60 * 1000;

type ChallengeRequest = {
  address?: string;
};

type VerificationRequest = {
  challengeId?: string;
  address?: string;
  signature?: string;
};

function normalizeAddress(value: string) {
  if (!isAddress(value)) return null;
  return getAddress(value);
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChallengeRequest;
  const address = normalizeAddress(body.address ?? "");
  if (!address) {
    return Response.json({ error: "钱包地址格式无效" }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const challengeId = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_DURATION_MS);
  const message = [
    `${requestUrl.host} 请求验证你的钱包地址：`,
    address,
    "",
    "签名用于领取课程完成徽章，不会发送交易，也不会消耗 MON。",
    "",
    `URI: ${requestUrl.origin}`,
    "Version: 1",
    `Chain ID: ${MONAD_TESTNET.id}`,
    `Nonce: ${challengeId}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiresAt.toISOString()}`,
  ].join("\n");

  const db = getDb();
  await db.insert(walletChallenges).values({
    id: challengeId,
    address,
    message,
    expiresAt: expiresAt.toISOString(),
  });

  return Response.json({
    challengeId,
    address,
    message,
    expiresAt: expiresAt.toISOString(),
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as VerificationRequest;
  const address = normalizeAddress(body.address ?? "");
  if (!body.challengeId || !address || !body.signature) {
    return Response.json(
      { error: "challengeId、address 和 signature 不能为空" },
      { status: 400 },
    );
  }

  const db = getDb();
  const [challenge] = await db
    .select()
    .from(walletChallenges)
    .where(eq(walletChallenges.id, body.challengeId))
    .limit(1);

  if (!challenge || challenge.usedAt) {
    return Response.json({ error: "签名请求不存在或已经使用" }, { status: 409 });
  }
  if (challenge.address !== address) {
    return Response.json({ error: "签名地址与请求地址不一致" }, { status: 400 });
  }
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    return Response.json({ error: "签名请求已过期，请重新连接钱包" }, { status: 410 });
  }

  let verified = false;
  try {
    verified = await verifyMessage({
      address,
      message: challenge.message,
      signature: body.signature as Hex,
    });
  } catch {
    verified = false;
  }
  if (!verified) {
    return Response.json({ error: "钱包签名验证失败" }, { status: 401 });
  }

  const [used] = await db
    .update(walletChallenges)
    .set({ usedAt: new Date().toISOString() })
    .where(
      and(
        eq(walletChallenges.id, challenge.id),
        isNull(walletChallenges.usedAt),
      ),
    )
    .returning({ id: walletChallenges.id });
  if (!used) {
    return Response.json({ error: "签名请求已经使用" }, { status: 409 });
  }

  let [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.walletAddress}) = lower(${address})`)
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        username: `wallet-${address.slice(2).toLowerCase()}`,
        walletAddress: address,
      })
      .returning();
  } else if (user.walletAddress !== address) {
    [user] = await db
      .update(users)
      .set({ walletAddress: address, updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .returning();
  }

  const session = await createSession(db, user.id);
  return Response.json({
    token: session.token,
    user: {
      id: user.id,
      walletAddress: address,
    },
  });
}
