import assert from "node:assert/strict";
import test from "node:test";

import {
  SCENE_PORTALS,
  SECURITY_COURSE_PLOT_MARKER,
  SECURITY_GREENHOUSE_BUILDING,
  SECURITY_GREENHOUSE_ENTRY,
  SECURITY_GREENHOUSE_MARKER,
  SMITHY_BUILDING,
  SMITHY_ENTRY,
  SPAWN_POINT,
  canStand,
  directionFromVector,
  distanceBetween,
  findPath,
  getCameraTransform,
  moveWithCollision,
  normalizeMovement,
  portalWithinReach,
  readStoredSceneState,
} from "../app/game/exploration.ts";

test("diagonal keyboard movement is normalized", () => {
  const movement = normalizeMovement(1, 1);
  assert.ok(Math.abs(Math.hypot(movement.x, movement.y) - 1) < 0.000001);
  assert.equal(directionFromVector(1, 0), "right");
  assert.equal(directionFromVector(0, -1), "up");
});

test("collision keeps the player outside the pond and buildings", () => {
  assert.equal(canStand(SPAWN_POINT), true);
  assert.equal(canStand({ x: 817, y: 284 }), false);
  assert.equal(canStand({ x: 397, y: 180 }), false);

  const blocked = moveWithCollision({ x: 792, y: 430 }, { x: 0, y: -220 });
  assert.equal(canStand(blocked), true);
  assert.ok(blocked.y > 405);
});

test("every farm portal has a reachable A-star route from spawn", () => {
  for (const portal of SCENE_PORTALS) {
    const path = findPath(SPAWN_POINT, portal.position);
    assert.ok(path.length >= 2, `${portal.id} should have a path`);
    assert.ok(distanceBetween(path.at(-1), portal.position) <= 18);
  }
});

test("Web3 安全训练场在地图上有独立入口，并且入口可达", () => {
  const security = SCENE_PORTALS.find((portal) => portal.id === "security-greenhouse");
  assert.equal(security?.label, "Web3 安全训练场");
  assert.deepEqual(security?.position, SECURITY_GREENHOUSE_ENTRY);
  assert.deepEqual(security?.markerPosition, SECURITY_GREENHOUSE_MARKER);
  assert.notDeepEqual(SECURITY_GREENHOUSE_BUILDING, SECURITY_GREENHOUSE_ENTRY);
  assert.ok(distanceBetween(SECURITY_GREENHOUSE_MARKER, SECURITY_GREENHOUSE_BUILDING) <= 24);
  assert.equal(canStand(security.position), true);
  assert.equal(canStand(SECURITY_GREENHOUSE_BUILDING), false);
  assert.ok(findPath(SPAWN_POINT, security.position).length >= 2);
  assert.ok(canStand(SECURITY_GREENHOUSE_ENTRY));
});

test("the fourth Web3 security field marker opens the existing training scene", () => {
  const plot = SCENE_PORTALS.find((portal) => portal.id === "security-course-plot");
  assert.equal(plot?.label, "Web3 安全课程田");
  assert.equal(plot?.destination, "security");
  assert.deepEqual(plot?.markerPosition, SECURITY_COURSE_PLOT_MARKER);
  assert.deepEqual(SECURITY_COURSE_PLOT_MARKER, { x: 288, y: 510 });
  assert.equal(canStand(plot.position), true);
  assert.ok(findPath(SPAWN_POINT, plot.position).length >= 2);
});

test("the smithy has a separate walk-up point and blocks traversal through its footprint", () => {
  const smithy = SCENE_PORTALS.find((portal) => portal.id === "smithy");
  assert.deepEqual(smithy?.position, SMITHY_ENTRY);
  assert.equal(canStand(SMITHY_BUILDING), false);
  assert.equal(canStand(SMITHY_ENTRY), true);
  assert.ok(findPath(SPAWN_POINT, SMITHY_ENTRY).length >= 2);
});

