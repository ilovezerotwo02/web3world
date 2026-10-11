export type ForgeSlot = "head" | "body" | "tool";

export type ForgeQuestion = {
  prompt: string;
  hint: string;
  options: Array<{ id: string; label: string }>;
  answer: string;
};

export type ForgeItem = {
  id: string;
  name: string;
  slot: ForgeSlot;
  slotLabel: string;
  material: string;
  description: string;
  bonus: string;
  artClass: string;
  question: ForgeQuestion;
};

export type ForgeState = {
  unlocked: string[];
  equipped: Record<ForgeSlot, string | null>;
  answered: number;
};

export type ForgeAction =
  | { type: "forge"; itemId: string }
  | { type: "equip"; itemId: string }
  | { type: "unequip"; slot: ForgeSlot }
  | { type: "reset" };

export const FORGE_STORAGE_KEY = "web3world:v1:forge";

export const FORGE_ITEMS: ForgeItem[] = [
  {
    id: "ledger-helm",
    name: "账本矿工头盔",
    slot: "head",
    slotLabel: "头部",
    material: "紫晶铁",
    description: "护目镜会在 Chain ID 不一致时闪烁，提醒你先确认网络再签名。",
    bonus: "识别跨链重放风险",
    artClass: "forge-helm",
    question: {
      prompt: "Chain ID 在钱包交易里最重要的作用是什么？",
      hint: "想一想：同一笔签名能不能被拿到另一条链重放？",
      options: [
        { id: "a", label: "标记目标网络，避免签名在另一条链被重放" },
        { id: "b", label: "决定钱包头像的颜色" },
        { id: "c", label: "让交易自动获得更多 Gas" },
      ],
      answer: "a",
    },
  },
  {
    id: "rpc-mail",
    name: "RPC 远行胸甲",
    slot: "body",
    slotLabel: "身体",
    material: "回执钢板",
    description: "胸甲上的节点刻纹只接受明确的 RPC 来源，陌生请求不会直接穿透。",
    bonus: "核对 RPC、网络与回执来源",
    artClass: "forge-chest",
    question: {
      prompt: "收到一个要求无限 approve 的签名请求，最稳妥的第一步是什么？",
      hint: "不要被“领取奖励”的文案催着点击。",
      options: [
        { id: "a", label: "先查看 spender、额度、网络和方法，再决定拒绝或限制授权" },
        { id: "b", label: "只要网站有漂亮动画就直接签名" },
        { id: "c", label: "把助记词发给客服，让对方代为确认" },
      ],
      answer: "a",
    },
  },
  {
    id: "sign-pickaxe",
    name: "签名守卫镐",
    slot: "tool",
    slotLabel: "工具",
    material: "验证矿晶",
    description: "镐尖会先敲出权限范围，再让你确认真正要签的 calldata。",
    bonus: "识别 approve、setApprovalForAll 与危险外部调用",
    artClass: "forge-pickaxe",
    question: {
      prompt: "修复重入风险时，哪种顺序最符合 Checks-Effects-Interactions？",
      hint: "先把内部状态写稳，再把控制权交给外部合约。",
      options: [
        { id: "a", label: "先检查条件，再更新状态，最后进行外部调用" },
        { id: "b", label: "先外部调用，等对方返回后再决定余额" },
        { id: "c", label: "删除所有检查，让交易更快" },
      ],
      answer: "a",
    },
  },
];

export const initialForgeState: ForgeState = {
  unlocked: [],
  equipped: {
    head: null,
    body: null,
    tool: null,
  },
  answered: 0,
};

function isSlot(value: string): value is ForgeSlot {
  return value === "head" || value === "body" || value === "tool";
}

export function getForgeItem(itemId: string) {
  return FORGE_ITEMS.find((item) => item.id === itemId) ?? null;
}

export function readStoredForgeState(raw: string | null): ForgeState {
  if (!raw) return initialForgeState;
  try {
    const parsed = JSON.parse(raw) as Partial<ForgeState>;
    const unlocked = Array.isArray(parsed.unlocked)
      ? parsed.unlocked.filter((itemId): itemId is string => typeof itemId === "string" && Boolean(getForgeItem(itemId)))
      : [];
    const equipped = { ...initialForgeState.equipped };
    if (parsed.equipped && typeof parsed.equipped === "object") {
      for (const slot of Object.keys(equipped) as ForgeSlot[]) {
        const value = parsed.equipped[slot];
        if (typeof value === "string" && unlocked.includes(value) && getForgeItem(value)?.slot === slot) {
          equipped[slot] = value;
        }
      }
    }
    return {
      unlocked: Array.from(new Set(unlocked)),
      equipped,
      answered: typeof parsed.answered === "number" && Number.isFinite(parsed.answered)
        ? Math.max(0, Math.floor(parsed.answered))
        : unlocked.length,
    };
  } catch {
    return initialForgeState;
  }
}

export function forgeReducer(state: ForgeState, action: ForgeAction): ForgeState {
  if (action.type === "reset") return initialForgeState;

  if (action.type === "forge") {
    const item = getForgeItem(action.itemId);
    if (!item) return state;
    if (state.unlocked.includes(item.id)) return state;
    return {
      ...state,
      unlocked: [...state.unlocked, item.id],
      answered: state.answered + 1,
    };
  }

  if (action.type === "unequip" && isSlot(action.slot)) {
    return {
      ...state,
      equipped: {
        ...state.equipped,
        [action.slot]: null,
      },
    };
  }

  if (action.type !== "equip") return state;
  const item = getForgeItem(action.itemId);
  if (!item || !state.unlocked.includes(item.id)) return state;

  return {
    ...state,
    equipped: {
      ...state.equipped,
      [item.slot]: item.id,
    },
  };
}
