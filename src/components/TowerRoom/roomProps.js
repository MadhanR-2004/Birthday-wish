import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { random, parchment } from "./roomTextures.js";

// The furniture and objects of the tower room, each built from simple shapes.
// Units are metres; the room is a round tower centred on the origin, floor at
// y = 0. Interactive objects return a "prop":
//   { key, title, text, root, focus: { position, target }, actions, act(id), update(dt, t), colliders }
// actions are { id, label } buttons shown in the page; act(id) runs one.

export const ROOM = { R: 4.2, H: 3.4, WINDOW_HALF: 0.165, SILL: 0.95, ARCH_Y: 2.13, OPEN_W: 0.62 };

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

function add(parent, geo, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}
const box = (parent, w, h, d, mat, x, y, z, opts) => add(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z, opts);
const rbox = (parent, w, h, d, r, mat, x, y, z, opts) => add(parent, new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z, opts);
const lathe = (points, segments = 32) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

// A point on the tower wall at angle a (0 = the door, pi = the window).
export const onWall = (a, inset = 0, y = 0) => v3(Math.sin(a) * (ROOM.R - inset), y, Math.cos(a) * (ROOM.R - inset));

// A copy of a material with all its surface maps tiled rx by ry times.
function tileMaterial(mat, rx, ry) {
  const m = mat.clone();
  for (const key of ["map", "normalMap", "roughnessMap", "bumpMap"]) if (mat[key]) m[key] = tiled(mat[key], rx, ry);
  return m;
}

