import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import {
  createSession,
  deleteSession,
  extractToken,
} from "../../../lib/auth";

// ---------------------------------------------------------------------------
// POST /api/auth/register — 注册新用户
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const db = getDb();
  const body = (await request.json()) as {
    username: string;
    avatarUrl?: string;
  };

  const { username, avatarUrl } = body;

  if (!username || username.trim().length === 0) {
    return Response.json({ error: "用户名不能为空" }, { status: 400 });
  }

  if (username.length > 32) {
    return Response.json({ error: "用户名最多 32 个字符" }, { status: 400 });
  }

  // 检查用户名是否已存在
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing) {
    return Response.json({ error: "用户名已被使用" }, { status: 409 });
  }

  // 创建用户
  const userId = crypto.randomUUID();
  const [user] = await db
    .insert(users)
    .values({
      id: userId,
      username: username.trim(),
      avatarUrl: avatarUrl ?? null,
      role: "user",
    })
    .returning();

  // 创建会话
  const session = await createSession(db, userId);

  return Response.json(
    {
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: user.role,
        exp: user.exp,
        level: user.level,
      },
      token: session.token,
    },
    { status: 201 },
  );
}

// ---------------------------------------------------------------------------
// GET /api/auth/me — 获取当前登录用户信息
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const db = getDb();
  const token = extractToken(request);
  if (!token) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { getSessionByToken } = await import("../../../lib/auth");
  const session = await getSessionByToken(db, token);
  if (!session) {
    return Response.json({ error: "登录已过期" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      exp: user.exp,
      level: user.level,
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/auth/logout — 退出登录
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  const db = getDb();
  const token = extractToken(request);
  if (!token) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  await deleteSession(db, token);
  return Response.json({ message: "已退出登录" });
}