test("Web3 安全训练场使用独立房屋模型，不复用进步工坊入口", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/game/FarmWorld.tsx", import.meta.url), "utf8"),
  );
  const houseSource = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/game/SecurityTrainingHouse3D.tsx", import.meta.url), "utf8"),
  );
  assert.match(source, /SecurityTrainingHouse3D/);
  assert.match(source, /SECURITY_GREENHOUSE_BUILDING/);
  assert.doesNotMatch(source, /className=\{`world-security-greenhouse/);
  assert.match(source, /smithy-pixel-v2\.png/);
  assert.match(source, /farm-map-sky-v2\.png/);
  assert.match(source, /smithy-forge-fire/);
  assert.match(source, /worldClock\.daylight/);
  assert.match(source, /worldClock\.sunOpacity/);
  assert.match(source, /worldClock\.moonOpacity/);
  const css = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  );
  assert.match(css, /\.smithy-house-art\s*\{[^}]*brightness\(var\(--building-daylight/);
  assert.match(css, /\.world-security-house-3d\s*\{[^}]*brightness\(var\(--building-daylight/);
  assert.match(css, /\.smithy-forge-fire\s*\{[^}]*z-index:\s*2/s);
  assert.match(css, /forge-flames-pixel-v2\.png/);
  assert.match(houseSource, /ExtrudeGeometry/);
  assert.match(houseSource, /security-training-house\.svg/);
  assert.doesNotMatch(houseSource, /CanvasTexture/);
  assert.notEqual(
    SECURITY_GREENHOUSE_ENTRY.x,
    SCENE_PORTALS.find((portal) => portal.id === "progress-workshop")?.position.x,
  );
});

test("the fishing marker sits over the pond while its interaction point stays walkable", () => {
  const fishing = SCENE_PORTALS.find((portal) => portal.id === "fishing-pond");
  assert.deepEqual(fishing.markerPosition, { x: 930, y: 355 });
  assert.equal(canStand(fishing.markerPosition), false);
  assert.equal(canStand(fishing.position), true);
  const path = findPath(SPAWN_POINT, fishing.position);
  assert.ok(distanceBetween(path.at(-1), fishing.position) <= 18);
});

test("non-walkable clicks project to a nearby reachable path", () => {
  const path = findPath(SPAWN_POINT, { x: 817, y: 284 });
  assert.ok(path.length >= 2);
  assert.equal(canStand(path.at(-1)), true);
});

test("portal proximity returns only an entrance within interaction range", () => {
  assert.equal(portalWithinReach(SPAWN_POINT), null);
  const tower = SCENE_PORTALS.find((portal) => portal.id === "knowledge-tower");
  assert.equal(portalWithinReach(tower.position)?.id, "knowledge-tower");
});

test("camera follows the player and remains clamped to the world", () => {
  const center = getCameraTransform(SPAWN_POINT, 1440, 900);
  const topLeft = getCameraTransform({ x: 0, y: 0 }, 1440, 900);
  const bottomRight = getCameraTransform({ x: 1586, y: 992 }, 1440, 900);
  assert.ok(center.scale > 1);
  assert.equal(topLeft.x, 0);
  assert.equal(topLeft.y, 0);
  assert.ok(bottomRight.x < 0);
  assert.ok(bottomRight.y < 0);
});

test("the sky belongs to the map and does not cancel the player's camera movement", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../app/game/FarmWorld.tsx", import.meta.url), "utf8"),
  );
  assert.match(source, /className="world-sky"/);
  for (const body of ["sun", "moon"]) {
    assert.match(source, new RegExp(`left: worldClock\\.${body}X`));
    assert.match(source, new RegExp(`top: worldClock\\.${body}Y`));
    assert.doesNotMatch(source, new RegExp(`viewport\\.(width|height) \\* worldClock\\.${body}`));
  }
});

test("stored scene state accepts only valid versioned walkable coordinates", () => {
  const valid = JSON.stringify({ version: 1, x: SPAWN_POINT.x, y: SPAWN_POINT.y, direction: "left" });
  assert.deepEqual(readStoredSceneState(valid), {
    version: 1,
    x: SPAWN_POINT.x,
    y: SPAWN_POINT.y,
    direction: "left",
  });
  assert.deepEqual(readStoredSceneState(JSON.stringify({ version: 1, x: 817, y: 284, direction: "up" })), {
    version: 1,
    x: SPAWN_POINT.x,
    y: SPAWN_POINT.y,
    direction: "down",
  });
  assert.deepEqual(readStoredSceneState("not-json"), {
    version: 1,
    x: SPAWN_POINT.x,
    y: SPAWN_POINT.y,
    direction: "down",
  });
});
