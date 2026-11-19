import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createOwlModel } from "../OwlCarrier/owlModel.js";
import { makeRoomTextures } from "./roomTextures.js";
import * as props from "./roomProps.js";
import * as magic from "./roomMagic.js";
import * as furniture from "./roomFurniture.js";
import { createSpells } from "./roomSpells.js";
import * as extras from "./roomExtras.js";
import { buildGryffindorBanner } from "./roomBanners.js";
import { loadRoomAssets, surfaceMaterial } from "./roomAssets.js";
import { createGuidedCamera } from "./guidedCamera.js";

// The tower room: a round stone bedroom high in the castle, furnished with
// real scanned models. The owl flies in through the window with a letter,
// hovers in front of you until you take it, then flies home to the top of
// her cage. You look around from hand-picked viewpoints, click glowing spots
// to go closer, and can pick up the wand to cast spells on almost anything.
//
// createRoomScene(host, options) resolves to { views, goTo, select, act,
// replay, resetView, setWand, dispose }. options: name, owlName, reduceMotion,
// and callbacks onProgress(0..1), onSelect(info | null), onNarrate(text),
// onLetterReady(ready), onWand(holding), onView(key).

const { R } = props.ROOM;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const clamp01 = (x) => clamp(x, 0, 1);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Hand-picked places to stand and look from.
const VIEWS = {
  overview: { label: "The room", position: v3(0.1, 1.62, 3.45), target: v3(0.1, 1.35, -1.0), fov: 52 },
  window: { label: "Window", position: v3(0.25, 1.62, -1.75), target: v3(0, 1.75, -4.4), fov: 50 },
  desk: { label: "Desk", position: v3(0.3, 1.45, -2.1), target: v3(0.05, 0.85, -3.25), fov: 48 },
  cage: { label: "Owl cage", position: v3(0.75, 1.75, -1.55), target: v3(1.75, 1.6, -3.0), fov: 50 },
  fireside: { label: "Fireside", position: v3(-0.65, 1.45, -0.55), target: v3(-3.2, 1.0, -1.85), fov: 54 },
  bed: { label: "Bed", position: v3(-0.9, 1.6, 2.55), target: v3(-2.8, 0.95, 0.35), fov: 52 },
  shelf: { label: "Bookshelf", position: v3(1.45, 1.55, 0.25), target: v3(3.4, 1.3, -1.2), fov: 50 },
};
const START_VIEW = VIEWS.overview;
const OWL_SCALE = 0.33;

function tiledCopy(t, n) {
  const c = t.clone();
  c.repeat.set(n, n);
  c.needsUpdate = true;
  return c;
}

