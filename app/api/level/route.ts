import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";
import { calculateLevel, expToNextLevel, levelRange } from "../../../lib/exp";

// ---------------------------------------------------------------------------
// 等级名称映射
// ---------------------------------------------------------------------------

const LEVEL_NAMES: Record<number, string> = {
  1: "初来乍到",
  2: "学徒",
  3: "探索者",
  4: "建造师",
  5: "农场主",
  6: "园艺大师",
  7: "加密园丁",
  8: "区块链农夫",
  9: "像素领主",
  10: "Monad 守护者",
};

// ---------------------------------------------------------------------------
// GET /api/level — 查询等级信息
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  if (!user) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  const level = calculateLevel(user.exp);
  const nextExp = expToNextLevel(user.exp);
  const range = levelRange(level);
  const maxLevel = level >= 10;

  return Response.json({
    level: {
      current: level,
      name: LEVEL_NAMES[level] || `Lv.${level}`,
      exp: user.exp,
      expToNext: nextExp,
      range,
      maxLevel,
      progress: maxLevel
        ? 100
        : Math.round(((user.exp - range.min) / (range.max - range.min)) * 100),
    },
  });
}