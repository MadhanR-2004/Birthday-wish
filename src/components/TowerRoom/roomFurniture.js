import * as THREE from "three";
import { onWall, candle } from "./roomProps.js";

// Furniture and props made from real (CC0, Poly Haven) models: placed in the
// room, and given their interactions. Each interactive thing returns a "prop"
// like the ones in roomProps.js.

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const facing = (x, z) => Math.atan2(-x, -z); // turn a thing at (x, z) to face the middle

function put(parent, object, x, y, z, rotY = 0, scale = 1) {
  object.position.set(x, y, z);
  object.rotation.y = rotY;
  object.scale.setScalar(scale);
  parent.add(object);
  return object;
}
const meshNamed = (root, name) => {
  let found = null;
  root.traverse((o) => {
    if (!found && o.isMesh && o.name === name) found = o;
  });
  return found;
};
// Moves a mesh into a pivot group placed at `hinge` (in the mesh's parent space).
function hingeAt(mesh, hinge) {
  const pivot = new THREE.Group();
  pivot.position.copy(hinge);
  mesh.parent.add(pivot);
  mesh.position.sub(hinge);
  pivot.add(mesh);
  return pivot;
}
const levitates = (o) => {
  o.userData.levitate = true;
  return o;
};

// ---------- the nightstand by the bed, with a candle ----------

export function buildNightstand(scene, models, mats, flickers) {
  const root = new THREE.Group();
  root.position.set(-3.42, 0, 1.6);
  root.rotation.y = facing(-3.42, 1.6);
  scene.add(root);
  root.add(models.ClassicNightstand_01);
  const TOP = 0.7;
  add(root, new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.06, 0.008], [0.015, 0.014], [0.012, 0.03], [0.026, 0.035], [0, 0.036]].map(([r, y]) => new THREE.Vector2(r, y)), 24), mats.brass, 0.14, TOP, -0.06);
  const { group: c, flame } = candle(mats, 0.13, 0.019);
  c.position.set(0.14, TOP + 0.035, -0.06);
  root.add(c);
  const light = new THREE.PointLight(0xffa850, 1.4, 5, 2);
  light.position.set(0.14, TOP + 0.24, -0.06);
  root.add(light);
  const entry = { light, base: 1.4, seed: 2.1 };
  flickers.push(entry);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.23), mats.bookCover[3]);
  book.position.set(-0.1, TOP + 0.018, 0.02);
  book.rotation.y = 0.2;
  book.castShadow = true;
  root.add(levitates(book));
  let lit = true;
  root.updateWorldMatrix(true, true);
  return {
    key: "bedside",
    title: "Bedside candle",
    text: "A stub of candle for reading late under the covers.",
    root,
    TOP,
    hotspot: root.localToWorld(v3(0.14, TOP + 0.3, -0.06)),
    focus: { position: v3(-2.55, 1.3, 2.55), target: v3(-3.4, 0.78, 1.6) },
    get actions() {
      return [{ id: "candle", label: lit ? "Snuff the candle" : "Light the candle" }];
    },
    act() {
      lit = !lit;
    },
    update(dt) {
      const k = flame.scale.x + ((lit ? 1 : 0) - flame.scale.x) * (1 - Math.exp(-dt * 8));
      flame.scale.setScalar(Math.max(0.001, k));
      entry.on = lit;
    },
  };
}

