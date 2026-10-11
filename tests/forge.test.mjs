import assert from "node:assert/strict";
import test from "node:test";

import {
  FORGE_ITEMS,
  forgeReducer,
  initialForgeState,
  readStoredForgeState,
} from "../app/game/forge.ts";

test("铁匠铺提供三件独立像素装备与三道 Web3 判断题", () => {
  assert.equal(FORGE_ITEMS.length, 3);
  assert.deepEqual(FORGE_ITEMS.map((item) => item.slot), ["head", "body", "tool"]);
  assert.ok(FORGE_ITEMS.every((item) => item.question.options.length === 3));
  assert.ok(FORGE_ITEMS.every((item) => item.question.answer === "a"));
});

test("答对后装备解锁，并且同一部位可以穿脱", () => {
  const item = FORGE_ITEMS[0];
  const forged = forgeReducer(initialForgeState, { type: "forge", itemId: item.id });
  assert.deepEqual(forged.unlocked, [item.id]);
  assert.equal(forged.answered, 1);

  const equipped = forgeReducer(forged, { type: "equip", itemId: item.id });
  assert.equal(equipped.equipped[item.slot], item.id);

  const unequipped = forgeReducer(equipped, { type: "unequip", slot: item.slot });
  assert.equal(unequipped.equipped[item.slot], null);
});

test("装备状态只恢复已解锁且部位匹配的装备", () => {
  const raw = JSON.stringify({
    version: 1,
    unlocked: ["ledger-helm", "unknown-item"],
    equipped: { head: "ledger-helm", body: "ledger-helm", tool: "unknown-item" },
    answered: 1,
  });
  const restored = readStoredForgeState(raw);
  assert.deepEqual(restored.unlocked, ["ledger-helm"]);
  assert.equal(restored.equipped.head, "ledger-helm");
  assert.equal(restored.equipped.body, null);
  assert.equal(restored.equipped.tool, null);
});
