import assert from "node:assert/strict";
import test from "node:test";

import {
  WORLD_DAY_DURATION_MS,
  WORLD_SKY_ORBIT,
  celestialPositionAt,
  worldClockAt,
  worldClockForPhase,
  worldPhaseAt,
} from "../app/game/world-clock.ts";

test("昼夜时钟会从黎明经过白天和黄昏进入黑夜", () => {
  assert.equal(worldClockAt(0).phase, "dawn");
  assert.equal(worldClockAt(WORLD_DAY_DURATION_MS * 0.1).phase, "day");
  assert.equal(worldClockAt(WORLD_DAY_DURATION_MS * 0.6).phase, "night");
  assert.equal(worldClockAt(WORLD_DAY_DURATION_MS).phase, "dawn");
  assert.equal(WORLD_DAY_DURATION_MS, 24_000);
  assert.equal(worldClockAt(WORLD_DAY_DURATION_MS / 4).daylight, 1);
  assert.equal(worldClockAt(0).celestialBody, "sun");
  assert.equal(worldClockAt(0).celestialX, worldClockAt(WORLD_DAY_DURATION_MS).celestialX);
});

test("昼夜边界和展示时间稳定", () => {
  assert.equal(worldPhaseAt(6 * 60), "dawn");
  assert.equal(worldPhaseAt(12 * 60), "day");
  assert.equal(worldPhaseAt(18 * 60), "dusk");
  assert.equal(worldPhaseAt(23 * 60), "night");
  const night = worldClockForPhase("night");
  assert.equal(night.minutes, 1380);
  assert.equal(night.label, "23:00");
  assert.equal(night.phaseLabel, "黑夜");
  assert.equal(night.isNight, true);
  assert.equal(night.daylight, 0);
  assert.equal(night.celestialBody, "moon");
  assert.equal(night.twilight, 0);
});

test("太阳与月亮沿同一条弧线平滑交替", () => {
  const sunrise = celestialPositionAt(5 * 60);
  const noon = celestialPositionAt(12 * 60);
  const sunset = celestialPositionAt(19 * 60);
  const midnight = celestialPositionAt(0);
  const beforeSunrise = celestialPositionAt(5 * 60 - 0.01);

  assert.equal(sunrise.body, "sun");
  assert.equal(sunrise.x, WORLD_SKY_ORBIT.left);
  assert.equal(sunrise.y, WORLD_SKY_ORBIT.horizonY);
  assert.equal(noon.body, "sun");
  assert.equal(noon.x, 830);
  assert.ok(noon.y < sunrise.y);
  assert.equal(sunset.body, "moon");
  assert.equal(sunset.x, WORLD_SKY_ORBIT.left);
  assert.equal(midnight.body, "moon");
  assert.equal(midnight.x, 830);
  assert.ok(midnight.y < sunset.y);
  assert.ok(Math.abs(beforeSunrise.moonX - sunrise.moonX) < 0.02);
  assert.ok(Math.abs(beforeSunrise.moonY - sunrise.moonY) < 0.02);
});

test("celestial bodies stay in the map's mountain sky and fade naturally", () => {
  for (let minute = 0; minute < 1440; minute += 1) {
    const celestial = celestialPositionAt(minute);
    assert.ok(celestial.sunX >= WORLD_SKY_ORBIT.left && celestial.sunX <= WORLD_SKY_ORBIT.right);
    assert.ok(celestial.moonX >= WORLD_SKY_ORBIT.left && celestial.moonX <= WORLD_SKY_ORBIT.right);
    assert.ok(celestial.sunY >= WORLD_SKY_ORBIT.peakY && celestial.sunY <= WORLD_SKY_ORBIT.horizonY);
    assert.ok(celestial.moonY >= WORLD_SKY_ORBIT.peakY && celestial.moonY <= WORLD_SKY_ORBIT.horizonY);
    assert.ok(celestial.sunOpacity >= 0 && celestial.sunOpacity <= 1);
    assert.ok(celestial.moonOpacity >= 0 && celestial.moonOpacity <= 1);
  }
});

test("sunset and dawn fade the sun and moon together in the same sky", () => {
  for (const minutes of [18 * 60 + 30, 5 * 60 + 30]) {
    const transition = celestialPositionAt(minutes);
    assert.ok(transition.sunOpacity > 0);
    assert.ok(transition.moonOpacity > 0);
  }
  assert.equal(celestialPositionAt(12 * 60).moonOpacity, 0);
  assert.equal(celestialPositionAt(23 * 60).sunOpacity, 0);
  assert.equal(celestialPositionAt(23 * 60).moonOpacity, 1);
});
