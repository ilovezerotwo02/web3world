import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateExp,
  fieldVisualStage,
  growthStage,
  initialProgress,
  progressReducer,
  readStoredProgress,
} from "../app/game/progress.ts";
import {
  fieldAssetForStage,
  ledgerStarCropAssetForStage,
  monadCropAssetForStage,
} from "../app/game/field-assets.ts";
import { COURSE_GRID_SLOTS, COURSE_PLOTS, courseGridSlots, coursePlotStatuses } from "../app/game/course-plots.ts";

function apply(progress, action) {
  return progressReducer(progress, action);
}

test("the Web3 course completes the full growth loop", () => {
  let progress = initialProgress;
  progress = apply(progress, { type: "start-course" });
  assert.equal(growthStage(progress), "种子入袋");

  progress = apply(progress, { type: "clear-land" });
  progress = apply(progress, { type: "plant" });
  assert.equal(growthStage(progress), "已播种");

  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-theory", chapter });
  }
  assert.equal(growthStage(progress), "已经发芽");

  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-challenge", chapter });
  }
  assert.equal(growthStage(progress), "已经开花");

  progress = apply(progress, { type: "start-quiz" });
  progress = apply(progress, { type: "pass-verification" });
  assert.equal(growthStage(progress), "已经结果");

  progress = apply(progress, { type: "harvest" });
  assert.equal(growthStage(progress), "已经收获");
  assert.equal(calculateExp(progress), 255);
});

test("field visuals follow all seven farm stages", () => {
  let progress = initialProgress;
  assert.equal(fieldVisualStage(progress), "wild");

  progress = apply(progress, { type: "start-course" });
  assert.equal(fieldVisualStage(progress), "wild");
  progress = apply(progress, { type: "clear-land" });
  assert.equal(fieldVisualStage(progress), "tilled");
  progress = apply(progress, { type: "plant" });
  assert.equal(fieldVisualStage(progress), "seeded");

  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-theory", chapter });
  }
  assert.equal(fieldVisualStage(progress), "sprout");

  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-challenge", chapter });
  }
  assert.equal(fieldVisualStage(progress), "bloom");

  progress = apply(progress, { type: "pass-verification" });
  assert.equal(fieldVisualStage(progress), "fruit");
  progress = apply(progress, { type: "harvest" });
  assert.equal(fieldVisualStage(progress), "harvested");
});

test("knowledge completion grows one plant in slot one without activating later course slots", () => {
  let progress = initialProgress;
  assert.equal(fieldVisualStage(progress), "wild");
  progress = apply(progress, { type: "start-course" });
  progress = apply(progress, { type: "clear-land" });
  progress = apply(progress, { type: "plant" });
  assert.equal(fieldVisualStage(progress), "seeded");
  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-theory", chapter });
  }
  assert.equal(fieldVisualStage(progress), "sprout");
  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-challenge", chapter });
  }
  assert.equal(fieldVisualStage(progress), "bloom");
  progress = apply(progress, { type: "pass-verification" });
  assert.equal(fieldVisualStage(progress), "fruit");
  assert.deepEqual(COURSE_PLOTS.map(({ id }) => id), ["web3", "monad", "contract"]);
  assert.deepEqual(coursePlotStatuses(false), {
    web3: "active",
    monad: "locked",
    contract: "locked",
  });
});

