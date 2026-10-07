import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateContractExp,
  contractProgressReducer,
  initialContractProgress,
  readStoredContractProgress,
} from "../app/game/contract-progress.ts";
import { coursePlotStatuses } from "../app/game/course-plots.ts";
import { fieldVisualStage } from "../app/game/progress.ts";

function reduce(actions) {
  return actions.reduce(contractProgressReducer, initialContractProgress);
}

const completeContractActions = [
  { type: "start-course" },
  { type: "clear-land" },
  { type: "plant" },
  { type: "complete-theory", chapter: 0 },
  { type: "complete-theory", chapter: 1 },
  { type: "complete-theory", chapter: 2 },
  { type: "complete-challenge", chapter: 0 },
  { type: "complete-challenge", chapter: 1 },
  { type: "complete-challenge", chapter: 2 },
  { type: "start-quiz" },
  { type: "pass-verification" },
  { type: "harvest" },
];

test("the smart contract course completes the third plot growth loop", () => {
  const progress = reduce(completeContractActions);
  assert.equal(progress.harvested, true);
  assert.equal(fieldVisualStage(progress), "harvested");
  assert.equal(calculateContractExp(progress), 255);
  assert.equal(progress.recentActivity[0], "收获合约晶果并完成三门首发课程");
});

test("smart contract progress rejects out-of-order farming and learning actions", () => {
  const progress = reduce([
    { type: "clear-land" },
    { type: "plant" },
    { type: "complete-theory", chapter: 0 },
    { type: "complete-challenge", chapter: 0 },
    { type: "pass-verification" },
    { type: "harvest" },
  ]);
  assert.deepEqual(progress, initialContractProgress);
});

test("starting and harvesting smart contract updates only plot three", () => {
  assert.deepEqual(coursePlotStatuses(true, true, true, true, false), {
    web3: "harvested",
    monad: "harvested",
    contract: "active",
  });
  assert.deepEqual(coursePlotStatuses(true, true, true, true, true), {
    web3: "harvested",
    monad: "harvested",
    contract: "harvested",
  });
});

test("stored smart contract progress accepts only the exact versioned shape", () => {
  const progress = reduce(completeContractActions.slice(0, 6));
  assert.deepEqual(readStoredContractProgress(JSON.stringify(progress)), progress);
  assert.deepEqual(readStoredContractProgress('{"version":2}'), initialContractProgress);
  assert.deepEqual(readStoredContractProgress("broken"), initialContractProgress);
});

test("the third course uses its exact crop sheet and live NFT claim flow", async () => {
  const source = await readFile(new URL("../app/game/FarmGame.tsx", import.meta.url), "utf8");
  const claimSource = await readFile(new URL("../app/game/NftClaimPanel.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\/art\/crops\/contract-scroll-growth-sheet-v1\.png/);
  assert.match(source, /\/art\/badges\/contract-builder-nft-v1\.png/);
  assert.match(source, /courseId="contract"/);
  assert.match(claimSource, /平台代付 Gas 并铸造/);
  assert.match(claimSource, /在区块浏览器查看/);
});
