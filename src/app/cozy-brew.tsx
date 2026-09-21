"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fredoka, Quicksand } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import styles from "./cozy-brew.module.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-fredoka",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-quicksand",
});

// Where "stepping inside" lands. The first working screen of the app.
const ENTER_ROUTE = "/suppliers";

// The dive lasts this long, then the veil is fully opaque and we route.
// The camera reaches the cup at DIVE_ARRIVE and holds there while the
// veil fades over the last stretch, so the "into the coffee" beat is
// actually seen rather than hidden behind the fade.
const ENTER_MS = 1700;
const ENTER_MS_REDUCED = 350;
const DIVE_ARRIVE = 0.85;
const VEIL_FROM = 0.82;

// A press that moves less than this (px) and releases within this time
// (ms) is a tap, not the start of a drag-to-orbit.
const TAP_SLOP = 6;
const TAP_MS = 500;

const COLOR = {
  espresso: 0x3b2417,
  mocha: 0x8c5a3b,
  cream: 0xfff6e6,
  terracotta: 0xe2703a,
  terracottaDk: 0xc85a2a,
  sage: 0x6e8f68,
  sageDk: 0x4f6b4b,
  tableTop: 0x7a4b32,
  steam: 0xfffbf2,
} as const;

const CAM_BASE_HEIGHT = 3.1;
const CAM_DIST = 9.6;
const CAM_LOOK = new THREE.Vector3(0, -0.15, 0);

// Cup sits at (0, -0.9, 0.2); its coffee surface is 1.36 above that.
// The dive ends hovering just over the coffee, looking straight down
// into it, so the last frame is a disc of espresso before the veil.
const DIVE_POS = new THREE.Vector3(0, 0.92, 0.2);
const DIVE_LOOK = new THREE.Vector3(0, 0.46, 0.2);

type Scene = {
  setSize(w: number, h: number): void;
  // Advance the scene by dt seconds and draw a frame.
  frame(dt: number, opts: { playing: boolean; dive: number | null }): void;
  // Drag-to-orbit input, in screen pixels.
  orbitBy(dx: number, dy: number): void;
  // Freeze the current camera pose as the dive's starting point.
  beginDive(): void;
  dispose(): void;
};

