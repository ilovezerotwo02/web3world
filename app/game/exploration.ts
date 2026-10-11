export type Direction = "up" | "down" | "left" | "right";

export type MotionState = "idle" | "walking" | "interacting";

export type WorldPoint = {
  x: number;
  y: number;
};

export type PlayerPose = {
  position: WorldPoint;
  direction: Direction;
  motion: MotionState;
};

export type SceneDestination =
  | "courses"
  | "seeds"
  | "fishing"
  | "land"
  | "chapter"
  | "challenge"
  | "verification"
  | "quiz"
  | "harvest"
  | "smithy"
  | "security"
  | "security-report";

export type PortalId =
  | "knowledge-tower"
  | "seed-shop"
  | "fishing-pond"
  | "course-fields"
  | "progress-workshop"
  | "smithy"
  | "security-greenhouse";

export type ScenePortal = {
  id: PortalId;
  label: string;
  description: string;
  position: WorldPoint;
  markerPosition?: WorldPoint;
  interactionRadius: number;
  destination: SceneDestination;
};

export type SceneState = {
  version: 1;
  x: number;
  y: number;
  direction: Direction;
};

export type CameraTransform = {
  scale: number;
  x: number;
  y: number;
};

type RectBlocker = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

type EllipseBlocker = {
  kind: "ellipse";
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
};

type Blocker = RectBlocker | EllipseBlocker;

export const WORLD_WIDTH = 1586;
export const WORLD_HEIGHT = 992;
export const NAV_GRID_SIZE = 24;
export const PLAYER_SPEED = 140;
export const PLAYER_COLLIDER = { radiusX: 10, radiusY: 6 } as const;
export const SCENE_STORAGE_KEY = "monad-pixel-farm:v35:scene-state";

export const SPAWN_POINT: WorldPoint = { x: 792, y: 585 };
export const SMITHY_ENTRY: WorldPoint = { x: 850, y: 820 };
export const SMITHY_MARKER: WorldPoint = { x: 850, y: 744 };
export const SECURITY_GREENHOUSE_ENTRY: WorldPoint = { x: 1300, y: 850 };
export const SECURITY_GREENHOUSE_BUILDING: WorldPoint = { x: 1300, y: 820 };
export const SECURITY_GREENHOUSE_MARKER: WorldPoint = { x: 1300, y: 760 };

export const SCENE_PORTALS: ScenePortal[] = [
  {
    id: "knowledge-tower",
    label: "知识塔",
    description: "课程路线与理论章节",
    position: { x: 397, y: 346 },
    interactionRadius: 48,
    destination: "courses",
  },
  {
    id: "seed-shop",
    label: "种子小铺",
    description: "领取与查看课程种子",
    position: { x: 1216, y: 386 },
    interactionRadius: 50,
    destination: "seeds",
  },
  {
    id: "fishing-pond",
    label: "回执池塘",
    description: "钓鱼、交易回执核验与鱼类图鉴",
    position: { x: 1000, y: 405 },
    markerPosition: { x: 930, y: 355 },
    interactionRadius: 54,
    destination: "fishing",
  },
  {
    id: "course-fields",
    label: "课程土地",
    description: "开荒、播种与作物成长",
    position: { x: 690, y: 610 },
    interactionRadius: 54,
    destination: "land",
  },
  {
    id: "progress-workshop",
    label: "进步工坊",
    description: "章节挑战与最终验证",
    position: { x: 1115, y: 817 },
    interactionRadius: 52,
    destination: "challenge",
  },
  {
    id: "smithy",
    label: "铁匠铺",
    description: "回答 Web3 知识，锻造并装备安全护具",
    position: SMITHY_ENTRY,
    markerPosition: SMITHY_MARKER,
    interactionRadius: 52,
    destination: "smithy",
  },
  {
    id: "security-greenhouse",
    label: "Web3 安全训练场",
    description: "昼夜安全路线、漏洞训练与交易安检",
    position: SECURITY_GREENHOUSE_ENTRY,
    markerPosition: SECURITY_GREENHOUSE_MARKER,
    interactionRadius: 54,
    destination: "security",
  },
];

const ISLAND_POLYGON: WorldPoint[] = [
  { x: 72, y: 336 },
  { x: 145, y: 254 },
  { x: 260, y: 194 },
  { x: 430, y: 166 },
  { x: 620, y: 158 },
  { x: 760, y: 181 },
  { x: 930, y: 180 },
  { x: 1090, y: 164 },
  { x: 1290, y: 170 },
  { x: 1460, y: 238 },
  { x: 1535, y: 354 },
  { x: 1525, y: 555 },
  { x: 1470, y: 740 },
  { x: 1370, y: 845 },
  { x: 1190, y: 890 },
  { x: 1005, y: 867 },
  { x: 835, y: 883 },
  { x: 650, y: 860 },
  { x: 466, y: 855 },
  { x: 300, y: 820 },
  { x: 160, y: 750 },
  { x: 82, y: 632 },
];

