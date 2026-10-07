import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { nftMinting, nftQualifications } from "../../../../../../db/schema";
import { requireAdmin } from "../../../../../../lib/auth";
import { logAdminAction } from "../../../../../../lib/repositories";
import { mintBadge, checkHasBadge, BADGE_TYPE_IDS } from "../../../../../../lib/nft";

// Course slug → badge type ID mapping
const COURSE_TO_BADGE_TYPE: Record<string, number> = {
  "web3": BADGE_TYPE_IDS["web3-intro"],
  "monad": BADGE_TYPE_IDS["monad-basics"],
  "contract": BADGE_TYPE_IDS["smart-contracts"],
};

// POST /api/admin/nft/:id/approve — 审批通过并链上铸造
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const { id } = params;
  const body = (await request.json()) as { reason?: string };
  const { reason } = body;

  const [mintingRecord] = await db
    .select()
    .from(nftMinting)
    .where(eq(nftMinting.id, id))
    .limit(1);

  if (!mintingRecord) {
    return Response.json({ error: "铸造记录不存在" }, { status: 404 });
  }

  if (mintingRecord.status !== "pending") {
    return Response.json({
      error: `该记录已处理，当前状态: ${mintingRecord.status}`,
      txHash: mintingRecord.txHash,
    }, { status: 400 });
  }

  const [qualification] = await db
    .select()
    .from(nftQualifications)
    .where(eq(nftQualifications.id, mintingRecord.qualificationId))
    .limit(1);

  if (!qualification) {
    return Response.json({ error: "资格记录不存在" }, { status: 404 });
  }

  const badgeTypeId = COURSE_TO_BADGE_TYPE[qualification.courseId];
  if (badgeTypeId === undefined) {
    return Response.json({ error: `未知课程: ${qualification.courseId}` }, { status: 400 });
  }

  try {
    const alreadyHasBadge = await checkHasBadge(
      mintingRecord.walletAddress as `0x${string}`,
      badgeTypeId,
    );
    if (alreadyHasBadge) {
      await db
        .update(nftMinting)
        .set({ status: "confirmed" })
        .where(eq(nftMinting.id, id));

      return Response.json({ error: "该钱包已拥有此徽章" }, { status: 409 });
    }
  } catch {
    // 链上查询失败时继续
  }

  try {
    const { tokenId, txHash } = await mintBadge(
      mintingRecord.walletAddress as `0x${string}`,
      badgeTypeId,
    );

    const now = new Date().toISOString();

    await db
      .update(nftMinting)
      .set({ status: "confirmed", txHash, mintedAt: now })
      .where(eq(nftMinting.id, id));

    await db
      .update(nftQualifications)
      .set({ status: "minted" })
      .where(eq(nftQualifications.id, mintingRecord.qualificationId));

    await logAdminAction(
      db,
      "nft_mint_approve",
      auth.userId,
      "nft_minting",
      id,
      { status: "pending" },
      { status: "confirmed", txHash, tokenId: tokenId.toString() },
      reason,
    );

    return Response.json({
      message: "铸造成功",
      mintingId: id,
      tokenId: tokenId.toString(),
      txHash,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(nftMinting)
      .set({ status: "failed" })
      .where(eq(nftMinting.id, id));

    await logAdminAction(
      db,
      "nft_mint_failed",
      auth.userId,
      "nft_minting",
      id,
      { status: "pending" },
      { status: "failed", error: errorMessage },
      errorMessage,
    );

    return Response.json({ error: "铸造失败", details: errorMessage }, { status: 500 });
  }
}