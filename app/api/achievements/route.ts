import { getDb } from "../../../db";
import { achievements } from "../../../db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId required" }, { status: 400 });
  }

  const records = await db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, userId))
    .orderBy(desc(achievements.earnedAt));

  const parsed = records.map((a) => ({
    ...a,
    dataBlob: a.dataBlob ? JSON.parse(a.dataBlob) : null,
  }));

  return Response.json({ achievements: parsed });
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json() as {
    userId: string;
    type: string;
    courseId?: string;
    data?: Record<string, unknown>;
  };

  const { userId, type, courseId, data } = body;

  if (!userId || !type) {
    return Response.json({ error: "userId and type required" }, { status: 400 });
  }

  // Idempotency check
  const [existing] = await db
    .select()
    .from(achievements)
    .where(eq(achievements.type, type))
    .limit(1);

  if (existing) {
    return Response.json({ achievement: null, message: "Already earned" });
  }

  const [achievement] = await db
    .insert(achievements)
    .values({
      id: crypto.randomUUID(),
      userId,
      type,
      courseId: courseId ?? null,
      dataBlob: data ? JSON.stringify(data) : null,
    })
    .returning();

  return Response.json({ achievement }, { status: 201 });
}