function paintedTexture(w, h, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMaterials(tex, surfaces) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const covers = [
    [0.42, 0.06, 0.07], [0.08, 0.15, 0.32], [0.1, 0.25, 0.12], [0.35, 0.2, 0.08], [0.55, 0.42, 0.15],
    [0.04, 0.04, 0.05], [0.22, 0.12, 0.3], [0.08, 0.28, 0.32], [0.3, 0.1, 0.04], [0.45, 0.38, 0.3],
  ];
  return {
    // scanned surfaces (CC0, Poly Haven)
    floor: surfaceMaterial(surfaces.floor, 4.2, 4.2, { roughness: 0.95, envMapIntensity: 0.6 }),
    stone: surfaceMaterial(surfaces.stone, 1, 1, { color: 0xc9c2b8 }),
    stoneDark: std({ color: 0x2c2722, roughness: 0.95 }),
    walnut: surfaceMaterial(surfaces.wood, 1, 1, { roughness: 0.8 }),
    walnutDark: surfaceMaterial(surfaces.wood, 1, 1, { color: 0x8a7a70, roughness: 0.8 }),
    oak: std({ map: tex.oak.map, bumpMap: tex.oak.bump, bumpScale: 0.5, roughness: 0.6 }),
    beams: std({ map: tex.beams.map, bumpMap: tex.beams.bump, bumpScale: 0.8, roughness: 0.8 }),
    velvet: phys({
      color: 0x6a0f18,
      map: tiledCopy(surfaces.velvet.map, 3),
      normalMap: tiledCopy(surfaces.velvet.normalMap, 3),
      roughness: 0.92,
      sheen: 0.6,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xb04050),
      side: THREE.DoubleSide,
    }),
    linen: phys({ map: tex.linen, roughness: 0.92, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    quilt: phys({ map: tex.quilt.map, bumpMap: tex.quilt.bump, bumpScale: 2, roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color(0xff8a70), side: THREE.DoubleSide }),
    leather: std({ map: tex.leather, roughness: 0.62 }),
    strap: std({ color: 0x23140b, roughness: 0.55 }),
    brass: std({ color: 0xb98b3c, metalness: 1, roughness: 0.32 }),
    iron: std({ color: 0x2b2a2c, metalness: 0.85, roughness: 0.5 }),
    gilt: std({ color: 0xa8833a, metalness: 1, roughness: 0.38 }),
    wax: phys({ color: 0xf1e6cc, roughness: 0.45, sheen: 0.5, emissive: 0x3a2205, emissiveIntensity: 0.4 }),
    wax2: phys({ color: 0x8e0f1c, roughness: 0.35, clearcoat: 0.6 }),
    flame: props.flameMaterial(),
    glass: phys({ map: tex.glass, color: 0x9fb0c8, transparent: true, roughness: 0.12, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
    bookCover: covers.map(([r, g, b]) => phys({ color: new THREE.Color(r, g, b), roughness: 0.6, sheen: 0.4 })),
    bookSpine: tex.spines.map((map) => std({ map, roughness: 0.55 })),
    pages: std({ color: 0xe8dcc0, roughness: 0.95 }),
    pageSheet: std({
      side: THREE.DoubleSide,
      roughness: 0.95,
      map: paintedTexture(128, 176, (c, w, h) => {
        c.fillStyle = "#efe4c9";
        c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(40, 26, 12, 0.5)";
        for (let y = 16; y < h - 12; y += 7) c.fillRect(12, y, w - 24 - Math.random() * 30, 2);
      }),
    }),
    scarf: phys({
      roughness: 0.9,
      sheen: 0.8,
      sheenColor: new THREE.Color(0xffc080),
      map: paintedTexture(128, 128, (c, w, h) => {
        for (let i = 0; i < 8; i++) {
          c.fillStyle = i % 2 ? "#c8962e" : "#7a0f18";
          c.fillRect(0, (i * h) / 8, w, h / 8);
        }
      }),
    }),
    wandWood: std({ color: 0x3a2214, roughness: 0.4 }),
    inkGlass: phys({ color: 0x141a26, roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.88 }),
    quillShaft: std({ color: 0xe8e2d4, roughness: 0.5 }),
    quillVane: std({
      side: THREE.DoubleSide,
      alphaTest: 0.5,
      roughness: 0.8,
      map: paintedTexture(64, 256, (c, w, h) => {
        c.fillStyle = "#f2efe6";
        c.beginPath();
        c.moveTo(w / 2, 0);
        c.quadraticCurveTo(w, h * 0.3, w * 0.55, h);
        c.lineTo(w * 0.45, h);
        c.quadraticCurveTo(0, h * 0.3, w / 2, 0);
        c.fill();
        c.strokeStyle = "rgba(120, 110, 100, 0.4)";
        for (let y = 6; y < h; y += 4) {
          c.beginPath();
          c.moveTo(w / 2, y);
          c.lineTo(4, y + 10);
          c.moveTo(w / 2, y);
          c.lineTo(w - 4, y + 10);
          c.stroke();
        }
      }),
    }),
    rug: std({ map: tex.rug, roughness: 0.97 }),
    straw: std({ map: tex.straw, roughness: 0.9 }),
  };
}

export async function createRoomScene(host, options = {}) {
  const { name = "you", owlName = "Hedwig", reduceMotion = false } = options;
  const onSelect = options.onSelect ?? (() => {});
  const onNarrate = options.onNarrate ?? (() => {});
  const onLetterReady = options.onLetterReady ?? (() => {});

  // ---------- renderer ----------

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = "tr-webgl";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060c);
  // the real furniture, surfaces and lighting (with a progress bar)
  const assets = await loadRoomAssets(renderer, options.onProgress);
  const { models } = assets;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromEquirectangular(assets.environment).texture;
  pmrem.dispose();
  assets.environment.dispose();
  scene.environment = envTexture;
  scene.environmentIntensity = 0.3;

  const camera = new THREE.PerspectiveCamera(58, 1, 0.03, 120);
  camera.position.copy(START_VIEW.position);

  // ---------- the room ----------

  const tex = makeRoomTextures();
  const mats = makeMaterials(tex, assets.surfaces);
  const flickers = []; // candle lights that flicker

  const moonDir = v3(0.15, 0.32, -1).normalize();
  const shell = props.buildShell(scene, mats, tex);
  const sky = props.buildSky(scene, moonDir);
  props.buildRug(scene, mats);
  buildGryffindorBanner(scene, mats);
  props.buildSconce(scene, mats, flickers, 0.72);
  props.buildSconce(scene, mats, flickers, -0.72);
  const bed = props.buildBed(scene, mats, tex, { model: models.GothicBed_01 });
  const trunk = furniture.buildChest(scene, models, mats);
  const bedside = furniture.buildNightstand(scene, models, mats, flickers);
  const [desk, globe] = props.buildDesk(scene, mats, tex, { name });
  furniture.dressDesk(desk, models, flickers);
  const cage = props.buildCage(scene, mats);
  const shelf = props.buildBookshelf(scene, mats);
  const candles = props.buildFloatingCandles(scene, mats, flickers);
  const painting = props.buildPainting(scene, mats, 1.25);
  const broom = furniture.buildBroomModel(scene, models, -0.42);
  const letter = props.buildLetter(scene, mats, tex, { name });
  furniture.buildChandelier(scene, models, mats, flickers);

  // the magical things: fire, potions, a portrait, a frog, the map, a wand...
  const sparks = magic.createSparks(scene);
  const fireplace = magic.buildFireplace(scene, mats, tex, sparks, -2.05);
  furniture.dressFireplace(fireplace, models);
  const potions = magic.buildPotions(fireplace, mats);
  const frog = magic.buildChocolateFrog(fireplace, mats);
  const chess = furniture.buildFireside(scene, models, sparks);
  const portrait = magic.buildPortrait(scene, mats, {
    ...props.onWall(0.98, 0.04, 1.75),
    rotY: 0.98 + Math.PI,
    scale: 1.35,
    frame: models.fancy_picture_frame_01,
    title: "Portrait of an old wizard",
    text: "A painted wizard with a magnificent beard. His eyes follow you round the room, and he's always pleased to see a visitor.",
  });
  const mirror = furniture.buildMirror(scene, models, mats, { name }, -0.92);
  const map = magic.buildMap(desk, mats, tex, { name, owlName });
  const wand = magic.buildWand(bedside, mats, sparks);
  const spectacles = furniture.buildSpectaclesModel(bedside, models, sparks);
  const moonbeam = magic.buildMoonbeam(scene, moonDir);
  // the mirror's mist writing and the quill's paper butterflies
  const spells = createSpells(scene, camera, sparks, { name, reduceMotion });
  // a golden snitch, moving photos of the two of you, and a music box
  const snitch = extras.buildSnitch(scene, camera, sparks);
  const photos = extras.buildPhotoWall(scene, mats, sparks, options.photos ?? []);
  const musicBox = extras.buildMusicBox(scene, mats, sparks);
  const added = [snitch, musicBox, ...(photos ? [photos] : [])];
  magic.buildContactShadows(scene, [
    [-2.85, 0.35, 2.9, 2.0],
    [-1.5, 0.35, 0.8, 1.2],
    [0, -3.2, 1.8, 1.0],
    [0.1, -2.48, 0.7, 0.7],
    [1.75, -3.0, 0.8, 0.8],
    [3.45, -1.2, 1.9, 0.7, 1.236],
    [-3.42, 1.6, 0.8, 0.7],
    [-3.3, -1.75, 1.9, 0.9, -2.05],
    [-2.15, -1.05, 1.0, 1.0],
    [-1.45, -1.75, 0.7, 0.6],
  ]);

  // the window: opens for the owl, and then however you like
  let windowOpen = false;
  let windowK = 0;
  const windowProp = {
    key: "window",
    title: "Arched window",
    get text() {
      return windowOpen
        ? "The casements are open to the night. You can smell pine trees and the lake."
        : "Leaded diamond panes looking out over the hills, the dark lake and the moon.";
    },
    root: shell.windowGroup,
    focus: { position: v3(0.15, 1.7, -2.2), target: v3(0, 1.8, -4.3) },
    colliders: [],
    get actions() {
      return [{ id: "toggle", label: windowOpen ? "Close the window" : "Open the window" }];
    },
    act() {
      windowOpen = !windowOpen;
    },
  };

  // ---------- light ----------

  scene.add(new THREE.HemisphereLight(0x3a4670, 0x2a180c, 0.35));
  // moonlight through the window, casting the window's shape on the floor
  const moon = new THREE.DirectionalLight(0xa9bcff, 1.6);
  moon.position.copy(moonDir).multiplyScalar(14);
  moon.target.position.set(0, 0.3, -1.8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 2, far: 30 });
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  scene.add(moon, moon.target);
  // warm light pooling down from the floating candles
  const candleSpot = new THREE.SpotLight(0xffa24a, 18, 9, 1.15, 1, 2);
  candleSpot.position.set(0.1, 3.05, -0.5);
  candleSpot.target.position.set(-0.2, 0, 0.1);
  candleSpot.castShadow = true;
  candleSpot.shadow.mapSize.set(1024, 1024);
  candleSpot.shadow.radius = 4;
  candleSpot.shadow.bias = -0.0006;
  scene.add(candleSpot, candleSpot.target);

  // dust drifting in the moonbeam
  const dust = (() => {
    const count = 220;
    const pos = new Float32Array(count * 3);
    const rand = Math.random;
    for (let i = 0; i < count; i++) {
      const t = rand();
      pos[i * 3] = (rand() - 0.5) * 1.4 + t * 0.4;
      pos[i * 3 + 1] = 0.2 + rand() * 2.4;
      pos[i * 3 + 2] = -4.0 + t * 3.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xb8c8ff, size: 0.005, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
  })();

  // ---------- the owl ----------

  const owl = createOwlModel({ reduceMotion });
  owl.root.scale.setScalar(OWL_SCALE);
  owl.root.rotation.order = "YXZ";
  owl.root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  scene.add(owl.root);

  // A path flown at a steady pace, easing off at the start and the end.
  function flightPlan(points, speed, accel, decel) {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const length = curve.getLength();
    const duration = accel / 2 + decel / 2 + (length - (speed * accel) / 2 - (speed * decel) / 2) / speed;
    const distAt = (t) => {
      t = clamp(t, 0, duration);
      const cruise = duration - accel - decel;
      if (t < accel) return (0.5 * speed * t * t) / accel;
      const s1 = 0.5 * speed * accel;
      if (t < accel + cruise) return s1 + speed * (t - accel);
      const t3 = t - accel - cruise;
      if (decel <= 0) return s1 + speed * cruise + speed * t3;
      return s1 + speed * cruise + speed * t3 - (0.5 * speed * t3 * t3) / decel;
    };
    return { curve, duration, u: (t) => clamp01(distAt(t) / length), easeIn: accel > 0, easeOut: decel > 0 };
  }

  const toRoom = cage.doorDirection();
  const cageTop = cage.topWorld();
  // First she's seen far out over the hills, flying straight at the window
  // (so you watch her grow through the glass), wings half-tucked to slip
  // through the opening...
  const WINDOW_IN = v3(0, 1.82, -3.55);
  const outside = flightPlan([v3(1.6, 3.4, -24), v3(0.7, 2.6, -13), v3(0.1, 2.0, -6.5), v3(0, 1.85, -4.6), WINDOW_IN], 3.0, 0.8, 0);
  // ...then, once inside, she flies straight to you. That path is worked out
  // as she comes in, from wherever you happen to be looking.
  let toYou = null;
  const hover = v3(0.2, 1.52, 1.6);
  function planToYou() {
    const forward = tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    hover.copy(camera.position).addScaledVector(forward, 1.55);
    hover.y = clamp(camera.position.y - 0.25, 1.1, 2.2);
    const r = Math.hypot(hover.x, hover.z);
    if (r > R - 0.9) hover.multiplyScalar((R - 0.9) / r).setY(clamp(camera.position.y - 0.25, 1.1, 2.2));
    for (const box of colliders) if (box.containsPoint(hover)) hover.y = Math.max(hover.y, box.max.y + 0.4);
    const mid = WINDOW_IN.clone().lerp(hover, 0.5).add(v3(0.35, 0.22, 0));
    toYou = flightPlan([WINDOW_IN, mid, hover.clone()], 3.0, 0, 1.5);
  }
  // ...and, once you've taken the letter, round the room and up onto her cage
  const lineUp = cageTop.clone().addScaledVector(toRoom, 1.8).add(v3(0, 0.35, 0));
  const approach = cageTop.clone().addScaledVector(toRoom, 0.75).add(v3(0, 0.22, 0));
  let homeward = null;
  function planHome() {
    const start = owl.root.position.clone();
    const away = start.clone().add(v3(-0.7, 0.4, -0.7));
    homeward = flightPlan([start, away, v3(-1.25, 2.15, -0.5), v3(-0.35, 2.3, -1.55), lineUp, approach], 2.1, 1.0, 1.3);
  }

  const T = { window: 1.0, enter: 2.0 };
  const story = { t: 0, phase: "arriving", phaseT: 0, ready: false, said: new Set(), yawPrev: 0, roll: 0 };
  const give = { t: 0, from: v3(), fromQ: new THREE.Quaternion() };

  function say(id, text) {
    if (story.said.has(id)) return;
    story.said.add(id);
    onNarrate(text);
  }
  function setPhase(phase) {
    story.phase = phase;
    story.phaseT = 0;
  }

  // the letter hangs from her talons until you take it
  function letterToTalons() {
    owl.root.add(letter);
    letter.position.set(0, -0.36, 0.08);
    letter.rotation.set(Math.PI / 2 - 0.15, 0, 0);
    letter.scale.setScalar(1 / OWL_SCALE);
    letter.visible = true;
  }

  // Coming back later (from the memory basin): the letter's been delivered
  // and read, Hedwig is home on her cage, and the room is yours to explore.
  function startExploring() {
    story.t = 0;
    story.ready = true;
    story.said.clear();
    letterToTalons();
    letter.visible = false;
    owl.root.position.copy(cageTop);
    owl.root.rotation.set(0, Math.atan2(toRoom.x, toRoom.z), 0);
    setPhase("home");
    onLetterReady(true);
    guide.active = false;
    candles.setLit(true, true);
    fireplace.setLevel(1);
    options.onStep?.(null);
  }

  function resetStory() {
    story.t = 0;
    story.ready = false;
    story.said.clear();
    story.windowOpened = false;
    windowOpen = false;
    story.yawPrev = 0;
    story.roll = 0;
    setPhase("arriving");
    letterToTalons();
    onLetterReady(false);
    startGuide();
    if (reduceMotion) {
      story.t = T.enter + outside.duration;
      planToYou();
      setPhase("hovering");
    }
  }

  function takeLetter() {
    if (story.phase !== "hovering") return;
    setPhase("giving");
    scene.attach(letter);
    give.t = 0;
    give.from.copy(letter.position);
    give.fromQ.copy(letter.quaternion);
  }

  const tmpV = v3();
  const tmpW = v3();
  const tmpQ = new THREE.Quaternion();
  const UP = v3(0, 1, 0);

  // Points the owl along a flight path and returns how far she's leaning.
  function flyAlong(plan, ft, dt, target) {
    const u = plan.u(ft);
    plan.curve.getPointAt(u, owl.root.position);
    const tangent = plan.curve.getTangentAt(Math.min(u, 0.999), tmpV);
    const yaw = Math.atan2(tangent.x, tangent.z);
    const yawRate = wrapAngle(yaw - story.yawPrev) / Math.max(dt, 1e-3);
    story.yawPrev = yaw;
    story.roll += (clamp(-yawRate * 0.35, -0.65, 0.65) - story.roll) * (1 - Math.exp(-dt * 4));
    const climb = -Math.asin(clamp(tangent.y, -1, 1)) * 0.7;
    const leanIn = plan.easeIn ? smooth(0, 0.6, ft) : 1;
    const leanOut = plan.easeOut ? 1 - smooth(plan.duration - 1.0, plan.duration, ft) : 1;
    const lean = 0.85 * leanIn * leanOut;
    owl.root.rotation.set(lean + climb, yaw, story.roll * (plan.easeOut ? 1 - smooth(plan.duration - 0.8, plan.duration, ft) : 1));
    target.fold = 0;
    target.flapRate = ft < 1.0 ? 3.0 : 2.3;
    target.headPitch = -lean * 0.9;
    target.headYaw = 0;
    return u;
  }

  function updateStory(dt) {
    story.t += dt;
    story.phaseT += dt;
    const t = story.t;
    const target = { flapRate: 2.3, glide: 0, fold: 0, headPitch: 0 };

    // the window swings open, and she comes in on the night air
    // the window swings open for her (and stays open while she's coming in)
    if (t > T.window && (!story.windowOpened || story.phase === "arriving")) {
      story.windowOpened = true;
      windowOpen = true;
    }
    windowK += ((windowOpen ? 1 : 0) - windowK) * (1 - Math.exp(-dt * 2.2));
    for (const c of shell.casements) c.hinge.rotation.y = -c.side * easeInOut(clamp01(windowK)) * 1.35;
    if (t > 0.3) say("start", "It's late, high in the tower. The candles are burning low…");
    if (t > T.window + 0.3) say("window", "The window creaks open. Something white is flying in out of the night…");

    const facingCamera = Math.atan2(camera.position.x - owl.root.position.x, camera.position.z - owl.root.position.z);

    switch (story.phase) {
      case "arriving": {
        // outside, coming in over the hills towards the window
        const ft = Math.max(0, t - T.enter);
        flyAlong(outside, ft, dt, target);
        // glide the last stretch with wings drawn in, to fit through
        const nearWindow = 1 - smooth(1.3, 2.6, Math.abs(owl.root.position.z + 4.4));
        target.glide = Math.max(nearWindow, ft > 1.2 && ft < 2.6 ? 1 : 0);
        target.fold = 0.55 * nearWindow;
        if (ft >= outside.duration) {
          planToYou();
          setPhase("coming");
        }
        break;
      }
      case "coming": {
        // inside: straight across the room to you
        flyAlong(toYou, story.phaseT, dt, target);
        target.fold = 0.55 * (1 - smooth(0, 0.5, story.phaseT));
        target.flapRate = 2.6;
        if (story.phaseT >= toYou.duration) {
          setPhase("hovering");
          say("brought", `${owlName} has brought you a letter! Click it to take it from her.`);
        }
        break;
      }
      case "hovering":
      case "giving": {
        // hovering in front of you, the letter swinging from her talons
        const drift = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.05;
        owl.root.position.set(hover.x + drift, hover.y + (reduceMotion ? 0 : Math.sin(owl.phase ?? 0) * -0.012), hover.z);
        const turn = wrapAngle(facingCamera - owl.root.rotation.y);
        owl.root.rotation.set(-0.08, owl.root.rotation.y + turn * (1 - Math.exp(-dt * 3)), -Math.cos(t * 0.6) * 0.04);
        target.flapRate = 2.2;
        target.headYaw = headYawTowards(camera.position);
        if (story.phase === "hovering" && letter.parent === owl.root) letter.rotation.x = Math.PI / 2 - 0.15 + Math.sin(t * 1.7) * 0.06;
        if (story.phase === "giving") {
          // the letter floats up to you
          give.t += dt;
          const k = easeInOut(clamp01(give.t / 0.9));
          tmpW.set(0, -0.12, -0.45).applyQuaternion(camera.quaternion).add(camera.position);
          letter.position.lerpVectors(give.from, tmpW, k);
          tmpQ.setFromUnitVectors(UP, tmpV.copy(camera.position).sub(letter.position).normalize());
          letter.quaternion.slerpQuaternions(give.fromQ, tmpQ, k);
          if (give.t >= 0.9) {
            letter.visible = false;
            if (!story.ready) {
              story.ready = true;
              onLetterReady(true);
              if (guide.active) guideDone("letter");
              else onSelect(infoFor(letterProp));
              say("taken", `You've got your letter. ${owlName} heads home to her cage.`);
            }
          }
          if (give.t >= 1.3) {
            if (reduceMotion) {
              owl.root.position.copy(cageTop);
              owl.root.rotation.set(0, Math.atan2(toRoom.x, toRoom.z), 0);
              setPhase("home");
            } else {
              story.yawPrev = owl.root.rotation.y;
              planHome();
              setPhase("returning");
            }
          }
        }
        break;
      }
      case "returning": {
        const u = flyAlong(homeward, story.phaseT, dt, target);
        target.glide = u > 0.45 && u < 0.6 ? 1 : 0;
        if (story.phaseT >= homeward.duration) setPhase("landing");
        break;
      }
      case "landing": {
        // a last flap up onto the top of the cage, folding her wings
        const k = clamp01(story.phaseT / 0.9);
        owl.root.position.lerpVectors(approach, cageTop, easeInOut(k));
        owl.root.position.y += Math.sin(Math.PI * k) * 0.1;
        owl.root.rotation.set(-0.3 * Math.sin(Math.PI * k), Math.atan2(-toRoom.x, -toRoom.z), 0);
        target.flapRate = 3.4;
        target.fold = k > 0.6 ? 1 : 0;
        if (k >= 1) setPhase("turning");
        break;
      }
      case "turning": {
        // shuffles round to face the room
        const k = clamp01(story.phaseT / 1.1);
        const from = Math.atan2(-toRoom.x, -toRoom.z);
        const to = Math.atan2(toRoom.x, toRoom.z);
        owl.root.position.copy(cageTop);
        owl.root.position.y += Math.sin(Math.PI * k) * 0.03;
        owl.root.rotation.set(0, from + wrapAngle(to - from) * easeInOut(k), 0);
        target.fold = 1;
        if (k >= 1) {
          setPhase("home");
          say("home", `${owlName} settles on top of her cage, very pleased with herself.`);
        }
        break;
      }
      default: {
        // home: perched on the cage, watching you
        owl.root.position.copy(cageTop);
        target.fold = 1;
        target.headYaw = headYawTowards(camera.position);
        if (!reduceMotion && Math.random() < dt / 9) owl.ruffle();
      }
    }

    owl.phase = owl.animate(dt, target);
  }

  // How far to turn her head to look at a point (relative to her body).
  function headYawTowards(point) {
    tmpW.copy(point);
    owl.root.worldToLocal(tmpW);
    return clamp(Math.atan2(tmpW.x, tmpW.z), -1.6, 1.6);
  }

  // ---------- things you can click ----------

  const owlProp = {
    key: "owl",
    get title() {
      return owlName;
    },
    get text() {
      if (story.phase === "hovering") return `${owlName} has flown in with a letter for you, sealed in red wax.`;
      if (story.ready) return `A snowy owl with golden eyes. She's delivered your letter and is very pleased with herself.`;
      return "A snowy owl with golden eyes, out on the night post.";
    },
    root: owl.root,
    focus() {
      const p = owl.root.position;
      const toCam = tmpV.copy(camera.position).sub(p).setY(0).normalize();
      return { position: p.clone().addScaledVector(toCam, 1.1).add(v3(0, 0.3, 0)), target: p.clone().add(v3(0, 0.22, 0)) };
    },
    get actions() {
      const list = [{ id: "hoot", label: "Say hello" }, { id: "ruffle", label: "Stroke her feathers" }];
      if (story.phase === "hovering") list.unshift({ id: "take", label: "Take the letter", primary: true });
      else if (story.ready) list.unshift({ id: "read", label: "Read the letter", primary: true });
      return list;
    },
    act(id) {
      if (id === "take") takeLetter();
      if (id === "hoot") owl.hoot();
      if (id === "ruffle") owl.ruffle();
    },
  };
  const letterProp = {
    key: "letter",
    title: "Your letter",
    text: "Sealed in red wax and addressed in careful ink. It's for you.",
    root: letter,
    focus: null,
    get actions() {
      if (story.phase === "hovering") return [{ id: "take", label: "Take the letter", primary: true }];
      return story.ready ? [{ id: "read", label: "Read the letter", primary: true }] : [];
    },
    act(id) {
      if (id === "take") takeLetter();
    },
  };
  const interactive = [owlProp, letterProp, bed, trunk, bedside, desk, globe, cage, shelf, candles, painting, broom, fireplace, potions, frog, portrait, map, wand, spectacles, chess, mirror, windowProp, ...added];
  const updaters = [bed, trunk, bedside, desk, globe, cage, shelf, candles, painting, broom, fireplace, potions, frog, portrait, map, wand, spectacles, chess, mirror, ...added];
  const colliders = interactive.flatMap((p) => p.colliders ?? []);
  for (const p of interactive) p.root.traverse((o) => (o.userData.propKey = p.key));
  const byKey = Object.fromEntries(interactive.map((p) => [p.key, p]));

  const infoFor = (p) => ({ key: p.key, title: p.title, text: p.text, actions: p.actions });

  // ---------- looking around: hand-picked viewpoints ----------

  const guided = createGuidedCamera(camera, renderer.domElement, { reduceMotion });
  guided.set(START_VIEW);
  let selectedKey = null;
  function goTo(key) {
    const view = VIEWS[key];
    if (!view) return;
    selectedKey = null;
    guided.goTo(view);
    options.onView?.(key);
  }
  function lookAtProp(prop) {
    const view = typeof prop.focus === "function" ? prop.focus() : prop.focus;
    if (!view) return;
    guided.goTo({ fov: 46, ...view });
    options.onView?.(null);
  }

  // ---------- glowing spots that show what you can look at ----------

  const hotspotTexture = paintedTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255, 244, 214, 1)");
    g.addColorStop(0.16, "rgba(255, 216, 140, 0.95)");
    g.addColorStop(0.42, "rgba(240, 170, 70, 0.3)");
    g.addColorStop(1, "rgba(240, 170, 70, 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(255, 226, 160, 0.75)";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2);
    c.stroke();
  });
  // bigger glows on touch screens, where they have to be tapped
  const touchScale = window.matchMedia("(pointer: coarse)").matches ? 1.5 : 1;
  const hotspots = [];
  for (const p of interactive) {
    if (p.key === "letter") continue;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: hotspotTexture, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    sprite.renderOrder = 10;
    sprite.userData.propKey = p.key;
    sprite.userData.hotspot = true;
    scene.add(sprite);
    hotspots.push({ sprite, prop: p, phase: Math.random() * 6, placed: false });
  }
  const bbox = new THREE.Box3();
  function placeHotspot(h) {
    const p = h.prop;
    if (p.key === "owl") return h.sprite.position.copy(owl.root.position).add(tmpV.set(0, 0.62, 0));
    const spot = p.hotspot; // (a getter, for things that move)
    if (spot) return h.sprite.position.copy(spot);
    bbox.setFromObject(p.root);
    bbox.getCenter(h.sprite.position);
    h.sprite.position.y = bbox.max.y + 0.12;
  }
  function updateHotspots(t) {
    const delivering = !["home", "hovering"].includes(story.phase);
    for (const h of hotspots) {
      if (h.prop.key === "owl" || h.prop.moving || !h.placed) {
        placeHotspot(h);
        h.placed = true;
      }
      const dist = camera.position.distanceTo(h.sprite.position);
      h.sprite.scale.setScalar(clamp(dist * 0.026, 0.03, 0.11) * touchScale * (1 + 0.15 * Math.sin(t * 2.4 + h.phase)));
      let goal;
      if (guide.active) {
        goal = isTarget(h.prop.key) ? 1 : 0;
        if (goal) h.sprite.scale.multiplyScalar(1.5);
      } else {
        const hidden = holding || !!visit.prop || selectedKey === h.prop.key || (h.prop.key === "owl" && delivering);
        goal = hidden ? 0 : delivering ? 0.25 : 0.85;
      }
      h.sprite.material.opacity += (goal - h.sprite.material.opacity) * 0.08;
      h.sprite.visible = h.sprite.material.opacity > 0.02;
    }
  }

  // ---------- the story ----------
  // Take the letter, pick up the wand, then choose what to enchant, in any
  // order. Stay at each one as long as you like, then close it and choose
  // the next. Once the room is alive with magic, the letter is ready (its
  // seal asks for our important date); after it, the memory basin is waiting.

  const STATIONS = [
    { key: "candles", choice: "Light the candles", view: () => candles.focus, prompt: "Point the wand at the floating candles and tap." },
    { key: "fireplace", choice: "Warm the fireplace", view: () => VIEWS.fireside, prompt: "Point the wand at the fireplace and tap." },
    { key: "mirror", choice: "Wake the old mirror", view: () => mirror.focus, prompt: "Point the wand at the old mirror and tap." },
    { key: "desk", choice: "Wake the quill", view: () => desk.focus, prompt: "Point the wand at the quill on the writing desk and tap." },
  ];
  const stations = STATIONS;
  // phase: letter | wand | choose | cast | wait | found | read | basin
  const guide = { active: true, phase: "letter", target: null, done: [], last: null, wait: 0, then: null, shown: false };
  const withBasin = options.withBasin !== false;
  const total = stations.length + (withBasin ? 4 : 3); // the letter, the wand, each enchantment, reading, the basin
  const remaining = () => stations.filter((s) => !guide.done.includes(s.key));
  const stationOf = (key) => remaining().find((s) => s.key === key);
  // is this something the story wants you to touch right now?
  const isTarget = (key) => {
    if (!guide.active) return true;
    switch (guide.phase) {
      case "letter":
        return story.phase === "hovering" && (key === "owl" || key === "letter");
      case "wand":
        return key === "wand";
      case "choose":
        return !!stationOf(key);
      case "cast":
        return key === guide.target;
      case "found":
        return key === guide.last;
      default:
        return false;
    }
  };
  function announce() {
    if (!guide.active) return options.onStep?.(null);
    const g = guide.phase;
    const index = g === "letter" ? 0 : g === "wand" ? 1 : g === "read" ? total - (withBasin ? 2 : 1) : g === "basin" ? total - 1 : g === "found" ? 1 + guide.done.length : 2 + Math.min(guide.done.length, stations.length - 1);
    const base = { index, total, mode: g, prompt: null };
    if (g === "letter") {
      base.prompt = story.phase === "hovering" ? `${owlName} has brought you a letter. Tap her to take it.` : null;
    } else if (g === "wand") {
      base.prompt = "The letter is sealed with a spell. Pick up the wand from the bedside table.";
    } else if (g === "choose") {
      base.prompt = guide.done.length ? (remaining().length === 1 ? "One more to go." : "What will you enchant next?") : "The letter won't open until the room is alive with magic. What will you enchant first?";
      base.choices = remaining().map((s) => ({ key: s.key, label: s.choice }));
    } else if (g === "cast") {
      base.prompt = stations.find((s) => s.key === guide.target)?.prompt ?? null;
    } else if (g === "found") {
      base.prompt = null;
    } else if (g === "read") {
      base.prompt = "The whole room is glowing. Your letter is ready.";
      base.action = "Open the letter";
    } else if (g === "basin") {
      base.prompt = "One last thing: your memories are waiting for you in the stone basin.";
      base.action = "Go to the memory basin";
    }
    options.onStep?.(base);
  }
  function guideTo(phase) {
    guide.phase = phase;
    guide.wait = 0;
    if (phase === "wand") guided.goTo({ fov: 46, ...bedside.focus });
    if (phase === "choose") goTo("overview");
    if (phase === "cast") {
      const s = stations.find((x) => x.key === guide.target);
      if (s) guided.goTo({ fov: 46, ...s.view() });
      options.onView?.(null);
    }
    if (phase === "found") {
      // stay looking at what you just enchanted
      const s = stations.find((x) => x.key === guide.last);
      if (s) guided.goTo({ fov: 46, ...s.view() });
      options.onView?.(null);
    }
    if (phase === "read") {
      if (holding) setWand(false);
      goTo("overview");
    }
    announce();
  }
  // let the moment land, then move on
  function waitThen(phase, seconds) {
    guide.phase = "wait";
    guide.then = phase;
    guide.wait = reduceMotion ? Math.min(seconds, 0.6) : seconds;
    announce();
  }
  // something happened that the story may have been waiting for
  function guideDone(key) {
    if (!guide.active || !key) return;
    if (key === "letter" && guide.phase === "letter") return waitThen("wand", 2.0);
    if (key === "wand" && guide.phase === "wand") return waitThen("choose", 1.4);
    if ((guide.phase === "choose" || guide.phase === "cast") && stationOf(key)) {
      guide.done.push(key);
      guide.target = null;
      guide.last = key;
      waitThen("found", 1.6);
    }
  }
  function updateGuide(dt) {
    if (!guide.active) return;
    if (guide.phase === "wait") {
      guide.wait -= dt;
      if (guide.wait <= 0) guideTo(guide.then);
    }
    if (guide.phase === "letter" && story.phase === "hovering" && !guide.shown) {
      guide.shown = true;
      announce();
    }
  }
  function startGuide() {
    Object.assign(guide, { active: true, phase: "letter", target: null, done: [], last: null, wait: 0, then: null, shown: false });
    candles.setLit(false, true);
    fireplace.setLevel(0);
    announce();
  }
  function endGuide() {
    if (holding) setWand(false);
    if (guide.active) goTo("overview");
    if (!guide.done.includes("fireplace")) fireplace.setLevel(1);
    guide.active = false;
    candles.setLit(true);
    options.onStep?.(null);
  }

  // ---------- picking things ----------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerMoved = false;
  let hovered = null;
  const pickables = [];
  for (const p of interactive) p.root.traverse((o) => o.isMesh && pickables.push(o));
  const spots = hotspots.map((h) => h.sprite);
  const shown = (o) => {
    for (let x = o; x; x = x.parent) if (!x.visible) return false;
    return true;
  };

  function aim(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function pick(clientX, clientY) {
    aim(clientX, clientY);
    const spot = raycaster.intersectObjects(spots, false).find((h) => h.object.material.opacity > 0.3);
    if (spot) return { prop: byKey[spot.object.userData.propKey], object: spot.object, hotspot: true };
    const hit = raycaster.intersectObjects(pickables, false).find((h) => shown(h.object) && h.object.userData.propKey);
    return hit ? { prop: byKey[hit.object.userData.propKey], object: hit.object, point: hit.point } : null;
  }

  function runAction(prop, id, object) {
    prop.act(id, object);
    prop.say = null;
  }

  function onPointerMove(e) {
    pointer.clientX = e.clientX;
    pointer.clientY = e.clientY;
    pointerMoved = true;
  }
  function onPointerUp(e) {
    if (guided.wasDrag) return;
    if (holding) {
      castAt(e.clientX, e.clientY);
      return;
    }
    const hit = pick(e.clientX, e.clientY);
    if (guide.active) {
      if (!hit || !isTarget(hit.prop.key)) return; // not yet: one thing at a time
      if (guide.phase === "letter") takeLetter();
      else if (guide.phase === "wand") setWand(true);
      else if (stationOf(hit.prop.key)) setWand(true); // put it down by mistake: pick it back up
      return;
    }
    // exploring one thing: tap it again (as often as you like) to repeat
    // its magic; the × in the page takes you back to the whole room
    if (visit.prop) {
      if (visit.stage === "there" && hit?.prop === visit.prop) visitMagic(hit.hotspot ? visit.object : hit.object);
      return;
    }
    if (!hit) return;
    const { prop, object } = hit;
    if ((prop.key === "owl" || prop.key === "letter") && story.phase === "hovering") {
      // clicking her (or the letter) while she's holding it out: take it
      takeLetter();
      return;
    }
    // a glowing light on the shelf means "a book", not the whole shelf
    const target = hit.hotspot ? (prop.key === "books" ? shelf.books[Math.floor(Math.random() * shelf.books.length)].mesh : prop.root) : object;
    startVisit(prop, target);
  }

  // ---------- exploring after the story ----------
  // Everything starts from the view of the whole room with its glowing
  // lights. Tap one: the camera goes over and the magic happens. Stay as
  // long as you like, doing it again and again, then close it to come back
  // to the whole room.
  const visit = { prop: null, object: null, stage: null };
  function startVisit(prop, object) {
    if (prop.key === "wand") return setWand(true);
    if (prop.key === "letter") return options.onReadLetter?.();
    Object.assign(visit, { prop, object, stage: "going" });
    selectedKey = prop.key;
    onSelect(null);
    lookAtProp(prop);
  }
  function endVisit() {
    if (!visit.prop) return;
    Object.assign(visit, { prop: null, object: null, stage: null });
    selectedKey = null;
    options.onVisit?.(null);
    goTo("overview");
  }
  function visitMagic(object = visit.object) {
    const [words, cast] = spellFor(visit.prop, object);
    onNarrate(words);
    cast();
  }
  function updateVisit() {
    if (visit.prop && visit.stage === "going" && !guided.busy) {
      visit.stage = "there";
      visitMagic();
      options.onVisit?.({ title: visit.prop.title ?? "" });
    }
  }
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);

  function select(key) {
    const prop = byKey[key];
    if (!prop) return;
    selectedKey = key;
    lookAtProp(prop);
    onSelect(infoFor(prop));
  }

  // ---------- the wand: pick it up, and cast spells on things ----------

  let holding = false;
  scene.add(camera);
  const heldWand = new THREE.Group();
  // held low on the right, pointing into the room (so it's mostly seen end-on)
  heldWand.position.set(0.15, -0.13, -0.32);
  heldWand.rotation.set(0, 0.12, 0);
  heldWand.scale.setScalar(0.42);
  const heldTilt = new THREE.Group();
  heldTilt.rotation.x = -1.42;
  heldWand.add(heldTilt);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0078, 0.33, 12), mats.wandWood);
  shaft.position.y = 0.08;
  heldTilt.add(shaft);
  for (const y of [-0.04, -0.055, -0.07]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0019, 6, 14), mats.wandWood);
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    heldTilt.add(ring);
  }
  const heldTipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.4, 1.1) });
  const heldTip = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), heldTipMat);
  heldTip.position.y = 0.08 + 0.165;
  heldTilt.add(heldTip);
  const heldLight = new THREE.PointLight(0xffe2a8, 0.25, 1.2, 2);
  heldTip.add(heldLight);
  heldWand.visible = false;
  camera.add(heldWand);
  let flick = 0;

  // the wand on the nightstand: its button picks it up
  wand.actions = [{ id: "pickup", label: "Pick up the wand", primary: true }];
  wand.text = "Holly, eleven inches, with a phoenix feather inside. Pick it up, and almost everything in the room will answer to it.";
  wand.act = (id) => {
    if (id === "pickup") setWand(true);
  };
  function setWand(on) {
    holding = on;
    heldWand.visible = on;
    wand.root.visible = !on;
    selectedKey = null;
    onSelect(null);
    options.onWand?.(on);
    renderer.domElement.style.cursor = on ? "crosshair" : "";
    if (on) {
      if (guide.active) guideDone("wand");
      else goTo("overview");
    }
  }
  for (const b of shelf.books) b.mesh.userData.levitate = true;

  const castables = [];
  const beams = [];
  const floating = new Map();
  const tipPos = v3();
  const beamMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.1, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  function beam(from, to) {
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, len, 6, 1, true), beamMaterial.clone());
    m.position.copy(from).lerp(to, 0.5);
    m.quaternion.setFromUnitVectors(UP, tmpV.copy(to).sub(from).normalize());
    scene.add(m);
    beams.push({ m, t: 0 });
    for (let k = 1; k < 10; k++) sparks.burst(from.clone().lerp(to, k / 10), 2, [0xffe9a8, 0xffffff], { speed: 0.15, up: 0.1, life: 0.5, gravity: 0 });
    sparks.burst(to, 45, [0xffd36a, 0xffffff, 0xffb070], { speed: 0.9, up: 0.5, spread: 1, life: 1.0, gravity: -1 });
  }

  function propOf(object) {
    for (let o = object; o; o = o.parent) if (o.userData.propKey) return byKey[o.userData.propKey];
    return null;
  }
  function levitating(object) {
    for (let o = object; o && o !== scene; o = o.parent) if (o.userData.levitate) return o;
    return null;
  }
  function levitate(object) {
    if (floating.has(object)) return;
    const scale = object.parent.getWorldScale(tmpW).y || 1;
    floating.set(object, { t: 0, base: object.position.clone(), rot: object.rotation.clone(), lift: 0.3 / scale, seed: Math.random() * 6 });
  }

  // Which spell a click casts, depending on what it hits.
  function spellFor(prop, object) {
    if (prop?.key === "owl") return [`"Hello, ${owlName}!"`, () => (owl.hoot(), owl.ruffle())];
    if (prop?.key === "letter") return ["Accio letter!", () => takeLetter()];
    const lifted = levitating(object);
    if (lifted) return ["Wingardium Leviosa!", () => levitate(lifted)];
    switch (prop?.key) {
      case "fireplace":
        return ["Incendio!", () => fireplace.act("stoke")];
      case "candles":
        return ["Lumos Maxima!", () => candles.act()];
      case "window":
        return [windowOpen ? "Colloportus!" : "Alohomora!", () => windowProp.act()];
      case "cage":
        return ["Alohomora!", () => cage.act()];
      case "trunk":
        return ["Alohomora!", () => trunk.act("lid")];
      case "mirror":
        return ["Revelio!", () => spells.writing(mirror.focus.target, () => mirror.act())];
      case "map":
        return ["I solemnly swear that I am up to no good.", () => map.act()];
      case "broom":
        return ["Up!", () => broom.act()];
      case "spectacles":
        return ["Oculus Reparo!", () => spectacles.act()];
      case "potions":
        return ["Incendio!", () => potions.act()];
      case "globe":
        return ["Spin!", () => globe.act()];
      case "desk":
        return ["Scribbulus!", () => (desk.act(), spells.butterflies(desk.focus.target, reduceMotion ? 0 : 1.2))];
      case "bed":
        return ["Accio curtains!", () => bed.act()];
      case "bedside":
        return ["Nox… Lumos!", () => bedside.act()];
      case "chess":
        return ["Your move!", () => runAction(chess, "move")];
      case "frog":
        return ["Ribbit!", () => frog.act()];
      case "painting":
        return ["Ventus!", () => painting.act()];
      case "portrait-of-an-old-wizard":
        return ["Good evening!", () => portrait.act()];
      case "snitch":
        return ["I open at the close.", () => snitch.act()];
      case "photos":
        return ["", () => photos.act(null, object)];
      case "musicbox":
        return ["", () => musicBox.act()];
      case "books":
        return ["Wingardium Leviosa!", () => levitate(object)];
      default:
        return ["Lumos!", () => {}];
    }
  }

  function castAt(clientX, clientY) {
    aim(clientX, clientY);
    const hit = raycaster.intersectObjects(castables, false).find((h) => shown(h.object));
    camera.updateMatrixWorld();
    heldTip.getWorldPosition(tipPos);
    const point = hit ? hit.point.clone() : tipPos.clone().addScaledVector(raycaster.ray.direction, 4);
    flick = 1;
    beam(tipPos, point);
    const hitProp = hit ? propOf(hit.object) : null;
    const [words, cast] = spellFor(hitProp, hit?.object);
    onNarrate(words);
    cast();
    guideDone(hitProp?.key);
  }

  function updateMagic(dt, t) {
    for (const [object, f] of floating) {
      f.t += dt;
      const up = easeInOut(clamp01(f.t / 0.9)) * (1 - easeInOut(clamp01((f.t - 3.4) / 0.9)));
      object.position.copy(f.base);
      object.position.y += up * (f.lift + (Math.sin(t * 2.2 + f.seed) * 0.03) / (f.lift / 0.3));
      object.rotation.set(f.rot.x + up * Math.sin(t * 1.3 + f.seed) * 0.18, f.rot.y + up * Math.sin(f.t * 1.4) * 0.7, f.rot.z + up * Math.cos(t * 1.1 + f.seed) * 0.14);
      if (f.t > 4.4) {
        object.position.copy(f.base);
        object.rotation.copy(f.rot);
        floating.delete(object);
      }
    }
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t += dt;
      b.m.material.opacity = Math.max(0, 1 - b.t / 0.35);
      if (b.t > 0.35) {
        scene.remove(b.m);
        b.m.geometry.dispose();
        b.m.material.dispose();
        beams.splice(i, 1);
      }
    }
    // the hand flicks the wand as it casts
    flick = Math.max(0, flick - dt * 4);
    heldTilt.rotation.x = -1.42 + Math.sin(flick * Math.PI) * 0.3;
    heldWand.position.y = -0.13 + Math.sin(t * 1.3) * 0.003;
    heldLight.intensity = 0.25 + flick * 1.5;
    heldTipMat.color.setRGB(1.5 + flick * 2, 1.4 + flick * 1.6, 1.1 + flick);
  }

  // ---------- post-processing: hover outline and candle glow ----------

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const outline = new OutlinePass(new THREE.Vector2(256, 256), scene, camera);
  outline.edgeStrength = 2.6;
  outline.edgeGlow = 0.4;
  outline.edgeThickness = 1.2;
  outline.visibleEdgeColor.set(0xf6d58a);
  outline.hiddenEdgeColor.set(0x000000);
  composer.addPass(outline);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.45, 0.95);
  composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);

  // ---------- loop ----------

  let raf = 0;
  let last = performance.now();
  let time = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    guided.update(dt);
    updateHotspots(time);
    updateMagic(dt, time);

    updateStory(dt);
    updateGuide(dt);
    updateVisit();
    for (const p of updaters) p.update?.(dt, time, camera);
    sparks.update(dt);
    spells.update(dt, time);
    moonbeam.material.uniforms.uTime.value = time;
    mats.flame.uniforms.uTime.value = time;
    sky.material.uniforms.uTime.value = time;
    for (const f of flickers) {
      const n = 0.82 + 0.1 * Math.sin(time * 9.1 + f.seed) + 0.08 * Math.sin(time * 23.7 + f.seed * 2);
      f.light.intensity = f.on === false ? 0 : f.base * n * (f.light.userData.boost ?? 1);
    }
    candleSpot.intensity = 18 * (0.9 + 0.1 * Math.sin(time * 7.3)) * candles.boost;
    dust.rotation.y = Math.sin(time * 0.05) * 0.02;
    dust.position.y = Math.sin(time * 0.2) * 0.03;

    if (pointerMoved && !guided.busy) {
      pointerMoved = false;
      const found = pointer.clientX !== undefined ? pick(pointer.clientX, pointer.clientY) : null;
      const hit = found && (visit.prop ? visit.stage === "there" && found.prop === visit.prop : !guide.active || isTarget(found.prop.key)) ? found : null;
      const object = hit ? (hit.object.userData.levitate && holding ? hit.object : hit.prop.key === "books" && hit.object.userData.book ? hit.object : hit.prop.root) : null;
      if (object !== hovered) {
        hovered = object;
        outline.selectedObjects = object ? [object] : [];
        renderer.domElement.style.cursor = holding ? "crosshair" : object ? "pointer" : "";
        // tell the page what's here and what a click will do
        const first = hit?.prop.actions?.[0]?.label;
        options.onHover?.(hit && !holding ? (first ? `${hit.prop.title} · ${first}` : hit.prop.title) : null);
      }
    }

    composer.render(dt);
  }

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  scene.updateMatrixWorld(true);
  // Spells hit real things. Light and shadow effects that aren't part of
  // anything (the moonbeam, the soft shadows under furniture) are see-through
  // to them, or a spell aimed at the fire would fizzle against the moonbeam.
  const isEffect = (o) => !o.userData.propKey && o.material && !Array.isArray(o.material) && o.material.transparent && o.material.depthWrite === false;
  scene.traverse((o) => {
    if (o.isMesh && o !== sky && o !== moonbeam && !o.userData.hotspot && !isEffect(o)) castables.push(o);
  });
  for (const o of [...castables]) if (heldWand.getObjectById(o.id)) castables.splice(castables.indexOf(o), 1);
  if (options.explore) startExploring();
  else resetStory();
  raf = requestAnimationFrame(frame);

  // ---------- what the page can ask for ----------

  return {
    views: Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, v.label])),
    goTo,
    select: (key) => select(key),
    act(key, id) {
      const prop = byKey[key];
      if (!prop) return;
      runAction(prop, id);
      if (!holding) onSelect(infoFor(prop));
    },
    replay() {
      Object.assign(visit, { prop: null, object: null, stage: null });
      options.onVisit?.(null);
      setWand(false);
      resetStory();
      goTo("overview");
      onSelect(null);
    },
    resetView() {
      goTo("overview");
    },
    setWand,
    // the story's over (after the letter's been read): explore freely
    finishStory: () => endGuide(),
    // while looking at one thing: do its magic again, or go back to the room
    again: () => visit.stage === "there" && visitMagic(),
    leaveVisit: () => endVisit(),
    // pick what to enchant next (from the story's choices)
    choose(key) {
      if (!guide.active || !["choose", "cast"].includes(guide.phase) || !stationOf(key)) return;
      if (!holding) setWand(true);
      guide.target = key;
      guideTo("cast");
    },
    // back to the list of choices, without casting
    chooseAgain() {
      if (guide.active && guide.phase === "cast") guideTo("choose");
    },
    // done here: on to the next choice, or the letter
    closeFound() {
      if (guide.active && guide.phase === "found") guideTo(remaining().length ? "choose" : "read");
    },
    // the letter's been read: the last step points to the memory basin
    letterRead() {
      if (guide.active && guide.phase === "read") withBasin ? guideTo("basin") : endGuide();
    },
    dispose() {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      guided.dispose();
      owl.dispose();
      musicBox.dispose();
      const textures = new Set();
      scene.traverse((o) => {
        o.geometry?.dispose();
        const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of list) {
          for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
          m.dispose();
        }
      });
      textures.forEach((t) => t.dispose());
      envTexture.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
