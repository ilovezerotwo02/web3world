export type FishId =
  | "pufferfish"
  | "anchovy"
  | "tuna"
  | "sardine"
  | "red-snapper"
  | "largemouth-bass"
  | "smallmouth-bass"
  | "rainbow-trout"
  | "salmon"
  | "walleye";

export type FishRarity = "常见" | "少见" | "稀有";

export type FishingReceipt = {
  mode: "demo" | "chain";
  txHash: string;
  blockNumber: number;
  gasUsed: number;
  confirmationMs: number;
  caughtAt: string;
};

export type FishCollectionEntry = {
  count: number;
  firstCaughtAt: string | null;
};

export type FishingCatch = FishingReceipt & {
  fishId: FishId;
};

export type FishingProgress = {
  version: 2;
  totalCatches: number;
  collection: Record<FishId, FishCollectionEntry>;
  history: FishingCatch[];
};

export type FishSpecies = {
  id: FishId;
  name: string;
  spriteSrc: string;
  rarity: FishRarity;
  difficulty: 1 | 2 | 3;
  eyebrow: string;
  description: string;
  lesson: string;
  habit: string;
};

export const FISHING_STORAGE_KEY = "monad-pixel-farm:v40:fishing-progress";

export const FISH_SPECIES: FishSpecies[] = [
  {
    id: "pufferfish",
    name: "河豚",
    spriteSrc: "/art/fish/pufferfish.png",
    rarity: "稀有",
    difficulty: 2,
    eyebrow: "签名前检查",
    description: "圆鼓鼓的河豚受到惊吓时会竖起尖刺，是回执池塘里最醒目的鱼影。",
    lesson: "像河豚展开尖刺前先观察环境一样，钱包签名前应先核对网络、接收地址和交易内容。",
    habit: "第 1 次垂钓出现，之后每完成一轮图鉴仍可能再次遇见。",
  },
  {
    id: "anchovy",
    name: "鳀鱼",
    spriteSrc: "/art/fish/anchovy.png",
    rarity: "常见",
    difficulty: 1,
    eyebrow: "交易广播",
    description: "银蓝色的小型鱼，通常成群快速游动，一离开鱼竿就会立刻进入池塘水流。",
    lesson: "签名完成只是创建交易；节点接收并向网络传播后，交易才进入广播阶段。",
    habit: "第 2 次垂钓出现，鱼影细长、移动迅速。",
  },
  {
    id: "tuna",
    name: "金枪鱼",
    spriteSrc: "/art/fish/tuna.png",
    rarity: "少见",
    difficulty: 3,
    eyebrow: "Pending 状态",
    description: "体型强壮、游速极快，在浮标周围盘旋时很难判断它何时真正咬钩。",
    lesson: "交易处于 Pending 时仍可能等待打包；界面提示不能替代链上确认结果。",
    habit: "第 3 次垂钓出现，需要耐心等到回执生成。",
  },
  {
    id: "sardine",
    name: "沙丁鱼",
    spriteSrc: "/art/fish/sardine.png",
    rarity: "常见",
    difficulty: 1,
    eyebrow: "交易顺序",
    description: "带着整齐蓝纹的小鱼，总会沿固定队列穿过回执池塘。",
    lesson: "账户交易通过 nonce 保持顺序；重复或跳过序号都可能让后续交易继续等待。",
    habit: "第 4 次垂钓出现，常沿着前一条鱼的路线前进。",
  },
  {
    id: "red-snapper",
    name: "鲷鱼",
    spriteSrc: "/art/fish/red-snapper.png",
    rarity: "少见",
    difficulty: 2,
    eyebrow: "进入区块",
    description: "暖红色鳞片在新区块出现时会亮起，鱼鳍像一枚展开的回执印章。",
    lesson: "回执中的 blockNumber 表示交易已经被打包进对应区块。",
    habit: "第 5 次垂钓出现，偏爱刚产生新区块的水面。",
  },
  {
    id: "largemouth-bass",
    name: "大嘴鲈鱼",
    spriteSrc: "/art/fish/largemouth-bass.png",
    rarity: "少见",
    difficulty: 3,
    eyebrow: "确认深度",
    description: "嘴宽、力量大，咬钩后仍会反复挣扎，需要等待水面真正平静。",
    lesson: "交易进入区块后，后续区块会增加确认深度；重要操作应等待足够确认。",
    habit: "第 6 次垂钓出现，拉扯时间比普通鱼更长。",
  },
  {
    id: "smallmouth-bass",
    name: "小嘴鲈鱼",
    spriteSrc: "/art/fish/smallmouth-bass.png",
    rarity: "常见",
    difficulty: 2,
    eyebrow: "Gas 使用量",
    description: "体型紧凑、动作利落，不会消耗多余力气，是池塘里的节制派。",
    lesson: "gasUsed 记录交易实际消耗的计算量，不等同于钱包预估的 Gas 上限。",
    habit: "第 7 次垂钓出现，常躲在浅水石块附近。",
  },
  {
    id: "rainbow-trout",
    name: "虹鳟鱼",
    spriteSrc: "/art/fish/rainbow-trout.png",
    rarity: "稀有",
    difficulty: 3,
    eyebrow: "网络身份",
    description: "侧身有一道紫粉虹彩，不同水域的光线会让它呈现不同颜色。",
    lesson: "相同地址可以出现在不同 EVM 网络，操作前必须核对 chainId。",
    habit: "第 8 次垂钓出现，只有网络信息清晰时才靠近浮标。",
  },
  {
    id: "salmon",
    name: "鲑鱼",
    spriteSrc: "/art/fish/salmon.png",
    rarity: "少见",
    difficulty: 2,
    eyebrow: "交易哈希",
    description: "会逆着水流返回熟悉的位置，银色鱼身像一条可以追溯的路径。",
    lesson: "交易哈希是查询单笔交易和回执的稳定索引，应从可信钱包或区块浏览器复制。",
    habit: "第 9 次垂钓出现，核对哈希末位后才会进入图鉴。",
  },
  {
    id: "walleye",
    name: "大眼鱼",
    spriteSrc: "/art/fish/walleye.png",
    rarity: "稀有",
    difficulty: 3,
    eyebrow: "RPC 再核验",
    description: "金色大眼能在昏暗水底辨认细节，是回执池塘最后出现的观察者。",
    lesson: "不要只相信页面动画；可以通过 RPC 或区块浏览器用交易哈希重新核验结果。",
    habit: "第 10 次垂钓出现，完成第一轮图鉴的最后一块记录。",
  },
];