function easeInCubic(t: number) {
  return t * t * t;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function buildScene(
  stage: HTMLElement,
  labelFont: string,
  reducedMotion: boolean,
): Scene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  // ---------- toon gradient map ----------
  const gradCanvas = document.createElement("canvas");
  gradCanvas.width = 4;
  gradCanvas.height = 1;
  const gradCtx = gradCanvas.getContext("2d")!;
  ["#5b5b5b", "#9a9a9a", "#d3d3d3", "#ffffff"].forEach((shade, i) => {
    gradCtx.fillStyle = shade;
    gradCtx.fillRect(i, 0, 1, 1);
  });
  const gradientMap = new THREE.CanvasTexture(gradCanvas);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;

  const toonMat = (
    color: THREE.ColorRepresentation,
    extra?: THREE.MeshToonMaterialParameters,
  ) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });

  // Outline helper: a dark back-face shell, scaled slightly up.
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x241207,
    side: THREE.BackSide,
  });
  const withOutline = (mesh: THREE.Mesh, scale = 1.045) => {
    const outline = new THREE.Mesh(mesh.geometry, outlineMat);
    outline.scale.multiplyScalar(scale);
    mesh.add(outline);
    return mesh;
  };

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xffefd6, 0x6b4a33, 0.75));

  const sun = new THREE.DirectionalLight(0xffeacb, 1.05);
  sun.position.set(4.5, 7, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.003;
  scene.add(sun);

  const fill = new THREE.PointLight(0xe2703a, 0.35, 12);
  fill.position.set(-4, 2.5, -3);
  scene.add(fill);

  // ---------- ground / table ----------
  const world = new THREE.Group();
  scene.add(world);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), toonMat(0xd9b482));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.62;
  floor.receiveShadow = true;
  world.add(floor);

  const tableTop = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.55, 0.34, 32),
    toonMat(COLOR.tableTop),
  );
  tableTop.position.y = -1.28;
  tableTop.receiveShadow = true;
  tableTop.castShadow = true;
  withOutline(tableTop, 1.02);
  world.add(tableTop);

  const tableRim = new THREE.Mesh(
    new THREE.TorusGeometry(4.45, 0.07, 10, 36),
    toonMat(COLOR.mocha),
  );
  tableRim.rotation.x = Math.PI / 2;
  tableRim.position.y = -1.1;
  world.add(tableRim);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.65, 0.9, 16),
    toonMat(COLOR.espresso),
  );
  pedestal.position.y = -1.9;
  world.add(pedestal);

  // ---------- saucer + cup ----------
  const cupGroup = new THREE.Group();
  cupGroup.position.set(0, -0.9, 0.2);
  world.add(cupGroup);

  const saucer = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.5, 0.13, 32),
    toonMat(COLOR.cream),
  );
  saucer.castShadow = true;
  saucer.receiveShadow = true;
  withOutline(saucer, 1.04);
  cupGroup.add(saucer);

  const saucerLip = new THREE.Mesh(
    new THREE.TorusGeometry(1.32, 0.05, 8, 32),
    toonMat(COLOR.terracotta),
  );
  saucerLip.rotation.x = Math.PI / 2;
  saucerLip.position.y = 0.07;
  cupGroup.add(saucerLip);

  // "Onyx Cafe" wrapped around the cup, drawn onto a canvas texture.
  const cupCanvas = document.createElement("canvas");
  cupCanvas.width = 512;
  cupCanvas.height = 256;
  const cupCtx = cupCanvas.getContext("2d")!;
  const cupTex = new THREE.CanvasTexture(cupCanvas);
  cupTex.colorSpace = THREE.SRGBColorSpace;
  const drawCupLabel = () => {
    cupCtx.clearRect(0, 0, 512, 256);
    cupCtx.fillStyle = "#FFF6E6";
    cupCtx.fillRect(0, 0, 512, 256);
    cupCtx.fillStyle = "#E2703A";
    cupCtx.fillRect(0, 60, 512, 136);
    cupCtx.fillStyle = "#FFF6E6";
    cupCtx.textAlign = "center";
    cupCtx.textBaseline = "middle";
    cupCtx.font = `700 72px ${labelFont}`;
    cupCtx.fillText("Onyx Cafe", 256, 128);
    cupTex.needsUpdate = true;
  };
  drawCupLabel();
  // Redraw once the webfont has actually arrived so the label isn't
  // stuck in the fallback face.
  let fontsAlive = true;
  document.fonts?.ready.then(() => {
    if (fontsAlive) drawCupLabel();
  });

  const cupBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.98, 0.78, 1.3, 28, 1, true),
    new THREE.MeshToonMaterial({ map: cupTex, gradientMap, side: THREE.DoubleSide }),
  );
  cupBody.position.y = 0.75;
  cupBody.castShadow = true;
  withOutline(cupBody, 1.035);
  cupGroup.add(cupBody);

  const cupBottom = new THREE.Mesh(new THREE.CircleGeometry(0.78, 28), toonMat(COLOR.cream));
  cupBottom.rotation.x = Math.PI / 2;
  cupBottom.position.y = 0.1;
  cupGroup.add(cupBottom);

  const cupRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.075, 10, 32),
    toonMat(COLOR.cream),
  );
  cupRim.rotation.x = Math.PI / 2;
  cupRim.position.y = 1.4;
  cupGroup.add(cupRim);

  const coffeeSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 28),
    toonMat(COLOR.espresso),
  );
  coffeeSurface.rotation.x = -Math.PI / 2;
  coffeeSurface.position.y = 1.36;
  cupGroup.add(coffeeSurface);

  // ---------- macarons on a plate ----------
  const pastryGroup = new THREE.Group();
  pastryGroup.position.set(2.8, -0.9, -0.4);
  world.add(pastryGroup);

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.3, 0.1, 28),
    toonMat(COLOR.cream),
  );
  plate.castShadow = true;
  plate.receiveShadow = true;
  withOutline(plate, 1.03);
  pastryGroup.add(plate);

  const plateLip = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.045, 8, 28),
    toonMat(COLOR.terracotta),
  );
  plateLip.rotation.x = Math.PI / 2;
  plateLip.position.y = 0.06;
  pastryGroup.add(plateLip);

  const macColors = [0xf4a7b9, 0xb5d5a8, 0xf9d98c]; // pink, pistachio, lemon
  const fillingMat = toonMat(0xfff0d0);
  macColors.forEach((col, mc) => {
    const yOff = 0.14 + mc * 0.38;
    const shellMat = toonMat(col);
    const shellGeo = new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);

    const topShell = new THREE.Mesh(shellGeo, shellMat);
    topShell.position.set(0, yOff + 0.14, 0);
    topShell.castShadow = true;
    withOutline(topShell, 1.04);
    pastryGroup.add(topShell);

    const botShell = new THREE.Mesh(shellGeo, shellMat);
    botShell.rotation.x = Math.PI;
    botShell.position.set(0, yOff - 0.14, 0);
    botShell.castShadow = true;
    withOutline(botShell, 1.04);
    pastryGroup.add(botShell);

    const filling = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.13, 20), fillingMat);
    filling.position.set(0, yOff, 0);
    pastryGroup.add(filling);

    const footGeo = new THREE.TorusGeometry(0.36, 0.055, 6, 20);
    [0.02, -0.02].forEach((dy) => {
      const foot = new THREE.Mesh(footGeo, shellMat);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(0, yOff + dy, 0);
      pastryGroup.add(foot);
    });
  });

  // ---------- steam ----------
  const steamGroup = new THREE.Group();
  steamGroup.position.copy(cupGroup.position);
  steamGroup.position.y += 1.5;
  world.add(steamGroup);

  const STEAM_COUNT = 9;
  type Puff = { mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshToonMaterial>; seed: number; lane: number; speed: number; t: number };
  const steamPuffs: Puff[] = [];
  for (let i = 0; i < STEAM_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11 + Math.random() * 0.05, 10, 10),
      toonMat(COLOR.steam, { transparent: true, opacity: 0.85 }),
    );
    steamGroup.add(mesh);
    steamPuffs.push({
      mesh,
      seed: Math.random() * 10,
      lane: i % 3,
      speed: 0.55 + Math.random() * 0.25,
      t: (i / STEAM_COUNT) * 2.4,
    });
  }

  // ---------- bean characters ----------
  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x241207 });
  const cheekGeo = new THREE.CircleGeometry(0.055, 12);
  const cheekMat = new THREE.MeshBasicMaterial({
    color: 0xe2703a,
    transparent: true,
    opacity: 0.45,
  });
  const makeBean = (color: number) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), toonMat(color));
    body.scale.set(1, 1.18, 0.82);
    body.castShadow = true;
    withOutline(body, 1.06);
    g.add(body);

    const crease = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.1), toonMat(COLOR.espresso));
    crease.position.z = 0.28;
    g.add(crease);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.13, 0.08, 0.36);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13;
    g.add(eyeL, eyeR);

    const cheekL = new THREE.Mesh(cheekGeo, cheekMat);
    cheekL.position.set(-0.22, -0.03, 0.355);
    const cheekR = cheekL.clone();
    cheekR.position.x = 0.22;
    g.add(cheekL, cheekR);
    return g;
  };

  const beanOrbit = [
    { r: 1.85, h: 0.15, speed: 0.18, offset: 0 },
    { r: 2.15, h: -0.05, speed: -0.14, offset: 2.1 },
    { r: 1.6, h: 0.4, speed: 0.22, offset: 4.2 },
  ];
  const beans = [COLOR.espresso, COLOR.mocha, 0x5c3a24].map((col, idx) => {
    const bean = makeBean(col);
    const o = beanOrbit[idx];
    bean.position.set(Math.cos(o.offset) * o.r, o.h, Math.sin(o.offset) * o.r + 0.2);
    world.add(bean);
    return bean;
  });

  // ---------- plant ----------
  const plantGroup = new THREE.Group();
  plantGroup.position.set(-2.15, -1.02, -0.6);
  world.add(plantGroup);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.26, 0.5, 12),
    toonMat(COLOR.terracottaDk),
  );
  pot.castShadow = true;
  withOutline(pot, 1.05);
  plantGroup.add(pot);

  [COLOR.sage, COLOR.sageDk, COLOR.sage].forEach((col, f) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32 - f * 0.03, 12, 10), toonMat(col));
    leaf.position.set(Math.cos(f * 2.1) * 0.16, 0.45 + f * 0.22, Math.sin(f * 2.1) * 0.16);
    leaf.castShadow = true;
    plantGroup.add(leaf);
  });

  // ---------- scalloped awning ----------
  const awningGroup = new THREE.Group();
  awningGroup.position.set(0, 3.05, -2.6);
  awningGroup.rotation.x = -0.18;
  world.add(awningGroup);

  const canopyBack = new THREE.Mesh(
    new THREE.CylinderGeometry(3.3, 3.3, 1.1, 24, 1, true, 0, Math.PI),
    toonMat(COLOR.cream, { side: THREE.DoubleSide }),
  );
  canopyBack.rotation.z = Math.PI / 2;
  canopyBack.rotation.y = Math.PI / 2;
  awningGroup.add(canopyBack);

  const SCALLOP_COUNT = 9;
  for (let s = 0; s < SCALLOP_COUNT; s++) {
    const ang = -Math.PI / 2 + (s / (SCALLOP_COUNT - 1)) * Math.PI;
    const scallop = new THREE.Mesh(
      new THREE.ConeGeometry(0.44, 0.5, 10),
      toonMat(s % 2 === 0 ? COLOR.terracotta : COLOR.cream),
    );
    scallop.rotation.x = Math.PI;
    scallop.position.set(Math.cos(ang) * 3.3, -0.75, Math.sin(ang) * 3.3);
    scallop.lookAt(0, -1.6, 0);
    scallop.castShadow = true;
    awningGroup.add(scallop);
  }

  // ---------- camera state ----------
  let autoAngle = 0;
  let userYaw = 0;
  let userPitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let elapsed = 0;

  const diveFromPos = new THREE.Vector3();
  const diveFromLook = new THREE.Vector3();
  const scratchPos = new THREE.Vector3();
  const scratchLook = new THREE.Vector3();

  camera.position.set(0, CAM_BASE_HEIGHT, CAM_DIST);
  camera.lookAt(CAM_LOOK);

  const placeOrbitCamera = () => {
    const yaw = autoAngle + userYaw;
    const pitch = 0.12 + userPitch;
    camera.position.x = Math.sin(yaw) * CAM_DIST * Math.cos(pitch);
    camera.position.z = Math.cos(yaw) * CAM_DIST * Math.cos(pitch);
    camera.position.y = CAM_BASE_HEIGHT + Math.sin(pitch) * CAM_DIST * 0.6;
    camera.lookAt(CAM_LOOK);
  };

  return {
    setSize(w, h) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    orbitBy(dx, dy) {
      targetYaw += dx * 0.005;
      targetPitch = Math.max(-0.35, Math.min(0.45, targetPitch + dy * 0.004));
    },

    beginDive() {
      diveFromPos.copy(camera.position);
      diveFromLook.copy(CAM_LOOK);
    },

    frame(dt, { playing, dive }) {
      elapsed += dt;
      userYaw += (targetYaw - userYaw) * 0.08;
      userPitch += (targetPitch - userPitch) * 0.08;

      // While diving the steam rushes up and the beans keep going,
      // regardless of the pause toggle.
      const animating = playing || dive !== null;
      const steamBoost = dive === null ? 1 : 1 + dive * 2.5;

      if (animating) {
        if (dive === null) autoAngle += dt * (reducedMotion ? 0 : 0.12);

        for (const p of steamPuffs) {
          p.t += dt * p.speed * steamBoost;
          const localT = p.t % 2.4;
          const laneOffset = (p.lane - 1) * 0.18;
          p.mesh.position.set(
            Math.sin(localT * 2.2 + p.seed) * 0.18 + laneOffset * 0.4,
            localT * 1.15,
            Math.cos(localT * 1.7 + p.seed) * 0.14,
          );
          const life = localT / 2.4;
          p.mesh.scale.setScalar(0.6 + life * 0.9);
          p.mesh.material.opacity = Math.max(
            0,
            0.85 * (1 - life) * (life < 0.08 ? life / 0.08 : 1),
          );
        }

        beans.forEach((bean, idx) => {
          const o = beanOrbit[idx];
          const ang = o.offset + elapsed * o.speed;
          bean.position.x = Math.cos(ang) * o.r;
          bean.position.z = Math.sin(ang) * o.r + 0.2;
          bean.position.y = o.h + Math.sin(elapsed * 1.8 + idx * 1.7) * 0.12 - 0.55;
          bean.rotation.y = -ang + Math.PI / 2;
          bean.rotation.z = Math.sin(elapsed * 2.2 + idx) * 0.12;
        });

        const pulse = 1 + Math.sin(elapsed * 1.6) * 0.008;
        cupGroup.scale.set(pulse, (1 / pulse) * 0.02 + 1, pulse);
      }

      if (dive === null || reducedMotion) {
        placeOrbitCamera();
      } else {
        // Swoop from wherever the orbit left us down into the cup,
        // accelerating so the last stretch feels like falling in.
        const k = easeInCubic(Math.min(1, dive / DIVE_ARRIVE));
        scratchPos.lerpVectors(diveFromPos, DIVE_POS, k);
        scratchLook.lerpVectors(diveFromLook, DIVE_LOOK, smoothstep(0, 0.7, dive));
        camera.position.copy(scratchPos);
        camera.lookAt(scratchLook);
      }

      renderer.render(scene, camera);
    },

    dispose() {
      fontsAlive = false;
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      gradientMap.dispose();
      cupTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function CozyBrew() {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);

  // Mutable animation state read from inside the RAF loop; kept in refs
  // so toggling doesn't rebuild the scene.
  const playingRef = useRef(true);
  const enterStartRef = useRef<number | null>(null);
  const reducedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [entering, setEntering] = useState(false);

  const enter = useCallback(() => {
    if (enterStartRef.current !== null) return;
    enterStartRef.current = performance.now();
    sceneRef.current?.beginDive();
    setEntering(true);
  }, []);

  useEffect(() => {
    router.prefetch(ENTER_ROUTE);
  }, [router]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    reducedRef.current = reduced;
    playingRef.current = !reduced;
    setPlaying(!reduced);

    const scene = buildScene(stage, fredoka.style.fontFamily, reduced);
    sceneRef.current = scene;

    const resize = () => scene.setSize(stage.clientWidth, stage.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    // ---------- pointer: drag orbits, a clean tap enters ----------
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let downAt = 0;
    let moved = false;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
      downAt = e.timeStamp;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_SLOP) moved = true;
      scene.orbitBy(dx, dy);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (!moved && e.timeStamp - downAt < TAP_MS) enter();
    };
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    // ---------- animation loop ----------
    let raf = 0;
    let last = performance.now();
    let navigated = false;
    const veil = veilRef.current;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      let dive: number | null = null;
      const start = enterStartRef.current;
      if (start !== null) {
        const dur = reducedRef.current ? ENTER_MS_REDUCED : ENTER_MS;
        dive = Math.min(1, (now - start) / dur);
        if (veil) {
          veil.style.opacity = String(
            reducedRef.current ? dive : smoothstep(VEIL_FROM, 1, dive),
          );
        }
        if (dive >= 1 && !navigated) {
          navigated = true;
          router.push(ENTER_ROUTE);
        }
      }

      scene.frame(dt, { playing: playingRef.current, dive });
    };
    raf = requestAnimationFrame(loop);
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [enter, router]);

  const togglePlaying = () => {
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
  };

  return (
    <div className={`${styles.root} ${fredoka.variable} ${quicksand.variable}`}>
      <div ref={stageRef} className={styles.stage} aria-hidden="true">
        <div className={`${styles.loading} ${ready ? styles.loadingHidden : ""}`}>
          brewing the scene…
        </div>
      </div>

      <div className={`${styles.overlay} ${entering ? styles.overlayHidden : ""}`}>
        <div className={styles.titleCard}>
          <h1>Onyx Cafe</h1>
          <p>Tap the table to step inside.</p>
        </div>
        <div className={styles.bottomRow}>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.pill}
              onClick={togglePlaying}
              aria-pressed={!playing}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <Link
              href={ENTER_ROUTE}
              className={`${styles.pill} ${styles.pillPrimary}`}
              onClick={(e) => {
                e.preventDefault();
                enter();
              }}
            >
              Step inside →
            </Link>
          </div>
          <span className={styles.caption}>drag to look around</span>
        </div>
      </div>

      <div ref={veilRef} className={styles.veil} aria-hidden="true" />
    </div>
  );
}
