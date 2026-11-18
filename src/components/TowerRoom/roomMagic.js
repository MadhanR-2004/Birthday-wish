import * as THREE from "three";
import { onWall } from "./roomProps.js";
import { random } from "./roomTextures.js";

// The magical things in the tower room: the fireplace (fire, smoke, sparks),
// potions that bubble, a portrait that watches you, a Chocolate Frog, the
// Marauder's Map and a wand, plus the moonbeam and soft contact shadows. Interactive things return a "prop"
// in the same shape as roomProps.js.

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function add(parent, geo, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}
const box = (p, w, h, d, mat, x, y, z, o) => add(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

function canvasTexture(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
`;

// ---------- sparks: a shared pool of glowing particles for spells and fire ----------

export function createSparks(scene, max = 600) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const parts = Array.from({ length: max }, () => ({ life: 0, max: 1, v: v3(), c: new THREE.Color(), gravity: -2 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // each spark a soft round glow, not a square
  const dot = canvasTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const mat = new THREE.PointsMaterial({ size: 0.012, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;
  const p = v3();
  return {
    // count sparks from a point, flying outwards at about `speed`
    burst(at, count, colors, { speed = 1.2, spread = 1, up = 0.6, life = 1.2, gravity = -2 } = {}) {
      for (let i = 0; i < count; i++) {
        const s = parts[next];
        next = (next + 1) % max;
        s.life = s.max = life * (0.6 + Math.random() * 0.6);
        s.gravity = gravity;
        s.v.set((Math.random() - 0.5) * 2 * spread, Math.random() * spread + up, (Math.random() - 0.5) * 2 * spread).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
        s.c.set(colors[Math.floor(Math.random() * colors.length)]);
        s.p = (s.p ?? v3()).copy(at);
      }
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const s = parts[i];
        if (s.life > 0) {
          s.life -= dt;
          s.v.y += s.gravity * dt;
          s.v.multiplyScalar(1 - dt * 1.2);
          s.p.addScaledVector(s.v, dt);
          p.copy(s.p);
          const k = Math.max(0, s.life / s.max);
          col[i * 3] = s.c.r * k * 2.5;
          col[i * 3 + 1] = s.c.g * k * 2.5;
          col[i * 3 + 2] = s.c.b * k * 2.5;
        } else {
          p.set(0, -100, 0);
          col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
        }
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---------- fireplace ----------

function flameSheetMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uSeed: { value: seed } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPower;
      uniform float uSeed;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float y = vUv.y;
        float n = fbm(vec2(vUv.x * 3.0 + uSeed, y * 2.4 - uTime * 1.7));
        float n2 = fbm(vec2(vUv.x * 7.0 - uSeed, y * 5.0 - uTime * 3.2));
        float width = (1.0 - y) * 0.85 + 0.06;
        float body = 1.0 - smoothstep(width * 0.45, width, abs(x) + (n - 0.5) * 0.55);
        float top = 1.0 - smoothstep(0.25 * uPower, 0.95 * uPower, y + (n2 - 0.5) * 0.4);
        float f = clamp(body * top, 0.0, 1.0);
        vec3 c = mix(vec3(0.9, 0.16, 0.01), vec3(1.0, 0.5, 0.1), smoothstep(0.15, 0.7, f));
        c = mix(c, vec3(1.0, 0.78, 0.42), smoothstep(0.8, 1.0, f));
        gl_FragColor = vec4(c * f * 0.75, f * 0.85);
      }`,
  });
}

