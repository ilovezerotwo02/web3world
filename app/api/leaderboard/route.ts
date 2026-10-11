import { desc, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { users, courseProgress } from "../../../db/schema";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  // Leaderboard: users sorted by total EXP descending
  const leaderboard = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      exp: users.exp,
      level: users.level,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.exp))
    .limit(limit)
    .offset(offset);

  // Get course completion counts for each user
  const userIds = leaderboard.map((u) => u.id);
  const completionCounts: Record<string, number> = {};

  if (userIds.length > 0) {
    const rows = await db
      .select({
        userId: courseProgress.userId,
        count: sql<number>`count(*)`.as<number>(),
      })
      .from(courseProgress)
      .where(
        sql`${courseProgress.userId} in ${userIds} AND ${courseProgress.harvested} = 1`,
      )
      .groupBy(courseProgress.userId);

    for (const row of rows) {
      completionCounts[row.userId] = row.count;
    }
  }

  // Get total user count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const enriched = leaderboard.map((user, index) => ({
    rank: offset + index + 1,
    ...user,
    completedCourses: completionCounts[user.id] ?? 0,
  }));

  return Response.json({
    leaderboard: enriched,
    total: Number(countResult?.count ?? 0),
    limit,
    offset,
  });
}
