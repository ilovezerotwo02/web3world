import { and, desc, eq } from "drizzle-orm";
import { getAddress, isAddress, type Address, type Hash } from "viem";
import { getDb } from "../../../db";
import {
  courseProgress,
  nftMinting,
  nftQualifications,
  users,
} from "../../../db/schema";
import { requireAuth } from "../../../lib/auth";
import { EXP_REWARDS } from "../../../lib/exp";
import { MONAD_TESTNET } from "../../../lib/monad-chain";
import {
  COURSE_TO_BADGE_TYPE,
  checkHasBadge,
  findBadgeTokenId,
  getBadgeContractAddress,
  getBadgeExplorerUrl,
  isBadgeCourseId,
  mintBadge,
} from "../../../lib/nft";
import {
  addExp,
  createNftQualification,
  logAdminAction,
} from "../../../lib/repositories";

type QualificationRequest = {
  courseId?: string;
  walletAddress?: string;
};

type ExecuteMintRequest = {
  mintingId?: string;
};

function isCompleteProgress(progress: typeof courseProgress.$inferSelect) {
  let chaptersRead: unknown;
  let challengePassed: unknown;
  try {
    chaptersRead = JSON.parse(progress.chaptersRead) as unknown;
    challengePassed = JSON.parse(progress.challengePassed) as unknown;
  } catch {
    return false;
  }
  return Boolean(
    progress.started &&
      progress.seedGranted &&
      progress.landCleared &&
      progress.planted &&
      Array.isArray(chaptersRead) &&
      chaptersRead.length === 3 &&
      chaptersRead.every((value) => value === true) &&
      Array.isArray(challengePassed) &&
      challengePassed.length === 3 &&
      challengePassed.every((value) => value === true) &&
      progress.verification === "passed" &&
      progress.harvested,
  );
}

function mintingPayload(record: typeof nftMinting.$inferSelect) {
  return {
    mintingRecord: record,
    tokenId: record.tokenId,
    txHash: record.txHash,
    contractAddress: record.contractAddress,
    chainId: record.chainId,
    explorerUrl: record.txHash
      ? getBadgeExplorerUrl(record.txHash as Hash)
      : null,
  };
}

export async function GET(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const courseId = new URL(request.url).searchParams.get("courseId");
  if (courseId && !isBadgeCourseId(courseId)) {
    return Response.json({ error: "课程编号无效" }, { status: 400 });
  }

  const qualifications = courseId
    ? await db
        .select()
        .from(nftQualifications)
        .where(
          and(
            eq(nftQualifications.userId, auth.userId),
            eq(nftQualifications.courseId, courseId),
          ),
        )
        .limit(1)
    : await db
        .select()
        .from(nftQualifications)
        .where(eq(nftQualifications.userId, auth.userId))
        .orderBy(desc(nftQualifications.createdAt));

  const mintingHistory = await db
    .select()
    .from(nftMinting)
    .where(eq(nftMinting.userId, auth.userId))
    .orderBy(desc(nftMinting.createdAt));
  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);

  return Response.json({
    qualifications,
    mintingHistory,
    walletAddress: user?.walletAddress ?? null,
    contractAddress: getBadgeContractAddress(),
    chainId: MONAD_TESTNET.id,
  });
}

export async function POST(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as QualificationRequest;
  if (!body.courseId || !isBadgeCourseId(body.courseId)) {
    return Response.json({ error: "课程编号无效" }, { status: 400 });
  }
  if (!body.walletAddress || !isAddress(body.walletAddress)) {
    return Response.json({ error: "钱包地址格式无效" }, { status: 400 });
  }
  const walletAddress = getAddress(body.walletAddress);

  const [user] = await db
    .select({ walletAddress: users.walletAddress })
    .from(users)
    .where(eq(users.id, auth.userId))
    .limit(1);
  if (
    !user?.walletAddress ||
    user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
  ) {
    return Response.json(
      { error: "当前会话未绑定这个钱包地址" },
      { status: 403 },
    );
  }

  const [progress] = await db
    .select()
    .from(courseProgress)
    .where(
      and(
        eq(courseProgress.userId, auth.userId),
        eq(courseProgress.courseId, body.courseId),
      ),
    )
    .limit(1);
  if (!progress || !isCompleteProgress(progress)) {
    return Response.json(
      { error: "平台未验证到完整的课程完成记录" },
      { status: 403 },
    );
  }

  const qualification = await createNftQualification(
    db,
    auth.userId,
    body.courseId,
  );
  const [existing] = await db
    .select()
    .from(nftMinting)
    .where(eq(nftMinting.qualificationId, qualification.id))
    .orderBy(desc(nftMinting.createdAt))
    .limit(1);
  if (existing?.status === "confirmed" || existing?.status === "pending") {
    return Response.json({
      qualification,
      ...mintingPayload(existing),
      badgeTypeId: COURSE_TO_BADGE_TYPE[body.courseId],
    });
  }

  const badgeTypeId = COURSE_TO_BADGE_TYPE[body.courseId];
  try {
    if (await checkHasBadge(walletAddress, badgeTypeId)) {
      const tokenId = await findBadgeTokenId(walletAddress, badgeTypeId);
      const values = {
        status: "confirmed",
        tokenId: tokenId?.toString() ?? null,
        contractAddress: getBadgeContractAddress(),
        chainId: MONAD_TESTNET.id,
        mintedAt: new Date().toISOString(),
      };
      const [record] = existing
        ? await db
            .update(nftMinting)
            .set(values)
            .where(eq(nftMinting.id, existing.id))
            .returning()
        : await db
            .insert(nftMinting)
            .values({
              id: crypto.randomUUID(),
              qualificationId: qualification.id,
              userId: auth.userId,
              walletAddress,
              ...values,
            })
            .returning();
      await db
        .update(nftQualifications)
        .set({ status: "minted" })
        .where(eq(nftQualifications.id, qualification.id));
      return Response.json({
        qualification,
        ...mintingPayload(record),
        badgeTypeId,
      });
    }
  } catch (error) {
    console.error("NFT eligibility chain read failed", error);
    return Response.json(
      { error: "链上资格检查暂时不可用，请稍后重试" },
      { status: 503 },
    );
  }

  const values = {
    status: "pending",
    walletAddress,
    txHash: null,
    tokenId: null,
    contractAddress: null,
    chainId: null,
    mintedAt: null,
  };
  const [mintingRecord] = existing
    ? await db
        .update(nftMinting)
        .set(values)
        .where(eq(nftMinting.id, existing.id))
        .returning()
    : await db
        .insert(nftMinting)
        .values({
          id: crypto.randomUUID(),
          qualificationId: qualification.id,
          userId: auth.userId,
          ...values,
        })
        .returning();

  return Response.json(
    {
      qualification,
      ...mintingPayload(mintingRecord),
      badgeTypeId,
    },
    { status: existing ? 200 : 201 },
  );
}