function emptyCollection(): Record<FishId, FishCollectionEntry> {
  return {
    pufferfish: { count: 0, firstCaughtAt: null },
    anchovy: { count: 0, firstCaughtAt: null },
    tuna: { count: 0, firstCaughtAt: null },
    sardine: { count: 0, firstCaughtAt: null },
    "red-snapper": { count: 0, firstCaughtAt: null },
    "largemouth-bass": { count: 0, firstCaughtAt: null },
    "smallmouth-bass": { count: 0, firstCaughtAt: null },
    "rainbow-trout": { count: 0, firstCaughtAt: null },
    salmon: { count: 0, firstCaughtAt: null },
    walleye: { count: 0, firstCaughtAt: null },
  };
}

export const initialFishingProgress: FishingProgress = {
  version: 2,
  totalCatches: 0,
  collection: emptyCollection(),
  history: [],
};

export function fishForCast(totalCatches: number): FishSpecies {
  return FISH_SPECIES[Math.max(0, totalCatches) % FISH_SPECIES.length];
}

export function latestChainFishingReceipt(
  progress: FishingProgress,
): FishingCatch | null {
  return progress.history.find((entry) => entry.mode === "chain") ?? null;
}

function demoHash(castNumber: number) {
  const seed = Math.max(1, castNumber + 1).toString(16).padStart(8, "0");
  const body = `${seed}4d4f4e414446495348`.repeat(5).slice(0, 64);
  return `0x${body}`;
}

export function createDemoFishingReceipt(castNumber: number): FishingReceipt {
  return {
    mode: "demo",
    txHash: demoHash(castNumber),
    blockNumber: 12_400_000 + castNumber * 3,
    gasUsed: 21_000,
    confirmationMs: 760 + (castNumber % 3) * 120,
    caughtAt: new Date().toISOString(),
  };
}

export function hashSuffix(txHash: string) {
  return txHash.slice(-6).toUpperCase();
}

export function hashChoices(txHash: string): [string, string] {
  const correct = hashSuffix(txHash);
  const last = correct.at(-1) ?? "0";
  const replacement = last === "F" ? "8" : "F";
  const decoy = `${correct.slice(0, -1)}${replacement}`;
  const firstNibble = Number.parseInt(txHash.slice(2, 3), 16);
  return Number.isNaN(firstNibble) || firstNibble % 2 === 0
    ? [correct, decoy]
    : [decoy, correct];
}

