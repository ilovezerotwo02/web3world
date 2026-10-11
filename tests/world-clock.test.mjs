import assert from "node:assert/strict";
import test from "node:test";

import {
  WORLD_DAY_DURATION_MS,
  worldClockAt,
  worldClockForPhase,
  worldPhaseAt,
} from "../app/game/world-clock.ts";

test("昼夜时钟会从黎明经过白天和黄昏进入黑夜", () => {
  assert.equal(worldClockAt(0).phase, "dawn");
  assert.equal(worldClockAt(WORLD_DAY_DURATION_MS * 0.1).phase, "day");
  assert.equal(worldClockAt(WORLD_DAY_DURATION_MS * 0.6).phase, "night");
  assert.equal(worldClockAt(WORLD_DAY_DURATION_MS).phase, "dawn");
  assert.equal(WORLD_DAY_DURATION_MS, 60_000);
});

test("昼夜边界和展示时间稳定", () => {
  assert.equal(worldPhaseAt(6 * 60), "dawn");
  assert.equal(worldPhaseAt(12 * 60), "day");
  assert.equal(worldPhaseAt(18 * 60), "dusk");
  assert.equal(worldPhaseAt(23 * 60), "night");
  assert.deepEqual(worldClockForPhase("night"), {
    minutes: 1380,
    label: "23:00",
    phase: "night",
    phaseLabel: "黑夜",
    isNight: true,
  });
});
