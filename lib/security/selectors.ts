// =============================================================================
// 函数选择器表与已知合约白名单
// 纯数据模块：不访问 DOM / D1 / RPC / LLM。
// =============================================================================

export type SelectorKind =
  | "ERC20_APPROVE"
  | "ERC20_TRANSFER"
  | "ERC20_TRANSFER_FROM"
  | "ERC20_PERMIT"
  | "ERC721_APPROVE"
  | "ERC721_SET_APPROVAL_FOR_ALL"
  | "ERC721_TRANSFER"
  | "MINT"
  | "NATIVE_DEPOSIT"
  | "NATIVE_WITHDRAW"
  | "VIEW"
  | "UNKNOWN";

export type SelectorDefinition = {
  selector: string;
  signature: string;
  name: string;
  kind: SelectorKind;
  /** 参数中文说明，用于 UI 第二层解释 */
  argLabels: string[];
};

/**
 * P0 只覆盖常见 ERC20 / ERC721 / permit / 教学合约方法，
 * 不做万能 EVM 模拟器。
 */
export const KNOWN_SELECTORS: Record<string, SelectorDefinition> = {
  "0x095ea7b3": {
    selector: "0x095ea7b3",
    signature: "approve(address,uint256)",
    name: "approve",
    kind: "ERC20_APPROVE",
    argLabels: ["spender 授权对象", "amount 授权额度"],
  },
  "0xa9059cbb": {
    selector: "0xa9059cbb",
    signature: "transfer(address,uint256)",
    name: "transfer",
    kind: "ERC20_TRANSFER",
    argLabels: ["to 接收地址", "amount 转账数量"],
  },
  "0x23b872dd": {
    selector: "0x23b872dd",
    signature: "transferFrom(address,address,uint256)",
    name: "transferFrom",
    kind: "ERC20_TRANSFER_FROM",
    argLabels: ["from 支出地址", "to 接收地址", "amount 转账数量"],
  },
  "0xd505accf": {
    selector: "0xd505accf",
    signature: "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
    name: "permit",
    kind: "ERC20_PERMIT",
    argLabels: [
      "owner 签名者",
      "spender 授权对象",
      "value 授权额度",
      "deadline 过期时间",
      "v/r/s 签名分量",
    ],
  },
  "0xa22cb465": {
    selector: "0xa22cb465",
    signature: "setApprovalForAll(address,bool)",
    name: "setApprovalForAll",
    kind: "ERC721_SET_APPROVAL_FOR_ALL",
    argLabels: ["operator 被授权方", "approved 是否授权"],
  },
  "0x42842e0e": {
    selector: "0x42842e0e",
    signature: "safeTransferFrom(address,address,uint256)",
    name: "safeTransferFrom",
    kind: "ERC721_TRANSFER",
    argLabels: ["from 转出地址", "to 接收地址", "tokenId NFT 编号"],
  },
  "0xb88d4fde": {
    selector: "0xb88d4fde",
    signature: "safeTransferFrom(address,address,uint256,bytes)",
    name: "safeTransferFrom",
    kind: "ERC721_TRANSFER",
    argLabels: ["from 转出地址", "to 接收地址", "tokenId NFT 编号", "data 回调数据"],
  },
  "0x40c10f19": {
    selector: "0x40c10f19",
    signature: "mint(address,uint256)",
    name: "mint",
    kind: "MINT",
    argLabels: ["to 铸造对象", "amount 铸造数量"],
  },
  "0x6a627842": {
    selector: "0x6a627842",
    signature: "mint(address)",
    name: "mint",
    kind: "MINT",
    argLabels: ["to 铸造对象"],
  },
  "0xd0e30db0": {
    selector: "0xd0e30db0",
    signature: "deposit()",
    name: "deposit",
    kind: "NATIVE_DEPOSIT",
    argLabels: [],
  },
  "0x3ccfd60b": {
    selector: "0x3ccfd60b",
    signature: "withdraw()",
    name: "withdraw",
    kind: "NATIVE_WITHDRAW",
    argLabels: [],
  },
  "0x2e1a7d4d": {
    selector: "0x2e1a7d4d",
    signature: "withdraw(uint256)",
    name: "withdraw",
    kind: "NATIVE_WITHDRAW",
    argLabels: ["amount 提取数量"],
  },
  "0x8da5cb5b": {
    selector: "0x8da5cb5b",
    signature: "owner()",
    name: "owner",
    kind: "VIEW",
    argLabels: [],
  },
  "0x70a08231": {
    selector: "0x70a08231",
    signature: "balanceOf(address)",
    name: "balanceOf",
    kind: "VIEW",
    argLabels: ["owner 查询地址"],
  },
};

/** 已知合约白名单：lowercase 地址 -> 人类可读名称 */
export const KNOWN_COURSE_CONTRACTS: Record<string, string> = {
  "0xc96a7087cfbbe5eb6f6f81a0905ad7a4d1375a5f":
    "MonadPixelFarmBadge（课程徽章 · 已验证）",
  // 教学沙箱合约（仅测试网/本地，无真实资金）
  "0x0000000000000000000000000000000000005eed":
    "SeedShop（教学种子小铺 · 沙箱）",
  "0x000000000000000000000000000000000000ba5e":
    "GreenhouseVault（教学审计靶场 · 沙箱）",
};

export function lookupSelector(selector: string | null) {
  if (!selector) return null;
  return KNOWN_SELECTORS[selector.toLowerCase()] ?? null;
}

export function isKnownCourseContract(address: string | null, extra: Record<string, string> = {}) {
  if (!address) return null;
  const key = address.toLowerCase();
  return extra[key] ?? KNOWN_COURSE_CONTRACTS[key] ?? null;
}
