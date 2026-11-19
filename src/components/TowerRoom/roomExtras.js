import * as THREE from "three";

// The golden snitch, darting about the tower room (a prop, see roomProps.js).
// Tap it and it flies to you and opens. Its gold is the real scanned,
// engraved gold of Poly Haven's pocket watch.

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
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

function canvasTexture(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const glowTexture = (rgb) =>
  canvasTexture(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, `rgba(${rgb},1)`);
    r.addColorStop(0.3, `rgba(${rgb},0.45)`);
    r.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });

// the pocket watch's engraved case back, as a material (loaded once)
const WATCH = `${import.meta.env.BASE_URL}room-assets/models/pocket_watch/textures/pocket_watch`;
let watchMaps = null;
function engravedGold() {
  if (!watchMaps) {
    const loader = new THREE.TextureLoader();
    const load = (file, color) => {
      const t = loader.load(`${WATCH}_${file}_1k.jpg`);
      t.flipY = false; // the same way round as the model's own UVs
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      return t;
    };
    watchMaps = { map: load("diff", true), normalMap: load("nor_gl"), arm: load("arm") };
  }
  return new THREE.MeshPhysicalMaterial({
    map: watchMaps.map,
    normalMap: watchMaps.normalMap,
    roughnessMap: watchMaps.arm,
    metalnessMap: watchMaps.arm,
    aoMap: watchMaps.arm,
    color: 0xffd36e, // warm it from aged brass to bright snitch gold
    metalness: 1,
    roughness: 0.8,
    clearcoat: 0.5,
    clearcoatRoughness: 0.15,
    emissive: 0x3a2400,
    emissiveIntensity: 0.35,
  });
}

// a half ball whose UVs land on the engraved disc of the watch's case back
// (centred at 25%, 75% of the texture, radius about 23%)
function engravedHalf(R, upper) {
  const geo = new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.249 + (pos.getX(i) / R) * 0.225, 0.747 + (pos.getZ(i) / R) * 0.225);
  geo.setAttribute("uv1", uv.clone());
  return geo;
}

// one feather: a fine shaft with soft barbs either side
function featherTexture() {
  return canvasTexture(256, 32, (g, w, h) => {
    g.fillStyle = "rgba(0,0,0,0)";
    g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#d9dbe4");
    grad.addColorStop(1, "#ffffff");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.quadraticCurveTo(w * 0.25, 1, w * 0.85, 4);
    g.quadraticCurveTo(w, h / 2, w * 0.85, h - 4);
    g.quadraticCurveTo(w * 0.25, h - 1, 0, h / 2);
    g.fill();
    g.strokeStyle = "rgba(150,150,170,0.7)";
    g.lineWidth = 1;
    for (let x = 6; x < w * 0.9; x += 5) {
      g.beginPath();
      g.moveTo(x, h / 2);
      g.lineTo(x + 7, 3);
      g.moveTo(x, h / 2);
      g.lineTo(x + 7, h - 3);
      g.stroke();
    }
    g.strokeStyle = "#b8a070";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, h / 2);
    g.lineTo(w * 0.92, h / 2);
    g.stroke();
  });
}

const gold = () => new THREE.MeshPhysicalMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.18, clearcoat: 0.6, emissive: 0x4a3000, emissiveIntensity: 0.6 });

// ---------- the golden snitch ----------

