import {
  SwitchChainError,
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  zeroAddress,
  type Address,
  type EIP1193Provider,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { MONAD_TESTNET } from "../../lib/monad-chain";

export const CONTRACTS = {
  kuruRouter: "0x7EFbE105Ca7415dE98F96622173458ac1c054630",
  kuruMarket: "0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9",
  usdc: "0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570",
  aprMon: "0xb2f82d0f38dc453d596ad40a37799446cc89274a",
} as const satisfies Record<string, Address>;

export const RPC_URL = MONAD_TESTNET.rpcUrls.default.http[0];
export const isMossConfigured = false;

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 value) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const kuruMarketAbi = parseAbi([
  "function getMarketParams() view returns (uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)",
  "function placeAndExecuteMarketBuy(uint96 quoteSize,uint256 minAmountOut,bool isMargin,bool isFillOrKill) payable returns (uint256)",
]);

const aprMonAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function deposit() payable",
]);

export type WalletConnection = {
  address: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
};

export type ChainSnapshot = {
  chainId: number;
  blockNumber: bigint;
  mon: bigint;
  usdc: bigint;
  aprMon: bigint;
  usdcDecimals: number;
};

export type VerifiedTransaction = {
  hash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
  before: bigint;
  after: bigint;
  delta: bigint;
};

export function makePublicClient() {
  return createPublicClient({
    chain: {
      ...MONAD_TESTNET,
      rpcUrls: {
        default: { http: [RPC_URL] },
      },
    },
    transport: http(RPC_URL),
  });
}

export async function connectInjectedWallet(): Promise<WalletConnection> {
  const provider = (
    window as unknown as { ethereum?: EIP1193Provider }
  ).ethereum;
  if (!provider) {
    throw new Error("未检测到浏览器钱包。请安装支持 Monad Testnet 的 EVM 钱包。");
  }

  const chain = {
    ...MONAD_TESTNET,
    rpcUrls: {
      default: { http: [RPC_URL] },
    },
  } as const;
  const walletClient = createWalletClient({
    chain,
    transport: custom(provider),
  });
  const [address] = await walletClient.requestAddresses();
  if (!address) throw new Error("钱包没有返回可用账户。");

  const chainId = await walletClient.getChainId();
  if (chainId !== MONAD_TESTNET.id) {
    try {
      await walletClient.switchChain({ id: MONAD_TESTNET.id });
    } catch (caught) {
      if (!(caught instanceof SwitchChainError)) throw caught;
      await walletClient.addChain({ chain: MONAD_TESTNET });
      await walletClient.switchChain({ id: MONAD_TESTNET.id });
    }
  }

  return { address, walletClient, publicClient: makePublicClient() };
}

