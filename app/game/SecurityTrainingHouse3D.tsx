"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import { cancelFrame, requestFrame } from "./animation-frame";
import type { GreenhouseStage } from "./security/types";

const HOUSE_WIDTH = 280;
const HOUSE_HEIGHT = 220;
const PIXEL_GLYPHS: Record<string, string[]> = {
  W: ["#.#", "#.#", "#.#", "###", "#.#"],
  E: ["###", "#..", "##.", "#..", "###"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  S: [".##", "#..", ".#.", "..#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
};

function makeBox(
  geometry: THREE.BoxGeometry,
  material: THREE.Material,
  position: [number, number, number],
  parent: THREE.Group,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPixelText(
  parent: THREE.Group,
  value: string,
  material: THREE.Material,
  geometry: THREE.BoxGeometry,
  y: number,
  z: number,
) {
  const cell = 0.09;
  const advance = cell * 4;
  const startX = -((value.length - 1) * advance + cell * 3) / 2;
  [...value].forEach((character, characterIndex) => {
    const glyph = PIXEL_GLYPHS[character];
    if (!glyph) return;
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel !== "#") return;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          startX + characterIndex * advance + columnIndex * cell,
          y - rowIndex * cell,
          z,
        );
        mesh.castShadow = false;
        parent.add(mesh);
      });
    });
  });
}

