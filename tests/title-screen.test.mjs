import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const titleSource = await readFile(new URL("../app/game/TitleScreen.tsx", import.meta.url), "utf8");
const gameSource = await readFile(new URL("../app/game/FarmGame.tsx", import.meta.url), "utf8");

test("the title menu exposes the four exact learning actions", () => {
  for (const label of ["开始学习", "继续学习", "重新学习", "退出学习"]) {
    assert.match(titleSource, new RegExp(`>${label}<`));
  }
  assert.match(titleSource, /role="dialog"/);
  assert.match(titleSource, /role="alertdialog"/);
  assert.match(titleSource, /课程、田地、钓鱼图鉴和人物位置的本地记录都会清空/);
});

test("preview routes bypass the title while normal play can return to its menu", () => {
  assert.match(gameSource, /setPreviewMode\(true\);\s*setEntryScreen\("game"\);/);
  assert.match(gameSource, /aria-label="返回学习主菜单"/);
  assert.match(gameSource, /drawerOpen=\{drawerOpen \|\| entryScreen !== "game"\}/);
});
