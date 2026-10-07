const BADGE_METADATA = [
  {
    name: "账本守护者",
    description: "完成 Monad 像素农场 Web3 通识课程的不可转让学习徽章。",
    imagePath: "/art/badges/ledger-guardian-nft-v1.png",
    course: "Web3 通识",
    seed: "账本星种",
  },
  {
    name: "Monad 探索者",
    description: "完成 Monad 像素农场 Monad 基础课程的不可转让学习徽章。",
    imagePath: "/art/badges/monad-explorer-nft-v1.png",
    course: "Monad 基础",
    seed: "并行紫藤种",
  },
  {
    name: "合约建造师",
    description: "完成 Monad 像素农场智能合约课程的不可转让学习徽章。",
    imagePath: "/art/badges/contract-builder-nft-v1.png",
    course: "智能合约",
    seed: "合约卷轴种",
  },
] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ typeId: string }> },
) {
  const { typeId: typeIdParam } = await params;
  if (!/^(0|1|2)$/.test(typeIdParam)) {
    return Response.json({ error: "Badge type not found" }, { status: 404 });
  }

  const typeId = Number(typeIdParam);
  const badge = BADGE_METADATA[typeId];
  const origin = new URL(request.url).origin;

  return Response.json(
    {
      name: badge.name,
      description: badge.description,
      image: `${origin}${badge.imagePath}`,
      external_url: origin,
      attributes: [
        { trait_type: "课程", value: badge.course },
        { trait_type: "知识种子", value: badge.seed },
        { trait_type: "网络", value: "Monad Testnet" },
        { trait_type: "凭证类型", value: "不可转让学习徽章" },
        { display_type: "number", trait_type: "徽章类型", value: typeId },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