const BLOCKERS: Blocker[] = [
  { kind: "rect", x: 250, y: 90, width: 300, height: 233 },
  { kind: "rect", x: 1080, y: 95, width: 390, height: 270 },
  { kind: "rect", x: 118, y: 445, width: 545, height: 295 },
  { kind: "rect", x: 1000, y: 510, width: 405, height: 285 },
  { kind: "rect", x: 1170, y: 795, width: 260, height: 30 },
  { kind: "ellipse", x: 817, y: 284, radiusX: 178, radiusY: 132 },
  { kind: "ellipse", x: 560, y: 170, radiusX: 102, radiusY: 92 },
  { kind: "ellipse", x: 690, y: 196, radiusX: 62, radiusY: 74 },
  { kind: "ellipse", x: 1425, y: 484, radiusX: 98, radiusY: 112 },
  { kind: "ellipse", x: 1450, y: 743, radiusX: 86, radiusY: 106 },
  { kind: "ellipse", x: 717, y: 393, radiusX: 25, radiusY: 18 },
  { kind: "ellipse", x: 954, y: 420, radiusX: 26, radiusY: 18 },
  { kind: "ellipse", x: 824, y: 516, radiusX: 26, radiusY: 18 },
  { kind: "ellipse", x: 967, y: 626, radiusX: 24, radiusY: 18 },
  { kind: "ellipse", x: 873, y: 643, radiusX: 22, radiusY: 18 },
];

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function pointInPolygon(point: WorldPoint, polygon: WorldPoint[]) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInsideBlocker(point: WorldPoint, blocker: Blocker) {
  if (blocker.kind === "rect") {
    return (
      point.x >= blocker.x &&
      point.x <= blocker.x + blocker.width &&
      point.y >= blocker.y &&
      point.y <= blocker.y + blocker.height
    );
  }
  const x = (point.x - blocker.x) / blocker.radiusX;
  const y = (point.y - blocker.y) / blocker.radiusY;
  return x * x + y * y <= 1;
}

export function isWalkable(point: WorldPoint) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if (!pointInPolygon(point, ISLAND_POLYGON)) return false;
  return !BLOCKERS.some((blocker) => pointInsideBlocker(point, blocker));
}

export function canStand(point: WorldPoint) {
  const samples = [
    point,
    { x: point.x - PLAYER_COLLIDER.radiusX, y: point.y },
    { x: point.x + PLAYER_COLLIDER.radiusX, y: point.y },
    { x: point.x, y: point.y - PLAYER_COLLIDER.radiusY },
    { x: point.x, y: point.y + PLAYER_COLLIDER.radiusY },
  ];
  return samples.every(isWalkable);
}

export function normalizeMovement(x: number, y: number) {
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0) return { x: 0, y: 0 };
  return { x: x / magnitude, y: y / magnitude };
}

export function directionFromVector(x: number, y: number, fallback: Direction = "down"): Direction {
  if (x === 0 && y === 0) return fallback;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}

export function moveWithCollision(position: WorldPoint, delta: WorldPoint) {
  const distance = Math.hypot(delta.x, delta.y);
  const steps = Math.max(1, Math.ceil(distance / 6));
  let next = { ...position };
  for (let step = 0; step < steps; step += 1) {
    const stepX = delta.x / steps;
    const stepY = delta.y / steps;
    const horizontal = { x: next.x + stepX, y: next.y };
    if (canStand(horizontal)) next = horizontal;
    const vertical = { x: next.x, y: next.y + stepY };
    if (canStand(vertical)) next = vertical;
  }
  return next;
}

export function distanceBetween(a: WorldPoint, b: WorldPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function portalWithinReach(position: WorldPoint) {
  return (
    SCENE_PORTALS.find(
      (portal) => distanceBetween(position, portal.position) <= portal.interactionRadius,
    ) ?? null
  );
}

function gridPoint(point: WorldPoint) {
  return {
    x: clamp(Math.floor(point.x / NAV_GRID_SIZE), 0, Math.ceil(WORLD_WIDTH / NAV_GRID_SIZE) - 1),
    y: clamp(Math.floor(point.y / NAV_GRID_SIZE), 0, Math.ceil(WORLD_HEIGHT / NAV_GRID_SIZE) - 1),
  };
}

function worldPoint(x: number, y: number): WorldPoint {
  return {
    x: Math.min(WORLD_WIDTH - 1, x * NAV_GRID_SIZE + NAV_GRID_SIZE / 2),
    y: Math.min(WORLD_HEIGHT - 1, y * NAV_GRID_SIZE + NAV_GRID_SIZE / 2),
  };
}

function projectToWalkable(point: WorldPoint) {
  const origin = gridPoint(point);
  for (let radius = 0; radius <= 20; radius += 1) {
    for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
      for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
        if (Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) !== radius) continue;
        const projected = worldPoint(x, y);
        if (canStand(projected)) return { grid: { x, y }, point: projected };
      }
    }
  }
  return null;
}

