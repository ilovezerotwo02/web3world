import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import {
  FISH_SPECIES,
  FISHING_STORAGE_KEY,
  createDemoFishingReceipt,
  fishForCast,
  hashChoices,
  hashSuffix,
  initialFishingProgress,
  latestChainFishingReceipt,
  readStoredFishingProgress,
  recordFishingCatch,
} from "../app/game/fishing.ts";

test("ten fishing casts unlock the ten exact fish species in order", () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => fishForCast(index).id),
    [
      "pufferfish",
      "anchovy",
      "tuna",
      "sardine",
      "red-snapper",
      "largemouth-bass",
      "smallmouth-bass",
      "rainbow-trout",
      "salmon",
      "walleye",
    ],
  );
  assert.equal(fishForCast(10).id, "pufferfish");
  assert.deepEqual(FISH_SPECIES.map((fish) => fish.name), ["河豚", "鳀鱼", "金枪鱼", "沙丁鱼", "鲷鱼", "大嘴鲈鱼", "小嘴鲈鱼", "虹鳟鱼", "鲑鱼", "大眼鱼"]);
});

test("every fish species resolves to an exact transparent pixel sprite", async () => {
  assert.equal(new Set(FISH_SPECIES.map((fish) => fish.spriteSrc)).size, 10);
  await Promise.all(FISH_SPECIES.map((fish) => access(new URL(`../public${fish.spriteSrc}`, import.meta.url))));
});

test("hash verification always includes one exact receipt suffix", () => {
  const receipt = createDemoFishingReceipt(0);
  const choices = hashChoices(receipt.txHash);
  assert.equal(choices.length, 2);
  assert.equal(choices.filter((choice) => choice === hashSuffix(receipt.txHash)).length, 1);
  assert.notEqual(choices[0], choices[1]);
});

test("a receipt can enter the collection only once", () => {
  const receipt = createDemoFishingReceipt(0);
  const first = recordFishingCatch(initialFishingProgress, "pufferfish", receipt);
  const repeated = recordFishingCatch(first, "pufferfish", receipt);
  assert.equal(first.totalCatches, 1);
  assert.equal(first.collection.pufferfish.count, 1);
  assert.deepEqual(repeated, first);
});

test("the recent chain receipt skips newer demo-only catches", () => {
  const chainReceipt = {
    ...createDemoFishingReceipt(3),
    mode: "chain",
    txHash: `0x${"ab".repeat(32)}`,
  };
  const withChainReceipt = recordFishingCatch(initialFishingProgress, "sardine", chainReceipt);
  const withNewerDemoCatch = recordFishingCatch(
    withChainReceipt,
    "red-snapper",
    createDemoFishingReceipt(4),
  );

  assert.equal(latestChainFishingReceipt(withNewerDemoCatch)?.txHash, chainReceipt.txHash);
  assert.equal(latestChainFishingReceipt(initialFishingProgress), null);
});

test("stored fishing progress restores only the exact versioned structure", () => {
  const receipt = createDemoFishingReceipt(1);
  const progress = recordFishingCatch(initialFishingProgress, "anchovy", receipt);
  assert.deepEqual(readStoredFishingProgress(JSON.stringify(progress)), progress);
  assert.deepEqual(readStoredFishingProgress('{"version":3}'), initialFishingProgress);
  assert.equal(FISHING_STORAGE_KEY, "monad-pixel-farm:v40:fishing-progress");
});

test("version one fishing progress migrates its three exact legacy fish records", () => {
  const receipt = createDemoFishingReceipt(2);
  const legacy = {
    version: 1,
    totalCatches: 3,
    collection: {
      "parallel-fish": { count: 1, firstCaughtAt: receipt.caughtAt },
      "fast-finality-fish": { count: 1, firstCaughtAt: receipt.caughtAt },
      "evm-compat-fish": { count: 1, firstCaughtAt: receipt.caughtAt },
    },
    history: [{ ...receipt, fishId: "evm-compat-fish" }],
  };
  const migrated = readStoredFishingProgress(JSON.stringify(legacy));
  assert.equal(migrated.version, 2);
  assert.equal(migrated.totalCatches, 3);
  assert.equal(migrated.collection.pufferfish.count, 1);
  assert.equal(migrated.collection.anchovy.count, 1);
  assert.equal(migrated.collection.tuna.count, 1);
  assert.equal(migrated.history[0].fishId, "tuna");
});
