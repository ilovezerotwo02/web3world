import {
  BaseError,
  SwitchChainError,
  UserRejectedRequestError,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import { MONAD_TESTNET } from "../../lib/monad-chain";
import type { FishingReceipt } from "./fishing";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export const FISHING_CHAIN = {
  id: MONAD_TESTNET.id,
  name: MONAD_TESTNET.name,
  currency: MONAD_TESTNET.nativeCurrency.symbol,
  rpcUrl: MONAD_TESTNET.rpcUrls.default.http[0],
  explorerUrl: MONAD_TESTNET.blockExplorers.default.url,
} as const;

export type FishingWalletSnapshot = {
  address: Address;
  chainId: number;
};

function getInjectedProvider() {
  return typeof window === "undefined" ? undefined : window.ethereum;
}

function createInjectedWallet(provider: EIP1193Provider) {
  return createWalletClient({
    chain: MONAD_TESTNET,
    transport: custom(provider),
  });
}

export function hasInjectedFishingWallet() {
  return Boolean(getInjectedProvider());
}

export function formatFishingWalletAddress(address: Address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function fishingTransactionUrl(hash: Hash) {
  return `${FISHING_CHAIN.explorerUrl}/tx/${hash}`;
}

export function fishingWalletErrorMessage(caught: unknown, fallback: string) {
  if (caught instanceof UserRejectedRequestError) return "你取消了钱包请求，没有产生任何交易。";
  if (caught instanceof BaseError) return caught.shortMessage;
  if (caught instanceof Error) return caught.message;
  return fallback;
}

export async function readConnectedFishingWallet(): Promise<FishingWalletSnapshot | null> {
  const provider = getInjectedProvider();
  if (!provider) return null;
  const wallet = createInjectedWallet(provider);
  const [address] = await wallet.getAddresses();
  if (!address) return null;
  return { address, chainId: await wallet.getChainId() };
}

export async function connectFishingWallet(): Promise<FishingWalletSnapshot> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("没有检测到浏览器钱包，请先安装支持 EVM 的钱包扩展。");
  }
  const wallet = createInjectedWallet(provider);
  const [address] = await wallet.requestAddresses();
  if (!address) throw new Error("钱包没有返回可用账户。");
  return { address, chainId: await wallet.getChainId() };
}

export async function switchFishingWalletToMonad(): Promise<FishingWalletSnapshot> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("没有检测到浏览器钱包，请先安装支持 EVM 的钱包扩展。");
  }
  const wallet = createInjectedWallet(provider);
  try {
    await wallet.switchChain({ id: MONAD_TESTNET.id });
  } catch (caught) {
    if (!(caught instanceof SwitchChainError)) throw caught;
    await wallet.addChain({ chain: MONAD_TESTNET });
    await wallet.switchChain({ id: MONAD_TESTNET.id });
  }
  const [address] = await wallet.getAddresses();
  if (!address) throw new Error("请先连接钱包账户。");
  return { address, chainId: await wallet.getChainId() };
}

export function watchFishingWallet(onChange: () => void) {
  const provider = getInjectedProvider();
  if (!provider) return () => undefined;
  const handleAccountsChanged = () => onChange();
  const handleChainChanged = () => onChange();
  const handleDisconnect = () => onChange();
  provider.on("accountsChanged", handleAccountsChanged);
  provider.on("chainChanged", handleChainChanged);
  provider.on("disconnect", handleDisconnect);
  return () => {
    provider.removeListener("accountsChanged", handleAccountsChanged);
    provider.removeListener("chainChanged", handleChainChanged);
    provider.removeListener("disconnect", handleDisconnect);
  };
}

export async function performRealFishingCast(
  account: Address,
  onBroadcast: (hash: Hash) => void,
): Promise<FishingReceipt> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("没有检测到浏览器钱包，请先安装支持 EVM 的钱包扩展。");
  }

  const wallet = createInjectedWallet(provider);
  const accounts = await wallet.getAddresses();
  if (!accounts.some((address) => address.toLowerCase() === account.toLowerCase())) {
    throw new Error("当前钱包账户已经变化，请重新连接后再试。");
  }
  const currentChainId = await wallet.getChainId();
  if (currentChainId !== MONAD_TESTNET.id) {
    throw new Error(`请先把钱包切换到 ${FISHING_CHAIN.name}。`);
  }

  const startedAt = performance.now();
  const hash = await wallet.sendTransaction({
    account,
    chain: MONAD_TESTNET,
    to: account,
    value: 0n,
  });
  onBroadcast(hash);

  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 120_000,
      pollingInterval: 2_000,
    });
  } catch {
    const publicFallback = createPublicClient({
      chain: MONAD_TESTNET,
      transport: http("https://testnet-rpc.monad.xyz"),
    });
    receipt = await publicFallback.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: 120_000,
      pollingInterval: 2_000,
    });
  }
  return {
    mode: "chain",
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: Number(receipt.gasUsed),
    confirmationMs: Math.max(1, Math.round(performance.now() - startedAt)),
    caughtAt: new Date().toISOString(),
  };
}