export async function PUT(request: Request) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as ExecuteMintRequest;
  if (!body.mintingId) {
    return Response.json({ error: "mintingId 不能为空" }, { status: 400 });
  }

  const [mintingRecord] = await db
    .select()
    .from(nftMinting)
    .where(
      and(
        eq(nftMinting.id, body.mintingId),
        eq(nftMinting.userId, auth.userId),
      ),
    )
    .limit(1);
  if (!mintingRecord) {
    return Response.json({ error: "铸造记录不存在" }, { status: 404 });
  }
  if (mintingRecord.status === "confirmed") {
    return Response.json(mintingPayload(mintingRecord));
  }
  if (mintingRecord.status !== "pending") {
    return Response.json(
      { error: "当前铸造记录不能执行，请重新验证资格" },
      { status: 409 },
    );
  }

  const [qualification] = await db
    .select()
    .from(nftQualifications)
    .where(eq(nftQualifications.id, mintingRecord.qualificationId))
    .limit(1);
  if (!qualification || !isBadgeCourseId(qualification.courseId)) {
    return Response.json({ error: "课程铸造资格无效" }, { status: 409 });
  }
  const badgeTypeId = COURSE_TO_BADGE_TYPE[qualification.courseId];
  const walletAddress = getAddress(mintingRecord.walletAddress) as Address;

  const [locked] = await db
    .update(nftMinting)
    .set({ status: "processing" })
    .where(
      and(
        eq(nftMinting.id, mintingRecord.id),
        eq(nftMinting.status, "pending"),
      ),
    )
    .returning();
  if (!locked) {
    return Response.json({ error: "铸造请求正在处理中" }, { status: 409 });
  }

  try {
    const result = await mintBadge(walletAddress, badgeTypeId);
    const [updated] = await db
      .update(nftMinting)
      .set({
        status: "confirmed",
        txHash: result.txHash,
        tokenId: result.tokenId.toString(),
        contractAddress: result.contractAddress,
        chainId: MONAD_TESTNET.id,
        mintedAt: new Date().toISOString(),
      })
      .where(eq(nftMinting.id, mintingRecord.id))
      .returning();
    await db
      .update(nftQualifications)
      .set({ status: "minted" })
      .where(eq(nftQualifications.id, qualification.id));
    await addExp(
      db,
      auth.userId,
      EXP_REWARDS.HARVEST,
      "nft_mint",
      `nft-mint-${qualification.id}`,
    );
    await logAdminAction(
      db,
      "nft_mint",
      auth.userId,
      "nft_minting",
      mintingRecord.id,
      { status: "processing" },
      {
        status: "confirmed",
        txHash: result.txHash,
        tokenId: result.tokenId.toString(),
      },
      "课程完成徽章铸造成功",
    );
    return Response.json(mintingPayload(updated));
  } catch (error) {
    console.error("NFT mint failed", error);
    await db
      .update(nftMinting)
      .set({ status: "failed" })
      .where(eq(nftMinting.id, mintingRecord.id));
    await logAdminAction(
      db,
      "nft_mint_failed",
      auth.userId,
      "nft_minting",
      mintingRecord.id,
      { status: "processing" },
      { status: "failed" },
      error instanceof Error ? error.message : String(error),
    );
    return Response.json(
      { error: "平台代付铸造失败，请重新验证资格后重试" },
      { status: 502 },
    );
  }
}
