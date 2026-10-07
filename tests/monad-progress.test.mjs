import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateMonadExp,
  initialMonadProgress,
  monadProgressReducer,
  readStoredMonadProgress,
} from "../app/game/monad-progress.ts";
import { fieldVisualStage } from "../app/game/progress.ts";
import { coursePlotStatuses } from "../app/game/course-plots.ts";

function reduce(actions) {
  return actions.reduce(monadProgressReducer, initialMonadProgress);
}

const completeMonadActions = [
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

test("the Monad course completes the second plot growth loop", () => {
  const progress = reduce(completeMonadActions);
  assert.equal(progress.harvested, true);
  assert.equal(fieldVisualStage(progress), "harvested");
  assert.equal(calculateMonadExp(progress), 255);
  assert.equal(progress.recentActivity[0], "收获 Monad 紫藤果并解锁智能合约课程");
});

test("Monad progress rejects out-of-order farming and learning actions", () => {
  const progress = reduce([
    { type: "clear-land" },
    { type: "plant" },
    { type: "complete-theory", chapter: 0 },
    { type: "complete-challenge", chapter: 0 },
    { type: "pass-verification" },
    { type: "harvest" },
  ]);
  assert.deepEqual(progress, initialMonadProgress);
});

test("harvesting Monad unlocks plot three while preserving the first two harvest states", () => {
  assert.deepEqual(coursePlotStatuses(true, true, true), {
    web3: "harvested",
    monad: "harvested",
    contract: "unlocked",
  });
});

test("stored Monad progress accepts only the exact versioned shape", () => {
  const progress = reduce(completeMonadActions.slice(0, 5));
  assert.deepEqual(readStoredMonadProgress(JSON.stringify(progress)), progress);
  assert.deepEqual(readStoredMonadProgress('{"version":2}'), initialMonadProgress);
  assert.deepEqual(readStoredMonadProgress("broken"), initialMonadProgress);
});

test("right and left movement use the exact sprite-sheet rows", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.world-player\.facing-left \.player-sprite \{ background-position-y: -96px; \}/);
  assert.match(css, /\.world-player\.facing-right \.player-sprite \{ background-position-y: -192px; \}/);
});

test("walking animation uses all three exact sprite frames", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /background-position-x: -64px;/);
  assert.match(css, /background-position-x: -128px;/);
  assert.match(css, /background-position-x: -192px;/);
  assert.match(css, /@keyframes player-walk-shadow/);
});

test("dialog cards remain inside the task drawer modal backdrop", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /width: min\(680px, 100%\);/);
  assert.match(css, /overflow-x: hidden;/);
  assert.match(css, /grid-template-columns: 164px minmax\(0, 1fr\);/);
});

