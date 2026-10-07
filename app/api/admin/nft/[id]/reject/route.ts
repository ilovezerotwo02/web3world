import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { nftMinting } from "../../../../../../db/schema";
import { requireAdmin } from "../../../../../../lib/auth";
import { logAdminAction } from "../../../../../../lib/repositories";

// POST /api/admin/nft/:id/reject — 拒绝铸造申请
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const db = getDb();
  const auth = await requireAdmin(request, db);
  if (auth instanceof Response) return auth;

  const { id } = params;
  const body = (await request.json()) as { reason: string };
  const { reason } = body;

  if (!reason) {
    return Response.json({ error: "拒绝原因不能为空" }, { status: 400 });
  }

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
    }, { status: 400 });
  }

  const now = new Date().toISOString();

  await db
    .update(nftMinting)
    .set({ status: "failed", mintedAt: now })
    .where(eq(nftMinting.id, id));

  await logAdminAction(
    db,
    "nft_mint_reject",
    auth.userId,
    "nft_minting",
    id,
    { status: "pending" },
    { status: "failed", reason },
    reason,
  );

  return Response.json({
    message: "已拒绝铸造申请",
    mintingId: id,
  });
}