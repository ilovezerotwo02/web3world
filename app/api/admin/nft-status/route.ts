import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { nftMinting } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/auth";

// GET /api/admin/nft-status — NFT 服务状态
export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const mintingRecords = await db
    .select()
    .from(nftMinting)
    .orderBy(desc(nftMinting.createdAt))
    .limit(50);

  const statusCounts = mintingRecords.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return Response.json({
    total: mintingRecords.length,
    statusCounts,
    records: mintingRecords.map((r) => ({
      id: r.id,
      userId: r.userId,
      walletAddress: r.walletAddress,
      status: r.status,
      txHash: r.txHash,
      createdAt: r.createdAt,
      mintedAt: r.mintedAt,
    })),
  });
}