export function buildFireplace(scene, mats, tex, sparks, angle) {
  const root = new THREE.Group();
  root.position.copy(onWall(angle, 0.07));
  root.rotation.y = angle + Math.PI;
  scene.add(root);
  const stone = mats.stone.clone();
  for (const key of ["map", "normalMap", "roughnessMap"]) {
    if (!mats.stone[key]) continue;
    stone[key] = mats.stone[key].clone();
    stone[key].repeat.set(0.6, 0.6);
    stone[key].needsUpdate = true;
  }
  stone.side = THREE.FrontSide;

  // stone surround, deep firebox, hearth and a carved oak mantel
  for (const x of [-0.58, 0.58]) box(root, 0.32, 1.15, 0.46, stone, x, 0.575, 0.21);
  box(root, 1.48, 0.26, 0.48, stone, 0, 1.28, 0.22);
  box(root, 1.78, 0.07, 0.44, mats.walnut, 0, 1.445, 0.25);
  box(root, 1.3, 1.9, 0.3, stone, 0, 2.43, 0.13);
  box(root, 1.86, 0.09, 0.66, stone, 0, 0.045, 0.42);
  const soot = new THREE.MeshStandardMaterial({ color: 0x120c09, roughness: 1 });
  box(root, 0.86, 1.08, 0.04, soot, 0, 0.6, 0.0);
  for (const x of [-0.42, 0.42]) box(root, 0.02, 1.08, 0.42, soot, x, 0.6, 0.2);
  box(root, 0.84, 0.02, 0.42, soot, 0, 0.1, 0.2);
  // iron grate and logs
  for (const x of [-0.25, 0.25]) box(root, 0.03, 0.12, 0.3, mats.iron, x, 0.16, 0.22);
  box(root, 0.6, 0.02, 0.03, mats.iron, 0, 0.22, 0.12);
  box(root, 0.6, 0.02, 0.03, mats.iron, 0, 0.22, 0.32);
  const bark = new THREE.MeshStandardMaterial({ color: 0x2e1d12, roughness: 0.95 });
  const embersMat = new THREE.MeshStandardMaterial({ color: 0x1a0a04, emissive: 0xff4a10, emissiveIntensity: 1.5, roughness: 1 });
  for (const [x, z, ry, rz] of [[-0.08, 0.2, 0.3, 0], [0.1, 0.24, -0.4, 0], [0.0, 0.2, 1.4, 0.15]]) {
    const log = add(root, new THREE.CylinderGeometry(0.055, 0.06, 0.55, 12), bark, x, 0.29, z);
    log.rotation.set(0, ry, Math.PI / 2 + rz);
    const glow = add(log, new THREE.CylinderGeometry(0.05, 0.055, 0.5, 12, 1, false, Math.PI * 0.6, Math.PI * 0.8), embersMat, 0, 0, 0, { cast: false });
    glow.scale.set(1.02, 1, 1.02);
  }
  add(root, new THREE.BoxGeometry(0.6, 0.03, 0.3), embersMat, 0, 0.12, 0.22, { cast: false });

  // the fire: crossed sheets of animated flame
  const sheets = [];
  for (let i = 0; i < 4; i++) {
    const m = flameSheetMaterial(i * 3.7);
    const sheet = add(root, new THREE.PlaneGeometry(0.62, 0.72), m, (i - 1.5) * 0.04, 0.62, 0.22, { cast: false, receive: false });
    sheet.rotation.y = (i * Math.PI) / 4;
    sheets.push(sheet);
  }
  // smoke curling up into the flue
  const smokeTex = canvasTexture(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(90, 84, 80, 0.55)");
    g.addColorStop(1, "rgba(90, 84, 80, 0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const smoke = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(m);
    root.add(s);
    smoke.push({ s, t: i / 9 });
  }
  const light = new THREE.PointLight(0xff8a3a, 3.2, 7, 2);
  light.position.set(0, 0.55, 0.55);
  root.add(light);
  root.updateWorldMatrix(true, true);
  const sparkAt = v3();
  const levels = [0.55, 1, 1.6];
  const names = ["low", "steady", "roaring"];
  let level = 1;
  let power = 1;

  return {
    key: "fireplace",
    title: "Fireplace",
    get text() {
      return `A deep stone hearth with a ${names[level]} fire. The warmest corner of the tower.`;
    },
    root,
    focus: { position: root.localToWorld(v3(0.2, 1.3, 2.2)), target: root.localToWorld(v3(0, 0.7, 0.2)) },
    colliders: [new THREE.Box3().setFromObject(root)],
    get actions() {
      return [
        { id: "stoke", label: level < 2 ? "Stoke the fire" : "It's roaring" },
        { id: "calm", label: "Let it burn low" },
      ];
    },
    // 0 low, 1 steady, 2 roaring
    setLevel(n) {
      level = n;
    },
    act(id) {
      if (id === "stoke") level = Math.min(2, level + 1);
      if (id === "calm") level = Math.max(0, level - 1);
      if (id === "stoke") sparks.burst(root.localToWorld(sparkAt.set(0, 0.35, 0.25)), 60, [0xffa040, 0xff6020, 0xffd080], { speed: 1.4, up: 2.5, spread: 0.35, life: 1.4, gravity: -0.6 });
    },
    update(dt, t) {
      power += (levels[level] - power) * (1 - Math.exp(-dt * 2));
      for (const sheet of sheets) {
        sheet.material.uniforms.uTime.value = t;
        sheet.material.uniforms.uPower.value = power;
        sheet.scale.y = 0.75 + 0.35 * power;
        sheet.position.y = 0.26 + 0.36 * sheet.scale.y;
      }
      light.intensity = 3.2 * power * (0.82 + 0.1 * Math.sin(t * 11.3) + 0.08 * Math.sin(t * 23.1));
      embersMat.emissiveIntensity = (1.1 + 0.4 * Math.sin(t * 2.3)) * (0.6 + 0.5 * power);
      for (const p of smoke) {
        p.t = (p.t + dt * 0.18) % 1;
        p.s.position.set(Math.sin(t * 0.7 + p.t * 6) * 0.08, 0.7 + p.t * 0.5, 0.18 - p.t * 0.12);
        p.s.scale.setScalar(0.18 + p.t * 0.35);
        p.s.material.opacity = Math.sin(Math.PI * p.t) * 0.45 * power;
      }
      if (Math.random() < dt * 6 * power) sparks.burst(root.localToWorld(sparkAt.set((Math.random() - 0.5) * 0.3, 0.4, 0.22)), 1, [0xffa040, 0xff7020], { speed: 0.5, up: 3, spread: 0.2, life: 1.2, gravity: 0.2 });
    },
  };
}

// ---------- potion bottles, on the mantel ----------

function liquidMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBoil: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uBoil;
      uniform vec3 uColor;
      varying vec3 vPos;
      ${NOISE}
      void main() {
        float a = atan(vPos.x, vPos.z);
        vec2 p = vec2(a * 2.0, vPos.y * 40.0 - uTime * (1.5 + uBoil * 6.0));
        float bubbles = smoothstep(0.72 - uBoil * 0.15, 0.9, noise(p * vec2(3.0, 1.0)));
        float swirl = fbm(vec2(a * 1.5 + uTime * 0.3, vPos.y * 20.0 - uTime * 0.5));
        vec3 c = uColor * (0.45 + 0.6 * swirl) + vec3(1.0) * bubbles * 0.55;
        c += uColor * (0.35 + uBoil * 1.6);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function buildPotions(fireplace, mats) {
  const root = new THREE.Group();
  root.position.set(-0.58, 1.48, 0.28);
  fireplace.root.add(root);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ee, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, clearcoat: 1 });
  const cork = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
  const bottles = [
    { x: 0, shape: [[0, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.1], [0.02, 0.14], [0.014, 0.18], [0, 0.18]], fill: 0.1, color: 0x2bd37a },
    { x: 0.12, shape: [[0, 0], [0.035, 0], [0.04, 0.05], [0.032, 0.09], [0.01, 0.15], [0.01, 0.2], [0, 0.2]], fill: 0.09, color: 0x9b4dff },
    { x: 0.23, shape: [[0, 0], [0.04, 0], [0.04, 0.08], [0.012, 0.11], [0.012, 0.15], [0, 0.15]], fill: 0.075, color: 0xffa21a },
  ];
  const liquids = [];
  for (const b of bottles) {
    const g = new THREE.Group();
    g.position.x = b.x;
    root.add(g);
    const inner = b.shape.filter(([, y]) => y <= b.fill).map(([r, y]) => [r * 0.88, y + 0.003]);
    inner.push([0, b.fill]);
    const liquid = add(g, lathe(inner), liquidMaterial(b.color), 0, 0, 0, { cast: false });
    liquids.push(liquid.material);
    const shell = add(g, lathe(b.shape), glass, 0, 0, 0, { cast: false });
    shell.renderOrder = 3;
    const top = b.shape[b.shape.length - 2];
    add(g, new THREE.CylinderGeometry(top[0] * 1.15, top[0], 0.025, 10), cork, 0, top[1] + 0.005, 0);
    const glow = new THREE.PointLight(b.color, 0.05, 0.8, 2);
    glow.position.y = 0.06;
    g.add(glow);
    liquids[liquids.length - 1].glow = glow;
  }
  root.updateWorldMatrix(true, true);
  let boil = 0;
  return {
    key: "potions",
    title: "Potion bottles",
    text: "Something green, something violet and something amber that smells faintly of toffee.",
    root,
    focus: { position: root.localToWorld(v3(0.1, 0.15, 0.9)), target: root.localToWorld(v3(0.12, 0.08, 0)) },
    colliders: [],
    actions: [{ id: "boil", label: "Warm them up" }],
    act() {
      boil = 1;
    },
    update(dt, t) {
      boil = Math.max(0, boil - dt * 0.18);
      for (const m of liquids) {
        m.uniforms.uTime.value = t;
        m.uniforms.uBoil.value = boil;
        m.glow.intensity = 0.05 + boil * 0.6;
      }
    },
  };
}

