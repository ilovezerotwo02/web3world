import { eq } from "drizzle-orm";
import type { DB } from "../db";
import { users, sessions, systemConfig } from "../db/schema";

// ---------------------------------------------------------------------------
// Auth utilities
// ---------------------------------------------------------------------------

const TOKEN_PREFIX = "mpx_";
const TOKEN_BYTES = 24;
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return TOKEN_PREFIX + hex;
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function createSession(
  db: DB,
  userId: string,
): Promise<{ userId: string; token: string }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt,
  });

  return { userId, token };
}

export async function getSessionByToken(
  db: DB,
  token: string,
): Promise<{ userId: string; role: string } | null> {
  const [session] = await db
    .select({
      userId: sessions.userId,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }
  return { userId: session.userId, role: session.role };
}

export async function deleteSession(db: DB, token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function deleteUserSessions(db: DB, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// ---------------------------------------------------------------------------
// Auth middleware helpers
// ---------------------------------------------------------------------------

export function extractToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAuth(
  request: Request,
  db: DB,
): Promise<{ userId: string; role: string } | Response> {
  const token = extractToken(request);
  if (!token) {
    return Response.json({ error: "未登录，请先登录" }, { status: 401 });
  }

  const session = await getSessionByToken(db, token);
  if (!session) {
    return Response.json({ error: "登录已过期，请重新登录" }, { status: 401 });
  }

  return session;
}

export async function requireAdmin(
  request: Request,
  db: DB,
): Promise<{ userId: string; role: string } | Response> {
  const result = await requireAuth(request, db);
  if (result instanceof Response) return result;

  if (result.role !== "admin") {
    return Response.json({ error: "权限不足，需要管理员身份" }, { status: 403 });
  }

  return result;
}

// ---------------------------------------------------------------------------
// 维护模式检查
// 在非管理员路由前调用，检查是否开启了维护模式
// ---------------------------------------------------------------------------

export async function requireServiceAvailable(
  request: Request,
  db: DB,
): Promise<Response | null> {
  // 检查维护模式配置
  const [config] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "maintenance_mode"))
    .limit(1);

  if (config && config.value === "true") {
    return Response.json(
      { error: "系统维护中，请稍后再试" },
      { status: 503 },
    );
  }

  return null;
}