function add(parent, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------- the school trunk (a chest whose lid really opens) ----------

export function buildChest(scene, models, mats) {
  const root = new THREE.Group();
  root.position.set(-1.5, 0, 0.35);
  root.rotation.y = Math.PI / 2;
  scene.add(root);
  const chest = models.treasure_chest;
  root.add(chest);
  const lid = meshNamed(chest, "treasure_chest_lid");
  let hinge = null;
  if (lid) {
    lid.geometry.computeBoundingBox();
    const bb = lid.geometry.boundingBox;
    // hinge along the back bottom edge of the lid
    hinge = hingeAt(lid, v3(0, lid.position.y + bb.min.y, lid.position.z + bb.min.z));
  }
  // inside: a red-and-gold striped scarf, a book, and a wand that glows
  const inside = new THREE.Group();
  inside.position.y = 0.38;
  root.add(inside);
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.28), mats.scarf);
  scarf.position.set(-0.15, 0, 0);
  scarf.rotation.y = 0.15;
  inside.add(levitates(scarf));
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.19), mats.bookCover[0]);
  book.position.set(0.2, 0, -0.03);
  book.rotation.y = -0.25;
  inside.add(levitates(book));
  const tipMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const wand = new THREE.Group();
  wand.position.set(0.05, 0.035, 0.1);
  wand.rotation.set(0, 0.3, Math.PI / 2);
  inside.add(wand);
  add(wand, new THREE.CylinderGeometry(0.004, 0.007, 0.32, 10), mats.wandWood, 0, 0, 0);
  add(wand, new THREE.SphereGeometry(0.006, 10, 8), tipMat, 0, 0.162, 0);
  const tipLight = new THREE.PointLight(0x9fd0ff, 0, 1.2, 2);
  tipLight.position.y = 0.17;
  wand.add(tipLight);

  let open = false;
  let k = 0;
  root.updateWorldMatrix(true, true);
  return {
    key: "trunk",
    title: "School trunk",
    text: "Iron-bound and battered from years of journeys. Everything that matters is packed inside.",
    root,
    hotspot: root.localToWorld(v3(0, 0.85, 0)),
    focus: { position: v3(-0.35, 1.35, 1.25), target: v3(-1.5, 0.45, 0.35) },
    get actions() {
      return [{ id: "lid", label: open ? "Close the lid" : "Open the trunk" }];
    },
    act() {
      open = !open;
    },
    update(dt, t) {
      k += ((open ? 1 : 0) - k) * (1 - Math.exp(-dt * 3.5));
      if (hinge) hinge.rotation.x = -ease(clamp01(k)) * 1.85;
      inside.visible = k > 0.02;
      const glow = clamp01((k - 0.6) / 0.4) * (0.8 + 0.2 * Math.sin(t * 5));
      tipMat.color.setRGB(1.8 * glow, 2.5 * glow, 3 * glow);
      tipLight.intensity = 0.3 * glow;
    },
  };
}

// ---------- the broomstick by the door ----------

export function buildBroomModel(scene, models, angle) {
  const root = new THREE.Group();
  root.position.copy(onWall(angle, 0.3, 0));
  root.rotation.y = angle + Math.PI;
  scene.add(root);
  const broom = new THREE.Group();
  root.add(broom);
  const lean = new THREE.Group();
  lean.rotation.x = -0.2;
  broom.add(lean);
  const model = models.wooden_broom;
  model.rotation.z = Math.PI; // bristles down
  model.position.y = 1.33;
  lean.add(model);
  let hover = 0;
  const state = { lift: 0, speed: 0 };
  root.updateWorldMatrix(true, true);
  return {
    key: "broom",
    title: "Racing broom",
    text: "A well-loved racing broom with a straight handle and neat twigs. It gets restless at night.",
    root,
    hotspot: root.localToWorld(v3(0, 1.2, 0.1)),
    focus: { position: onWall(angle, 2.0, 1.35), target: onWall(angle, 0.35, 0.9) },
    actions: [{ id: "hover", label: "Let it fly" }],
    act() {
      hover = 4.5;
    },
    update(dt, t) {
      hover = Math.max(0, hover - dt);
      const target = hover > 0 ? 0.5 : 0;
      state.speed += ((target - state.lift) * 14 - state.speed * 3.5) * dt;
      state.lift += state.speed * dt;
      const k = clamp01(state.lift / 0.5);
      // rises, swings level like it wants a rider, bobs, and settles back
      broom.position.set(0, Math.max(0, state.lift) + Math.sin(t * 3) * 0.02 * k, 0.35 * k);
      lean.rotation.x = -0.2 * (1 - k) + (Math.PI / 2 - 0.05) * k * 0.9;
      broom.rotation.y = Math.sin(t * 0.9) * 0.25 * k;
    },
  };
}

// ---------- the fireside: armchair, cushion, and a game of wizard chess ----------