// ---------- a portrait whose eyes follow you ----------

export function buildPortrait(parent, mats, { x = 0, y = 0, z = 0, rotY = 0, scale = 1, frame = null, w = 0.5, h = 0.64, sepia = 0, bg = 0x1f3a2c, robe = 0x5a1218, title, text }) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  root.rotation.y = rotY;
  root.scale.setScalar(scale);
  parent.add(root);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLook: { value: new THREE.Vector2() },
      uBlink: { value: 0 },
      uWave: { value: 0 },
      uSepia: { value: sepia },
      // the painting is composed for a tall canvas; on a wider one it's
      // centred rather than stretched
      uAspect: { value: frame ? 1.66 : 1 },
      uBg: { value: new THREE.Color(bg) },
      uRobe: { value: new THREE.Color(robe) },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBlink, uWave, uSepia, uAspect;
      uniform vec2 uLook;
      uniform vec3 uBg, uRobe;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vec2(0.5 + (vUv.x - 0.5) * uAspect, vUv.y);
        vec3 col = mix(uBg * 0.5, uBg, p.y) * (0.85 + 0.3 * fbm(p * 6.0));
        vec2 hc = vec2(0.5 + 0.012 * sin(uTime * 0.6), 0.55);
        // robes and shoulders
        float sh = 0.4 - 0.5 * pow(abs(p.x - 0.5) * 1.7, 2.0);
        if (p.y < sh) col = uRobe * (0.7 + 0.4 * fbm(p * vec2(8.0, 3.0)));
        // the head
        vec2 hq = (p - hc) / vec2(0.12, 0.155);
        float head = length(hq);
        if (head < 1.0) col = vec3(0.86, 0.68, 0.56) * (0.75 + 0.3 * (1.0 - head));
        // long white beard
        if (p.y < hc.y - 0.035 && p.y > hc.y - 0.33 + 0.1 * abs(p.x - hc.x) * 4.0 && abs(p.x - hc.x) < 0.11 - (hc.y - p.y) * 0.12)
          col = vec3(0.86, 0.85, 0.82) * (0.8 + 0.3 * noise(vec2(p.x * 140.0, p.y * 8.0)));
        // pointed hat
        float hy = p.y - (hc.y + 0.1);
        if (hy > 0.0 && abs(p.x - hc.x + hy * 0.25) < 0.16 * (1.0 - hy / 0.33)) col = uRobe * 0.75;
        if (abs(p.y - (hc.y + 0.105)) < 0.022 && abs(p.x - hc.x) < 0.2) col = uRobe * 0.6;
        // eyes, following you, and blinking
        for (int i = 0; i < 2; i++) {
          vec2 ec = hc + vec2(i == 0 ? -0.045 : 0.045, 0.03);
          vec2 e = (p - ec) / vec2(0.024, 0.015 * (1.0 - uBlink) + 0.001);
          if (length(e) < 1.0) {
            col = vec3(0.92);
            vec2 pp = (p - ec - uLook * vec2(0.012, 0.005)) / 0.009;
            if (length(pp) < 1.0) col = vec3(0.15, 0.25, 0.4) * (length(pp) < 0.55 ? 0.2 : 1.0);
          }
          if (abs(p.y - ec.y - 0.025) < 0.004 && abs(p.x - ec.x) < 0.03) col = vec3(0.8);
        }
        // a hand that waves
        vec2 hand = vec2(0.78, 0.36) + vec2(sin(uTime * 9.0) * 0.03, 0.1) * uWave;
        if (uWave > 0.01 && length((p - hand) / vec2(0.05, 0.06)) < 1.0) col = vec3(0.86, 0.68, 0.56);
        if (uWave > 0.01 && p.y < hand.y && p.y > 0.2 && abs(p.x - mix(0.66, hand.x, (p.y - 0.2) / (hand.y - 0.2))) < 0.035) col = uRobe * 0.9;
        // oil paint and old varnish
        col *= 0.85 + 0.3 * fbm(p * vec2(70.0, 30.0));
        vec3 sep = vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(1.1, 0.95, 0.7);
        col = mix(col * vec3(1.0, 0.9, 0.7), sep, uSepia);
        col *= 1.0 - 0.6 * pow(length(p - 0.5), 2.0);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  if (frame) {
    // a carved frame model: paint onto its canvas
    root.add(frame);
    frame.traverse((o) => {
      if (o.isMesh && o.name.endsWith("_canvas")) o.material = mat;
    });
  } else {
    add(root, new THREE.PlaneGeometry(w, h), mat, 0, 0, 0.012, { cast: false });
    const f = Math.min(w, h) * 0.12;
    for (const [fw, fh, fx, fy] of [[w + 2 * f, f, 0, h / 2 + f / 2], [w + 2 * f, f, 0, -h / 2 - f / 2], [f, h, -w / 2 - f / 2, 0], [f, h, w / 2 + f / 2, 0]]) {
      box(root, fw, fh, f * 0.7, mats.gilt, fx, fy, 0.012);
    }
  }
  let wave = 0;
  let blinkAt = 2;
  const local = v3();
  return {
    key: title.toLowerCase().replace(/\W+/g, "-"),
    title,
    text,
    root,
    get focus() {
      return { position: root.localToWorld(v3(0, -0.05, 1.2 / scale)), target: root.localToWorld(v3(0, 0, 0)) };
    },
    get hotspot() {
      return root.localToWorld(v3(0, h / 2 + 0.1, 0.05));
    },
    colliders: [],
    actions: [{ id: "wave", label: "Wave hello" }],
    act() {
      wave = 3;
    },
    update(dt, t, camera) {
      wave = Math.max(0, wave - dt);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uWave.value = clamp01(wave);
      // eyes turn to wherever you're standing
      root.worldToLocal(local.copy(camera.position));
      mat.uniforms.uLook.value.set(Math.max(-1, Math.min(1, local.x / 1.5)), Math.max(-1, Math.min(1, local.y / 1.5)));
      if (t > blinkAt) {
        const k = (t - blinkAt) / 0.18;
        mat.uniforms.uBlink.value = k < 1 ? Math.sin(Math.PI * k) : 0;
        if (k >= 1) blinkAt = t + 2 + Math.random() * 5;
      }
    },
  };
}