test("harvesting Web3 unlocks the Monad course plot and keeps the contract plot locked", () => {
  assert.deepEqual(coursePlotStatuses(true), {
    web3: "harvested",
    monad: "unlocked",
    contract: "locked",
  });
  assert.deepEqual(
    COURSE_PLOTS.map(({ title, seed, crop }) => [title, seed, crop]),
    [
      ["Web3 通识", "账本星种", "守护浆果"],
      ["Monad 基础", "并行紫藤种", "Monad 紫藤果"],
      ["智能合约", "合约卷轴种", "合约晶果"],
    ],
  );
  assert.deepEqual(COURSE_GRID_SLOTS, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(
    courseGridSlots(false).map(({ slot, course, status }) => [slot, course?.id ?? null, status]),
    [
      [1, "web3", "active"],
      [2, "monad", "locked"],
      [3, "contract", "locked"],
      [4, "security", "locked"],
      [5, null, "reserved"],
      [6, null, "reserved"],
      [7, null, "reserved"],
      [8, null, "reserved"],
      [9, null, "reserved"],
    ],
  );
});

test("the fourth land slot is Web3 security and follows the training-ground state", () => {
  const slots = courseGridSlots(false);
  assert.deepEqual(slots[3].course, {
    id: "security",
    order: 4,
    title: "Web3 安全",
    seed: "安全种子",
    crop: "防护结晶",
  });
  assert.equal(slots[3].status, "locked");
  assert.equal(courseGridSlots(false, false, false, false, false, "active")[3].status, "active");
  assert.equal(courseGridSlots(false, false, false, false, false, "harvested")[3].status, "harvested");
});

test("completion rewards are idempotent", () => {
  let progress = initialProgress;
  for (let repeat = 0; repeat < 2; repeat += 1) {
    progress = apply(progress, { type: "start-course" });
    progress = apply(progress, { type: "clear-land" });
    progress = apply(progress, { type: "plant" });
    for (let chapter = 0; chapter < 3; chapter += 1) {
      progress = apply(progress, { type: "complete-theory", chapter });
    }
    for (let chapter = 0; chapter < 3; chapter += 1) {
      progress = apply(progress, { type: "complete-challenge", chapter });
    }
    progress = apply(progress, { type: "pass-verification" });
    progress = apply(progress, { type: "harvest" });
  }

  assert.equal(progress.recentActivity.filter((item) => item.includes("收获守护浆果")).length, 1);
  assert.equal(calculateExp(progress), 255);
});

test("invalid state jumps do not grant progress", () => {
  let progress = initialProgress;
  progress = apply(progress, { type: "plant" });
  progress = apply(progress, { type: "complete-theory", chapter: 0 });
  progress = apply(progress, { type: "complete-challenge", chapter: 0 });
  progress = apply(progress, { type: "pass-verification" });
  progress = apply(progress, { type: "harvest" });

  assert.deepEqual(progress, initialProgress);
  assert.equal(calculateExp(progress), 0);
});

test("a challenge mistake removes only the first-perfect bonus", () => {
  let progress = initialProgress;
  progress = apply(progress, { type: "start-course" });
  progress = apply(progress, { type: "clear-land" });
  progress = apply(progress, { type: "plant" });
  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-theory", chapter });
  }
  progress = apply(progress, { type: "challenge-mistake", chapter: 1 });
  for (let chapter = 0; chapter < 3; chapter += 1) {
    progress = apply(progress, { type: "complete-challenge", chapter });
  }

  assert.equal(calculateExp(progress), 100);
  assert.deepEqual(progress.challengePassed, [true, true, true]);
});

test("stored progress accepts only the exact versioned shape", () => {
  const serialized = JSON.stringify(initialProgress);
  assert.deepEqual(readStoredProgress(serialized), initialProgress);
  assert.deepEqual(readStoredProgress("{}"), initialProgress);
  assert.deepEqual(readStoredProgress("not json"), initialProgress);
});

test("every visual stage resolves to its exact transparent field asset", () => {
  assert.equal(fieldAssetForStage("wild"), "/art/fields/course-field-wild-v4.png");
  assert.equal(fieldAssetForStage("tilled"), "/art/fields/course-field-tilled-v4.png");
  assert.equal(fieldAssetForStage("seeded"), "/art/fields/course-field-seeded-v4.png");
  assert.equal(fieldAssetForStage("sprout"), "/art/fields/course-field-sprout-v4.png");
  assert.equal(fieldAssetForStage("bloom"), "/art/fields/course-field-bloom-v4.png");
  assert.equal(fieldAssetForStage("fruit"), "/art/fields/course-field-fruit-v4.png");
  assert.equal(fieldAssetForStage("harvested"), "/art/fields/course-field-harvested-v4.png");
});

test("the Web3 course uses one exact crop asset for each single-plant stage", () => {
  assert.equal(ledgerStarCropAssetForStage("sprout"), "/art/crops/ledger-star-sprout-v3.png");
  assert.equal(ledgerStarCropAssetForStage("bloom"), "/art/crops/ledger-star-bloom-v3.png");
  assert.equal(ledgerStarCropAssetForStage("fruit"), "/art/crops/ledger-star-fruit-v3.png");
  assert.equal(ledgerStarCropAssetForStage("harvested"), "/art/crops/ledger-star-harvested-field-v2.png");
});

test("the Monad course uses compact rooted sprites for every visible growth stage", () => {
  assert.equal(monadCropAssetForStage("sprout"), "/art/crops/parallel-crystal-berry-sprout-v2.png");
  assert.equal(monadCropAssetForStage("bloom"), "/art/crops/parallel-crystal-berry-bloom-v2.png");
  assert.equal(monadCropAssetForStage("fruit"), "/art/crops/parallel-crystal-berry-fruit-v2.png");
  assert.equal(monadCropAssetForStage("harvested"), "/art/crops/parallel-crystal-berry-harvested-v2.png");
});