export function buildFireside(scene, models, sparks) {
  const chair = put(scene, models.ArmChair_01, -2.15, 0, -1.05, facing(-2.15, -1.05) + Math.PI * 0.62);
  const pillowSet = models.throw_pillows_01;
  const pillow = meshNamed(pillowSet, "throw_pillows_01_pillow01");
  if (pillow) {
    pillow.removeFromParent();
    pillow.position.set(0, 0.62, -0.12);
    pillow.rotation.set(-0.35, 0, 0);
    pillow.scale.setScalar(0.85);
    chair.add(levitates(pillow));
  }
  const table = put(scene, models.side_table_01, -1.45, 0, -1.75, 0.3);
  const board = put(table, models.chess_set, 0, 0.55, 0, 0, 0.78);

  // the pieces, by name, and a couple of moves they like to make
  const pieces = {};
  board.traverse((o) => {
    if (o.isMesh && o.name.startsWith("piece_")) {
      pieces[o.name] = o;
      o.userData.home = o.position.clone();
      levitates(o);
    }
  });
  const pick = (type, color) => Object.values(pieces).filter((p) => p.name.includes(`_${type}_`) || p.name.endsWith(`_${type}`)).filter((p) => p.name.includes(color));
  const knight = pick("knight", "white")[0];
  const queen = pick("queen", "white")[0];
  const pawnsBlack = pick("pawn", "black");
  const bishopsBlack = pick("bishop", "black");
  const moves = [
    { piece: knight, target: pawnsBlack[3] ?? pawnsBlack[0], say: "The knight leaps over the board and smashes a pawn to pieces!" },
    { piece: queen, target: bishopsBlack[0], say: "The queen glides across the board and knocks the bishop clean off it." },
  ];
  let move = null;
  let moveIndex = 0;
  const at = v3();
  table.updateWorldMatrix(true, true);
  return {
    key: "chess",
    title: "Wizard chess",
    text: "A set of chessmen who play themselves, and don't hold back. Tell them to make a move.",
    root: table,
    hotspot: table.localToWorld(v3(0, 0.9, 0)),
    focus: { position: v3(-0.75, 1.25, -0.85), target: v3(-1.45, 0.6, -1.75) },
    actions: [{ id: "move", label: "Make a move" }],
    say: null,
    act() {
      if (move) return;
      const m = moves[moveIndex % moves.length];
      moveIndex += 1;
      if (!m.piece || !m.target) return;
      move = { ...m, t: 0, from: m.piece.userData.home.clone(), to: m.target.userData.home.clone() };
      this.say = m.say;
    },
    update(dt) {
      if (!move) return;
      move.t += dt;
      const T = move.t;
      // 0-1: the piece jumps across; 1: the target shatters; 4-5: everything goes home
      if (T < 1) {
        const k = ease(clamp01(T));
        move.piece.position.lerpVectors(move.from, move.to, k);
        move.piece.position.y += Math.sin(Math.PI * k) * 0.12;
      } else if (move.target.visible && T < 4) {
        move.target.visible = false;
        move.target.updateWorldMatrix(true, false);
        move.target.getWorldPosition(at);
        sparks.burst(at, 70, [0xf0e6d0, 0x2a2a2a, 0xffd36a], { speed: 1.1, up: 1.4, spread: 0.6, life: 1.1, gravity: -3 });
      } else if (T > 4) {
        const k = ease(clamp01(T - 4));
        move.piece.position.lerpVectors(move.to, move.from, k);
        move.piece.position.y += Math.sin(Math.PI * k) * 0.06;
        if (k > 0.5 && !move.target.visible) {
          move.target.visible = true;
          move.target.getWorldPosition(at);
          sparks.burst(at, 30, [0xffffff, 0xffe9a8], { speed: 0.4, up: 0.6, life: 0.8, gravity: 0 });
        }
        if (k >= 1) move = null;
      }
    },
  };
}

// ---------- a lantern chandelier, hung from the roof ----------

export function buildChandelier(scene, models, mats, flickers) {
  const root = new THREE.Group();
  root.position.set(0.1, 3.65, -0.45);
  scene.add(root);
  root.add(models.lantern_chandelier_01);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.6, 6), mats.iron);
  chain.position.y = 0.8;
  root.add(chain);
  const light = new THREE.PointLight(0xffb060, 2.2, 7, 2);
  light.position.y = -0.55;
  root.add(light);
  flickers.push({ light, base: 2.2, seed: 9.1 });
  return root;
}

// ---------- over the fire: a lion's head, and a clock on the mantel ----------

export function dressFireplace(fireplace, models) {
  const lion = put(fireplace.root, models.lion_head, 0, 1.78, 0.38, 0, 1.2);
  const clock = put(fireplace.root, models.mantel_clock_01, 0.05, 1.48, 0.32, 0, 1);
  levitates(clock);
  return { lion, clock };
}

// ---------- an ornate mirror with something hidden in it ----------