// ---------- a Chocolate Frog that hops out of its box ----------

export function buildChocolateFrog(fireplace, mats) {
  const root = new THREE.Group();
  root.position.set(0.45, 1.48, 0.3);
  fireplace.root.add(root);
  const purple = new THREE.MeshPhysicalMaterial({ color: 0x4a1d6e, roughness: 0.5, clearcoat: 0.4 });
  const label = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = "#4a1d6e";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#e3b648";
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 18 : 44;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }
    c.fill();
  });
  add(root, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 5), purple, 0, 0.025, 0);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.05, -0.05);
  root.add(lidPivot);
  add(lidPivot, new THREE.CylinderGeometry(0.063, 0.063, 0.012, 5), [purple, new THREE.MeshStandardMaterial({ map: label, roughness: 0.5 }), purple], 0, 0.006, 0.05);
  // the frog: smooth glossy chocolate
  const choc = new THREE.MeshPhysicalMaterial({ color: 0x4a2512, roughness: 0.35, clearcoat: 0.6 });
  const frog = new THREE.Group();
  root.add(frog);
  add(frog, new THREE.SphereGeometry(1, 20, 14), choc, 0, 0.018, 0).scale.set(0.024, 0.016, 0.03);
  add(frog, new THREE.SphereGeometry(1, 16, 12), choc, 0, 0.028, 0.022).scale.set(0.018, 0.012, 0.016);
  for (const s of [-1, 1]) {
    add(frog, new THREE.SphereGeometry(0.006, 10, 8), choc, s * 0.01, 0.038, 0.026);
    add(frog, new THREE.CapsuleGeometry(0.006, 0.026, 4, 8), choc, s * 0.022, 0.008, -0.012).rotation.set(1.2, 0, s * 0.4);
  }
  root.updateWorldMatrix(true, true);
  frog.position.y = 0.015;
  frog.visible = false;
  let hop = -1;
  return {
    key: "frog",
    title: "Chocolate Frog",
    text: "A box of chocolate with a jump in it. Better hold on tight.",
    root,
    focus: { position: root.localToWorld(v3(0, 0.15, 0.8)), target: root.localToWorld(v3(0, 0.03, 0)) },
    colliders: [],
    actions: [{ id: "open", label: "Open the box" }],
    act() {
      if (hop < 0) hop = 0;
    },
    update(dt) {
      if (hop < 0) return;
      hop += dt;
      // lid opens, three hops out along the mantel, three hops back, lid shuts
      lidPivot.rotation.x = -1.6 * ease(clamp01(hop / 0.4)) * (1 - ease(clamp01((hop - 4.6) / 0.4)));
      const k = clamp01((hop - 0.4) / 4.0);
      frog.visible = hop > 0.35 && hop < 4.5;
      const out = k < 0.5 ? k * 2 : 2 - k * 2;
      const hops = k * 6;
      frog.position.set(-out * 0.32, 0.015 + Math.abs(Math.sin(Math.PI * hops)) * 0.06 + (1 - Math.min(1, out * 6)) * 0.03, 0.03 * Math.sin(Math.PI * out));
      frog.rotation.y = k < 0.5 ? -Math.PI / 2 : Math.PI / 2;
      if (hop > 5.1) hop = -1;
    },
  };
}

