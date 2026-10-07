import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";

// ---------------------------------------------------------------------------
// GET /api/users — 查询用户信息
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const address = searchParams.get("address");

  if (!userId && !address) {
    return Response.json({ error: "userId or wallet address required" }, { status: 400 });
  }

  let user = null;
  if (userId) {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
  } else if (address) {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, address))
      .limit(1);
  }

  return Response.json({ user });
}

// ---------------------------------------------------------------------------
// PUT /api/users — 修改个人资料
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as {
    username?: string;
    avatarUrl?: string | null;
  };
  const { username, avatarUrl } = body;

  const updates: Record<string, string | null> = {};

  if (username !== undefined) {
    if (username.trim().length === 0) {
      return Response.json({ error: "用户名不能为空" }, { status: 400 });
    }
    if (username.length > 32) {
      return Response.json({ error: "用户名最多 32 个字符" }, { status: 400 });
    }

    // 检查用户名是否被其他用户使用
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.trim()))
      .limit(1);

    if (existing && existing.id !== auth.userId) {
      return Response.json({ error: "用户名已被使用" }, { status: 409 });
    }

    updates.username = username.trim();
  }

  if (avatarUrl !== undefined) {
    updates.avatarUrl = avatarUrl;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "没有需要更新的字段" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, auth.userId))
    .returning();

  return Response.json({
    user: {
      id: updated.id,
      username: updated.username,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      exp: updated.exp,
      level: updated.level,
    },
  });
}