function gridKey(x: number, y: number) {
  return `${x}:${y}`;
}

function simplifyPath(points: WorldPoint[]) {
  if (points.length <= 2) return points;
  const simplified = [points[0]];
  let previousDirection = `${Math.sign(points[1].x - points[0].x)}:${Math.sign(points[1].y - points[0].y)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const nextDirection = `${Math.sign(points[index + 1].x - points[index].x)}:${Math.sign(points[index + 1].y - points[index].y)}`;
    if (nextDirection !== previousDirection) simplified.push(points[index]);
    previousDirection = nextDirection;
  }
  simplified.push(points.at(-1) as WorldPoint);
  return simplified;
}

export function findPath(start: WorldPoint, requestedTarget: WorldPoint) {
  const projectedStart = projectToWalkable(start);
  const projectedTarget = projectToWalkable(requestedTarget);
  if (!projectedStart || !projectedTarget) return [];

  const targetKey = gridKey(projectedTarget.grid.x, projectedTarget.grid.y);
  const startKey = gridKey(projectedStart.grid.x, projectedStart.grid.y);
  const open = new Map<string, { x: number; y: number; score: number }>();
  const cameFrom = new Map<string, string>();
  const costs = new Map<string, number>([[startKey, 0]]);
  open.set(startKey, { ...projectedStart.grid, score: 0 });
  const offsets = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];

  while (open.size > 0) {
    let currentKey = "";
    let current = { x: 0, y: 0, score: Number.POSITIVE_INFINITY };
    open.forEach((entry, key) => {
      if (entry.score < current.score) {
        current = entry;
        currentKey = key;
      }
    });
    open.delete(currentKey);
    if (currentKey === targetKey) {
      const path: WorldPoint[] = [projectedTarget.point];
      let key = currentKey;
      while (key !== startKey) {
        const [x, y] = key.split(":").map(Number);
        path.push(worldPoint(x, y));
        key = cameFrom.get(key) as string;
      }
      path.push({ ...start });
      return simplifyPath(path.reverse());
    }

    for (const [offsetX, offsetY] of offsets) {
      const x = current.x + offsetX;
      const y = current.y + offsetY;
      const nextPoint = worldPoint(x, y);
      if (!canStand(nextPoint)) continue;
      if (offsetX !== 0 && offsetY !== 0) {
        if (!canStand(worldPoint(current.x + offsetX, current.y))) continue;
        if (!canStand(worldPoint(current.x, current.y + offsetY))) continue;
      }
      const key = gridKey(x, y);
      const cost = (costs.get(currentKey) ?? 0) + (offsetX !== 0 && offsetY !== 0 ? Math.SQRT2 : 1);
      if (cost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(key, cost);
      cameFrom.set(key, currentKey);
      const heuristic = Math.hypot(projectedTarget.grid.x - x, projectedTarget.grid.y - y);
      open.set(key, { x, y, score: cost + heuristic });
    }
  }
  return [];
}

export function getCameraTransform(
  player: WorldPoint,
  viewportWidth: number,
  viewportHeight: number,
): CameraTransform {
  const fitScale = Math.max(viewportWidth / WORLD_WIDTH, viewportHeight / WORLD_HEIGHT);
  const scale = fitScale * 1.32;
  const scaledWidth = WORLD_WIDTH * scale;
  const scaledHeight = WORLD_HEIGHT * scale;
  const minimumX = Math.min(0, viewportWidth - scaledWidth);
  const minimumY = Math.min(0, viewportHeight - scaledHeight);
  return {
    scale,
    x: clamp(viewportWidth / 2 - player.x * scale, minimumX, 0),
    y: clamp(viewportHeight / 2 - player.y * scale, minimumY, 0),
  };
}

export function readStoredSceneState(value: string | null): SceneState {
  if (!value) return { version: 1, x: SPAWN_POINT.x, y: SPAWN_POINT.y, direction: "down" };
  try {
    const parsed = JSON.parse(value) as Partial<SceneState>;
    const position = { x: parsed.x as number, y: parsed.y as number };
    if (
      parsed.version !== 1 ||
      !DIRECTIONS.includes(parsed.direction as Direction) ||
      !canStand(position)
    ) {
      throw new Error("invalid scene state");
    }
    return {
      version: 1,
      x: position.x,
      y: position.y,
      direction: parsed.direction as Direction,
    };
  } catch {
    return { version: 1, x: SPAWN_POINT.x, y: SPAWN_POINT.y, direction: "down" };
  }
}