export function recordFishingCatch(
  progress: FishingProgress,
  fishId: FishId,
  receipt: FishingReceipt,
): FishingProgress {
  if (progress.history.some((entry) => entry.txHash === receipt.txHash)) return progress;
  const previous = progress.collection[fishId];
  return {
    version: 2,
    totalCatches: progress.totalCatches + 1,
    collection: {
      ...progress.collection,
      [fishId]: {
        count: previous.count + 1,
        firstCaughtAt: previous.firstCaughtAt ?? receipt.caughtAt,
      },
    },
    history: [{ ...receipt, fishId }, ...progress.history].slice(0, 12),
  };
}

function isFishId(value: unknown): value is FishId {
  return FISH_SPECIES.some((fish) => fish.id === value);
}

function isReceipt(value: unknown): value is FishingReceipt {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FishingReceipt>;
  return (
    (item.mode === "demo" || item.mode === "chain") &&
    typeof item.txHash === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(item.txHash) &&
    typeof item.blockNumber === "number" &&
    Number.isFinite(item.blockNumber) &&
    typeof item.gasUsed === "number" &&
    Number.isFinite(item.gasUsed) &&
    typeof item.confirmationMs === "number" &&
    Number.isFinite(item.confirmationMs) &&
    typeof item.caughtAt === "string"
  );
}

export function readStoredFishingProgress(raw: string | null): FishingProgress {
  if (!raw) return initialFishingProgress;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const totalCatches = value.totalCatches;
    if (typeof totalCatches !== "number" || !Number.isInteger(totalCatches) || totalCatches < 0) {
      return initialFishingProgress;
    }
    if (value.version === 1) return migrateLegacyFishingProgress(value);
    if (value.version !== 2) return initialFishingProgress;
    const storedCollection = value.collection;
    if (!storedCollection || typeof storedCollection !== "object") return initialFishingProgress;
    const collection = emptyCollection();
    for (const fish of FISH_SPECIES) {
      const entry = (storedCollection as Record<string, unknown>)[fish.id];
      if (!entry || typeof entry !== "object") return initialFishingProgress;
      const count = (entry as Partial<FishCollectionEntry>).count;
      const firstCaughtAt = (entry as Partial<FishCollectionEntry>).firstCaughtAt;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return initialFishingProgress;
      collection[fish.id] = {
        count,
        firstCaughtAt: typeof firstCaughtAt === "string" ? firstCaughtAt : null,
      };
    }
    const history = Array.isArray(value.history)
      ? value.history.filter((entry): entry is FishingCatch => {
          const item = entry as Partial<FishingCatch>;
          return isFishId(item.fishId) && isReceipt(item);
        }).slice(0, 12)
      : [];
    return {
      version: 2,
      totalCatches,
      collection,
      history,
    };
  } catch {
    return initialFishingProgress;
  }
}

type LegacyFishId = "parallel-fish" | "fast-finality-fish" | "evm-compat-fish";

const LEGACY_FISH_MAP: Record<LegacyFishId, FishId> = {
  "parallel-fish": "pufferfish",
  "fast-finality-fish": "anchovy",
  "evm-compat-fish": "tuna",
};

function migrateLegacyFishingProgress(value: Record<string, unknown>): FishingProgress {
  const collection = emptyCollection();
  const legacyCollection = value.collection;
  if (!legacyCollection || typeof legacyCollection !== "object") return initialFishingProgress;

  for (const [legacyId, fishId] of Object.entries(LEGACY_FISH_MAP) as [LegacyFishId, FishId][]) {
    const entry = (legacyCollection as Record<string, unknown>)[legacyId];
    if (!entry || typeof entry !== "object") return initialFishingProgress;
    const count = (entry as Partial<FishCollectionEntry>).count;
    const firstCaughtAt = (entry as Partial<FishCollectionEntry>).firstCaughtAt;
    if (!Number.isInteger(count) || (count ?? -1) < 0) return initialFishingProgress;
    collection[fishId] = {
      count: count as number,
      firstCaughtAt: typeof firstCaughtAt === "string" ? firstCaughtAt : null,
    };
  }

  const history: FishingCatch[] = [];
  if (Array.isArray(value.history)) {
    for (const entry of value.history) {
      if (!entry || typeof entry !== "object") continue;
      const legacyFishId = (entry as { fishId?: unknown }).fishId;
      if (typeof legacyFishId !== "string" || !(legacyFishId in LEGACY_FISH_MAP) || !isReceipt(entry)) continue;
      history.push({ ...(entry as FishingReceipt), fishId: LEGACY_FISH_MAP[legacyFishId as LegacyFishId] });
    }
  }

  return {
    version: 2,
    totalCatches: value.totalCatches as number,
    collection,
    history: history.slice(0, 12),
  };
}
