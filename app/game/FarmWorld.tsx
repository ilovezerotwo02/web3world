"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  PLAYER_SPEED,
  SCENE_PORTALS,
  SCENE_STORAGE_KEY,
  SPAWN_POINT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  directionFromVector,
  distanceBetween,
  findPath,
  getCameraTransform,
  moveWithCollision,
  normalizeMovement,
  portalWithinReach,
  readStoredSceneState,
  SMITHY_ENTRY,
  SECURITY_GREENHOUSE_BUILDING,
  SECURITY_GREENHOUSE_MARKER,
  type Direction,
  type PortalId,
  type SceneDestination,
  type ScenePortal,
  type WorldPoint,
} from "./exploration";
import { CourseFieldLayer } from "./FieldVisuals";
import type { FieldVisualStage } from "./progress";
import type { WorldClock } from "./world-clock";

export type WorldTravelRequest = {
  token: number;
  portalId: PortalId;
  destination: SceneDestination;
  chapter?: number;
};

type FarmWorldProps = {
  drawerOpen: boolean;
  previewMode: boolean;
  primaryLabel: string;
  stage: string;
  courseTitle: string;
  courseOrder: number;
  fieldStage: FieldVisualStage;
  monadFieldStage: FieldVisualStage;
  monadStarted: boolean;
  contractFieldStage: FieldVisualStage;
  contractStarted: boolean;
  securityStage: string | null;
  worldClock: WorldClock;
  portalDestinations: Record<PortalId, SceneDestination>;
  portalStatuses: Record<PortalId, string>;
  travelRequest: WorldTravelRequest | null;
  resetToken: number;
  onPrimary: () => void;
  onEnter: (destination: SceneDestination, chapter?: number) => void;
  onMessage: (message: string, tone?: "success" | "warning" | "info") => void;
};

type PendingTravel = {
  portal: ScenePortal;
  destination: SceneDestination;
  chapter?: number;
};

type Pose = {
  position: WorldPoint;
  direction: Direction;
  motion: "idle" | "walking" | "interacting";
};

const MOVEMENT_KEYS = new Set([
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "w",
  "a",
  "s",
  "d",
]);

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"),
  );
}

function previewPose(name: string | null): Pose | null {
  if (name === "walking") {
    return { position: { x: 845, y: 548 }, direction: "right", motion: "walking" };
  }
  if (name === "near-portal" || name === "drawer") {
    return { position: { x: 425, y: 360 }, direction: "up", motion: "idle" };
  }
  if (name === "profile-avatar" || name === "explore") {
    return { position: { ...SPAWN_POINT }, direction: "down", motion: "idle" };
  }
  if (name === "fishing") {
    return { position: { x: 1000, y: 405 }, direction: "left", motion: "idle" };
  }
  if (name?.startsWith("field-") || name === "seed-shop") {
    return { position: { x: 760, y: 610 }, direction: "left", motion: "idle" };
  }
  return null;
}

