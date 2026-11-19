import * as THREE from "three";
import { onWall } from "./roomProps.js";

// Three more things in the tower room, each one a prop (see roomProps.js):
//   snitch    - a golden snitch darting about; tap it and it flies to you and opens
//   photos    - moving photos of the two of you on the wall; tap one and it changes
//   musicbox  - a music box on a little table; it opens and plays Happy Birthday

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
const box = (p, w, h, d, mat, x, y, z, o) => add(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

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

const gold = () => new THREE.MeshPhysicalMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.18, clearcoat: 0.6, emissive: 0x4a3000, emissiveIntensity: 0.6 });

// ---------- the golden snitch ----------

export function buildSnitch(scene, camera, sparks) {
  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);
  const shell = gold();
  const R = 0.024;
  // two halves, so it can open: the top one hinges up at the back
  const top = new THREE.Group();
  top.position.set(0, 0, -R);
  body.add(top);
  add(top, new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, 0, R);
  add(top, new THREE.TorusGeometry(R, 0.0018, 6, 32).rotateX(Math.PI / 2), shell, 0, 0.0005, R);
  add(body, new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shell);
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

  // silvery feathered wings
  const wingMap = canvasTexture(128, 64, (g) => {
    g.beginPath();
    g.moveTo(0, 30);
    g.bezierCurveTo(30, 0, 100, 2, 126, 14);
    g.bezierCurveTo(110, 26, 80, 40, 0, 40);
    g.closePath();
    g.fillStyle = "rgba(240,240,250,0.95)";
    g.fill();
    g.strokeStyle = "rgba(160,160,180,0.9)";
    g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(4, 34);
      g.lineTo(40 + i * 15, 8 + i * 4);
      g.stroke();
    }
  });
  const wingMat = new THREE.MeshBasicMaterial({ map: wingMap, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const wingGeo = new THREE.PlaneGeometry(0.075, 0.0375).translate(0.0375, 0, 0);
  const wings = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * R * 0.9, 0.004, 0);
    pivot.scale.x = side;
    body.add(pivot);
    add(pivot, wingGeo, wingMat, 0, 0, 0, { cast: false });
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

// ---------- moving photos of the two of you ----------

export function buildPhotoWall(scene, mats, sparks, pictures) {
  if (!pictures.length) return null;
  const root = new THREE.Group();
  scene.add(root);
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.35, clearcoat: 0.3 });
  const backing = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 });
  const loader = new THREE.TextureLoader();
  const textures = pictures.map((src) => {
    const t = loader.load(src, () =>
      frames.forEach((f) => {
        for (const m of [f.back, f.front]) if (m.material.map) m.material.map.needsUpdate = true;
        fit(f);
      }),
    );
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  // a cluster on the wall to the right of the window, above the owl cage
  const LAYOUT = [
    { a: 2.36, y: 2.08, w: 0.36, h: 0.27 },
    { a: 2.58, y: 2.3, w: 0.36, h: 0.46 },
    { a: 2.8, y: 2.06, w: 0.3, h: 0.36 },
  ];
  const frames = LAYOUT.map((l, i) => {
    const group = new THREE.Group();
    group.position.copy(onWall(l.a, 0.06, l.y));
    group.rotation.y = l.a + Math.PI;
    root.add(group);
    const B = 0.035;
    box(group, l.w + B * 2, l.h + B * 2, 0.012, backing, 0, 0, -0.004);
    for (const [x, y, w, h] of [
      [0, l.h / 2 + B / 2, l.w + B * 2, B],
      [0, -l.h / 2 - B / 2, l.w + B * 2, B],
      [l.w / 2 + B / 2, 0, B, l.h],
      [-l.w / 2 - B / 2, 0, B, l.h],
    ])
      box(group, w, h, 0.03, frameMat, x, y, 0.008);
    // two layers, so one photo can melt into the next
    const layer = (z) => {
      const tex = new THREE.Texture();
      const m = add(group, new THREE.PlaneGeometry(l.w, l.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, transparent: true, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 }), 0, 0, z, { cast: false });
      return m;
    };
    const back = layer(0.003);
    const front = layer(0.005);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("255,214,140"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    glow.scale.set(l.w * 2.4, l.h * 2.4, 1);
    glow.position.z = 0.02;
    group.add(glow);
    return { ...l, group, back, front, glow, index: i % textures.length, fade: 1, flash: 0, seed: i * 2.1 };
  });

  // crop a photo to fill its frame, leaving room to drift about
  function setPhoto(mesh, f, index) {
    const src = textures[index];
    const tex = src.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const old = mesh.material.map;
    mesh.material.map = tex;
    mesh.material.emissiveMap = tex;
    mesh.material.needsUpdate = true;
    if (old && old !== tex) old.dispose();
    mesh.userData.index = index;
    fitOne(mesh, f);
  }
  function fitOne(mesh, f) {
    const tex = mesh.material.map;
    const img = textures[mesh.userData.index]?.image;
    if (!tex || !img?.width) return;
    const imgA = img.width / img.height;
    const frameA = f.w / f.h;
    const zoom = 0.86; // a little room for the photo to move
    tex.repeat.set(imgA > frameA ? (frameA / imgA) * zoom : zoom, imgA > frameA ? zoom : (imgA / frameA) * zoom);
    tex.userData.base = { x: (1 - tex.repeat.x) / 2, y: (1 - tex.repeat.y) / 2 };
    tex.offset.set(tex.userData.base.x, tex.userData.base.y);
  }
  function fit(f) {
    fitOne(f.back, f);
    fitOne(f.front, f);
  }
  frames.forEach((f) => {
    setPhoto(f.back, f, f.index);
    setPhoto(f.front, f, f.index);
  });
  const meshesOf = new Map();
  for (const f of frames) f.group.traverse((o) => meshesOf.set(o, f));

  return {
    key: "photos",
    title: "Photos of us",
    text: "Photographs of the two of you. Like all wizarding photos, they never stay quite still.",
    root,
    hotspot: onWall(2.58, 0.25, 2.68),
    focus: { position: onWall(2.58, 2.05, 1.95), target: onWall(2.58, 0, 2.2) },
    actions: [{ id: "next", label: "Change the photos" }],
    // tap a photo to change it; tap the light to change them all
    act(id, object) {
      const one = object && meshesOf.get(object);
      for (const f of one ? [one] : frames) {
        // the old photo stays behind, and the next one fades in over it
        setPhoto(f.back, f, f.front.userData.index);
        f.index = (f.index + frames.length) % textures.length;
        if (f.index === f.front.userData.index) f.index = (f.index + 1) % textures.length;
        setPhoto(f.front, f, f.index);
        f.fade = 0;
        f.flash = 1;
        sparks.burst(f.group.localToWorld(v3(0, 0, 0.05)), 26, [0xffe7a0, 0xffffff, 0xffc4d0], { speed: 0.4, up: 0.1, life: 1, gravity: -0.3 });
      }
    },
    update(dt, t) {
      for (const f of frames) {
        f.fade = Math.min(1, f.fade + dt / 1.2);
        f.front.material.opacity = ease(f.fade);
        f.flash = Math.max(0, f.flash - dt / 1.6);
        f.glow.material.opacity = f.flash * 0.9;
        f.group.scale.setScalar(1 + f.flash * 0.04);
        // slowly drifting and breathing, like a photo that's alive
        for (const m of [f.back, f.front]) {
          const tex = m.material.map;
          const base = tex?.userData.base;
          if (!base) continue;
          tex.offset.set(base.x * (1 + 0.9 * Math.sin(t * 0.13 + f.seed)), base.y * (1 + 0.9 * Math.sin(t * 0.17 + f.seed * 1.7)));
        }
        f.group.rotation.z = Math.sin(t * 0.6 + f.seed) * 0.004;
      }
    },
  };
}

// ---------- the music box ----------

// Happy Birthday, as [semitones from C5, beats]
const TUNE = [
  [-5, 0.75], [-5, 0.25], [-3, 1], [-5, 1], [0, 1], [-1, 2],
  [-5, 0.75], [-5, 0.25], [-3, 1], [-5, 1], [2, 1], [0, 2],
  [-5, 0.75], [-5, 0.25], [7, 1], [4, 1], [0, 1], [-1, 1], [-3, 2],
  [5, 0.75], [5, 0.25], [4, 1], [0, 1], [2, 1], [0, 3],
];
const BEAT = 0.42;

function createTune() {
  let ctx = null;
  let out = null;
  return {
    get length() {
      return TUNE.reduce((s, [, b]) => s + b, 0) * BEAT;
    },
    play() {
      try {
        ctx ??= new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume?.();
      } catch {
        return;
      }
      this.stop();
      out = ctx.createGain();
      out.gain.value = 0.16;
      out.connect(ctx.destination);
      let at = ctx.currentTime + 0.08;
      for (const [semi, beats] of TUNE) {
        const f = 523.25 * 2 ** (semi / 12) * 2; // high, like a music box comb
        // a bright pluck with a soft ring
        for (const [mult, level, decay] of [[1, 1, 1.6], [2, 0.25, 0.5], [4.2, 0.12, 0.2]]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = f * mult;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(level, at + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
          osc.connect(g).connect(out);
          osc.start(at);
          osc.stop(at + decay + 0.05);
        }
        at += beats * BEAT;
      }
    },
    stop() {
      if (!out) return;
      const o = out;
      out = null;
      try {
        o.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => o.disconnect(), 300);
      } catch {
        o.disconnect();
      }
    },
    dispose() {
      this.stop();
      ctx?.close?.();
    },
  };
}

export function buildMusicBox(scene, mats, sparks) {
  const root = new THREE.Group();
  root.position.set(2.2, 0, -1.4);
  root.rotation.y = Math.atan2(-2.2, 1.4) + 0.35; // turned towards the room
  scene.add(root);
  // a little round table
  add(root, lathe([[0, 0], [0.16, 0], [0.16, 0.025], [0.05, 0.06], [0.035, 0.12], [0.045, 0.4], [0.03, 0.62], [0.05, 0.66], [0, 0.66]]), mats.walnut);
  add(root, new THREE.CylinderGeometry(0.27, 0.26, 0.035, 40), mats.walnut, 0, 0.68, 0);

  // the box, with a lid that hinges at the back
  const W = 0.2;
  const D = 0.14;
  const H = 0.075;
  const boxRoot = new THREE.Group();
  boxRoot.position.y = 0.6975;
  boxRoot.rotation.y = 0.2;
  root.add(boxRoot);
  const lining = new THREE.MeshStandardMaterial({ color: 0x7a1424, roughness: 0.9 });
  const T = 0.01;
  box(boxRoot, W, T, D, mats.walnut, 0, T / 2, 0);
  box(boxRoot, W, H, T, mats.walnut, 0, H / 2, D / 2 - T / 2);
  box(boxRoot, W, H, T, mats.walnut, 0, H / 2, -D / 2 + T / 2);
  box(boxRoot, T, H, D, mats.walnut, W / 2 - T / 2, H / 2, 0);
  box(boxRoot, T, H, D, mats.walnut, -W / 2 + T / 2, H / 2, 0);
  box(boxRoot, W - T * 2, 0.002, D - T * 2, lining, 0, T + 0.001, 0, { cast: false });
  box(boxRoot, W + 0.004, 0.008, D + 0.004, mats.brass, 0, 0.004, 0);
  const lid = new THREE.Group();
  lid.position.set(0, H, -D / 2);
  boxRoot.add(lid);
  box(lid, W + 0.004, 0.016, D + 0.004, mats.walnut, 0, 0.008, D / 2);
  box(lid, W - 0.04, 0.003, D - 0.04, mats.brass, 0, 0.017, D / 2);
  // red velvet inside the lid
  box(lid, W - 0.02, 0.002, D - 0.02, lining, 0, -0.001, D / 2, { cast: false });

  // the dancer, on a turning stand that rises up when it opens
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xfff6f0, roughness: 0.3, clearcoat: 0.8 });
  const tutu = new THREE.MeshPhysicalMaterial({ color: 0xffc4d6, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide });
  const dancer = new THREE.Group();
  dancer.position.y = T;
  dancer.scale.setScalar(1.5);
  boxRoot.add(dancer);
  add(dancer, new THREE.CylinderGeometry(0.012, 0.012, 0.004, 20), mats.brass, 0, 0.002, 0);
  add(dancer, new THREE.CylinderGeometry(0.0012, 0.0012, 0.03, 6), porcelain, 0, 0.017, 0); // leg
  add(dancer, new THREE.ConeGeometry(0.018, 0.012, 20, 1, true), tutu, 0, 0.034, 0); // tutu
  add(dancer, lathe([[0, 0], [0.004, 0.002], [0.0035, 0.014], [0.0045, 0.02], [0, 0.024]], 12), porcelain, 0, 0.034, 0);
  add(dancer, new THREE.SphereGeometry(0.0045, 12, 8), porcelain, 0, 0.062, 0);
  const arms = add(dancer, new THREE.TorusGeometry(0.008, 0.0009, 4, 16, Math.PI * 1.4), porcelain, 0, 0.066, 0, { cast: false });
  arms.rotation.z = Math.PI * 0.8;

  // little music notes that float up while it plays
  const noteMaps = ["♪", "♫", "♬"].map((ch) =>
    canvasTexture(64, 64, (g, w) => {
      g.fillStyle = "#ffe7b0";
      g.shadowColor = "rgba(255,200,120,0.9)";
      g.shadowBlur = 8;
      g.font = "44px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(ch, w / 2, w / 2 + 2);
    }),
  );
  const notes = Array.from({ length: 10 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteMaps[i % 3], transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.035);
    boxRoot.add(s);
    return { s, life: 0, x: 0, z: 0 };
  });
  let nextNote = 0;
  let noteT = 0;

  const tune = createTune();
  let openK = 0;
  let playing = 0; // seconds of tune left
  let spin = 0;

  return {
    key: "musicbox",
    title: "Music box",
    text: "A little walnut music box with a dancer inside. Wind it and it plays a tune you know.",
    root,
    focus: { position: root.localToWorld(v3(0.15, 1.15, 0.62)), target: root.localToWorld(v3(0, 0.74, 0)) },
    actions: [{ id: "play", label: "Open it" }],
    // tap to open it and play; tap while it plays to close it again
    act() {
      if (playing > 0) {
        playing = 0;
        tune.stop();
        return;
      }
      playing = tune.length + 0.6;
      tune.play();
      sparks.burst(boxRoot.localToWorld(v3(0, 0.1, 0)), 20, [0xffe7a0, 0xffd0e0, 0xffffff], { speed: 0.3, up: 0.4, life: 0.9, gravity: -0.3 });
    },
    update(dt) {
      playing = Math.max(0, playing - dt);
      const goal = playing > 0 ? 1 : 0;
      openK += (goal - openK) * (1 - Math.exp(-dt * 4));
      lid.rotation.x = -openK * 1.75;
      dancer.position.y = T + 0.03 * (2 * openK - 1);
      dancer.visible = openK > 0.05;
      spin += dt * openK * 2.4;
      dancer.rotation.y = spin;
      // notes
      noteT -= dt;
      if (playing > 0.5 && noteT <= 0) {
        noteT = 0.55;
        const n = notes[nextNote];
        nextNote = (nextNote + 1) % notes.length;
        Object.assign(n, { life: 2.4, x: (Math.random() - 0.5) * 0.12, z: (Math.random() - 0.5) * 0.06 });
      }
      for (const n of notes) {
        n.life = Math.max(0, n.life - dt);
        const k = 1 - n.life / 2.4;
        n.s.position.set(n.x + Math.sin(k * 6 + n.z * 40) * 0.02, 0.1 + k * 0.32, n.z);
        n.s.material.opacity = n.life > 0 ? Math.min(clamp01(k * 5), clamp01(n.life / 0.6)) : 0;
      }
    },
    dispose() {
      tune.dispose();
    },
  };
}