export function SecurityTrainingHouse3D({
  stage,
  style,
}: {
  stage: GreenhouseStage;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      canvas.dataset.webglFallback = "true";
      canvas.parentElement?.setAttribute("data-webgl-fallback", "true");
      return;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(HOUSE_WIDTH, HOUSE_HEIGHT, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5.9, 5.9, 4.8, -4.8, 0.1, 100);
    camera.position.set(7.5, 6.5, 9.5);
    camera.lookAt(0, 1.2, 0);

    const muted = stage === "locked";
    scene.add(new THREE.HemisphereLight(0xffe6c1, 0x241b35, muted ? 1.6 : 1.65));
    const keyLight = new THREE.DirectionalLight(0xffdca0, muted ? 2 : 2.35);
    keyLight.position.set(-5, 9, 7);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const root = new THREE.Group();
    root.rotation.y = -0.22;
    root.scale.setScalar(0.74);
    scene.add(root);

    const wall = new THREE.MeshStandardMaterial({
      color: muted ? 0x756578 : 0x76505a,
      roughness: 0.92,
      flatShading: true,
    });
    const sideWall = new THREE.MeshStandardMaterial({
      color: muted ? 0x564859 : 0x553c48,
      roughness: 0.95,
      flatShading: true,
    });
    const roof = new THREE.MeshStandardMaterial({
      color: muted ? 0x806371 : 0x9c5d43,
      roughness: 0.86,
      flatShading: true,
    });
    const roofTile = new THREE.MeshStandardMaterial({
      color: muted ? 0x967080 : 0xb87551,
      roughness: 0.9,
      flatShading: true,
    });
    const roofEdge = new THREE.MeshStandardMaterial({
      color: muted ? 0x3c3042 : 0x60403c,
      roughness: 0.95,
      flatShading: true,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x211a2b, roughness: 0.96, flatShading: true });
    const door = new THREE.MeshStandardMaterial({ color: muted ? 0x211b2c : 0x30243a, roughness: 0.8, flatShading: true });
    const timber = new THREE.MeshStandardMaterial({
      color: muted ? 0x6b4b49 : 0xb47a55,
      roughness: 0.94,
      flatShading: true,
    });
    const window = new THREE.MeshStandardMaterial({
      color: muted ? 0x63838b : 0x9be1d5,
      emissive: muted ? 0x07151a : 0x23605a,
      emissiveIntensity: muted ? 0.18 : 0.5,
      roughness: 0.32,
      flatShading: true,
    });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xf2c35b,
      emissive: muted ? 0x2e2414 : 0x5d3e0c,
      emissiveIntensity: muted ? 0.25 : 0.75,
      roughness: 0.58,
      flatShading: true,
    });
    const security = new THREE.MeshStandardMaterial({
      color: muted ? 0x7252a0 : 0xc6a9ff,
      emissive: muted ? 0x1c1231 : 0x6c45d6,
      emissiveIntensity: muted ? 0.2 : 1.1,
      roughness: 0.42,
      flatShading: true,
    });
    const signFace = new THREE.MeshStandardMaterial({
      color: 0x292238,
      roughness: 0.86,
      flatShading: true,
    });
    const signLetters = new THREE.MeshBasicMaterial({ color: 0xffe4a0 });
    const stone = new THREE.MeshStandardMaterial({
      color: muted ? 0x50505f : 0x777982,
      roughness: 1,
      flatShading: true,
    });

    makeBox(new THREE.BoxGeometry(7.2, 0.42, 5.05), dark, [0, 0.21, 0], root);
    makeBox(new THREE.BoxGeometry(6.45, 2.75, 4.25), wall, [0, 1.78, 0], root);
    makeBox(new THREE.BoxGeometry(0.28, 2.55, 3.98), sideWall, [-3.1, 1.68, 0], root);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-3.15, 0);
    gableShape.lineTo(3.15, 0);
    gableShape.lineTo(0, 1.48);
    gableShape.closePath();
    const gable = new THREE.Mesh(
      new THREE.ExtrudeGeometry(gableShape, { depth: 0.16, bevelEnabled: false }),
      wall,
    );
    gable.position.set(0, 3.12, 2.08);
    gable.castShadow = true;
    root.add(gable);

    const roofAngle = 0.42;
    const roofPlane = new THREE.BoxGeometry(3.9, 0.34, 5.05);
    const leftRoof = makeBox(roofPlane, roof, [-1.62, 3.45, 0], root);
    leftRoof.rotation.z = roofAngle;
    const rightRoof = makeBox(roofPlane, roof, [1.62, 3.45, 0], root);
    rightRoof.rotation.z = -roofAngle;
    makeBox(new THREE.BoxGeometry(0.28, 0.28, 5.16), timber, [0, 4.19, 0], root);
    makeBox(new THREE.BoxGeometry(0.2, 0.22, 5.15), roofEdge, [-3.35, 2.74, 0], root);
    makeBox(new THREE.BoxGeometry(0.2, 0.22, 5.15), roofEdge, [3.35, 2.74, 0], root);

    const roofTileGeometry = new THREE.BoxGeometry(0.64, 0.11, 0.55);
    for (const side of [-1, 1]) {
      for (let column = 0; column < 4; column += 1) {
        const x = side * (0.48 + column * 0.78);
        const y = 4.17 - Math.abs(x) * 0.45;
        for (let row = 0; row < 7; row += 1) {
          const z = -2.14 + row * 0.7;
          const tile = makeBox(
            roofTileGeometry,
            (column + row) % 3 === 0 ? roofTile : roof,
            [x, y, z],
            root,
          );
          tile.rotation.z = side < 0 ? roofAngle : -roofAngle;
        }
      }
    }

    makeBox(new THREE.BoxGeometry(1.25, 2.05, 0.24), door, [0, 1.31, 2.2], root);
    makeBox(new THREE.BoxGeometry(1.37, 0.13, 0.26), timber, [0, 2.38, 2.22], root);
    makeBox(new THREE.BoxGeometry(0.13, 0.11, 0.12), gold, [0.43, 1.27, 2.35], root);
    makeBox(new THREE.BoxGeometry(0.09, 0.09, 0.1), gold, [0.46, 1.27, 2.37], root);
    makeBox(new THREE.BoxGeometry(0.18, 2.75, 0.2), timber, [-3.0, 1.78, 2.18], root);
    makeBox(new THREE.BoxGeometry(0.18, 2.75, 0.2), timber, [3.0, 1.78, 2.18], root);
    makeBox(new THREE.BoxGeometry(6.15, 0.16, 0.2), timber, [0, 2.75, 2.18], root);

    for (const x of [-2.05, 2.05]) {
      makeBox(new THREE.BoxGeometry(1.48, 1.04, 0.18), dark, [x, 1.72, 2.17], root);
      makeBox(new THREE.BoxGeometry(1.18, 0.72, 0.1), window, [x, 1.72, 2.29], root);
      makeBox(new THREE.BoxGeometry(0.09, 0.84, 0.1), timber, [x, 1.72, 2.35], root);
      makeBox(new THREE.BoxGeometry(1.34, 0.09, 0.1), timber, [x, 1.72, 2.35], root);
      makeBox(new THREE.BoxGeometry(1.64, 0.15, 0.28), roofEdge, [x, 2.32, 2.2], root);
      makeBox(new THREE.BoxGeometry(0.12, 1.18, 0.16), timber, [x - 0.78, 1.7, 2.15], root);
      makeBox(new THREE.BoxGeometry(0.12, 1.18, 0.16), timber, [x + 0.78, 1.7, 2.15], root);
    }

    makeBox(new THREE.BoxGeometry(2.8, 0.58, 0.2), dark, [0, 3.16, 2.24], root);
    makeBox(new THREE.BoxGeometry(2.64, 0.58, 0.08), signFace, [0, 3.16, 2.37], root);
    makeBox(new THREE.BoxGeometry(2.82, 0.08, 0.1), gold, [0, 3.48, 2.33], root);
    makeBox(new THREE.BoxGeometry(2.82, 0.08, 0.1), gold, [0, 2.84, 2.33], root);
    makeBox(new THREE.BoxGeometry(0.08, 0.64, 0.1), gold, [-1.37, 3.16, 2.33], root);
    makeBox(new THREE.BoxGeometry(0.08, 0.64, 0.1), gold, [1.37, 3.16, 2.33], root);
    addPixelText(root, "WEB3", signLetters, new THREE.BoxGeometry(0.09, 0.09, 0.07), 3.34, 2.45);

    makeBox(new THREE.BoxGeometry(0.72, 1.9, 0.7), roofEdge, [2.75, 3.08, -0.5], root);
    makeBox(new THREE.BoxGeometry(0.48, 0.36, 0.48), dark, [2.75, 4.18, -0.5], root);
    makeBox(new THREE.BoxGeometry(0.66, 0.66, 0.2), dark, [2.53, 2.73, 2.25], root);
    makeBox(new THREE.BoxGeometry(0.4, 0.4, 0.16), security, [2.53, 2.73, 2.4], root);
    const beacon = new THREE.PointLight(muted ? 0x7d5bb0 : 0xd0b7ff, muted ? 0.2 : 1.3, 4.5);
    beacon.position.set(2.53, 2.73, 2.55);
    root.add(beacon);

    for (const x of [-2.8, 2.8]) {
      makeBox(new THREE.BoxGeometry(0.55, 0.22, 0.3), stone, [x, 0.56, 2.18], root);
      makeBox(new THREE.BoxGeometry(0.48, 0.16, 0.28), stone, [x - 0.18, 0.75, 2.22], root);
    }
    makeBox(new THREE.BoxGeometry(1.66, 0.2, 0.58), stone, [0, 0.3, 2.58], root);
    makeBox(new THREE.BoxGeometry(1.36, 0.18, 0.42), stone, [0, 0.48, 2.38], root);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 8),
      new THREE.MeshBasicMaterial({ color: 0x171521, transparent: true, opacity: 0.32 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(1.15, 0.58, 1);
    ground.position.y = 0.02;
    root.add(ground);

    let frame = 0;
    const animate = (time: number) => {
      beacon.intensity = (muted ? 0.18 : 0.85) + (muted ? 0.08 : 0.3) * (0.5 + Math.sin(time * 0.004) * 0.5);
      renderer.render(scene, camera);
      frame = requestFrame(animate);
    };
    frame = requestFrame(animate);

    return () => {
      cancelFrame(frame);
      renderer.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material.dispose();
      });
    };
  }, [stage]);

  return (
    <div className={`world-security-house-3d stage-${stage}`} style={style} role="img" aria-label="Web3 安全训练场立体像素房屋">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="world-security-house-fallback" src="/art/security-training-house.svg" alt="" />
      <canvas ref={canvasRef} width={HOUSE_WIDTH} height={HOUSE_HEIGHT} />
    </div>
  );
}
