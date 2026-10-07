import { eq, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { nftMinting, nftQualifications, users } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/auth";

// GET /api/admin/nft — 待铸造列表
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  const rows = await db
    .select({ minting: nftMinting, user: users, qualification: nftQualifications })
    .from(nftMinting)
    .innerJoin(users, eq(nftMinting.userId, users.id))
    .innerJoin(nftQualifications, eq(nftMinting.qualificationId, nftQualifications.id))
    .where(eq(nftMinting.status, status))
    .orderBy(desc(nftMinting.createdAt));

  return Response.json({
    records: rows.map((r) => ({
      id: r.minting.id,
      userId: r.minting.userId,
      username: r.user.username,
      courseId: r.qualification.courseId,
      walletAddress: r.minting.walletAddress,
      status: r.minting.status,
      txHash: r.minting.txHash,
      createdAt: r.minting.createdAt,
      mintedAt: r.minting.mintedAt,
    })),
  });
}