import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { compileBadgeContract } from "./badge-contract.mjs";

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("PRIVATE_KEY must be a 32-byte hex value prefixed with 0x.");
}

const rpcUrl = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const metadataBaseUrl = (
  process.env.BADGE_METADATA_BASE_URL ??
  "https://monad-pixel-farm.sushengi.workers.dev/api/nft/metadata"
).replace(/\/$/, "");

const chain = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: { name: "Monadscan", url: "https://testnet.monadscan.com" },
  },
  testnet: true,
};

const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ account, chain, transport });
const chainId = await publicClient.getChainId();
if (chainId !== chain.id) {
  throw new Error(`Refusing deployment: expected chain ${chain.id}, received ${chainId}.`);
}

const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) {
  throw new Error(`Deployment account ${account.address} has no testnet MON.`);
}

const compiled = compileBadgeContract();
const deployHash = await walletClient.deployContract({
  abi: compiled.abi,
  bytecode: compiled.bytecode,
  args: ["Monad Pixel Farm Learning Badges", "MPFB"],
  account,
});
const deployReceipt = await publicClient.waitForTransactionReceipt({
  hash: deployHash,
  confirmations: 1,
});
if (deployReceipt.status !== "success" || !deployReceipt.contractAddress) {
  throw new Error(`Contract deployment failed: ${deployHash}`);
}

const contractAddress = deployReceipt.contractAddress;
const names = ["账本守护者", "Monad 探索者", "合约建造师"];
const descriptions = [
  "完成 Monad 像素农场 Web3 通识课程的不可转让学习徽章。",
  "完成 Monad 像素农场 Monad 基础课程的不可转让学习徽章。",
  "完成 Monad 像素农场智能合约课程的不可转让学习徽章。",
];
const uris = [0, 1, 2].map((typeId) => `${metadataBaseUrl}/${typeId}`);

const initializeHash = await walletClient.writeContract({
  address: contractAddress,
  abi: compiled.abi,
  functionName: "createBadgeTypes",
  args: [names, descriptions, uris],
  account,
});
const initializeReceipt = await publicClient.waitForTransactionReceipt({
  hash: initializeHash,
  confirmations: 1,
});
if (initializeReceipt.status !== "success") {
  throw new Error(`Badge type initialization failed: ${initializeHash}`);
}

const minterHash = await walletClient.writeContract({
  address: contractAddress,
  abi: compiled.abi,
  functionName: "setMinter",
  args: [account.address, true],
  account,
});
const minterReceipt = await publicClient.waitForTransactionReceipt({
  hash: minterHash,
  confirmations: 1,
});
if (minterReceipt.status !== "success") {
  throw new Error(`Platform minter configuration failed: ${minterHash}`);
}

const nextBadgeTypeId = await publicClient.readContract({
  address: contractAddress,
  abi: compiled.abi,
  functionName: "nextBadgeTypeId",
});
if (nextBadgeTypeId !== 3n) {
  throw new Error(`Expected three badge types, received ${nextBadgeTypeId}.`);
}
const platformMinterEnabled = await publicClient.readContract({
  address: contractAddress,
  abi: compiled.abi,
  functionName: "minters",
  args: [account.address],
});
if (!platformMinterEnabled) {
  throw new Error("Platform minter was not enabled after deployment.");
}

console.log(
  JSON.stringify(
    {
      network: chain.name,
      chainId,
      deployer: account.address,
      balanceMONBeforeDeploy: formatEther(balance),
      contractAddress,
      deployHash,
      initializeHash,
      minterHash,
      platformMinterEnabled,
      badgeTypes: names.map((name, typeId) => ({ typeId, name, uri: uris[typeId] })),
    },
    null,
    2,
  ),
);