test("field previews use stable background assets without broken image placeholders", async () => {
  const source = await readFile(new URL("../app/game/FieldVisuals.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /style=\{\{ backgroundImage: `url\("\$\{fieldAssetForStage\("wild"\)\}"\)` \}\}/);
  assert.match(source, /style=\{\{ backgroundImage: `url\("\$\{fieldAssetForStage\("tilled"\)\}"\)` \}\}/);
  assert.match(css, /background-size: contain;/);
});

test("crop stages root directly into the tilled plot without a separate soil pedestal", async () => {
  const source = await readFile(new URL("../app/game/FieldVisuals.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /className={`crop-growth-site crop-stage-\$\{stage\}/);
  assert.match(source, /className="crop-ground-shadow"/);
  assert.match(source, /className="crop-root-contact"/);
  assert.doesNotMatch(source, /crop-soil-opening/);
  assert.doesNotMatch(source, /crop-soil-lip/);
  assert.match(css, /transform: translate\(-50%, -92%\);/);
  assert.match(css, /@keyframes course-crop-emerge/);
  assert.match(css, /clip-path: inset\(78% 0 0\);/);
  assert.doesNotMatch(css, /@keyframes crop-soil-settle/);
});

test("harvested field art remains a rooted plant rather than an inventory basket", async () => {
  const assets = await readFile(new URL("../app/game/field-assets.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(assets, /harvested: "\/art\/crops\/ledger-star-harvested-field-v2\.png"/);
  assert.doesNotMatch(assets, /harvested: "\/art\/crops\/ledger-star-harvested-v4\.png"/);
  assert.match(css, /\.course-field-layer \.course-crop-art\.crop-harvested \{[\s\S]*?width: 68px;[\s\S]*?height: 62px;/);
  assert.match(css, /\.course-field-layer \.crop-growth-site\.crop-stage-harvested \.crop-root-contact \{[\s\S]*?display: block;/);
  assert.match(css, /\.crop-root-contact \{[\s\S]*?width: 24px;[\s\S]*?height: 5px;[\s\S]*?opacity: 0\.82;/);
  assert.match(css, /\.crop-ground-shadow \{[\s\S]*?width: 30px;[\s\S]*?opacity: 0\.24;/);
  assert.match(css, /\.course-field-layer \.course-plot-soil \.field-stage-overlay \{[\s\S]*?saturate\(0\.82\) brightness\(0\.88\) contrast\(1\.06\)/);
  assert.match(css, /\.field-stage-preview \.course-crop-art\.crop-harvested \{ bottom: 1px; width: 40px; height: 40px; \}/);
});

test("every Monad crop stage uses a centered bottom-anchored image sprite", async () => {
  const source = await readFile(new URL("../app/game/FieldVisuals.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /src=\{monadCropAssetForStage\(monadStage\)\}/);
  assert.match(css, /\.monad-crop-art \{[\s\S]*?object-position: center bottom;/);
  assert.match(css, /\.monad-crop-art\.crop-sprout \{ bottom: 2px; width: 34px; height: 34px; \}/);
  assert.match(css, /\.monad-crop-art\.crop-fruit \{ width: 62px; height: 60px;/);
  assert.match(css, /@keyframes crop-mature-breathe/);
  assert.match(css, /@keyframes monad-crop-spark/);
  assert.doesNotMatch(css, /parallel-wisteria-growth-sheet-v1\.png/);
});

test("course plot borders read as subtle soil seams instead of permanent neon UI frames", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.course-grid-slot polygon \{ fill: rgba\(54, 34, 23, 0\.03\); stroke-width: 2px; \}/);
  assert.match(css, /\.course-grid-slot\.is-active polygon \{ fill: rgba\(131, 86, 42, 0\.05\); stroke-width: 3px; \}/);
  assert.doesNotMatch(css, /stroke-width: 7px;/);
});

test("clicking non-interactive farm background closes an open location drawer", async () => {
  const source = await readFile(new URL("../app/game/FarmGame.tsx", import.meta.url), "utf8");
  assert.match(source, /<main className="app-shell" onClick=\{handleShellBackgroundClick\}>/);
  assert.match(source, /if \(!drawerOpen \|\| !\(event\.target instanceof Element\)\) return;/);
  assert.match(source, /\.content-drawer, \.topbar, \.dock, \.toast, \.desktop-notice, \.modal-backdrop, button, a, input, select, textarea, \[role='dialog'\]/);
  assert.match(source, /closeDrawer\(\);/);
});

test("course land continuation routes unread chapters through the knowledge tower", async () => {
  const source = await readFile(new URL("../app/game/FarmGame.tsx", import.meta.url), "utf8");
  const worldSource = await readFile(new URL("../app/game/FarmWorld.tsx", import.meta.url), "utf8");
  assert.match(source, /function continueLearningFromLand\(course: ActiveCourse, courseProgress: FarmProgress\)/);
  assert.match(source, /travelTo\("chapter", unreadChapter\);/);
  assert.match(source, /onContinue=\{\(\) => continueLearningFromLand\("web3", progress\)\}/);
  assert.match(source, /onContinue=\{\(\) => continueLearningFromLand\("monad", monadProgress\)\}/);
  assert.match(source, /onContinue=\{\(\) => continueLearningFromLand\("contract", contractProgress\)\}/);
  assert.match(worldSource, /else if \(step > 0 && pathRef\.current\.length > 0\)/);
});

test("toast feedback can retract and dismiss without covering the interface", async () => {
  const source = await readFile(new URL("../app/game/FarmGame.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /setTimeout\(\(\) => setCollapsed\(true\), 1800\)/);
  assert.match(source, /setTimeout\(onDismiss, 4200\)/);
  assert.match(css, /\.toast\.is-collapsed/);
});

test("the NFT badge connects the qualification UI to the verified claim flow", async () => {
  const source = await readFile(new URL("../app/game/FarmGame.tsx", import.meta.url), "utf8");
  const claimSource = await readFile(new URL("../app/game/NftClaimPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /\/art\/badges\/ledger-guardian-nft-v1\.png/);
  assert.match(source, /\/art\/badges\/monad-explorer-nft-v1\.png/);
  assert.match(source, /courseId="web3"/);
  assert.match(source, /courseId="monad"/);
  assert.match(claimSource, /\/api\/wallet\/challenge/);
  assert.match(claimSource, /\/api\/checkpoint/);
  assert.match(claimSource, /\/api\/nft/);
});