export function FarmWorld({
  drawerOpen,
  previewMode,
  primaryLabel,
  stage,
  courseTitle,
  courseOrder,
  fieldStage,
  monadFieldStage,
  monadStarted,
  contractFieldStage,
  contractStarted,
  securityStage,
  worldClock,
  portalDestinations,
  portalStatuses,
  travelRequest,
  resetToken,
  onPrimary,
  onEnter,
  onMessage,
}: FarmWorldProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pressedKeysRef = useRef(new Set<string>());
  const pathRef = useRef<WorldPoint[]>([]);
  const pendingTravelRef = useRef<PendingTravel | null>(null);
  const positionRef = useRef<WorldPoint>({ ...SPAWN_POINT });
  const directionRef = useRef<Direction>("down");
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastTravelTokenRef = useRef(0);
  const previousFieldVisualRef = useRef(fieldStage);
  const previousMonadFieldVisualRef = useRef(monadFieldStage);
  const previousContractFieldVisualRef = useRef(contractFieldStage);
  const wasMovingRef = useRef(false);
  const onEnterRef = useRef(onEnter);
  const onMessageRef = useRef(onMessage);
  const [hydrated, setHydrated] = useState(false);
  const [fieldTransitioning, setFieldTransitioning] = useState(false);
  const [destinationMarker, setDestinationMarker] = useState<WorldPoint | null>(null);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [pose, setPose] = useState<Pose>({
    position: { ...SPAWN_POINT },
    direction: "down",
    motion: "idle",
  });

  useEffect(() => {
    if (
      !hydrated ||
      (previousFieldVisualRef.current === fieldStage &&
        previousMonadFieldVisualRef.current === monadFieldStage &&
        previousContractFieldVisualRef.current === contractFieldStage)
    ) {
      previousFieldVisualRef.current = fieldStage;
      previousMonadFieldVisualRef.current = monadFieldStage;
      previousContractFieldVisualRef.current = contractFieldStage;
      return;
    }
    previousFieldVisualRef.current = fieldStage;
    previousMonadFieldVisualRef.current = monadFieldStage;
    previousContractFieldVisualRef.current = contractFieldStage;
    setFieldTransitioning(true);
    const timeout = window.setTimeout(() => setFieldTransitioning(false), 900);
    return () => window.clearTimeout(timeout);
  }, [contractFieldStage, fieldStage, monadFieldStage, hydrated]);

  useEffect(() => {
    onEnterRef.current = onEnter;
    onMessageRef.current = onMessage;
  }, [onEnter, onMessage]);

  function persistScene(nextPose: Pose = pose) {
    if (!hydrated || previewMode) return;
    window.localStorage.setItem(
      SCENE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        x: Math.round(nextPose.position.x * 100) / 100,
        y: Math.round(nextPose.position.y * 100) / 100,
        direction: nextPose.direction,
      }),
    );
  }

  function clearMovement() {
    pressedKeysRef.current.clear();
    pathRef.current = [];
    pendingTravelRef.current = null;
    wasMovingRef.current = false;
    setDestinationMarker(null);
    setPose((value) => ({ ...value, motion: "idle" }));
  }

  function startTravel(
    portal: ScenePortal,
    destination: SceneDestination,
    chapter?: number,
  ) {
    const path = findPath(positionRef.current, portal.position);
    if (path.length < 2) {
      if (distanceBetween(positionRef.current, portal.position) <= portal.interactionRadius) {
        pendingTravelRef.current = null;
        persistScene({
          position: positionRef.current,
          direction: directionRef.current,
          motion: "interacting",
        });
        onEnterRef.current(destination, chapter);
        return;
      }
      onMessageRef.current("那里无法到达", "warning");
      return;
    }
    pressedKeysRef.current.clear();
    pathRef.current = path.slice(1);
    pendingTravelRef.current = { portal, destination, chapter };
    setDestinationMarker(portal.position);
    onMessageRef.current(`正在前往${portal.label}`, "info");
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const preset = previewMode ? previewPose(params.get("preview")) : null;
      const stored = preset
        ? { version: 1 as const, x: preset.position.x, y: preset.position.y, direction: preset.direction }
        : readStoredSceneState(window.localStorage.getItem(SCENE_STORAGE_KEY));
      const initialPose: Pose = preset ?? {
        position: { x: stored.x, y: stored.y },
        direction: stored.direction,
        motion: "idle",
      };
      positionRef.current = initialPose.position;
      directionRef.current = initialPose.direction;
      setPose(initialPose);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [previewMode]);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) return;
    const update = () => {
      const bounds = viewportElement.getBoundingClientRect();
      setViewport({ width: bounds.width, height: bounds.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!travelRequest || travelRequest.token === lastTravelTokenRef.current) return;
    lastTravelTokenRef.current = travelRequest.token;
    const portal = SCENE_PORTALS.find((entry) => entry.id === travelRequest.portalId);
    if (portal) startTravel(portal, travelRequest.destination, travelRequest.chapter);
  // startTravel reads live refs; the token is the only execution trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelRequest]);

  useEffect(() => {
    if (resetToken === 0) return;
    const frame = window.requestAnimationFrame(() => {
      clearMovement();
      const resetPose: Pose = {
        position: { ...SPAWN_POINT },
        direction: "down",
        motion: "idle",
      };
      positionRef.current = resetPose.position;
      directionRef.current = resetPose.direction;
      setPose(resetPose);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [resetToken]);

  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (drawerOpen || isTextEntryTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (MOVEMENT_KEYS.has(key)) {
        event.preventDefault();
        pathRef.current = [];
        pendingTravelRef.current = null;
        setDestinationMarker(null);
        pressedKeysRef.current.add(key);
        return;
      }
      if (key === "e" || event.code === "Space" || key === "enter") {
        if (event.target instanceof HTMLElement && event.target.closest("button, a")) return;
        const portal = portalWithinReach(positionRef.current);
        if (!portal) return;
        event.preventDefault();
        const destination = portalDestinations[portal.id];
        persistScene({
          position: positionRef.current,
          direction: directionRef.current,
          motion: "interacting",
        });
        onEnterRef.current(destination);
      }
    }

    function keyUp(event: KeyboardEvent) {
      pressedKeysRef.current.delete(event.key.toLowerCase());
    }

    function clearKeys() {
      pressedKeysRef.current.clear();
    }

    function handleVisibility() {
      if (document.hidden) {
        clearKeys();
        persistScene({
          position: positionRef.current,
          direction: directionRef.current,
          motion: "idle",
        });
      }
    }

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clearKeys);
    window.addEventListener("pagehide", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clearKeys);
      window.removeEventListener("pagehide", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  // The event handlers intentionally use live refs for position and callbacks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, portalDestinations, hydrated, previewMode]);

  useEffect(() => {
    if (!hydrated) return;
    function frame(time: number) {
      const elapsed = lastFrameRef.current ? Math.min(0.032, (time - lastFrameRef.current) / 1000) : 0;
      lastFrameRef.current = time;
      if (drawerOpen || document.hidden) {
        if (wasMovingRef.current) {
          wasMovingRef.current = false;
          setPose((value) => ({ ...value, motion: "idle" }));
        }
        frameRef.current = window.requestAnimationFrame(frame);
        return;
      }

      const keys = pressedKeysRef.current;
      const keyboardX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const keyboardY = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      let vector = normalizeMovement(keyboardX, keyboardY);
      let targetDistance = Number.POSITIVE_INFINITY;

      if (vector.x === 0 && vector.y === 0 && pathRef.current.length > 0) {
        const target = pathRef.current[0];
        const x = target.x - positionRef.current.x;
        const y = target.y - positionRef.current.y;
        targetDistance = Math.hypot(x, y);
        if (targetDistance <= 5) {
          pathRef.current.shift();
        } else {
          vector = normalizeMovement(x, y);
        }
      }

      if (vector.x !== 0 || vector.y !== 0) {
        const maximumStep = PLAYER_SPEED * elapsed;
        const step = Math.min(maximumStep, targetDistance);
        const previous = positionRef.current;
        const next = moveWithCollision(previous, { x: vector.x * step, y: vector.y * step });
        const moved = distanceBetween(previous, next) > 0.01;
        if (moved) {
          const direction = directionFromVector(vector.x, vector.y, directionRef.current);
          positionRef.current = next;
          directionRef.current = direction;
          wasMovingRef.current = true;
          setPose({ position: next, direction, motion: "walking" });
        } else if (step > 0 && pathRef.current.length > 0) {
          pathRef.current = [];
          pendingTravelRef.current = null;
          setDestinationMarker(null);
          onMessageRef.current("那里无法到达", "warning");
        }
      } else if (wasMovingRef.current) {
        wasMovingRef.current = false;
        const idlePose: Pose = {
          position: positionRef.current,
          direction: directionRef.current,
          motion: "idle",
        };
        setPose(idlePose);
        persistScene(idlePose);
      }

      const pending = pendingTravelRef.current;
      if (
        pending &&
        distanceBetween(positionRef.current, pending.portal.position) <= pending.portal.interactionRadius
      ) {
        pathRef.current = [];
        pendingTravelRef.current = null;
        setDestinationMarker(null);
        const interactingPose: Pose = {
          position: positionRef.current,
          direction: directionRef.current,
          motion: "interacting",
        };
        setPose(interactingPose);
        persistScene(interactingPose);
        onEnterRef.current(pending.destination, pending.chapter);
      }

      frameRef.current = window.requestAnimationFrame(frame);
    }
    frameRef.current = window.requestAnimationFrame(frame);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      lastFrameRef.current = 0;
    };
  // The animation loop is isolated from parent renders through refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, hydrated, previewMode]);

  const camera = useMemo(
    () => getCameraTransform(pose.position, viewport.width, viewport.height),
    [pose.position, viewport],
  );
  const activePortal = portalWithinReach(pose.position);

  function handleGroundClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (drawerOpen || (event.target as HTMLElement).closest("button")) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const target = {
      x: (event.clientX - bounds.left - camera.x) / camera.scale,
      y: (event.clientY - bounds.top - camera.y) / camera.scale,
    };
    const path = findPath(positionRef.current, target);
    if (path.length < 2) {
      onMessageRef.current("那里无法到达", "warning");
      return;
    }
    pressedKeysRef.current.clear();
    pathRef.current = path.slice(1);
    pendingTravelRef.current = null;
    setDestinationMarker(path.at(-1) ?? target);
  }

  return (
    <section className="world-viewport" ref={viewportRef} aria-label="可探索的 web3world 像素世界" tabIndex={0}>
      <div className="world-click-layer" onClick={handleGroundClick}>
        <div
          className="world-layer"
          style={{
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="world-map-art" src="/art/farm-map.png" alt="" />
          <CourseFieldLayer
            stage={fieldStage}
            monadStage={monadFieldStage}
            monadStarted={monadStarted}
            contractStage={contractFieldStage}
            contractStarted={contractStarted}
            transitioning={fieldTransitioning}
          />
          {securityStage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={`world-security-house stage-${securityStage}`}
              src="/art/security-training-house.svg"
              alt="Web3 安全训练场独立像素房屋"
              style={{
                left: SECURITY_GREENHOUSE_BUILDING.x,
                top: SECURITY_GREENHOUSE_BUILDING.y,
              }}
            />
          )}
          <div
            className="world-smithy-house"
            style={{ left: SMITHY_ENTRY.x, top: SMITHY_ENTRY.y }}
            role="img"
            aria-label="铁匠铺像素房屋，回答 Web3 知识锻造装备"
          >
            <span className="smithy-house-roof" />
            <span className="smithy-house-body" />
            <span className="smithy-house-door" />
            <span className="smithy-house-window smithy-house-window-left" />
            <span className="smithy-house-window smithy-house-window-right" />
            <span className="smithy-house-chimney" />
            <span className="smithy-house-anvil" />
            <span className="smithy-house-sign">IRON<br />WEB3</span>
          </div>
          <div className={`world-time-overlay phase-${worldClock.phase}`} aria-hidden="true" />
          <div className={`world-stars phase-${worldClock.phase}`} aria-hidden="true" />
          <div className="world-vignette" />
          {securityStage && (
            <span
              className={`world-security-greenhouse stage-${securityStage}`}
              style={{ left: SECURITY_GREENHOUSE_MARKER.x, top: SECURITY_GREENHOUSE_MARKER.y }}
              aria-hidden="true"
            >
              <i className="world-security-icon">❖</i>
            </span>
          )}
          {destinationMarker && (
            <span
              className="world-destination-marker"
              style={{ left: destinationMarker.x, top: destinationMarker.y }}
              aria-hidden="true"
            ><i /></span>
          )}
          {SCENE_PORTALS.map((portal) => (
            <button
              className={`world-portal portal-${portal.id} ${activePortal?.id === portal.id ? "is-near" : ""}`}
              key={portal.id}
              style={{
                left: (portal.markerPosition ?? portal.position).x,
                top: (portal.markerPosition ?? portal.position).y,
              }}
              onClick={(event) => {
                event.stopPropagation();
                startTravel(portal, portalDestinations[portal.id]);
              }}
              aria-label={`${portal.label}：${portalStatuses[portal.id]}`}
            >
              <span>{portal.id === "knowledge-tower" ? "▤" : portal.id === "seed-shop" ? "✦" : portal.id === "fishing-pond" ? "≈" : portal.id === "course-fields" ? "⌁" : portal.id === "smithy" ? "⚒" : portal.id === "security-greenhouse" ? "❖" : "◆"}</span>
              <span className="portal-copy"><b>{portal.label}</b><small>{portalStatuses[portal.id]}</small></span>
            </button>
          ))}
          <div
            className={`world-player facing-${pose.direction} motion-${pose.motion}`}
            style={{ left: pose.position.x, top: pose.position.y, zIndex: Math.round(pose.position.y) }}
            role="img"
            aria-label={`Monad 农场学徒，面向${pose.direction === "up" ? "上" : pose.direction === "down" ? "下" : pose.direction === "left" ? "左" : "右"}方，${pose.motion === "walking" ? "正在行走" : pose.motion === "interacting" ? "正在互动" : "站立中"}`}
          >
            <span className="player-shadow" />
            <span className="player-sprite" />
            {pose.motion !== "idle" && (
              <span className="player-feedback" aria-hidden="true">
                {pose.motion === "interacting" ? "正在互动" : destinationMarker ? "自动带路" : "正在移动"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="explore-quest pixel-frame">
        <span className="avatar-portrait" aria-hidden="true" />
        <div className="quest-copy">
          <small>第 {courseOrder} 关 · 第 {courseOrder} 格 · {courseTitle}</small>
          <b>{primaryLabel}</b>
          <span>{stage}</span>
        </div>
        <button onClick={onPrimary}>自动带路</button>
      </div>

      <div className="control-hint" aria-live="polite">
        {activePortal ? (
          <><kbd>E</kbd><span>进入{activePortal.label}</span></>
        ) : (
          <><kbd>WASD</kbd><span>或方向键移动 · 点击地面自动行走</span></>
        )}
      </div>
    </section>
  );
}
