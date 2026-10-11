import { eq, desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { users, achievements, expLedger, nftMinting } from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";
import { calculateLevel, expToNextLevel } from "../../../lib/exp";
import { getUserAllProgresses } from "../../../lib/repositories";

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
// GET /api/profile — 成就档案聚合
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || auth.userId;

  // 用户基本信息
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  // 等级信息
  const level = calculateLevel(user.exp);
  const nextExp = expToNextLevel(user.exp);

  // 成就列表
  const userAchievements = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, userId))
    .orderBy(desc(achievements.earnedAt));

  // 课程进度列表
  const progresses = await getUserAllProgresses(db, userId);

  // EXP 流水（最近 50 条）
  const expEntries = await db
    .select()
    .from(expLedger)
    .where(eq(expLedger.userId, userId))
    .orderBy(desc(expLedger.createdAt))
    .limit(50);

  // NFT 铸造记录
  const nftRecords = await db
    .select()
    .from(nftMinting)
    .where(eq(nftMinting.userId, userId))
    .orderBy(desc(nftMinting.createdAt));

  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      exp: user.exp,
      level: {
        current: level,
        name: LEVEL_NAMES[level] || `Lv.${level}`,
        expToNext: nextExp,
      },
    },
    achievements: userAchievements.map((a) => ({
      type: a.type,
      courseId: a.courseId,
      data: a.dataBlob ? JSON.parse(a.dataBlob) : null,
      earnedAt: a.earnedAt,
    })),
    courses: progresses.map((p) => ({
      started: p.started,
      harvested: p.harvested,
      stage: p.harvested
        ? "completed"
        : p.verification === "passed"
          ? "verified"
          : p.challengePassed.every(Boolean)
            ? "challenges_done"
            : p.chaptersRead.every(Boolean)
              ? "theory_done"
              : p.planted
                ? "planted"
                : "started",
    })),
    expHistory: expEntries.map((e) => ({
      amount: e.amount,
      source: e.source,
      createdAt: e.createdAt,
    })),
    nftStatus: nftRecords.map((n) => ({
      status: n.status,
      txHash: n.txHash,
      mintedAt: n.mintedAt,
    })),
  });
}