// Keeps a texture's look but with its own tiling.
function tiled(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

// ---------- candle flames ----------

const FLAME_H = 0.05;
export function flameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vH;
      void main() {
        vec3 p = position;
        vH = clamp(p.y / ${FLAME_H.toFixed(3)}, 0.0, 1.0);
        vec4 origin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float seed = origin.x * 12.7 + origin.z * 7.3 + origin.y * 3.1;
        float sway = sin(uTime * 13.0 + seed) * 0.5 + sin(uTime * 7.3 + seed * 2.0) * 0.5;
        p.x += sway * 0.004 * vH * vH;
        p.z += cos(uTime * 11.0 + seed) * 0.003 * vH * vH;
        p.y *= 1.0 + 0.14 * sin(uTime * 17.0 + seed);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uBright;
      varying float vH;
      void main() {
        vec3 core = vec3(1.0, 0.95, 0.8);
        vec3 edge = vec3(1.0, 0.45, 0.08);
        vec3 c = mix(core, edge, smoothstep(0.1, 0.9, vH));
        gl_FragColor = vec4(c * 3.0 * uBright, 1.0);
      }`,
  });
}
const flameGeometry = lathe([[0, 0], [0.006, 0.004], [0.009, 0.013], [0.008, 0.026], [0.005, 0.038], [0, FLAME_H]], 16);

// A wax candle with a flickering flame. Returns { group, flame }.
export function candle(mats, height = 0.16, radius = 0.022) {
  const group = new THREE.Group();
  add(group, new THREE.CylinderGeometry(radius, radius * 1.05, height, 20), mats.wax, 0, height / 2, 0);
  add(group, new THREE.SphereGeometry(radius * 0.55, 10, 6), mats.wax, radius * 0.7, height - 0.01, 0).scale.set(0.5, 1.6, 0.5); // a drip
  add(group, new THREE.CylinderGeometry(0.0015, 0.0015, 0.012, 6), mats.iron, 0, height + 0.006, 0, { cast: false });
  const flame = add(group, flameGeometry, mats.flame, 0, height + 0.008, 0, { cast: false, receive: false });
  return { group, flame };
}

// ---------- the room itself ----------

export function buildShell(scene, mats, tex) {
  const { R, H, WINDOW_HALF: HW, SILL, ARCH_Y, OPEN_W } = ROOM;
  const group = new THREE.Group();
  scene.add(group);

  const floorMat = mats.floor.clone();
  const floor = add(group, new THREE.CircleGeometry(R + 0.05, 96), floorMat, 0, 0, 0, { cast: false });
  floor.rotation.x = -Math.PI / 2;

  // Curved stone wall, in pieces so there's an opening for the window.
  const wall = (start, length, y0, y1) => {
    const m = tileMaterial(mats.stone, (R * length) / 2.5, (y1 - y0) / 2.5);
    const mesh = add(group, new THREE.CylinderGeometry(R, R, y1 - y0, Math.max(8, Math.round(length * 30)), 1, true, start, length), m, 0, (y0 + y1) / 2, 0);
    m.side = THREE.BackSide;
    m.shadowSide = THREE.DoubleSide;
    return mesh;
  };
  wall(Math.PI + HW, Math.PI * 2 - HW * 2, 0, H);
  wall(Math.PI - HW, HW * 2, 0, SILL);
  wall(Math.PI - HW, HW * 2, ARCH_Y + OPEN_W, H);

  // The window: a deep arched opening through the wall.
  const chordZ = -R * Math.cos(HW);
  const revealMat = tileMaterial(mats.stone, 0.4, 0.4);
  const depth = 0.45;
  for (const side of [-1, 1]) {
    // arch corners
    const shape = new THREE.Shape();
    shape.moveTo(side * 0.75, ARCH_Y);
    shape.lineTo(side * OPEN_W, ARCH_Y);
    for (let i = 0; i <= 16; i++) {
      const a = side > 0 ? (i / 16) * (Math.PI / 2) : Math.PI - (i / 16) * (Math.PI / 2);
      shape.lineTo(Math.cos(a) * OPEN_W, ARCH_Y + Math.sin(a) * OPEN_W);
    }
    shape.lineTo(0, ARCH_Y + OPEN_W + 0.06);
    shape.lineTo(side * 0.75, ARCH_Y + OPEN_W + 0.06);
    shape.closePath();
    // the stone above each side of the arch, as deep as the wall, so the
    // opening is properly arched rather than a square hole
    add(group, new THREE.ExtrudeGeometry(shape, { depth: depth + 0.02, bevelEnabled: false, curveSegments: 16 }), revealMat, 0, 0, chordZ - depth);

    // side walls of the opening
    box(group, 0.12, ARCH_Y - SILL, depth, revealMat, side * (OPEN_W + 0.06), (SILL + ARCH_Y) / 2, chordZ - depth / 2);
  }
  // a deep stone sill
  box(group, OPEN_W * 2 + 0.24, 0.07, depth + 0.16, revealMat, 0, SILL - 0.035, chordZ - depth / 2 + 0.08);

  // Glass: two leaded casements that swing in, and a fixed arched pane above.
  const glassZ = chordZ - depth + 0.05;
  const windowGroup = new THREE.Group();
  group.add(windowGroup);
  const casements = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * OPEN_W, 0, glassZ);
    windowGroup.add(hinge);
    const leaf = new THREE.Group();
    hinge.add(leaf);
    const w = OPEN_W;
    const h = ARCH_Y - SILL - 0.02;
    const cx = -side * w / 2;
    const cy = SILL + 0.01 + h / 2;
    const glass = add(leaf, new THREE.PlaneGeometry(w - 0.06, h - 0.06), mats.glass, cx, cy, 0, { cast: false });
    glass.renderOrder = 2;
    for (const [fw, fh, fx, fy] of [[w, 0.04, cx, SILL + 0.03], [w, 0.04, cx, ARCH_Y - 0.03], [0.04, h, -side * 0.02, cy], [0.04, h, -side * (w - 0.02), cy]]) {
      box(leaf, fw, fh, 0.04, mats.oak, fx, fy, 0);
    }
    add(leaf, new THREE.TorusGeometry(0.018, 0.005, 6, 16), mats.iron, -side * (w - 0.08), cy, 0.03);
    casements.push({ hinge, side });
  }
  const top = add(windowGroup, new THREE.CircleGeometry(OPEN_W, 32, 0, Math.PI), mats.glass, 0, ARCH_Y, glassZ, { cast: false });
  top.renderOrder = 2;
  const transom = add(windowGroup, new THREE.BoxGeometry(OPEN_W * 2, 0.05, 0.05), mats.oak, 0, ARCH_Y, glassZ);
  transom.castShadow = true;
  // an oak frame round the arched pane
  add(windowGroup, new THREE.TorusGeometry(OPEN_W - 0.02, 0.025, 6, 40, Math.PI), mats.oak, 0, ARCH_Y, glassZ);

  // The roof: a cone of dark planks on radial rafters, with a ring beam.
  const roofH = 2.2;
  const roofMat = mats.beams.clone();
  roofMat.map = tiled(tex.beams.map, 6, 2);
  roofMat.side = THREE.BackSide;
  add(group, new THREE.ConeGeometry(R, roofH, 96, 1, true), roofMat, 0, H + roofH / 2, 0, { cast: false });
  const ring = add(group, new THREE.TorusGeometry(R - 0.06, 0.09, 8, 128), mats.beams, 0, H, 0);
  ring.rotation.x = Math.PI / 2;
  const rafterLen = Math.hypot(R, roofH);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rafter = add(group, new THREE.BoxGeometry(0.1, 0.14, rafterLen), mats.beams, Math.sin(a) * R * 0.5, H + roofH / 2 - 0.08, Math.cos(a) * R * 0.5);
    rafter.rotation.order = "YXZ";
    rafter.rotation.y = a;
    rafter.rotation.x = Math.atan2(roofH, R);
  }
  // skirting ring of stone at the floor
  const skirt = add(group, new THREE.TorusGeometry(R - 0.02, 0.05, 6, 128), mats.stoneDark, 0, 0.04, 0);
  skirt.rotation.x = Math.PI / 2;

  // The door, arched oak with iron straps (behind where you start).
  const door = new THREE.Group();
  door.position.copy(onWall(0, 0.06));
  door.rotation.y = Math.PI;
  group.add(door);
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.55, 0);
  doorShape.lineTo(0.55, 0);
  doorShape.lineTo(0.55, 1.75);
  doorShape.absarc(0, 1.75, 0.55, 0, Math.PI, false);
  doorShape.lineTo(-0.55, 0);
  const doorMat = mats.oak.clone();
  doorMat.map = tiled(tex.floor.map, 0.6, 0.5);
  add(door, new THREE.ExtrudeGeometry(doorShape, { depth: 0.08, bevelEnabled: false }), doorMat, 0, 0, 0);
  for (const y of [0.35, 1.2, 1.9]) box(door, 0.9, 0.05, 0.02, mats.iron, -0.05, y, 0.09);
  const handle = add(door, new THREE.TorusGeometry(0.06, 0.01, 8, 24), mats.iron, 0.38, 1.05, 0.12);
  handle.rotation.x = 0.3;

  return { group, casements, windowGroup };
}

// ---------- sky outside the window ----------

export function buildSky(scene, moonDir) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uMoon: { value: moonDir.clone().normalize() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoon;
      uniform float uTime;
      varying vec3 vDir;
      float hash13(vec3 p3) {
        p3 = fract(p3 * 0.1031);
        p3 += dot(p3, p3.zyx + 31.32);
        return fract((p3.x + p3.y) * p3.z);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(vec3(0.06, 0.08, 0.18), vec3(0.008, 0.012, 0.035), smoothstep(0.0, 0.6, h));
        // stars
        vec3 p = d * 220.0;
        vec3 cell = floor(p);
        float r = hash13(cell);
        if (r > 0.986 && h > 0.0) {
          float s = smoothstep(0.32, 0.0, length(fract(p) - 0.5)) * (r - 0.986) / 0.014;
          s *= 0.7 + 0.3 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
          col += vec3(0.9, 0.94, 1.0) * s * 2.5;
        }
        // the moon and its halo
        float m = dot(d, uMoon);
        col += vec3(1.0, 0.97, 0.9) * smoothstep(0.99935, 0.9996, m) * 2.2;
        col += vec3(0.35, 0.45, 0.8) * pow(max(m, 0.0), 400.0) * 0.35;
        col += vec3(0.12, 0.16, 0.3) * pow(max(m, 0.0), 30.0) * 0.4;
        // far mountains, and a dark lake below them
        float az = atan(d.x, d.z);
        float ridge = 0.05 + 0.04 * sin(az * 3.0 + 1.0) + 0.025 * sin(az * 7.0 + 2.0) + 0.012 * sin(az * 17.0);
        if (h < ridge) col = mix(vec3(0.01, 0.014, 0.03), vec3(0.03, 0.04, 0.08), smoothstep(ridge - 0.06, ridge, h));
        if (h < 0.0) col = vec3(0.01, 0.013, 0.025) + vec3(0.2, 0.25, 0.4) * pow(max(dot(vec3(d.x, -d.y, d.z), uMoon), 0.0), 200.0) * 0.5;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), mat);
  scene.add(sky);
  return sky;
}

// ---------- the four-poster bed ----------

export function buildBed(scene, mats, tex, { model } = {}) {
  const root = new THREE.Group();
  root.position.set(-2.85, 0, 0.35);
  scene.add(root);
  // with a real bed model, the canopy and curtains go round it
  const L = model ? 1.08 : 1.0; // half length (along x)
  const W = model ? 0.8 : 0.5; // half width (along z)

  const post = lathe([
    [0, 0], [0.06, 0], [0.06, 0.1], [0.045, 0.14], [0.045, 0.5], [0.066, 0.56], [0.066, 0.66], [0.04, 0.72],
    [0.034, 1.9], [0.05, 1.95], [0.05, 2.05], [0.03, 2.12], [0.042, 2.2], [0, 2.27],
  ]);
  for (const x of [-L, L]) for (const z of [-W, W]) add(root, post, mats.walnut, x, 0, z);
  for (const z of [-W, W]) box(root, 2 * L + 0.08, 0.07, 0.06, mats.walnut, 0, 2.13, z);
  for (const x of [-L, L]) box(root, 0.06, 0.07, 2 * W + 0.08, mats.walnut, x, 2.13, 0);

  if (model) {
    // the model lies along z with its head at -z; turn it to run along x,
    // head against the wall
    model.rotation.y = Math.PI / 2;
    root.add(model);
  } else {
    for (const z of [-W, W]) box(root, 2 * L, 0.16, 0.05, mats.walnut, 0, 0.36, z);
    for (const x of [-L, L]) box(root, 0.05, 0.16, 2 * W, mats.walnut, x, 0.36, 0);
    // headboard with a carved panel, and a lower footboard
    box(root, 0.06, 0.85, 2 * W - 0.06, mats.walnut, -L, 0.95, 0);
    box(root, 0.03, 0.55, 2 * W - 0.3, mats.walnutDark, -L + 0.035, 1.0, 0);
    box(root, 0.06, 0.5, 2 * W - 0.06, mats.walnut, L, 0.6, 0);
    rbox(root, 2 * L - 0.06, 0.22, 2 * W - 0.04, 0.06, mats.linen, 0, 0.53, 0);
    for (const z of [-0.23, 0.23]) {
      const pillow = add(root, new THREE.SphereGeometry(1, 32, 16), mats.linen, -L + 0.24, 0.71, z);
      pillow.scale.set(0.16, 0.075, 0.22);
      pillow.rotation.set(0, z * 0.3, -0.25);
    }
    // quilt over the lower two-thirds, hanging over the sides
    const quiltMat = mats.quilt;
    rbox(root, 1.45, 0.05, 2 * W + 0.06, 0.02, quiltMat, 0.27, 0.66, 0);
    const drape = (len, x, z, rotY) => {
      const geo = new THREE.PlaneGeometry(len, 0.4, 40, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const t = 0.5 - pos.getY(i) / 0.4;
        pos.setZ(i, Math.sin(pos.getX(i) * 22) * 0.015 * t);
      }
      geo.computeVertexNormals();
      const m = add(root, geo, quiltMat, x, 0.47, z);
      m.rotation.y = rotY;
      return m;
    };
    drape(1.45, 0.27, W + 0.035, 0);
    drape(1.45, 0.27, -W - 0.035, Math.PI);
    drape(2 * W + 0.06, L - 0.42, 0, Math.PI / 2).position.x = 0.27 + 0.73;
  }

  // Velvet curtains: each side has two panels that gather at the posts.
  const curtainGeo = (width) => {
    const geo = new THREE.PlaneGeometry(1, 1.92, 64, 1);
    geo.translate(0.5, 0, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * Math.PI * 2 * (6 * width)) * 0.03);
    geo.computeVertexNormals();
    return geo;
  };
  const panels = [];
  const panel = (px, pz, dirAngle, width) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, 1.13, pz);
    pivot.rotation.y = dirAngle;
    root.add(pivot);
    const m = add(pivot, curtainGeo(width), mats.velvet, 0, 0, 0);
    m.scale.x = width * 0.14;
    panels.push({ pivot, mesh: m, width, open: width * 0.14, closed: width, scale: width * 0.14, speed: 0, sway: Math.random() * 6 });
  };
  // front (z = +W) and back sides: from each end post towards the middle
  for (const z of [W + 0.04, -W - 0.04]) {
    panel(-L, z, 0, L);
    panel(L, z, Math.PI, L);
  }
  // foot end: from each corner towards the middle
  panel(L + 0.04, -W, -Math.PI / 2, W);
  panel(L + 0.04, W, Math.PI / 2, W);
  // valance along the canopy
  for (const z of [W + 0.05, -W - 0.05]) box(root, 2 * L + 0.1, 0.16, 0.02, mats.velvet, 0, 2.05, z);
  box(root, 0.02, 0.16, 2 * W + 0.1, mats.velvet, L + 0.05, 2.05, 0);

  let drawn = false;
  const prop = {
    key: "bed",
    title: "Four-poster bed",
    text: "Heavy crimson curtains, a feather pillow and a quilt stitched in gold. The warmest place in the tower.",
    root,
    focus: { position: v3(-1.0, 1.6, 2.4), target: v3(-2.7, 0.9, 0.35) },
    hotspot: v3(-2.85, 1.6, 0.35),
    colliders: [new THREE.Box3(v3(-3.95, 0, -0.5), v3(-1.7, 2.35, 1.2))],
    get actions() {
      return [{ id: "curtains", label: drawn ? "Open the curtains" : "Draw the curtains" }];
    },
    act() {
      drawn = !drawn;
      for (const p of panels) p.target = drawn ? p.closed : p.open;
    },
    update(dt, t) {
      for (const p of panels) {
        const target = p.target ?? p.open;
        // a soft spring, so the velvet swings a little as it settles
        p.speed += ((target - p.scale) * 18 - p.speed * 6) * dt;
        p.scale += p.speed * dt;
        p.mesh.scale.x = Math.max(0.05, p.scale);
        p.mesh.rotation.x = Math.sin(t * 0.7 + p.sway) * 0.012 + p.speed * 0.02;
      }
    },
  };
  return prop;
}



// ---------- desk under the window: parchment, a quill that writes, a globe ----------

export function buildDesk(scene, mats, tex, { name }) {
  const root = new THREE.Group();
  root.position.set(0, 0, -3.2);
  scene.add(root);
  box(root, 1.36, 0.05, 0.66, mats.walnut, 0, 0.75, 0);
  box(root, 1.22, 0.11, 0.56, mats.walnut, 0, 0.67, 0);
  box(root, 0.5, 0.08, 0.01, mats.walnutDark, 0, 0.67, 0.282);
  add(root, new THREE.SphereGeometry(0.014, 10, 8), mats.brass, 0, 0.67, 0.292);
  const leg = lathe([[0, 0], [0.035, 0], [0.03, 0.05], [0.025, 0.4], [0.04, 0.5], [0.032, 0.62], [0.036, 0.725], [0, 0.725]], 20);
  for (const x of [-0.6, 0.6]) for (const z of [-0.27, 0.27]) add(root, leg, mats.walnut, x, 0, z);

  // the chair, pulled out a little
  const chair = new THREE.Group();
  chair.position.set(0.1, 0, 0.72);
  chair.rotation.y = Math.PI + 0.15;
  root.add(chair);
  rbox(chair, 0.46, 0.04, 0.44, 0.01, mats.oak, 0, 0.46, 0);
  for (const x of [-0.19, 0.19]) for (const z of [-0.18, 0.18]) add(chair, new THREE.CylinderGeometry(0.018, 0.016, 0.46, 10), mats.oak, x, 0.23, z);
  for (const x of [-0.19, 0.19]) add(chair, new THREE.CylinderGeometry(0.016, 0.016, 0.5, 10), mats.oak, x, 0.72, -0.19);
  box(chair, 0.44, 0.07, 0.03, mats.oak, 0, 0.96, -0.19);
  for (let i = 0; i < 4; i++) add(chair, new THREE.CylinderGeometry(0.008, 0.008, 0.42, 8), mats.oak, -0.12 + i * 0.08, 0.72, -0.19);

  // parchment, which the quill writes on
  const sheet = parchment(tex.fine);
  const paperMat = new THREE.MeshStandardMaterial({ map: sheet.texture, roughness: 0.92 });
  const paper = add(root, new THREE.PlaneGeometry(0.3, 0.41), paperMat, -0.15, 0.7765, 0.06, { cast: false });
  paper.rotation.set(-Math.PI / 2, 0, 0.12);
  // ink bottle
  add(root, new THREE.CylinderGeometry(0.03, 0.035, 0.06, 20), mats.inkGlass, 0.25, 0.805, -0.1);
  add(root, new THREE.CylinderGeometry(0.014, 0.016, 0.02, 14), mats.inkGlass, 0.25, 0.843, -0.1);
  // the quill (a long feather on a shaft), standing in the ink
  const quill = new THREE.Group();
  root.add(quill);
  add(quill, new THREE.CylinderGeometry(0.0018, 0.0012, 0.3, 6), mats.quillShaft, 0, 0.15, 0, { cast: false });
  const vane = add(quill, new THREE.PlaneGeometry(0.045, 0.21), mats.quillVane, 0.012, 0.19, 0);
  vane.rotation.y = 0.4;
  const rest = { pos: v3(0.25, 0.8, -0.1), rot: new THREE.Euler(0.25, 0, -0.32) };
  quill.position.copy(rest.pos);
  quill.rotation.copy(rest.rot);

  // a stack of old books and a small brass star globe that turns by itself
  for (let i = 0; i < 4; i++) {
    const b = box(root, 0.22 - i * 0.015, 0.045, 0.3 - i * 0.02, mats.bookCover[i % mats.bookCover.length], -0.5, 0.8 + i * 0.046, -0.12);
    b.rotation.y = (i % 2 ? 0.12 : -0.08) + i * 0.03;
  }
  const globe = new THREE.Group();
  globe.position.set(0.5, 0.775, -0.12);
  root.add(globe);
  add(globe, lathe([[0, 0], [0.07, 0], [0.07, 0.012], [0.02, 0.025], [0.012, 0.11], [0, 0.11]]), mats.brass, 0, 0, 0);
  const spinner = new THREE.Group();
  spinner.position.y = 0.21;
  globe.add(spinner);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const r = add(spinner, new THREE.TorusGeometry(0.1 - i * 0.012, 0.0035, 8, 64), mats.brass, 0, 0, 0);
    r.rotation.set(i * 0.9, i * 0.6, i * 0.3);
    rings.push(r);
  }
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x1b2a55, emissive: 0x4d7cff, emissiveIntensity: 0.6, roughness: 0.3 });
  add(spinner, new THREE.SphereGeometry(0.04, 24, 16), coreMat, 0, 0, 0, { cast: false });
  const meridian = add(globe, new THREE.TorusGeometry(0.115, 0.004, 8, 48, Math.PI), mats.brass, 0, 0.21, 0);
  meridian.rotation.z = Math.PI / 2 + 0.4;

  // Writing: draw the letters one at a time and move the nib along with them.
  let lines = [`Dear ${name},`, "Happy birthday!", "May this year be", "full of magic."];
  const ctx = sheet.canvas.getContext("2d");
  const fontFamily = '"Homemade Apple", "IM Fell English", cursive';
  let writing = null;
  const nib = new THREE.Vector3();

  function nibTarget(lineIndex, chars) {
    ctx.font = `30px ${fontFamily}`;
    const x = 60 + ctx.measureText(lines[lineIndex].slice(0, chars)).width;
    const y = 150 + lineIndex * 80;
    // canvas pixels -> point on the parchment
    const u = x / sheet.canvas.width;
    const v = y / sheet.canvas.height;
    return paper.localToWorld(nib.set((u - 0.5) * 0.3, (0.5 - v) * 0.41, 0.004)).clone();
  }
  function redraw(lineIndex, chars) {
    ctx.drawImage(sheet.base, 0, 0);
    ctx.font = `30px ${fontFamily}`;
    ctx.fillStyle = "rgba(30, 18, 10, 0.9)";
    for (let i = 0; i <= lineIndex; i++) ctx.fillText(i < lineIndex ? lines[i] : lines[i].slice(0, chars), 60, 150 + i * 80);
    sheet.texture.needsUpdate = true;
  }

  let spin = 0.25;
  let glow = 0.6;
  const deskProp = {
    key: "desk",
    title: "Writing desk",
    text: "Parchment, ink and a quill that's been known to write all by itself.",
    root,
    focus: { position: v3(0.15, 1.45, -2.05), target: v3(0, 0.8, -3.25) },
    colliders: [new THREE.Box3(v3(-0.72, 0, -3.55), v3(0.72, 0.85, -2.85)), new THREE.Box3(v3(-0.18, 0, -2.75), v3(0.4, 1.0, -2.25))],
    get actions() {
      return [{ id: "write", label: writing ? "Writing…" : "Let the quill write" }];
    },
    act() {
      if (writing) return;
      writing = { t: 0, line: 0, chars: 0 };
      redraw(0, 0);
    },
    // give the quill something else to write (from now on), and start
    update(dt, t) {
      if (!writing) {
        quill.position.lerp(rest.pos, 1 - Math.exp(-dt * 4));
        quill.rotation.x += (rest.rot.x - quill.rotation.x) * (1 - Math.exp(-dt * 4));
        quill.rotation.z += (rest.rot.z - quill.rotation.z) * (1 - Math.exp(-dt * 4));
        return;
      }
      writing.t += dt;
      if (writing.t > 0.8) {
        writing.chars += dt * 9;
        const len = lines[writing.line].length;
        if (writing.chars >= len) {
          if (writing.line < lines.length - 1) {
            writing.line += 1;
            writing.chars = 0;
          } else if (writing.chars > len + 6) {
            writing = null;
            return;
          }
        }
        redraw(writing.line, Math.floor(writing.chars));
      }
      // the quill lifts out of the ink and follows its own writing
      const target = nibTarget(writing.line, Math.min(Math.floor(writing.chars), lines[writing.line].length));
      root.worldToLocal(target);
      target.y += 0.004 + Math.abs(Math.sin(t * 22)) * 0.004;
      quill.position.lerp(target, 1 - Math.exp(-dt * 10));
      quill.rotation.x += (0.5 - quill.rotation.x) * (1 - Math.exp(-dt * 6));
      quill.rotation.z += (-0.2 + Math.sin(t * 22) * 0.04 - quill.rotation.z) * (1 - Math.exp(-dt * 6));
    },
  };
  const globeProp = {
    key: "globe",
    title: "Star globe",
    text: "Brass rings that trace the paths of the stars. It turns by itself, a little faster when it's pleased.",
    root: globe,
    focus: { position: v3(0.75, 1.15, -2.55), target: v3(0.5, 0.95, -3.32) },
    colliders: [],
    actions: [{ id: "spin", label: "Give it a spin" }],
    act() {
      spin = 3.5;
      glow = 2.2;
    },
    update(dt, t) {
      spin += (0.25 - spin) * (1 - Math.exp(-dt * 0.6));
      glow += (0.6 - glow) * (1 - Math.exp(-dt * 0.8));
      spinner.rotation.y += spin * dt;
      rings.forEach((r, i) => (r.rotation.x += spin * dt * (0.3 + i * 0.25)));
      coreMat.emissiveIntensity = glow * (0.9 + 0.1 * Math.sin(t * 3));
    },
  };
  return [deskProp, globeProp];
}

// ---------- the owl's cage, on a turned wooden stand ----------

// Tube along points, for curved bars and rings.
const tube = (points, radius, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(8, points.length * 3), radius, 6, closed);

export function buildCage(scene, mats) {
  const root = new THREE.Group();
  root.position.set(1.75, 0, -3.0);
  root.rotation.y = Math.atan2(-1.75, 3.0); // door faces the middle of the room
  scene.add(root);
  add(root, lathe([[0, 0], [0.22, 0], [0.22, 0.05], [0.16, 0.08], [0.07, 0.15], [0.06, 0.7], [0.1, 0.78], [0.3, 0.8], [0.3, 0.85], [0, 0.85]], 32), mats.walnut, 0, 0, 0);

  const cage = new THREE.Group();
  cage.position.y = 0.85;
  root.add(cage);
  const Rc = 0.4;
  const SIDE = 0.6; // where the straight bars meet the dome
  const DOME = 0.36; // dome height
  add(cage, new THREE.CylinderGeometry(Rc + 0.02, Rc + 0.04, 0.06, 48), mats.brass, 0, 0.03, 0);
  add(cage, new THREE.CylinderGeometry(Rc - 0.01, Rc - 0.01, 0.01, 48), mats.oak, 0, 0.062, 0, { cast: false });

  // bars: angle a measured round from the door (+z)
  const DOOR = 0.42;
  const barPoints = (a, from, to) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const s = from + (to - from) * (i / 14);
      // s from 0..1 runs up the side; 1..2 over the dome
      let r;
      let y;
      if (s <= 1) {
        r = Rc;
        y = 0.06 + s * (SIDE - 0.06);
      } else {
        const q = (s - 1) * (Math.PI / 2);
        r = Rc * Math.cos(q);
        y = SIDE + DOME * Math.sin(q);
      }
      pts.push(v3(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    return pts;
  };
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wrapped = Math.atan2(Math.sin(a), Math.cos(a));
    const inDoor = Math.abs(wrapped) < DOOR;
    add(cage, tube(barPoints(a, inDoor ? 1 : 0, 1.97), 0.0055), mats.brass, 0, 0, 0);
  }
  const ringAt = (y, r, skipDoor) => {
    const pts = [];
    const from = skipDoor ? DOOR + 0.02 : 0;
    const to = skipDoor ? Math.PI * 2 - DOOR - 0.02 : Math.PI * 2;
    for (let i = 0; i <= 64; i++) {
      const a = from + (to - from) * (i / 64);
      pts.push(v3(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    add(cage, tube(pts, 0.008, !skipDoor), mats.brass, 0, 0, 0);
  };
  ringAt(0.07, Rc, false);
  ringAt(0.34, Rc, true);
  ringAt(SIDE, Rc, false);
  ringAt(SIDE + DOME * Math.sin(Math.PI / 4), Rc * Math.cos(Math.PI / 4), false);
  // a flat brass knob on top: where the owl likes to sit
  add(cage, new THREE.CylinderGeometry(0.035, 0.05, 0.035, 20), mats.brass, 0, SIDE + DOME + 0.012, 0);

  // the door: its bars swing out on a hinge at one edge
  const hingeAngle = -DOOR;
  const doorHinge = new THREE.Group();
  doorHinge.position.set(Math.sin(hingeAngle) * Rc, 0, Math.cos(hingeAngle) * Rc);
  cage.add(doorHinge);
  const doorBars = new THREE.Group();
  doorBars.position.copy(doorHinge.position).negate();
  doorHinge.add(doorBars);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wrapped = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(wrapped) < DOOR) add(doorBars, tube(barPoints(wrapped, 0.03, 0.97), 0.0055), mats.brass, 0, 0, 0);
  }
  for (const y of [0.1, 0.58]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = -DOOR + (2 * DOOR * i) / 16;
      pts.push(v3(Math.sin(a) * Rc, y, Math.cos(a) * Rc));
    }
    add(doorBars, tube(pts, 0.007), mats.brass, 0, 0, 0);
  }

  // perch across the middle, and a water dish
  const PERCH_Y = 0.36;
  const perch = add(cage, new THREE.CylinderGeometry(0.018, 0.018, 2 * Rc - 0.02, 12), mats.oak, 0, PERCH_Y, -0.04);
  perch.rotation.z = Math.PI / 2;
  add(cage, new THREE.CylinderGeometry(0.06, 0.05, 0.04, 20), mats.brass, 0.22, 0.085, -0.15);

  let doorOpen = true;
  let k = 1;
  const perchPoint = new THREE.Vector3(0, PERCH_Y + 0.018, -0.04);
  return {
    key: "cage",
    title: "Owl cage",
    text: "A tall brass cage with a smooth oak perch: home, when she isn't out delivering the post.",
    root,
    cage,
    focus: { position: v3(0.9, 1.6, -1.6), target: v3(1.72, 1.15, -3.0) },
    colliders: [new THREE.Box3(v3(1.25, 0, -3.5), v3(2.25, 1.9, -2.5))],
    // where the owl's talons go, and the floor of the cage, in world space
    perchWorld: () => cage.localToWorld(perchPoint.clone()),
    topWorld: () => cage.localToWorld(v3(0, SIDE + DOME + 0.03, 0)),
    trayWorld: (x = 0.12, z = 0.12) => cage.localToWorld(v3(x, 0.068, z)),
    doorDirection: () => v3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y)),
    get doorOpen() {
      return doorOpen;
    },
    setDoor(open) {
      doorOpen = open;
    },
    get actions() {
      return [{ id: "door", label: doorOpen ? "Close the door" : "Open the door" }];
    },
    act() {
      doorOpen = !doorOpen;
    },
    update(dt) {
      k += ((doorOpen ? 1 : 0) - k) * (1 - Math.exp(-dt * 3.5));
      doorHinge.rotation.y = -ease(clamp01(k)) * 1.75;
    },
  };
}

// ---------- bookshelf, with books that can be taken out ----------

export function buildBookshelf(scene, mats) {
  const root = new THREE.Group();
  root.position.set(3.45, 0, -1.2);
  root.rotation.y = Math.atan2(-3.45, 1.2);
  scene.add(root);
  const W = 1.4;
  const H = 2.3;
  const D = 0.38;
  box(root, 0.05, H, D, mats.walnut, -W / 2, H / 2, 0);
  box(root, 0.05, H, D, mats.walnut, W / 2, H / 2, 0);
  box(root, W + 0.1, 0.06, D + 0.06, mats.walnut, 0, H + 0.03, 0.01);
  box(root, W + 0.04, 0.03, D + 0.03, mats.walnutDark, 0, H + 0.075, 0.01);
  box(root, W, H, 0.02, mats.walnutDark, 0, H / 2, -D / 2 + 0.01);
  const shelves = [0.06, 0.5, 0.94, 1.38, 1.82];
  for (const y of shelves) box(root, W - 0.04, 0.035, D - 0.02, mats.walnut, 0, y - 0.0175, 0);

  const rand = random(77);
  const books = [];
  for (const y of shelves) {
    let x = -W / 2 + 0.05;
    while (x < W / 2 - 0.08) {
      if (rand() < 0.08) {
        // a few books lying flat in a stack
        const n = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) box(root, 0.22, 0.04, 0.17, mats.bookCover[Math.floor(rand() * mats.bookCover.length)], x + 0.11, y + 0.02 + i * 0.041, 0.02).rotation.y = (rand() - 0.5) * 0.2;
        x += 0.25;
        continue;
      }
      const bw = 0.028 + rand() * 0.035;
      const bh = 0.2 + rand() * 0.15;
      const bd = 0.17 + rand() * 0.07;
      if (x + bw > W / 2 - 0.04) break;
      const variant = Math.floor(rand() * mats.bookCover.length);
      const cover = mats.bookCover[variant];
      const book = add(root, new THREE.BoxGeometry(bw, bh, bd), [cover, cover, mats.pages, cover, mats.bookSpine[variant], cover], x + bw / 2, y + bh / 2, -D / 2 + 0.04 + bd / 2);
      book.userData.book = true;
      books.push({ mesh: book, home: book.position.clone(), size: v3(bw, bh, bd), variant });
      x += bw + 0.002;
      if (rand() < 0.05 && x < W / 2 - 0.2) {
        x += 0.04;
        book.rotation.z = -0.12; // one leaning on the next
      }
    }
  }

  // An open book that floats out and turns its pages (shown in place of the
  // book that was clicked).
  const open = new THREE.Group();
  open.visible = false;
  root.add(open);
  const leftCover = new THREE.Group();
  const rightCover = new THREE.Group();
  open.add(leftCover, rightCover);
  const coverBox = (g, sign) => {
    const m = box(g, 0.17, 0.24, 0.006, mats.bookCover[0], (sign * 0.17) / 2, 0, 0);
    const pages = box(g, 0.16, 0.225, 0.02, mats.pages, (sign * 0.165) / 2, 0, 0.012);
    return [m, pages];
  };
  const leftParts = coverBox(leftCover, -1);
  const rightParts = coverBox(rightCover, 1);
  const flipping = [];
  for (let i = 0; i < 4; i++) {
    const hingeG = new THREE.Group();
    open.add(hingeG);
    const geo = new THREE.PlaneGeometry(0.16, 0.22, 8, 1);
    geo.translate(0.08, 0, 0);
    const page = add(hingeG, geo, mats.pageSheet, 0, 0, 0.024, { cast: false });
    flipping.push({ hinge: hingeG, page, delay: i * 0.45 });
  }

  let anim = null;
  const tmpTarget = new THREE.Vector3();
  return {
    key: "books",
    title: "Bookshelf",
    text: "Spellbooks, histories and a few that hum quietly at night. Click any book to take it down.",
    root,
    focus: { position: v3(1.6, 1.5, -0.35), target: v3(3.4, 1.2, -1.2) },
    colliders: [new THREE.Box3(v3(3.0, 0, -2.0), v3(3.95, 2.45, -0.4))],
    books,
    actions: [{ id: "book", label: "Take down a book" }],
    act(id, hit) {
      if (anim) return;
      const pick = (hit && books.find((b) => b.mesh === hit)) || books[Math.floor(Math.random() * books.length)];
      anim = { t: 0, book: pick };
      for (const g of [leftParts[0], rightParts[0]]) g.material = mats.bookCover[pick.variant];
    },
    update(dt, t) {
      if (!anim) return;
      anim.t += dt;
      const { book } = anim;
      const T = anim.t;
      // 0-0.7 slide out; 0.7-1.6 rise and turn; 1.6-2.2 open; 2.2-5 pages; 5-5.6 close; 5.6-6.6 return
      if (T < 0.7) {
        book.mesh.position.copy(book.home).add(tmpTarget.set(0, 0.01, ease(T / 0.7) * 0.25));
        return;
      }
      const floatPos = v3(0, 1.45 + Math.sin(t * 1.6) * 0.02, 0.62);
      if (T < 1.6) {
        const k = ease((T - 0.7) / 0.9);
        book.mesh.position.copy(book.home).add(tmpTarget.set(0, 0.01, 0.25)).lerp(floatPos, k);
        book.mesh.rotation.set(0, k * Math.PI * 0.5, 0);
        return;
      }
      if (T < 5.6) {
        book.mesh.visible = false;
        open.visible = true;
        open.position.copy(floatPos);
        open.rotation.set(-0.25, Math.sin(t * 0.8) * 0.08, 0);
        const k = T < 5.0 ? ease(clamp01((T - 1.6) / 0.6)) : 1 - ease(clamp01((T - 5.0) / 0.6));
        leftCover.rotation.y = -(1 - k) * Math.PI * 0.5;
        rightCover.rotation.y = (1 - k) * Math.PI * 0.5;
        for (const f of flipping) {
          const p = clamp01((T - 2.2 - f.delay) / 0.9);
          f.page.visible = k > 0.95 && p > 0 && p < 1;
          f.hinge.rotation.y = -Math.PI * ease(p);
          f.page.position.z = 0.024 + Math.sin(Math.PI * p) * 0.01;
        }
        return;
      }
      open.visible = false;
      book.mesh.visible = true;
      const k = ease(clamp01((T - 5.6) / 1.0));
      book.mesh.position.copy(floatPos).lerp(book.home, k);
      book.mesh.rotation.set(0, (1 - k) * Math.PI * 0.5, 0);
      if (k >= 1) {
        book.mesh.position.copy(book.home);
        book.mesh.rotation.set(0, 0, 0);
        anim = null;
      }
    },
    // where the owl perches at the start (on top of the shelf), world space
    topWorld: () => root.localToWorld(v3(0, H + 0.09, 0.06)),
    facing: () => root.rotation.y,
  };
}

// ---------- candles floating under the roof ----------

export function buildFloatingCandles(scene, mats, lights) {
  const root = new THREE.Group();
  root.position.set(0.1, 2.85, -0.5);
  scene.add(root);
  const candles = [];
  const rand = random(91);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
    const r = 0.55 + rand() * 0.45;
    const { group, flame } = candle(mats, 0.15 + rand() * 0.09, 0.02);
    group.position.set(Math.sin(a) * r, (rand() - 0.5) * 0.25, Math.cos(a) * r);
    root.add(group);
    candles.push({ group, flame, base: group.position.clone(), phase: rand() * 6 });
  }
  const glowA = new THREE.PointLight(0xffb060, 2.4, 8, 2);
  glowA.position.set(0.4, 0.05, 0.2);
  const glowB = new THREE.PointLight(0xffa850, 2.4, 8, 2);
  glowB.position.set(-0.4, 0.05, -0.3);
  root.add(glowA, glowB);
  lights.push({ light: glowA, base: 2.4, seed: 4.2 }, { light: glowB, base: 2.4, seed: 7.7 });

  let flare = 0;
  let boost = 1;
  let lit = true;
  let litK = 1; // eases between dark and lit
  return {
    key: "candles",
    get boost() {
      return boost;
    },
    // the story starts with them dark, and has you light them
    setLit(on, instantly = false) {
      lit = on;
      if (instantly) litK = on ? 1 : 0;
    },
    title: "Floating candles",
    text: "Candles that hang in the air by themselves, drifting slowly like boats on still water.",
    root,
    focus: { position: v3(0.6, 1.7, 1.6), target: v3(0.1, 2.75, -0.5) },
    colliders: [],
    actions: [{ id: "flare", label: "Make them glow" }],
    act() {
      lit = true;
      flare = 1;
    },
    update(dt, t) {
      flare = Math.max(0, flare - dt * 0.35);
      litK += ((lit ? 1 : 0) - litK) * (1 - Math.exp(-dt * 1.6));
      const spread = 1 + 0.35 * Math.sin(Math.PI * flare) * (flare > 0 ? 1 : 0);
      for (const c of candles) {
        c.group.position.set(c.base.x * spread, c.base.y + Math.sin(t * 0.8 + c.phase) * 0.03, c.base.z * spread);
        c.flame.scale.setScalar(Math.max(0.001, litK) * (1 + flare * 0.9));
      }
      boost = Math.max(0.04, litK) * (1 + flare * 1.6);
      glowA.userData.boost = glowB.userData.boost = boost;
    },
  };
}

// ---------- wall candle sconces ----------

export function buildSconce(scene, mats, lights, angle) {
  const root = new THREE.Group();
  root.position.copy(onWall(angle, 0.05, 1.75));
  root.rotation.y = angle + Math.PI;
  scene.add(root);
  box(root, 0.08, 0.16, 0.02, mats.iron, 0, 0, 0);
  const arm = add(root, new THREE.TorusGeometry(0.08, 0.008, 6, 16, Math.PI / 2), mats.iron, 0, -0.04, 0.08);
  arm.rotation.y = Math.PI / 2;
  add(root, new THREE.CylinderGeometry(0.035, 0.02, 0.025, 16), mats.iron, 0, 0.04, 0.16);
  const { group } = candle(mats, 0.12, 0.018);
  group.position.set(0, 0.05, 0.16);
  root.add(group);
  const light = new THREE.PointLight(0xffa448, 1.8, 6, 2);
  light.position.set(0, 0.25, 0.22);
  root.add(light);
  lights.push({ light, base: 1.8, seed: angle * 3.3 });
}

// ---------- a painting whose clouds drift and water ripples ----------

export function buildPainting(scene, mats, angle) {
  const root = new THREE.Group();
  root.position.copy(onWall(angle, 0.05, 1.7));
  root.rotation.y = angle + Math.PI;
  scene.add(root);
  const W = 0.86;
  const H = 0.64;
  const paint = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uWind: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWind;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      vec3 skyAt(vec2 uv, float drift) {
        vec3 c = mix(vec3(0.95, 0.62, 0.38), vec3(0.22, 0.27, 0.48), smoothstep(0.35, 0.95, uv.y));
        c += vec3(1.0, 0.85, 0.6) * smoothstep(0.09, 0.0, length(uv - vec2(0.74, 0.62))) * 0.8;
        float cl = fbm(vec2(uv.x * 3.0 + drift, uv.y * 7.0));
        c = mix(c, vec3(0.98, 0.86, 0.8), smoothstep(0.55, 0.8, cl) * smoothstep(0.45, 0.75, uv.y) * 0.8);
        return c;
      }
      void main() {
        vec2 uv = vUv;
        float drift = uTime * (0.02 + uWind * 0.12);
        vec3 col = skyAt(uv, drift);
        float far = 0.42 + 0.06 * sin(uv.x * 5.0 + 1.0) + 0.03 * sin(uv.x * 13.0);
        if (uv.y < far) col = mix(vec3(0.28, 0.3, 0.42), vec3(0.4, 0.38, 0.45), uv.y * 1.5);
        float near = 0.3 + 0.07 * sin(uv.x * 7.0 + 3.0) + 0.02 * sin(uv.x * 21.0);
        if (uv.y < near) col = vec3(0.12, 0.2, 0.15) + 0.05 * fbm(uv * 20.0);
        // a castle on the far hill
        vec2 c = uv - vec2(0.3, far - 0.01);
        if (c.y > 0.0 && c.y < 0.09 && abs(c.x) < 0.05 && (c.y < 0.05 || abs(c.x + 0.03) < 0.008 || abs(c.x - 0.025) < 0.01)) col = vec3(0.2, 0.2, 0.3);
        // the lake: the sky upside down, rippling
        if (uv.y < 0.18) {
          vec2 m = vec2(uv.x + sin(uv.y * 90.0 + uTime * 2.0) * 0.004, 0.36 - uv.y);
          col = mix(skyAt(m, drift), vec3(0.1, 0.15, 0.25), 0.45);
        }
        // brush strokes and old varnish
        col *= 0.88 + 0.24 * fbm(uv * vec2(60.0, 25.0));
        col = mix(col, col * vec3(1.0, 0.85, 0.6), 0.35);
        col *= 1.0 - 0.5 * pow(length(uv - 0.5) * 1.3, 2.0);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  add(root, new THREE.PlaneGeometry(W, H), paint, 0, 0, 0.012, { cast: false });
  const f = 0.07;
  for (const [w, h, x, y] of [[W + 2 * f, f, 0, H / 2 + f / 2], [W + 2 * f, f, 0, -H / 2 - f / 2], [f, H, -W / 2 - f / 2, 0], [f, H, W / 2 + f / 2, 0]]) {
    rbox(root, w, h, 0.05, 0.012, mats.gilt, x, y, 0.01);
  }
  let wind = 0;
  return {
    key: "painting",
    title: "Moving painting",
    text: "A lakeside landscape where the clouds really do drift and the water really does ripple.",
    root,
    focus: { position: onWall(angle, 1.6, 1.6), target: onWall(angle, 0.05, 1.7) },
    colliders: [],
    actions: [{ id: "wind", label: "Blow on it" }],
    act() {
      wind = 1;
    },
    update(dt, t) {
      wind = Math.max(0, wind - dt * 0.25);
      paint.uniforms.uTime.value = t;
      paint.uniforms.uWind.value = wind;
    },
  };
}


// ---------- the rug ----------

export function buildRug(scene, mats) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.008, 1.75), mats.rug);
  m.position.set(-0.6, 0.004, 0.55);
  m.rotation.y = 0.08;
  m.receiveShadow = true;
  scene.add(m);
}

// ---------- the letter: an envelope addressed in ink, sealed in red wax ----------

export function buildLetter(scene, mats, tex, { name }) {
  const { canvas, texture } = parchment(tex.fine);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(40, 24, 12, 0.92)";
  ctx.font = '44px "Homemade Apple", "IM Fell English", cursive';
  ctx.fillText(`To ${name}`, 70, 330);
  ctx.font = '26px "Homemade Apple", "IM Fell English", cursive';
  ctx.fillText("The Tower Room,", 90, 400);
  ctx.fillText("The Castle on the Hill", 90, 450);
  texture.needsUpdate = true;
  const front = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  const plain = new THREE.MeshStandardMaterial({ color: 0xd9c393, roughness: 0.92 });
  const letter = new THREE.Group();
  const env = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.004, 0.16), [plain, plain, front, plain, plain, plain]);
  env.castShadow = true;
  letter.add(env);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.006, 20), mats.wax2);
  seal.position.y = -0.004;
  letter.add(seal);
  scene.add(letter);
  return letter;
}