export async function readSnapshot(
  client: PublicClient,
  address: Address,
): Promise<ChainSnapshot> {
  const [chainId, blockNumber, mon, usdc, aprMon, usdcDecimals] =
    await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
      client.getBalance({ address }),
      client.readContract({
        address: CONTRACTS.usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
      client.readContract({
        address: CONTRACTS.aprMon,
        abi: aprMonAbi,
        functionName: "balanceOf",
        args: [address],
      }),
      client.readContract({
        address: CONTRACTS.usdc,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);

  return {
    chainId,
    blockNumber,
    mon,
    usdc,
    aprMon,
    usdcDecimals,
  };
}

function decimalPlacesForPrecision(precision: bigint) {
  let value = precision;
  let places = 0;
  while (value > 1n && value % 10n === 0n) {
    value /= 10n;
    places += 1;
  }
  if (value !== 1n) {
    throw new Error("Kuru pricePrecision 不是 10 的整数次幂。");
  }
  return places;
}

export async function quoteKuruBuy(
  client: PublicClient,
  usdcAmount: string,
) {
  const params = await client.readContract({
    address: CONTRACTS.kuruMarket,
    abi: kuruMarketAbi,
    functionName: "getMarketParams",
  });
  const [
    pricePrecision,
    ,
    baseAssetAddress,
    baseAssetDecimals,
    quoteAssetAddress,
    quoteAssetDecimals,
  ] = params;

  if (baseAssetAddress.toLowerCase() !== zeroAddress) {
    throw new Error("当前 Kuru 市场的 baseAsset 不是原生 MON。");
  }
  if (quoteAssetAddress.toLowerCase() !== CONTRACTS.usdc.toLowerCase()) {
    throw new Error("当前 Kuru 市场的 quoteAsset 不是配置中的 USDC。");
  }

  const precisionPlaces = decimalPlacesForPrecision(BigInt(pricePrecision));
  const quoteSize = parseUnits(usdcAmount, precisionPlaces);
  const { result } = await client.simulateContract({
    address: CONTRACTS.kuruMarket,
    abi: kuruMarketAbi,
    functionName: "placeAndExecuteMarketBuy",
    args: [quoteSize, 0n, false, false],
    account: zeroAddress,
  });

  const output = BigInt(result);
  return {
    output,
    minOutput: (output * 9950n) / 10000n,
    quoteSize,
    tokenAmount: parseUnits(usdcAmount, Number(quoteAssetDecimals)),
    baseDecimals: Number(baseAssetDecimals),
    quoteDecimals: Number(quoteAssetDecimals),
  };
}

export async function executeKuruBuy(
  connection: WalletConnection,
  usdcAmount: string,
  onApproval?: (hash: Hash) => void,
) {
  if (!isMossConfigured) {
    throw new Error("Moss Fork RPC 未配置，真实 Swap 已阻断。");
  }
  const { publicClient, walletClient, address } = connection;
  const quote = await quoteKuruBuy(publicClient, usdcAmount);
  const beforeUsdc = await publicClient.readContract({
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  const beforeMon = await publicClient.getBalance({ address });

  const approvalHash = await walletClient.writeContract({
    account: address,
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: "approve",
    args: [CONTRACTS.kuruMarket, quote.tokenAmount],
    chain: walletClient.chain,
  });
  onApproval?.(approvalHash);
  await publicClient.waitForTransactionReceipt({ hash: approvalHash });

  const hash = await walletClient.writeContract({
    account: address,
    address: CONTRACTS.kuruMarket,
    abi: kuruMarketAbi,
    functionName: "placeAndExecuteMarketBuy",
    args: [quote.quoteSize, quote.minOutput, false, true],
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  });
  if (receipt.status !== "success") throw new Error("Kuru Swap 回执为失败。");

  const [afterUsdc, afterMon] = await Promise.all([
    publicClient.readContract({
      address: CONTRACTS.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
    publicClient.getBalance({ address }),
  ]);
  if (afterUsdc >= beforeUsdc || afterMon <= beforeMon) {
    throw new Error("Swap 回执成功，但 USDC/MON 余额变化未通过验证。");
  }

  return {
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    before: beforeMon,
    after: afterMon,
    delta: afterMon - beforeMon,
  } satisfies VerifiedTransaction;
}

export async function quoteAprMon(client: PublicClient, assets: bigint) {
  return client.readContract({
    address: CONTRACTS.aprMon,
    abi: aprMonAbi,
    functionName: "convertToShares",
    args: [assets],
  });
}

export async function executeAprioriDeposit(
  connection: WalletConnection,
  assets: bigint,
) {
  if (!isMossConfigured) {
    throw new Error("Moss Fork RPC 未配置，真实质押已阻断。");
  }
  const { publicClient, walletClient, address } = connection;
  const [beforeMon, beforeAprMon] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: CONTRACTS.aprMon,
      abi: aprMonAbi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);

  const hash = await walletClient.writeContract({
    account: address,
    address: CONTRACTS.aprMon,
    abi: aprMonAbi,
    functionName: "deposit",
    value: assets,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  });
  if (receipt.status !== "success") throw new Error("aPriori 质押回执为失败。");

  const [afterMon, afterAprMon] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: CONTRACTS.aprMon,
      abi: aprMonAbi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  if (afterMon >= beforeMon || afterAprMon <= beforeAprMon) {
    throw new Error("质押回执成功，但 MON/aprMON 余额变化未通过验证。");
  }

  return {
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    before: beforeAprMon,
    after: afterAprMon,
    delta: afterAprMon - beforeAprMon,
  } satisfies VerifiedTransaction;
}

export function compactAddress(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "未连接";
}

export function displayAmount(value: bigint, decimals = 18, digits = 4) {
  const raw = decimals === 18 ? formatEther(value) : formatUnits(value, decimals);
  const number = Number(raw);
  if (!Number.isFinite(number)) return raw;
  return number.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
  });
}
