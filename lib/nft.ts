import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  getAddress,
  http,
  isAddress,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MONAD_TESTNET } from "./monad-chain";

export const badgeAbi = [
  {
    type: "function",
    name: "hasBadge",
    inputs: [
      { name: "owner", type: "address", internalType: "address" },
      { name: "typeId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBadgeType",
    inputs: [{ name: "typeId", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "name", type: "string", internalType: "string" },
      { name: "description", type: "string", internalType: "string" },
      { name: "uri", type: "string", internalType: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokensOfOwner",
    inputs: [{ name: "owner", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256[]", internalType: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenBadgeType",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minters",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address", internalType: "address" },
      { name: "typeId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMinter",
    inputs: [
      { name: "account", type: "address", internalType: "address" },
      { name: "isMinter_", type: "bool", internalType: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "BadgeMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "typeId", type: "uint256", indexed: true },
      { name: "to", type: "address", indexed: true },
    ],
  },
] as const;

export const BADGE_TYPE_IDS = {
  "web3-intro": 0,
  "monad-basics": 1,
  "smart-contracts": 2,
} as const;

export const COURSE_TO_BADGE_TYPE = {
  web3: BADGE_TYPE_IDS["web3-intro"],
  monad: BADGE_TYPE_IDS["monad-basics"],
  contract: BADGE_TYPE_IDS["smart-contracts"],
} as const;

export type BadgeCourseId = keyof typeof COURSE_TO_BADGE_TYPE;

export function isBadgeCourseId(value: string): value is BadgeCourseId {
  return Object.prototype.hasOwnProperty.call(COURSE_TO_BADGE_TYPE, value);
}

export function getBadgeContractAddress(): Address {
  const value = process.env.BADGE_CONTRACT_ADDRESS ??
    process.env.NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS;
  if (!value || !isAddress(value) || getAddress(value) === zeroAddress) {
    throw new Error("BADGE_CONTRACT_ADDRESS 未配置为有效的非零合约地址");
  }
  return getAddress(value);
}

export function getBadgeExplorerUrl(txHash: Hash) {
  return `${MONAD_TESTNET.blockExplorers.default.url}/tx/${txHash}`;
}

export function getBadgePublicClient() {
  return createPublicClient({
    chain: MONAD_TESTNET,
    transport: http(
      process.env.MONAD_RPC_URL ?? MONAD_TESTNET.rpcUrls.default.http[0],
    ),
  });
}

export function getBadgeWalletClient() {
  const privateKey = process.env.MINTER_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("MINTER_PRIVATE_KEY 未配置为有效的 32 字节私钥");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return {
    client: createWalletClient({
      account,
      chain: MONAD_TESTNET,
      transport: http(
        process.env.MONAD_RPC_URL ?? MONAD_TESTNET.rpcUrls.default.http[0],
      ),
    }),
    account,
  };
}

export async function checkHasBadge(owner: Address, typeId: number) {
  return getBadgePublicClient().readContract({
    address: getBadgeContractAddress(),
    abi: badgeAbi,
    functionName: "hasBadge",
    args: [owner, BigInt(typeId)],
  });
}

export async function findBadgeTokenId(owner: Address, typeId: number) {
  const client = getBadgePublicClient();
  const address = getBadgeContractAddress();
  const tokenIds = await client.readContract({
    address,
    abi: badgeAbi,
    functionName: "tokensOfOwner",
    args: [owner],
  });
  for (const tokenId of tokenIds) {
    const storedTypeId = await client.readContract({
      address,
      abi: badgeAbi,
      functionName: "tokenBadgeType",
      args: [tokenId],
    });
    if (storedTypeId === BigInt(typeId)) return tokenId;
  }
  return null;
}

export type MintBadgeResult = {
  tokenId: bigint;
  txHash: Hash;
  contractAddress: Address;
};

export async function mintBadge(
  to: Address,
  typeId: number,
): Promise<MintBadgeResult> {
  const publicClient = getBadgePublicClient();
  const contractAddress = getBadgeContractAddress();
  const { client, account } = getBadgeWalletClient();
  const [authorized, owner] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: badgeAbi,
      functionName: "minters",
      args: [account.address],
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: badgeAbi,
      functionName: "owner",
    }),
  ]);
  if (!authorized && getAddress(owner) !== getAddress(account.address)) {
    throw new Error("平台铸造钱包没有合约 minter 权限");
  }

  const { request } = await publicClient.simulateContract({
    address: contractAddress,
    abi: badgeAbi,
    functionName: "mint",
    args: [to, BigInt(typeId)],
    account,
  });
  const txHash = await client.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("徽章铸造交易执行失败");
  }

  for (const log of receipt.logs) {
    if (getAddress(log.address) !== contractAddress) continue;
    try {
      const decoded = decodeEventLog({
        abi: badgeAbi,
        eventName: "BadgeMinted",
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.args.typeId === BigInt(typeId) &&
        getAddress(decoded.args.to) === getAddress(to)
      ) {
        return {
          tokenId: decoded.args.tokenId,
          txHash,
          contractAddress,
        };
      }
    } catch {
      // Ignore unrelated logs in the same receipt.
    }
  }
  throw new Error("交易已确认，但未找到匹配的 BadgeMinted 事件");
}