// ---------- the Marauder's Map, on the desk ----------

export function buildMap(desk, mats, tex, { name, owlName }) {
  const root = new THREE.Group();
  root.position.set(0.38, 0.779, 0.18);
  root.rotation.y = -0.08;
  desk.root.add(root);
  const W = 1024;
  const H = 480;
  const base = document.createElement("canvas");
  base.width = W;
  base.height = H;
  const bctx = base.getContext("2d");
  const rand = random(101);
  // parchment and the castle plan in ink
  bctx.fillStyle = "#e3cf9c";
  bctx.fillRect(0, 0, W, H);
  const stain = bctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.6);
  stain.addColorStop(0, "rgba(120, 80, 30, 0)");
  stain.addColorStop(1, "rgba(120, 80, 30, 0.4)");
  bctx.fillStyle = stain;
  bctx.fillRect(0, 0, W, H);
  const ink = document.createElement("canvas");
  ink.width = W;
  ink.height = H;
  const ictx = ink.getContext("2d");
  ictx.strokeStyle = "rgba(60, 30, 15, 0.9)";
  ictx.fillStyle = "rgba(60, 30, 15, 0.9)";
  ictx.lineWidth = 2;
  const rooms = [];
  for (let i = 0; i < 26; i++) {
    const rw = 60 + rand() * 120;
    const rh = 40 + rand() * 80;
    const x = 40 + rand() * (W - 80 - rw);
    const y = 40 + rand() * (H - 80 - rh);
    ictx.strokeRect(x, y, rw, rh);
    rooms.push([x + rw / 2, y + rh / 2]);
  }
  for (let i = 0; i < rooms.length - 1; i++) {
    const [ax, ay] = rooms[i];
    const [bx, by] = rooms[i + 1];
    ictx.beginPath();
    ictx.moveTo(ax, ay);
    ictx.lineTo(bx, ay);
    ictx.lineTo(bx, by);
    ictx.stroke();
  }
  ictx.font = 'italic 22px "IM Fell English", serif';
  for (const [i, label] of ["Great Hall", "Library", "Owlery", "Tower", "Kitchens", "Dungeons", "Courtyard"].entries()) {
    const [x, y] = rooms[i * 3];
    ictx.fillText(label, x - 40, y + 6);
  }
  ictx.font = 'bold 30px "IM Fell English", serif';
  ictx.fillText("I solemnly swear that I am up to no good", W / 2 - 280, 32);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.anisotropy = 8;
  const cover = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    map: canvasTexture(256, 480, (c, w, h) => {
      c.fillStyle = "#cdb47a";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(60, 30, 15, 0.85)";
      c.font = 'bold 30px "IM Fell English", serif';
      c.fillText("The", 100, 180);
      c.fillText("Marauder's", 50, 220);
      c.fillText("Map", 95, 260);
    }),
  });

  // footprints that walk the corridors, each with a name
  const walkers = [name, owlName, "Peeves", "Filch"].map((label, i) => ({ label, t: rand() * 10, speed: 18 + i * 5, start: i * 5 }));
  function pathPoint(w, t, out) {
    const n = rooms.length;
    const seg = ((Math.floor(t) % n) + n) % n;
    const [ax, ay] = rooms[(seg + w.start) % n];
    const [bx, by] = rooms[(seg + w.start + 1) % n];
    const f = t - Math.floor(t);
    // along the L-shaped corridor: across, then up or down
    const across = Math.abs(bx - ax);
    const down = Math.abs(by - ay);
    const d = f * (across + down);
    if (d < across) out.set(ax + Math.sign(bx - ax) * d, ay, 0);
    else out.set(bx, ay + Math.sign(by - ay) * (d - across), 0);
    return out;
  }
  const fp = v3();
  const fp2 = v3();
  function draw(reveal) {
    ctx.drawImage(base, 0, 0);
    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.drawImage(ink, 0, 0);
    if (reveal > 0.5) {
      for (const w of walkers) {
        for (let k = 0; k < 8; k++) {
          const tt = w.t - k * 0.035;
          pathPoint(w, tt, fp);
          pathPoint(w, tt + 0.01, fp2);
          const ang = Math.atan2(fp2.y - fp.y, fp2.x - fp.x);
          const side = k % 2 ? 1 : -1;
          ctx.save();
          ctx.globalAlpha = reveal * (1 - k / 8);
          ctx.translate(fp.x + Math.cos(ang + Math.PI / 2) * 4 * side, fp.y + Math.sin(ang + Math.PI / 2) * 4 * side);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        pathPoint(w, w.t, fp);
        ctx.font = 'italic 18px "IM Fell English", serif';
        const tw = ctx.measureText(w.label).width;
        ctx.strokeRect(fp.x + 8, fp.y - 26, tw + 10, 22);
        ctx.fillText(w.label, fp.x + 13, fp.y - 9);
      }
    }
    ctx.restore();
    mapTex.needsUpdate = true;
  }
  draw(0);

  // four panels: 1 stays put, 0 and 2 fold onto it, 3 folds onto 2
  const PW = 0.15;
  const PD = 0.28;
  const panelMat = (i) => {
    const m = new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.9 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>\n vMapUv = vec2(${(i / 4).toFixed(3)} + uv.x * 0.25, uv.y);`);
    };
    m.customProgramCacheKey = () => `map-panel-${i}`;
    return m;
  };
  const panel = (parent, i, dx) => {
    const geo = new THREE.BoxGeometry(PW, 0.002, PD);
    geo.translate(dx, 0.001, 0);
    return add(parent, geo, [cover, cover, panelMat(i), cover, cover, cover], 0, 0, 0, { cast: true });
  };
  const p1 = new THREE.Group();
  root.add(p1);
  panel(p1, 1, -PW / 2);
  const h0 = new THREE.Group();
  h0.position.x = -PW;
  p1.add(h0);
  panel(h0, 0, -PW / 2);
  const h2 = new THREE.Group();
  p1.add(h2);
  panel(h2, 2, PW / 2);
  const h3 = new THREE.Group();
  h3.position.x = PW;
  h2.add(h3);
  panel(h3, 3, PW / 2);

  root.updateWorldMatrix(true, true);
  let open = false;
  let k = 0;
  let reveal = 0;
  let redrawIn = 0;
  return {
    key: "map",
    title: "The Marauder's Map",
    get text() {
      return open ? "Mischief in progress: every footstep in the castle, inked live onto the parchment." : "A worn, folded piece of parchment. It looks blank... unless you know what to say.";
    },
    root,
    focus: { position: root.localToWorld(v3(0, 0.55, 0.45)), target: root.localToWorld(v3(0, 0, 0)) },
    colliders: [],
    get actions() {
      return [{ id: "toggle", label: open ? "Mischief managed" : "I solemnly swear…" }];
    },
    act() {
      open = !open;
    },
    update(dt, t) {
      k += ((open ? 1 : 0) - k) * (1 - Math.exp(-dt * 2.2));
      // unfold in order: the left flap, then the right pair
      h0.rotation.z = Math.PI * (1 - ease(clamp01(k * 2)));
      h2.rotation.z = -Math.PI * (1 - ease(clamp01(k * 2 - 0.5)));
      h3.rotation.z = -Math.PI * (1 - ease(clamp01(k * 2 - 1)));
      h0.position.y = 0.003 * (1 - k);
      h2.position.y = 0.0045 * (1 - k);
      h3.position.y = 0.0015 * (1 - k);
      const want = open && k > 0.8 ? 1 : 0;
      reveal += (want - reveal) * (1 - Math.exp(-dt * 1.2));
      for (const w of walkers) w.t += (dt * w.speed) / 200;
      redrawIn -= dt;
      if ((reveal > 0.01 || open) && redrawIn <= 0) {
        draw(reveal);
        redrawIn = 1 / 12;
      }
    },
  };
}

// ---------- a wand on the bedside table that casts spells ----------

export function buildWand(bedside, mats, sparks) {
  const root = new THREE.Group();
  root.position.set(-0.1, 0.72, 0.02);
  bedside.root.add(root);
  const wand = new THREE.Group();
  wand.rotation.set(0, 0.5, Math.PI / 2);
  root.add(wand);
  add(wand, new THREE.CylinderGeometry(0.004, 0.0075, 0.32, 10), mats.wandWood, 0, 0, 0);
  for (const y of [-0.09, -0.11, -0.13]) add(wand, new THREE.TorusGeometry(0.008, 0.0018, 6, 12), mats.wandWood, 0, y, 0).rotation.x = Math.PI / 2;
  const tipMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  add(wand, new THREE.SphereGeometry(0.006, 10, 8), tipMat, 0, 0.162, 0, { cast: false });
  const light = new THREE.PointLight(0xdfe8ff, 0, 3, 2);
  light.position.y = 0.17;
  wand.add(light);
  root.updateWorldMatrix(true, true);
  const tip = v3();
  let spell = null;
  return {
    key: "wand",
    title: "Wand",
    text: "Holly, eleven inches, with a feather from a phoenix inside. It hums when you pick it up.",
    root,
    focus: { position: root.localToWorld(v3(0.6, 0.45, 0.8)), target: root.localToWorld(v3(0, 0.1, 0)) },
    colliders: [],
    actions: [
      { id: "lumos", label: "Lumos" },
      { id: "sparks", label: "Shower of sparks" },
    ],
    act(id) {
      spell = { id, t: 0 };
    },
    update(dt, t) {
      if (!spell) {
        light.intensity += (0 - light.intensity) * (1 - Math.exp(-dt * 3));
        tipMat.color.setScalar(light.intensity * 2);
        return;
      }
      spell.t += dt;
      const T = spell.t;
      // rises from the table, points up, does its spell, and settles back
      const up = ease(clamp01(T / 0.6)) * (1 - ease(clamp01((T - 4.4) / 0.8)));
      wand.position.y = up * 0.25;
      wand.rotation.set(0, 0.5 + up * Math.sin(T * 2) * 0.3, Math.PI / 2 * (1 - up) + up * 0.15 * Math.sin(T * 6) * (spell.id === "sparks" ? 1 : 0.2));
      wand.updateWorldMatrix(true, false);
      wand.localToWorld(tip.set(0, 0.17, 0));
      if (spell.id === "lumos") {
        light.intensity = up * 2.2 * (0.9 + 0.1 * Math.sin(t * 9));
        tipMat.color.setRGB(up * 3, up * 3.1, up * 3.4);
        if (Math.random() < dt * 20 * up) sparks.burst(tip, 1, [0xe8f0ff, 0xbfd4ff], { speed: 0.2, up: 0.5, life: 0.8, gravity: 0 });
      } else if (T > 0.7 && T < 3.8) {
        tipMat.color.setRGB(3, 1.6, 0.6);
        sparks.burst(tip, 4, [0xffd36a, 0xff5a3a, 0xffffff, 0x8fd0ff], { speed: 1.6, up: 0.8, spread: 1, life: 1.4, gravity: -1.5 });
      }
      if (T > 5.2) spell = null;
    },
  };
}



// ---------- moonbeam and soft contact shadows ----------

export function buildMoonbeam(scene, moonDir) {
  const from = v3(0, 1.85, -4.45);
  const dir = moonDir.clone().negate().normalize();
  const length = from.y / -dir.y;
  const geo = new THREE.CylinderGeometry(0.62, 0.95, length, 32, 1, true);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      ${NOISE}
      void main() {
        float facing = abs(dot(normalize(vN), normalize(cameraPosition - vW)));
        float a = pow(facing, 3.0) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        a *= 0.7 + 0.6 * fbm(vec2(vUv.x * 10.0, vUv.y * 4.0 - uTime * 0.03));
        gl_FragColor = vec4(vec3(0.55, 0.65, 1.0), a * 0.05);
      }`,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.position.copy(from).addScaledVector(dir, length / 2);
  beam.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.clone().negate());
  scene.add(beam);
  return beam;
}

export function buildContactShadows(scene, spots) {
  const tex = canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(0,0,0,0.85)");
    g.addColorStop(0.55, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z, w, d, rot = 0, opacity = 0.7] of spots) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.clone());
    m.material.opacity = opacity;
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(x, 0.009, z);
    m.renderOrder = 1;
    scene.add(m);
  }
}
