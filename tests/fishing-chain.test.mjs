import assert from "node:assert/strict";
import test from "node:test";

import {
  FISHING_CHAIN,
  fishingTransactionUrl,
  formatFishingWalletAddress,
} from "../app/game/fishing-chain.ts";

test("fishing uses the current official Monad Testnet endpoints", () => {
  assert.equal(FISHING_CHAIN.id, 10143);
  assert.equal(FISHING_CHAIN.currency, "MON");
  assert.equal(FISHING_CHAIN.rpcUrl, "https://testnet-rpc.monad.xyz");
  assert.equal(FISHING_CHAIN.explorerUrl, "https://testnet.monadscan.com");
});

test("wallet and explorer labels preserve exact on-chain identifiers", () => {
  const address = "0x1234567890abcdef1234567890abcdef12345678";
  const hash = `0x${"ab".repeat(32)}`;
  assert.equal(formatFishingWalletAddress(address), "0x1234…5678");
  assert.equal(
    fishingTransactionUrl(hash),
    `https://testnet.monadscan.com/tx/${hash}`,
  );
});