export function buildSnitch(scene, camera, sparks) {
  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);
  const shell = engravedGold();
  const R = 0.024;
  // two halves, so it can open: the top one hinges up at the back
  const top = new THREE.Group();
  top.position.set(0, 0, -R);
  body.add(top);
  add(top, engravedHalf(R, true), shell, 0, 0, R);
  add(top, new THREE.TorusGeometry(R, 0.0016, 8, 48).rotateX(Math.PI / 2), shell, 0, 0.0005, R);
  add(body, engravedHalf(R, false), shell);
  // inside: a ring
  const ring = new THREE.Group();
  ring.visible = false;
  body.add(ring);
  add(ring, new THREE.TorusGeometry(0.009, 0.0022, 10, 32), gold(), 0, 0.006, 0, { cast: false });
  const stone = add(ring, new THREE.OctahedronGeometry(0.0042), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 0, 0.0175, 0, { cast: false });
  const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,255,255"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  shine.scale.setScalar(0.05);
  shine.position.y = 0.0175;
  ring.add(shine);

  // thin, silvery feathered wings: each a fan of separate feathers
  const featherMat = new THREE.MeshStandardMaterial({ map: featherTexture(), alphaTest: 0.25, side: THREE.DoubleSide, metalness: 0.35, roughness: 0.35, emissive: 0x2a2a34 });
  const wings = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * R * 0.92, 0.006, -0.004);
    pivot.scale.x = side;
    body.add(pivot);
    // a little gold joint where the wing meets the ball
    add(pivot, new THREE.SphereGeometry(0.0032, 12, 8), shell, 0, 0, 0);
    for (let i = 0; i < 9; i++) {
      const len = 0.078 - i * 0.0055;
      const geo = new THREE.PlaneGeometry(len, 0.011).translate(len / 2, 0, 0);
      const f = add(pivot, geo, featherMat, 0, 0, 0, { cast: false });
      // fanned back and slightly up, like a swept wing
      f.rotation.set(0.25, 0.12 + i * 0.13, 0.32 - i * 0.05);
    }
    return pivot;
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,210,110"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.setScalar(0.16);
  root.add(halo);

  // where it darts about when it's free: high up in the middle of the room
  const free = (t, out) =>
    out.set(
      1.5 * Math.sin(t * 0.23) + 0.25 * Math.sin(t * 1.7),
      2.1 + 0.25 * Math.sin(t * 0.7) + 0.08 * Math.sin(t * 3.1),
      -0.9 + 1.1 * Math.sin(t * 0.31 + 1) + 0.2 * Math.sin(t * 2.3),
    );
  const freeAt = v3();
  const prev = v3();
  const held = v3();
  const from = v3();
  const look = v3();
  // free -> coming -> open -> leaving -> free
  let state = "free";
  let k = 0; // progress of the current move
  let open = 0;
  free(0, root.position);

  return {
    key: "snitch",
    title: "Golden snitch",
    text: "A golden snitch, darting about near the ceiling. They say it remembers the first hand that touches it.",
    root,
    focus: null, // the snitch comes to you, so the camera stays where it is
    moving: true,
    get hotspot() {
      return root.position.clone().add(v3(0, 0.07, 0));
    },
    actions: [{ id: "catch", label: "Catch it" }],
    act() {
      if (state === "open") {
        k = Math.min(k, 0.5);
        return;
      }
      from.copy(root.position);
      state = "coming";
      k = 0;
    },
    update(dt, t) {
      prev.copy(root.position);
      free(t, freeAt);
      // where it hovers when it's with you: just in front, a little low
      const f = camera.getWorldDirection(look);
      held.copy(camera.position).addScaledVector(f, 0.5).add(v3(0, -0.05, 0));
      if (state === "free") {
        root.position.lerp(freeAt, 1 - Math.exp(-dt * 6));
      } else if (state === "coming") {
        k = Math.min(1, k + dt / 1.1);
        root.position.lerpVectors(from, held, ease(k));
        root.position.y += Math.sin(k * Math.PI) * 0.15;
        if (k >= 1) {
          state = "open";
          k = 0;
          sparks.burst(root.position, 30, [0xffe27a, 0xffffff], { speed: 0.35, up: 0.2, life: 0.9, gravity: -0.4 });
        }
      } else if (state === "open") {
        k += dt / 4.5;
        root.position.copy(held).add(v3(0, Math.sin(t * 2.2) * 0.006, 0));
        if (k >= 1) {
          state = "leaving";
          k = 0;
          from.copy(root.position);
        }
      } else {
        k = Math.min(1, k + dt / 1.4);
        root.position.lerpVectors(from, freeAt, ease(k));
        if (k >= 1) state = "free";
      }
      // open up while it's with you
      const goal = state === "open" && k > 0.08 && k < 0.85 ? 1 : 0;
      open += (goal - open) * (1 - Math.exp(-dt * 5));
      top.rotation.x = -open * 1.9;
      ring.visible = open > 0.02;
      ring.scale.setScalar(0.4 + 0.6 * open);
      ring.rotation.y = t * 0.8;
      shine.material.opacity = open * (0.55 + 0.45 * Math.sin(t * 5));
      stone.rotation.y = t * 2;
      if (open > 0.6 && Math.random() < dt * 4) sparks.burst(root.position.clone().add(v3(0, 0.02, 0)), 2, [0xffffff, 0xfff2c0], { speed: 0.12, up: 0.15, life: 0.7, gravity: -0.1 });
      // face where it's going (or you, when it's with you)
      if (state === "open" || state === "coming") body.lookAt(camera.position);
      else if (prev.distanceToSquared(root.position) > 1e-8) body.lookAt(look.copy(root.position).multiplyScalar(2).sub(prev));
      // a blur of wings
      const flap = Math.sin(t * 46) * 0.9;
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
      halo.material.opacity = 0.45 + 0.15 * Math.sin(t * 7);
    },
  };
}