export function buildMirror(scene, models, mats, { name }, angle) {
  const root = new THREE.Group();
  root.position.copy(onWall(angle, 0.04, 1.95));
  root.rotation.y = angle + Math.PI;
  scene.add(root);
  root.add(models.ornate_mirror_01);
  // the glass: dark silver that mists over and shows a birthday wish
  const words = document.createElement("canvas");
  words.width = 512;
  words.height = 768;
  const w = words.getContext("2d");
  function drawWords(lines, small) {
    w.fillStyle = "#000";
    w.fillRect(0, 0, 512, 768);
    w.fillStyle = "#ffe2a0";
    w.textAlign = "center";
    const size = lines.length > 4 ? 40 : 50;
    w.font = `${size}px "Homemade Apple", "IM Fell English", cursive`;
    const top = 384 - ((lines.length - 1) * size * 1.5) / 2 - (small ? 30 : 0);
    lines.forEach((line, i) => w.fillText(line, 256, top + i * size * 1.5));
    if (small) {
      w.font = '30px "IM Fell English", serif';
      w.fillText(small, 256, top + lines.length * size * 1.5 + 20);
    }
  }
  drawWords(["Happy", "birthday,", `${name}`], "may every wish find its way home");
  const wordsTex = new THREE.CanvasTexture(words);
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uShow: { value: 0 }, uWords: { value: wordsTex } },
    transparent: true,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uShow;
      uniform sampler2D uWords;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 p = vUv - 0.5;
        float oval = length(p / vec2(0.5, 0.5));
        if (oval > 1.0) discard;
        float mist = noise(vUv * 6.0 + vec2(uTime * 0.1, -uTime * 0.07)) * 0.6 + noise(vUv * 13.0 - uTime * 0.12) * 0.4;
        vec3 silver = vec3(0.07, 0.08, 0.1) + vec3(0.3, 0.32, 0.36) * pow(1.0 - oval, 2.0) * 0.4;
        vec3 col = silver + vec3(0.5, 0.55, 0.65) * mist * uShow * 0.35;
        float words = texture2D(uWords, vUv).r * smoothstep(0.2, 0.8, uShow + (mist - 0.5) * 0.4);
        col += vec3(1.0, 0.82, 0.45) * words * 1.6;
        gl_FragColor = vec4(col, 0.92);
        #include <colorspace_fragment>
      }`,
  });
  // sized and placed over the model's own glass (the frame spans y -0.41 to
  // 0.33, so its oval sits just below the middle), hiding its bright reflection
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.6), glassMat);
  glass.position.set(0, -0.05, 0.021);
  root.add(glass);
  let show = 0;
  let goal = 0;
  let hide = 0;
  root.updateWorldMatrix(true, true);
  return {
    key: "mirror",
    title: "Ornate mirror",
    get text() {
      return goal ? "The mist clears... and something is written in the glass, just for you." : "An old mirror in a carved frame. They say it shows what you wish for most.";
    },
    root,
    hotspot: root.localToWorld(v3(0, 0.42, 0.1)),
    focus: { position: root.localToWorld(v3(0, -0.1, 1.15)), target: root.localToWorld(v3(0, -0.05, 0)) },
    actions: [{ id: "look", label: "Look into it" }],
    act() {
      goal = 1;
      hide = 9;
    },
    // show other words in the glass (from now on)
    update(dt, t) {
      hide = Math.max(0, hide - dt);
      if (hide <= 0) goal = 0;
      show += (goal - show) * (1 - Math.exp(-dt * 0.9));
      glassMat.uniforms.uTime.value = t;
      glassMat.uniforms.uShow.value = show;
    },
  };
}

// ---------- the desk: an oil lamp and a row of books ----------

export function dressDesk(desk, models, flickers) {
  const lamp = put(desk.root, models.vintage_oil_lamp, -0.58, 0.775, 0.16, 0, 0.8);
  const light = new THREE.PointLight(0xffb565, 1.2, 4, 2);
  light.position.set(-0.58, 0.775 + 0.42, 0.16);
  desk.root.add(light);
  flickers.push({ light, base: 1.2, seed: 5.5 });
  const books = put(desk.root, models.book_encyclopedia_set_01, -0.22, 0.775, -0.27, 0, 1);
  books.traverse((o) => o.isMesh && levitates(o));
  return { lamp, books };
}

// ---------- the round spectacles, on the nightstand ----------

export function buildSpectaclesModel(nightstand, models, sparks) {
  const root = new THREE.Group();
  root.position.set(0.02, nightstand.TOP + 0.025, 0.12);
  root.rotation.y = -0.5;
  nightstand.root.add(root);
  root.add(models.round_spectacles);
  let glint = 0;
  const at = v3();
  root.updateWorldMatrix(true, true);
  return {
    key: "spectacles",
    title: "Round spectacles",
    text: "Wire-rimmed, perfectly round, and mended more times than anyone can count.",
    root,
    hotspot: root.localToWorld(v3(0, 0.12, -0.05)),
    focus: { position: root.localToWorld(v3(0.1, 0.25, 0.4)), target: root.localToWorld(v3(0, 0, -0.07)) },
    actions: [{ id: "repair", label: "Oculus Reparo" }],
    act() {
      glint = 1.4;
      sparks.burst(root.localToWorld(at.set(0, 0.03, -0.07)), 50, [0xffffff, 0xcfe3ff, 0xffe9a8], { speed: 0.5, up: 0.4, life: 1, gravity: 0 });
    },
    update(dt) {
      glint = Math.max(0, glint - dt);
      const k = Math.sin(Math.PI * clamp01(glint / 1.4));
      root.position.y = nightstand.TOP + 0.025 + k * 0.08;
      root.rotation.y = -0.5 + (1 - glint / 1.4) * Math.PI * 2 * (glint > 0 ? 1 : 0);
    },
  };
}
