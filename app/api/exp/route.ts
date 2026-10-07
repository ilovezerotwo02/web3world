import { getDb } from "../../../db";
import { expLedger, users as usersTable } from "../../../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { calculateLevel } from "../../../lib/exp";

export async function GET(request: Request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId required" }, { status: 400 });
  }

  const records = await db
    .select()
    .from(expLedger)
    .where(eq(expLedger.userId, userId))
    .orderBy(desc(expLedger.createdAt));

  return Response.json({ records });
}

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json() as {
    userId: string;
    amount: number;
    source: string;
    referenceId: string;
  };

  const { userId, amount, source, referenceId } = body;

  if (!userId || !amount || !source || !referenceId) {
    return Response.json({ error: "userId, amount, source, and referenceId required" }, { status: 400 });
  }

  // Check idempotency
  const [existing] = await db
    .select()
    .from(expLedger)
    .where(eq(expLedger.referenceId, referenceId))
    .limit(1);

  if (existing) {
    return Response.json({ record: null, message: "Already recorded" });
  }

  const [record] = await db
    .insert(expLedger)
    .values({ id: crypto.randomUUID(), userId, amount, source, referenceId })
    .returning();

  // Update user total exp and recalculate level
  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const newExp = (currentUser?.exp ?? 0) + amount;
  const newLevel = calculateLevel(newExp);

  await db
    .update(usersTable)
    .set({
      exp: sql`${usersTable.exp} + ${amount}`,
      level: newLevel,
    })
    .where(eq(usersTable.id, userId));

  return Response.json({ record }, { status: 201 });
}
