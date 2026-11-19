import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { loadMandrake } from "./mandrakeModel.js";

// Hand-built, detailed objects for the tower room (each one a prop, see
// roomProps.js), made from the room's scanned wood, brass and velvet:
//   gramophone - an old wind-up gramophone on a side table; it plays your
//              favourite songs (or Happy Birthday)
//   frog     - a chocolate frog in its box on the mantel, that hops out
//   mandrake - a potted mandrake; pull it up and it sings Happy Birthday

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function add(parent, geo, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}
const rbox = (p, w, h, d, r, mat, x, y, z, o) => add(p, new RoundedBoxGeometry(w, h, d, 4, r), mat, x, y, z, o);
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// a tube along points, tapering from r0 to r1
function taperTube(points, r0, r1, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = 24;
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position;
  const p = v3();
  const c = v3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, c);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, p.x, p.y, p.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function canvasTexture(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const glowTexture = () =>
  canvasTexture(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,230,170,1)");
    r.addColorStop(0.35, "rgba(255,190,100,0.4)");
    r.addColorStop(1, "rgba(255,170,80,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });

// one shared audio context for the room's sounds (made on the first tap)
let audio = null;
function audioContext() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
    return audio;
  } catch {
    return null;
  }
}
export function closeRoomAudio() {
  audio?.close?.();
  audio = null;
}

// ======================= the gramophone =======================

// Happy Birthday, as [semitones from C5, beats] (the gramophone plays it
// when it has no songs of yours, and the mandrake sings it)
const TUNE = [
  [-5, 0.75], [-5, 0.25], [-3, 1], [-5, 1], [0, 1], [-1, 2],
  [-5, 0.75], [-5, 0.25], [-3, 1], [-5, 1], [2, 1], [0, 2],
  [-5, 0.75], [-5, 0.25], [7, 1], [4, 1], [0, 1], [-1, 1], [-3, 2],
  [5, 0.75], [5, 0.25], [4, 1], [0, 1], [2, 1], [0, 3],
];
const BEAT = 0.42;
const TUNE_LENGTH = TUNE.reduce((s, [, b]) => s + b, 0) * BEAT;

// The sound of an old record: thin at the top and bottom, warm in the
// middle, with a soft crackle. Returns { input, stop }.
function oldRecordSound(ctx) {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 180;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4200;
  const warm = ctx.createBiquadFilter();
  warm.type = "peaking";
  warm.frequency.value = 1200;
  warm.gain.value = 4;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  input.connect(hp).connect(lp).connect(warm).connect(out).connect(ctx.destination);
  // crackle: sparse little clicks over a faint hiss, looping
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.6 : 0);
  const crackle = ctx.createBufferSource();
  crackle.buffer = buf;
  crackle.loop = true;
  const cg = ctx.createGain();
  cg.gain.value = 0.35;
  const clp = ctx.createBiquadFilter();
  clp.type = "lowpass";
  clp.frequency.value = 6000;
  crackle.connect(clp).connect(cg).connect(ctx.destination);
  crackle.start();
  return {
    input,
    stop() {
      try {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
        cg.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
        crackle.stop(ctx.currentTime + 0.4);
      } catch {
        /* already closed */
      }
      setTimeout(() => {
        out.disconnect();
        cg.disconnect();
      }, 500);
    },
  };
}

// Happy Birthday, played as if on an old record
function playTune(ctx, into) {
  const out = ctx.createGain();
  out.gain.value = 0.22;
  out.connect(into);
  let at = ctx.currentTime + 0.3;
  for (const [semi, beats] of TUNE) {
    const f = 523.25 * 2 ** (semi / 12);
    for (const [mult, level, decay] of [[1, 1, 1.4], [2, 0.4, 0.8], [3, 0.18, 0.4], [4, 0.08, 0.2]]) {
      const osc = ctx.createOscillator();
      osc.type = mult === 1 ? "triangle" : "sine";
      const g = ctx.createGain();
      osc.frequency.value = f * mult;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    }
    at += beats * BEAT;
  }
  return { length: TUNE_LENGTH + 0.6, stop: () => out.disconnect() };
}

// the record's label and its grooves
function recordTexture(title) {
  return canvasTexture(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = "#0b0b0c";
    g.fillRect(0, 0, w, w);
    // fine grooves, catching the light a little
    for (let r = c * 0.36; r < c * 0.98; r += 1.6) {
      g.strokeStyle = `rgba(255,255,255,${0.025 + Math.random() * 0.03})`;
      g.lineWidth = 0.6;
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.stroke();
    }
    // the gaps between songs
    for (const r of [0.52, 0.68, 0.84]) {
      g.strokeStyle = "rgba(0,0,0,0.9)";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(c, c, c * r, 0, Math.PI * 2);
      g.stroke();
    }
    // the label
    g.fillStyle = "#7a1420";
    g.beginPath();
    g.arc(c, c, c * 0.34, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#d9b25a";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(c, c, c * 0.31, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#e9c878";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '700 20px "Cinzel", Georgia, serif';
    g.fillText(title, c, c - 30);
    g.font = 'italic 16px "IM Fell English", Georgia, serif';
    g.fillText("for the two of us", c, c + 34);
    g.fillStyle = "#0b0b0c";
    g.beginPath();
    g.arc(c, c, 6, 0, Math.PI * 2);
    g.fill();
  });
}

// favourites: [{ title, url }] - your songs; without any it plays Happy Birthday
export function buildGramophone(scene, models, mats, sparks, { position = v3(2.2, 0, -1.4), favourites = [] } = {}) {
  const root = new THREE.Group();
  root.position.copy(position);
  root.rotation.y = Math.atan2(-position.x, -position.z) + 0.25; // turned towards the room
  scene.add(root);

  // Poly Haven's side table, with the gramophone on top (a fresh copy:
  // the chess table by the fireplace has moved and turned the original,
  // and put the chess set on it, so that's left behind)
  const table = models.side_table_01.clone();
  for (const child of [...table.children]) if (child.name !== "side_table_01") table.remove(child);
  table.position.set(0, 0, 0);
  table.rotation.set(0, 0, 0);
  table.scale.setScalar(0.85);
  root.add(table);
  table.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(table).max.y - root.position.y;

  const walnut = mats.walnut;
  const brass = mats.brass;
  const box = new THREE.Group();
  box.position.y = top;
  root.add(box);

  // the cabinet: walnut with a moulded base, brass corners and little feet
  const W = 0.3;
  const H = 0.13;
  for (const x of [-1, 1]) for (const z of [-1, 1]) add(box, new THREE.SphereGeometry(0.014, 16, 10), brass, x * (W / 2 - 0.02), 0.008, z * (W / 2 - 0.02)).scale.set(1, 0.6, 1);
  rbox(box, W + 0.014, 0.018, W + 0.014, 0.005, walnut, 0, 0.018, 0);
  rbox(box, W, H, W, 0.008, walnut, 0, 0.018 + H / 2, 0);
  rbox(box, W + 0.012, 0.014, W + 0.012, 0.005, walnut, 0, 0.018 + H + 0.004, 0);
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      add(box, new THREE.BoxGeometry(0.03, H * 0.96, 0.003), brass, x * (W / 2 - 0.013), 0.018 + H / 2, z * (W / 2 + 0.001));
      add(box, new THREE.BoxGeometry(0.003, H * 0.96, 0.03), brass, x * (W / 2 + 0.001), 0.018 + H / 2, z * (W / 2 - 0.013));
    }
  // a brass plaque on the front
  const plaque = add(box, new THREE.PlaneGeometry(0.11, 0.032), new THREE.MeshPhysicalMaterial({
    map: canvasTexture(256, 76, (g, w, h) => {
      g.fillStyle = "#b98b3c";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#6a4a18";
      g.lineWidth = 3;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.fillStyle = "#4a3010";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = '700 26px "Cinzel", Georgia, serif';
      g.fillText("OUR FAVOURITES", w / 2, h / 2 + 1);
    }),
    metalness: 0.9,
    roughness: 0.35,
  }), 0, 0.018 + H / 2, W / 2 + 0.002, { cast: false });
  plaque.rotation.y = 0;
  const deck = 0.018 + H + 0.011;

  // the turntable: a brass rim, green felt, and the record
  const felt = new THREE.MeshStandardMaterial({ color: 0x1f4a2c, roughness: 1 });
  add(box, new THREE.CylinderGeometry(0.124, 0.124, 0.01, 64), brass, -0.01, deck + 0.005, 0.01);
  add(box, new THREE.CylinderGeometry(0.118, 0.118, 0.002, 64), felt, -0.01, deck + 0.011, 0.01, { cast: false });
  const record = new THREE.Group();
  record.position.set(-0.01, deck + 0.0125, 0.01);
  box.add(record);
  const vinyl = new THREE.MeshPhysicalMaterial({ map: recordTexture("Our Favourites"), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  add(record, new THREE.CylinderGeometry(0.114, 0.114, 0.0025, 96), [new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.4 }), vinyl, vinyl], 0, 0, 0);
  add(record, new THREE.CylinderGeometry(0.0035, 0.0035, 0.018, 12), brass, 0, 0.008, 0); // spindle

  // the crank on the right side, for winding it up
  const crank = new THREE.Group();
  crank.position.set(W / 2 + 0.004, 0.018 + H * 0.55, 0.03);
  box.add(crank);
  add(crank, new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12), brass, 0.015, 0, 0).rotation.z = Math.PI / 2;
  add(crank, taperTube([v3(0.03, 0, 0), v3(0.034, -0.02, 0), v3(0.034, -0.05, 0)], 0.0035, 0.0035), brass);
  add(crank, new THREE.CylinderGeometry(0.0055, 0.006, 0.026, 14), walnut, 0.048, -0.05, 0).rotation.z = Math.PI / 2;

  // the tone arm: a brass post at the back, an arm curving out over the
  // record, and the sound box with its needle at the end
  const armBase = v3(0.105, deck, -0.105);
  add(box, new THREE.CylinderGeometry(0.016, 0.02, 0.02, 24), brass, armBase.x, deck + 0.01, armBase.z);
  const arm = new THREE.Group(); // turns about the post
  arm.position.set(armBase.x, deck + 0.03, armBase.z);
  box.add(arm);
  const lift = new THREE.Group(); // raises the needle off the record
  arm.add(lift);
  add(lift, taperTube([v3(0, 0, 0), v3(-0.03, 0.006, 0.04), v3(-0.07, 0.004, 0.09), v3(-0.09, -0.004, 0.115)], 0.0065, 0.005), brass);
  const soundbox = new THREE.Group();
  soundbox.position.set(-0.092, -0.008, 0.118);
  soundbox.rotation.set(0, 0.6, Math.PI / 2);
  lift.add(soundbox);
  add(soundbox, new THREE.CylinderGeometry(0.022, 0.022, 0.012, 32), brass, 0, 0, 0);
  add(soundbox, new THREE.CylinderGeometry(0.018, 0.018, 0.0125, 32), new THREE.MeshPhysicalMaterial({ color: 0xd8dde4, metalness: 0.6, roughness: 0.2, clearcoat: 1 }), 0, 0.0005, 0, { cast: false });
  add(soundbox, new THREE.CylinderGeometry(0.0006, 0.0014, 0.018, 6), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 1, roughness: 0.3 }), 0.012, -0.004, 0).rotation.z = Math.PI / 2; // needle

  // the great flared horn, rising from the back on a curved neck
  const neckStart = v3(armBase.x, deck + 0.03, armBase.z);
  const neckCurve = [neckStart, v3(armBase.x, deck + 0.11, armBase.z - 0.01), v3(armBase.x - 0.04, deck + 0.19, armBase.z + 0.01)];
  add(box, taperTube(neckCurve, 0.011, 0.012), brass);
  const horn = new THREE.Group();
  horn.position.copy(neckCurve[2]);
  horn.rotation.set(1.0, 0, 0.35); // pointing out over the front, and up a little
  box.add(horn);
  const L = 0.4;
  const profile = [];
  for (let i = 0; i <= 40; i++) {
    const y = (i / 40) * L;
    profile.push([0.012 * Math.exp((Math.log(0.19 / 0.012) / L) * y), y]);
  }
  const hornMat = new THREE.MeshPhysicalMaterial({ color: 0xc9973f, metalness: 1, roughness: 0.28, clearcoat: 0.4, side: THREE.DoubleSide });
  add(horn, lathe(profile, 64), hornMat);
  // the seams between the horn's petals, and a rolled lip round the mouth
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(horn, taperTube(profile.filter((_, k) => k % 4 === 0).map(([r, y]) => v3(Math.cos(a) * (r + 0.0015), y, Math.sin(a) * (r + 0.0015))), 0.0016, 0.0024), brass, 0, 0, 0, { cast: false });
  }
  add(horn, new THREE.TorusGeometry(0.19, 0.0055, 10, 96), brass, 0, L, 0).rotation.x = Math.PI / 2;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  glow.scale.setScalar(0.16);
  glow.position.y = L * 0.6;
  horn.add(glow);

  // music notes drifting out of the horn while it plays
  const noteMaps = ["♪", "♫", "♬", "♩"].map((ch) =>
    canvasTexture(64, 64, (g, w) => {
      g.fillStyle = "#ffe2a0";
      g.shadowColor = "rgba(255,190,90,1)";
      g.shadowBlur = 10;
      g.font = "46px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(ch, w / 2, w / 2 + 2);
    }),
  );
  const notes = Array.from({ length: 14 }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteMaps[i % noteMaps.length], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sp.scale.setScalar(0.04);
    sp.visible = false;
    horn.add(sp);
    return { sp, life: 0, a: 0, sway: 0 };
  });
  let nextNote = 0;
  let noteT = 0;

  // ---------- playing ----------

  const songs = favourites.filter((f) => f?.url);
  let index = -1; // which song is on (or was last)
  let player = null; // { stop(), done }
  let playing = false;
  let armK = 0; // 0 resting, 1 on the record
  let groove = 0; // how far the needle has crept in
  let wind = 0; // crank turns left to show
  let spin = 0;

  function stopPlayer() {
    player?.stop();
    player = null;
    playing = false;
  }
  function playSong(i) {
    stopPlayer();
    const ctx = audioContext();
    if (!ctx) return;
    const sound = oldRecordSound(ctx);
    if (songs.length) {
      const el = new Audio(songs[i].url);
      let done = false;
      try {
        ctx.createMediaElementSource(el).connect(sound.input);
      } catch {
        /* plays without the old-record sound */
      }
      el.addEventListener("ended", () => (done = true));
      el.addEventListener("error", () => (done = true));
      el.play().catch(() => (done = true));
      player = {
        get done() {
          return done;
        },
        stop() {
          el.pause();
          el.removeAttribute("src");
          el.load();
          sound.stop();
        },
      };
    } else {
      const tune = playTune(ctx, sound.input);
      const ends = ctx.currentTime + tune.length;
      player = {
        get done() {
          return ctx.currentTime > ends;
        },
        stop() {
          tune.stop();
          sound.stop();
        },
      };
    }
    playing = true;
    groove = 0;
    wind = 1;
  }

  return {
    key: "gramophone",
    title: "Gramophone",
    text: "An old wind-up gramophone with a great brass horn. It knows all your favourite songs.",
    root,
    focus: { position: root.localToWorld(v3(0.2, top + 0.55, 0.85)), target: root.localToWorld(v3(0, top + 0.2, 0)) },
    actions: [{ id: "play", label: "Play a song" }],
    // what the next tap will do, for the narration line
    nextTitle() {
      if (!songs.length) return playing ? "" : "♪ Happy Birthday";
      const next = index + 1;
      return next < songs.length ? `♪ ${songs[next].title}` : "";
    },
    // each tap (or spell) puts on the next favourite; after the last, it stops
    act() {
      if (!songs.length) {
        if (playing) stopPlayer();
        else playSong(0);
      } else {
        index += 1;
        if (index >= songs.length) {
          index = -1;
          stopPlayer();
        } else playSong(index);
      }
      sparks.burst(box.localToWorld(v3(-0.01, deck + 0.05, 0.01)), 24, [0xffe7a0, 0xffffff, 0xffd0e0], { speed: 0.3, up: 0.5, life: 1, gravity: -0.3 });
    },
    update(dt, t) {
      if (player?.done) stopPlayer();
      armK += ((playing ? 1 : 0) - armK) * (1 - Math.exp(-dt * 3));
      // the record spins up and down; the arm swings onto it and the needle drops
      spin += dt * armK * 8.2;
      record.rotation.y = -spin;
      if (playing) groove = Math.min(1, groove + dt * 0.004);
      arm.rotation.y = -0.65 * armK - 0.12 * groove * armK + 0.1;
      lift.position.y = 0.012 * (1 - smooth(0.6, 1, armK));
      // winding the crank when a song starts
      if (wind > 0) {
        wind = Math.max(0, wind - dt * 0.9);
        crank.rotation.x -= dt * 9 * Math.min(1, wind * 3);
      }
      glow.material.opacity = armK * (0.06 + 0.02 * Math.sin(t * 3));
      // notes out of the horn
      noteT -= dt;
      if (playing && armK > 0.8 && noteT <= 0) {
        noteT = 0.45;
        const n = notes[nextNote];
        nextNote = (nextNote + 1) % notes.length;
        Object.assign(n, { life: 3, a: Math.random() * Math.PI * 2, sway: Math.random() * 6 });
      }
      for (const n of notes) {
        n.life = Math.max(0, n.life - dt);
        n.sp.visible = n.life > 0;
        if (!n.sp.visible) continue;
        const q = 1 - n.life / 3;
        n.sp.position.set(Math.cos(n.a) * 0.1 * (0.4 + q) + Math.sin(q * 5 + n.sway) * 0.03, L + q * 0.35, Math.sin(n.a) * 0.1 * (0.4 + q));
        n.sp.material.opacity = Math.min(1, q * 5) * Math.min(1, n.life / 0.7);
      }
    },
    dispose() {
      stopPlayer();
    },
  };
}

// ======================= the chocolate frog =======================

// A sitting frog, sculpted from one deformed sphere, with folded legs.
function frogBodyGeometry() {
  const geo = new THREE.SphereGeometry(1, 96, 64);
  const pos = geo.attributes.position;
  const p = v3();
  const bump = (q, c, size, amount) => amount * Math.exp(-q.distanceToSquared(c) / size);
  const eyes = [v3(0.42, 0.62, 0.62).normalize(), v3(-0.42, 0.62, 0.62).normalize()];
  const hump = v3(0, 0.8, -0.35).normalize();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const dir = p.clone();
    let r = 1;
    r += bump(dir, eyes[0], 0.025, 0.2) + bump(dir, eyes[1], 0.025, 0.2);
    r += bump(dir, hump, 0.18, 0.08);
    // a wide mouth: a soft crease round the front
    const mouth = Math.exp(-((dir.y + 0.02) ** 2) / 0.0015) * smooth(0.35, 0.85, dir.z);
    r -= 0.035 * mouth;
    p.multiplyScalar(r);
    // overall frog proportions: wide, low, longer than tall, flat underneath
    p.x *= 0.95;
    p.z *= 1.12;
    p.y *= p.y < 0 ? 0.42 : 0.66;
    // the head tapers to a rounded snout
    if (p.z > 0.4) p.x *= 1 - (p.z - 0.4) * 0.28;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildFrogModel(choc) {
  const frog = new THREE.Group();
  const body = add(frog, frogBodyGeometry(), choc, 0, 0.42, 0);
  body.scale.setScalar(1);
  const legs = { hind: [], front: [] };
  for (const s of [-1, 1]) {
    // hind leg: thigh folded along the side, shin back under, a long webbed foot
    const hind = new THREE.Group();
    hind.position.set(s * 0.7, 0.3, -0.45);
    frog.add(hind);
    add(hind, new THREE.SphereGeometry(1, 32, 20), choc, 0, 0, 0).scale.set(0.3, 0.26, 0.5);
    add(hind, taperTube([v3(0, -0.05, 0.35), v3(s * 0.1, -0.18, 0.2), v3(s * 0.12, -0.24, -0.2)], 0.14, 0.09), choc);
    const foot = new THREE.Group();
    foot.position.set(s * 0.15, -0.27, 0.25);
    hind.add(foot);
    for (let k = -2; k <= 2; k++) add(foot, taperTube([v3(0, 0, -0.1), v3(s * 0.05 + k * 0.06, 0, 0.12), v3(s * 0.08 + k * 0.12, 0, 0.32)], 0.055, 0.03), choc);
    add(foot, new THREE.SphereGeometry(1, 20, 12), choc, s * 0.06, 0, 0.12).scale.set(0.2, 0.04, 0.22);
    legs.hind.push(hind);
    // front leg, straight down, with splayed fingers
    const front = new THREE.Group();
    front.position.set(s * 0.42, 0.3, 0.55);
    frog.add(front);
    add(front, taperTube([v3(0, 0.05, 0), v3(s * 0.08, -0.12, 0.05), v3(s * 0.1, -0.28, 0.1)], 0.1, 0.07), choc);
    for (let k = -1; k <= 1; k++) add(front, taperTube([v3(s * 0.1, -0.28, 0.1), v3(s * 0.14 + k * 0.08, -0.3, 0.22)], 0.045, 0.028), choc);
    legs.front.push(front);
  }
  return { frog, body, legs };
}

function frogBoxLabel() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    r.addColorStop(0, "#6a2c94");
    r.addColorStop(1, "#3a1356");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#e3b648";
    g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      g.lineTo(w / 2 + Math.cos(a) * 104, h / 2 + Math.sin(a) * 104);
    }
    g.closePath();
    g.stroke();
    // a gold star
    g.fillStyle = "#f0c860";
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? 18 : 42;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(w / 2 + Math.cos(a) * rr, h / 2 - 16 + Math.sin(a) * rr);
    }
    g.fill();
    g.fillStyle = "#f0c860";
    g.textAlign = "center";
    g.font = "700 22px Cinzel, Georgia, serif";
    g.fillText("CHOCOLATE", w / 2, h / 2 + 50);
    g.fillText("FROG", w / 2, h / 2 + 74);
  });
}

export function buildChocolateFrog(fireplace, mats, sparks) {
  const root = new THREE.Group();
  root.position.set(0.5, 1.48, 0.38); // towards the front of the mantel, clear of the wall
  fireplace.root.add(root);

  // the box: a bevelled pentagon in purple card with gold edges
  const purple = new THREE.MeshPhysicalMaterial({ color: 0x4a1d6e, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const goldEdge = mats.brass;
  const pent = (r) => {
    const s = new THREE.Shape();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i) s.lineTo(x, y);
      else s.moveTo(x, y);
    }
    s.closePath();
    return s;
  };
  const tray = pent(0.06);
  tray.holes.push(pent(0.053));
  const trayGeo = new THREE.ExtrudeGeometry(tray, { depth: 0.045, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 3 });
  trayGeo.rotateX(-Math.PI / 2);
  add(root, trayGeo, purple, 0, 0.002, 0);
  const floorGeo = new THREE.ShapeGeometry(pent(0.055)).rotateX(-Math.PI / 2);
  add(root, floorGeo, new THREE.MeshStandardMaterial({ color: 0xe9d9b8, roughness: 0.9 }), 0, 0.005, 0, { cast: false });
  const rimGeo = new THREE.ExtrudeGeometry(tray, { depth: 0.003, bevelEnabled: false }).rotateX(-Math.PI / 2);
  add(root, rimGeo, goldEdge, 0, 0.047, 0);
  // the lid, hinged at the back
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.05, -0.052);
  root.add(lidPivot);
  const lidGeo = new THREE.ExtrudeGeometry(pent(0.064), { depth: 0.008, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 3 }).rotateX(-Math.PI / 2);
  add(lidPivot, lidGeo, purple, 0, 0, 0.052);
  const label = add(lidPivot, new THREE.CircleGeometry(0.052, 5).rotateZ(Math.PI / 2 - Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: frogBoxLabel(), roughness: 0.4, clearcoat: 0.6 }), 0, 0.0105, 0.052, { cast: false });
  label.rotation.x = -Math.PI / 2;
  label.rotation.z = Math.PI / 2 - (Math.PI * 2) / 5 / 2 + Math.PI / 10;

  // the frog: glossy dark chocolate
  const choc = new THREE.MeshPhysicalMaterial({ color: 0x3a1b0c, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.18, sheen: 0.3, sheenColor: new THREE.Color(0x8a5030) });
  const { frog, body, legs } = buildFrogModel(choc);
  const frogRoot = new THREE.Group();
  frogRoot.add(frog);
  frog.scale.setScalar(0.034);
  root.add(frogRoot);
  frogRoot.visible = false;

  // it sits on the fireplace, so work out where that puts it in the room
  // before placing its glowing light and the view of it
  root.updateWorldMatrix(true, true);
  let hop = -1;
  return {
    key: "frog",
    title: "Chocolate Frog",
    text: "A box of chocolate with a jump in it. Better hold on tight.",
    root,
    hotspot: root.localToWorld(v3(0, 0.17, 0)),
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
      lidPivot.rotation.x = -1.7 * ease(clamp01(hop / 0.4)) * (1 - ease(clamp01((hop - 4.6) / 0.4)));
      const k = clamp01((hop - 0.4) / 4.0);
      frogRoot.visible = hop > 0.35 && hop < 4.5;
      const out = k < 0.5 ? k * 2 : 2 - k * 2;
      const hops = k * 6;
      const phase = hops % 1;
      const air = Math.sin(Math.PI * phase);
      frogRoot.position.set(-out * 0.3, 0.008 + air * 0.06 + (1 - Math.min(1, out * 6)) * 0.03, 0.02 * Math.sin(Math.PI * out));
      frogRoot.rotation.y = k < 0.5 ? -Math.PI / 2 : Math.PI / 2;
      // squash on landing, stretch in the air, legs kick out
      const land = 1 - air;
      body.scale.set(1 + land * 0.06, 1 - land * 0.1 + air * 0.08, 1 - air * 0.03);
      frog.rotation.x = -air * 0.35 * (phase < 0.5 ? 1 : -0.5);
      for (const h of legs.hind) h.rotation.x = air * 0.9;
      for (const f of legs.front) f.rotation.x = -air * 0.5;
      if (land > 0.97 && Math.random() < 0.5) sparks.burst(frogRoot.getWorldPosition(v3()), 2, [0x8a5030, 0xc9a070], { speed: 0.12, up: 0.2, life: 0.4, gravity: -1 });
      if (hop > 5.1) hop = -1;
    },
  };
}

// ======================= the mandrake =======================

// The mandrake sings Happy Birthday in a little "aah" voice. Returns the
// note times (to move its mouth) and a way to stop it.
function sing() {
  const ctx = audioContext();
  const notes = [];
  let at = 0.1;
  for (const [semi, beats] of TUNE) {
    notes.push({ start: at, end: at + beats * BEAT * 0.92 });
    at += beats * BEAT;
  }
  if (!ctx) return { notes, stop: () => {} };
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.2;
  out.connect(ctx.destination);
  // a voice: a buzzy source shaped by the formants of "ah"
  const voice = ctx.createOscillator();
  voice.type = "sawtooth";
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.5;
  const vibDepth = ctx.createGain();
  vib.connect(vibDepth).connect(voice.frequency);
  const level = ctx.createGain();
  level.gain.value = 0.0001;
  voice.connect(level);
  for (const [f, q, g] of [[800, 6, 1], [1150, 8, 0.6], [2900, 10, 0.25]]) {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = f;
    band.Q.value = q;
    const bg = ctx.createGain();
    bg.gain.value = g;
    level.connect(band).connect(bg).connect(out);
  }
  TUNE.forEach(([semi], i) => {
    const f = 523.25 * 2 ** (semi / 12);
    const n = notes[i];
    voice.frequency.setTargetAtTime(f, now + n.start - 0.02, 0.015); // a little slide between notes
    vibDepth.gain.setValueAtTime(f * 0.012, now + n.start);
    level.gain.setTargetAtTime(0.9, now + n.start, 0.03);
    level.gain.setTargetAtTime(0.0001, now + n.end - 0.04, 0.05);
  });
  voice.start(now);
  vib.start(now);
  const endAt = now + at + 0.3;
  voice.stop(endAt);
  vib.stop(endAt);
  let stopped = false;
  return {
    notes,
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      } catch {
        /* already closed */
      }
      setTimeout(() => out.disconnect(), 400);
    },
  };
}

// Happy Birthday in the mandrake's own little voice, starting `offset`
// seconds into its time.
function builtInSong(offset = 0) {
  const { notes, stop } = sing();
  for (const n of notes) {
    n.start += offset;
    n.end += offset;
  }
  const end = offset + TUNE_LENGTH + 0.4;
  const noteAt = (t) => notes.find((n) => t >= n.start && t < n.end);
  return {
    level: (t) => {
      const n = noteAt(t);
      return n ? Math.sin(clamp01((t - n.start) / 0.12) * Math.PI * 0.5) : 0;
    },
    onset(t) {
      const n = noteAt(t);
      if (!n || n.shown) return false;
      n.shown = true;
      return true;
    },
    done: (t) => t > end,
    stop,
  };
}

// your own recording (an audio file); the mouth follows how loud it is
function recordedSong(url) {
  const ctx = audioContext();
  const el = new Audio(url);
  let failed = false;
  let ended = false;
  el.addEventListener("ended", () => (ended = true));
  el.addEventListener("error", () => (failed = true));
  let analyser = null;
  let data = null;
  if (ctx) {
    try {
      const src = ctx.createMediaElementSource(el);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      data = new Float32Array(analyser.fftSize);
      src.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      analyser = null;
    }
  }
  el.play().catch(() => (failed = true));
  let smoothLevel = 0;
  let quiet = true;
  return {
    get failed() {
      return failed;
    },
    level() {
      let raw = el.paused ? 0 : 0.5;
      if (analyser) {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        raw = Math.min(1, Math.sqrt(sum / data.length) * 7);
      }
      smoothLevel += (raw - smoothLevel) * 0.35;
      return smoothLevel;
    },
    // a new note: the voice gets loud again after a quiet moment
    onset() {
      if (quiet && smoothLevel > 0.4) {
        quiet = false;
        return true;
      }
      if (smoothLevel < 0.2) quiet = true;
      return false;
    },
    done: () => ended || failed,
    stop() {
      el.pause();
      setTimeout(() => {
        try {
          analyser?.disconnect();
        } catch {
          /* already closed */
        }
        el.removeAttribute("src");
        el.load();
      }, 100);
    },
  };
}

// songUrl: your own recording for it to sing; without one it sings Happy Birthday
export function buildMandrake(scene, models, sparks, { position = v3(1.05, 0, -2.35), songUrl = "" } = {}) {
  const root = new THREE.Group();
  root.position.copy(position);
  root.rotation.y = 0.6;
  scene.add(root);
  // Poly Haven's potted plant: the pot stays, the leaves come up with the root
  const plant = models.potted_plant_02.clone();
  root.add(plant);
  const leaves = plant.getObjectByName("potted_plant_02_leaves");
  const leavesHome = leaves.position.clone();
  // the sculpted mandrake takes a second to make, so it's made in the
  // background while the room loads
  const baby = new THREE.Group();
  plant.add(baby);
  let model = null;
  loadMandrake().then((m) => {
    model = m;
    model.group.scale.setScalar(1.3);
    baby.add(model.group);
  });
  const HIDE = -0.22; // head just under the soil
  const LIFT = 0.39; // pulled right out
  baby.position.copy(leavesHome).add(v3(0, HIDE, 0));
  const soil = leavesHome.clone().add(v3(0, 0.01, 0));

  // little notes that float up while it sings
  const noteMap = canvasTexture(64, 64, (g, w) => {
    g.fillStyle = "#fff0c4";
    g.shadowColor = "rgba(255,200,110,1)";
    g.shadowBlur = 10;
    g.font = "46px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("♪", w / 2, w / 2 + 2);
  });
  const notes = Array.from({ length: 8 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sp.scale.setScalar(0.06);
    plant.add(sp);
    return { sp, life: 0, x: 0 };
  });
  let nextNote = 0;

  let t0 = -1;
  let song = null;
  let endAt = Infinity; // when the song finished, and it starts to sink back
  const SINK = 0.7;
  return {
    key: "mandrake",
    title: "Mandrake",
    text: "A mandrake in a clay pot. This one doesn't scream: it sings.",
    root,
    focus: { position: root.localToWorld(v3(0.08, 0.9, 0.8)), target: root.localToWorld(v3(0, 0.66, 0)) },
    actions: [{ id: "sing", label: "Pull it up" }],
    // tap to pull it up and it sings; tap while it sings to let it sink back
    act() {
      if (song) {
        song.stop();
        song = null;
        endAt = Math.min(endAt, t0);
        return;
      }
      t0 = 0;
      endAt = Infinity;
      song = songUrl ? recordedSong(songUrl) : builtInSong(0.1);
      sparks.burst(root.localToWorld(soil.clone()), 30, [0x4a3020, 0x6a4a30, 0x2a1a10], { speed: 0.6, up: 0.6, life: 0.8, gravity: -3 });
    },
    update(dt, t) {
      if (t0 < 0) return;
      t0 += dt;
      // the recording couldn't play: sing Happy Birthday instead
      if (song?.failed) song = builtInSong(t0);
      if (song?.done(t0)) {
        song.stop();
        song = null;
        endAt = Math.min(endAt, t0);
      }
      // up it comes, sings the whole song swaying to the beat, then sinks back
      const up = ease(clamp01(t0 / 0.5)) * (1 - ease(clamp01((t0 - endAt) / SINK)));
      const beat = Math.sin((t0 / BEAT) * Math.PI);
      const bob = Math.abs(beat) * 0.01 * up;
      leaves.position.copy(leavesHome).add(v3(0, up * LIFT + bob, 0));
      leaves.rotation.set(0, 0, beat * 0.08 * up);
      baby.position.copy(leavesHome).add(v3(0, HIDE + up * LIFT + bob, 0));
      baby.rotation.set(0, Math.sin(t0 * 0.8) * 0.3 * up, beat * 0.12 * up);
      // the mouth opens with the singing
      const open = song ? song.level(t0) : 0;
      model?.mouth.open(open * up);
      // arms wave like a conductor
      for (const [i, arm] of (model?.arms ?? []).entries()) {
        arm.rotation.z = (i ? -1 : 1) * (0.15 + 0.75 * Math.abs(beat)) * up;
        arm.rotation.x = -0.3 * Math.abs(beat) * up;
      }
      // a note floats up with each sung note
      if (song?.onset(t0)) {
        const n = notes[nextNote];
        nextNote = (nextNote + 1) % notes.length;
        Object.assign(n, { life: 2.2, x: (Math.random() - 0.5) * 0.2 });
      }
      for (const n of notes) {
        n.life = Math.max(0, n.life - dt);
        const k = 1 - n.life / 2.2;
        n.sp.position.set(leavesHome.x + n.x + Math.sin(k * 6) * 0.03, leavesHome.y + 0.25 + k * 0.45, leavesHome.z + 0.05);
        n.sp.material.opacity = n.life > 0 ? Math.min(clamp01(k * 5), clamp01(n.life / 0.6)) : 0;
      }
      if (t0 > endAt + SINK + 0.1) t0 = -1;
    },
    dispose() {
      song?.stop();
    },
  };
}

// ======================= the potion bottles =======================

// liquid that swirls slowly, glows at its edges and bubbles when warmed
function potionLiquid(color, color2) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBoil: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uColor2: { value: new THREE.Color(color2 ?? color) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBoil;
      uniform vec3 uColor, uColor2;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec3 vView;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
      void main() {
        float a = atan(vPos.x, vPos.z);
        // slow swirls, mixing the two colours
        float swirl = fbm(vec2(a * 1.6 + uTime * 0.25 + vPos.y * 30.0, vPos.y * 45.0 - uTime * 0.35));
        vec3 c = mix(uColor, uColor2, smoothstep(0.35, 0.75, swirl));
        // deeper at the bottom, brighter towards the top
        c *= 0.45 + 0.75 * smoothstep(0.0, 0.12, vPos.y) + 0.25 * swirl;
        // rising bubbles, faster and more of them when warmed
        vec2 bp = vec2(a * 5.0, vPos.y * 160.0 - uTime * (3.0 + uBoil * 14.0));
        float bubbles = smoothstep(0.86 - uBoil * 0.2, 0.97, noise(bp));
        // a glow at the edges, like light caught in the liquid
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
        c += mix(uColor, uColor2, 0.5) * rim * (0.6 + uBoil);
        c += vec3(1.0) * bubbles * (0.35 + uBoil * 0.5);
        c *= 1.0 + uBoil * 1.4;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function corkTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = "#a07a4a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(70,45,22,0.55)" : "rgba(200,165,110,0.45)";
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 0.5 + Math.random() * 1.6, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// an aged parchment label with a potion's name in ink
function labelTexture(name, sub, w = 512, h = 220) {
  const paint = (g) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
    grad.addColorStop(0, "#f1e2bd");
    grad.addColorStop(1, "#cdb07a");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(120,80,30,${0.03 + Math.random() * 0.05})`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 24, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "#5a3a1a";
    g.lineWidth = 4;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.lineWidth = 1.5;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.fillStyle = "#3a2210";
    g.textAlign = "center";
    g.textBaseline = "middle";
    let size = 64;
    g.font = `${size}px "Homemade Apple", "IM Fell English", cursive`;
    while (g.measureText(name).width > w - 70 && size > 20) {
      size -= 2;
      g.font = `${size}px "Homemade Apple", "IM Fell English", cursive`;
    }
    g.fillText(name, w / 2, h * 0.44);
    g.font = `italic 26px "IM Fell English", Georgia, serif`;
    g.fillStyle = "#5a3a1a";
    g.fillText(sub, w / 2, h * 0.78);
  };
  const tex = canvasTexture(w, h, paint);
  document.fonts
    ?.load?.('64px "Homemade Apple"')
    .then(() => {
      paint(tex.image.getContext("2d"));
      tex.needsUpdate = true;
    })
    .catch(() => {});
  return tex;
}

// a sprite drawn on a canvas, for the potions' magic
function drawnSprite(w, h, paint, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(w, h, paint), transparent: true, depthWrite: false, opacity: 0 }));
  sp.scale.set(size, (size * h) / w, 1);
  sp.visible = false;
  return sp;
}
const heartPath = (g, cx, cy, s) => {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.35);
  g.bezierCurveTo(cx - s * 0.05, cy + s * 0.28, cx - s * 0.5, cy + s * 0.02, cx - s * 0.5, cy - s * 0.2);
  g.bezierCurveTo(cx - s * 0.5, cy - s * 0.45, cx - s * 0.15, cy - s * 0.55, cx, cy - s * 0.3);
  g.bezierCurveTo(cx + s * 0.15, cy - s * 0.55, cx + s * 0.5, cy - s * 0.45, cx + s * 0.5, cy - s * 0.2);
  g.bezierCurveTo(cx + s * 0.5, cy + s * 0.02, cx + s * 0.05, cy + s * 0.28, cx, cy + s * 0.35);
  g.fill();
};
function howl() {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.09, now + 0.4);
  out.gain.setValueAtTime(0.09, now + 1.6);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
  out.connect(ctx.destination);
  for (const [mult, type, level] of [[1, "sawtooth", 0.25], [2, "sine", 0.5], [3, "sine", 0.15]]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(320 * mult, now);
    osc.frequency.exponentialRampToValueAtTime(560 * mult, now + 0.7);
    osc.frequency.setValueAtTime(560 * mult, now + 1.5);
    osc.frequency.exponentialRampToValueAtTime(380 * mult, now + 2.6);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(lp).connect(g).connect(out);
    osc.start(now);
    osc.stop(now + 2.7);
  }
  setTimeout(() => out.disconnect(), 2900);
}

// Seven potions on a tray on the mantel. Tap one and it does its own magic;
// tap the light above them and they take turns.
export function buildPotions(fireplace, mats, sparks) {
  const root = new THREE.Group();
  root.position.set(-0.5, 1.48, 0.33); // left of the mantel, clear of the wall
  fireplace.root.add(root);

  // a long oak tray with a brass rim
  rbox(root, 0.66, 0.012, 0.15, 0.004, mats.walnut, 0, 0.006, 0);
  add(root, new THREE.BoxGeometry(0.664, 0.006, 0.154), mats.brass, 0, 0.003, 0);

  const glassMat = (tint) => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.006, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1, envMapIntensity: 1.2 });
  const cork = new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 0.95 });
  const wax = new THREE.MeshPhysicalMaterial({ color: 0x9a1020, roughness: 0.35, clearcoat: 0.6 });
  const string = new THREE.MeshStandardMaterial({ color: 0xcbb48a, roughness: 1 });

  // profile: [radius, height] up the outside of the glass
  const ROUND = [[0.0001, 0], [0.024, 0.002], [0.04, 0.018], [0.045, 0.04], [0.04, 0.064], [0.024, 0.08], [0.012, 0.09], [0.011, 0.135], [0.014, 0.138], [0.014, 0.143]];
  const TEARDROP = [[0.0001, 0], [0.02, 0.002], [0.029, 0.02], [0.029, 0.045], [0.02, 0.073], [0.009, 0.092], [0.009, 0.112], [0.012, 0.115], [0.012, 0.12]];
  const JAR = [[0.0001, 0], [0.031, 0.001], [0.034, 0.01], [0.034, 0.05], [0.028, 0.06], [0.022, 0.065], [0.022, 0.073], [0.025, 0.076], [0.025, 0.08]];
  const VIAL = [[0.0001, 0], [0.016, 0.001], [0.018, 0.008], [0.018, 0.14], [0.012, 0.152], [0.009, 0.158], [0.009, 0.172], [0.011, 0.175], [0.011, 0.18]];
  const CONICAL = [[0.0001, 0], [0.036, 0.001], [0.038, 0.006], [0.02, 0.07], [0.011, 0.09], [0.011, 0.112], [0.014, 0.115], [0.014, 0.12]];
  const HEX = [[0.0001, 0], [0.028, 0.001], [0.03, 0.008], [0.03, 0.1], [0.022, 0.115], [0.011, 0.122], [0.011, 0.14], [0.013, 0.143], [0.013, 0.148]];

  const POTIONS = [
    { key: "polyjuice", name: "Polyjuice Potion", sub: "becomes someone else", x: -0.27, z: -0.03, profile: JAR, fill: 0.048, colors: [0x4a5418, 0x8a7a30], tint: 0xe8efe0 },
    { key: "felix", name: "Felix Felicis", sub: "liquid luck", x: -0.185, z: 0.03, profile: TEARDROP, fill: 0.058, colors: [0xffb21a, 0xfff1a0], tint: 0xfffaf0, seal: true },
    { key: "veritaserum", name: "Veritaserum", sub: "three drops for the truth", x: -0.1, z: -0.03, profile: VIAL, fill: 0.11, colors: [0x9fc8e8, 0xffffff], tint: 0xf4f8ff },
    { key: "amortentia", name: "Amortentia", sub: "the strongest love potion", x: -0.005, z: 0.028, profile: ROUND, fill: 0.06, colors: [0xf27ab0, 0xffe0f0], tint: 0xfff2f6 },
    { key: "skelegro", name: "Skele-Gro", sub: "regrows bones", x: 0.09, z: 0.03, profile: JAR, fill: 0.05, colors: [0xbab29a, 0xe8e2cc], tint: 0xf2f0e8 },
    { key: "livingdeath", name: "Draught of Living Death", sub: "a very deep sleep", x: 0.178, z: -0.032, profile: CONICAL, fill: 0.05, colors: [0xa58ad8, 0xe8e0ff], tint: 0xf6f2ff },
    { key: "wolfsbane", name: "Wolfsbane Potion", sub: "for the full moon", x: 0.265, z: -0.022, profile: HEX, sides: 6, fill: 0.085, colors: [0x2f4f8f, 0x9ab8e0], tint: 0xc8d8f0 },
  ];

  const potions = [];
  const BASE = 0.012;
  for (const b of POTIONS) {
    // a holder that the magic moves (jumps, tips, squashes), the bottle inside
    const holder = new THREE.Group();
    holder.position.set(b.x, BASE, b.z);
    root.add(holder);
    const g = new THREE.Group();
    g.rotation.y = (Math.random() - 0.5) * 0.4;
    holder.add(g);
    const liquid = potionLiquid(...b.colors);
    add(g, lathe(b.profile, b.sides ?? 64), glassMat(b.tint), 0, 0, 0, { cast: false });
    // the liquid: the inside of the glass, filled up to its level
    const inner = [];
    for (let i = 0; i < b.profile.length; i++) {
      const [r, y] = b.profile[i];
      if (y > b.fill) {
        const [r0, y0] = b.profile[i - 1];
        inner.push([(r0 + ((r - r0) * (b.fill - y0)) / (y - y0)) * 0.88, b.fill]);
        break;
      }
      inner.push([Math.max(0.0001, r * 0.88), y + 0.003]);
    }
    inner.push([0.0001, b.fill - 0.002]); // a gentle meniscus
    add(g, lathe(inner, b.sides ?? 48), liquid, 0, 0, 0, { cast: false });
    const top = b.profile[b.profile.length - 1][1];
    const neckR = b.profile[b.profile.length - 3][0];
    const widest = b.profile.reduce((m, p) => (p[0] > m[0] ? p : m));
    // a parchment label wrapped round the front
    const labelR = widest[0] + 0.0012;
    const labelH = Math.min(labelR * 0.75, b.fill * 0.9);
    add(g, new THREE.CylinderGeometry(labelR, labelR, labelH, 32, 1, true, -0.75, 1.5), new THREE.MeshStandardMaterial({ map: labelTexture(b.name, b.sub), roughness: 0.9, side: THREE.DoubleSide }), 0, Math.max(widest[1], labelH / 2 + 0.006), 0, { cast: false });
    // the cork, and string tied round the neck
    const corkGroup = new THREE.Group();
    corkGroup.position.y = top - 0.008;
    g.add(corkGroup);
    add(corkGroup, new THREE.CylinderGeometry(neckR * 1.18, neckR * 0.92, 0.024, 20), cork, 0, 0.012, 0);
    if (b.seal) add(corkGroup, lathe([[0.0001, 0.026], [neckR * 1.25, 0.022], [neckR * 1.45, 0.012], [neckR * 1.35, 0.004], [neckR * 1.1, 0.0]], 24), wax, 0, 0, 0);
    const knot = add(g, new THREE.TorusGeometry(neckR * 1.05, 0.0012, 6, 24), string, 0, top - 0.018, 0, { cast: false });
    knot.rotation.x = Math.PI / 2;
    const glow = new THREE.PointLight(b.colors[0], 0.03, 0.5, 2);
    glow.position.y = b.fill * 0.6;
    g.add(glow);
    const meshes = new Set();
    holder.traverse((o) => o.isMesh && meshes.add(o));
    potions.push({ ...b, holder, g, liquid, corkGroup, glow, top, radius: widest[0], meshes, t: -1, base: new THREE.Color(b.colors[0]), base2: new THREE.Color(b.colors[1]) });
  }
  const byKey = Object.fromEntries(potions.map((p) => [p.key, p]));

  // ---------- the props each potion's magic needs ----------

  // Veritaserum: a truth, written in the air
  const truth = drawnSprite(512, 160, (g, w, h) => {
    g.fillStyle = "#e9f4ff";
    g.shadowColor = "rgba(160,210,255,1)";
    g.shadowBlur = 16;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '28px "IM Fell English", Georgia, serif';
    g.fillText("The truth?", w / 2, h * 0.3);
    g.font = '56px "Homemade Apple", cursive';
    g.fillText("I love you.", w / 2, h * 0.68);
  }, 0.24);
  // Amortentia: little hearts
  const heartMap = canvasTexture(64, 64, (g, w) => {
    g.fillStyle = "#ff8fc0";
    g.shadowColor = "rgba(255,150,200,1)";
    g.shadowBlur = 10;
    heartPath(g, w / 2, w / 2 + 4, w * 0.8);
  });
  const hearts = Array.from({ length: 16 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartMap, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    root.add(sp);
    return { sp, life: 0, a: 0 };
  });
  let nextHeart = 0;
  // Draught of Living Death: drifting Zs
  const zMap = canvasTexture(64, 64, (g, w) => {
    g.fillStyle = "#e6dcff";
    g.shadowColor = "rgba(180,150,255,1)";
    g.shadowBlur = 8;
    g.font = '700 48px "IM Fell English", Georgia, serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("z", w / 2, w / 2);
  });
  const zs = Array.from({ length: 6 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zMap, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    root.add(sp);
    return { sp, life: 0, x: 0 };
  });
  let nextZ = 0;
  // Wolfsbane: a full moon, and a wolf howling at it
  const moon = drawnSprite(256, 256, (g, w) => {
    const r = g.createRadialGradient(w * 0.6, w * 0.38, 4, w * 0.6, w * 0.38, w * 0.34);
    r.addColorStop(0, "#fffbe8");
    r.addColorStop(0.7, "#e6e8f4");
    r.addColorStop(1, "rgba(200,215,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
    g.fillStyle = "rgba(170,175,200,0.35)";
    for (const [x, y, s] of [[0.55, 0.32, 0.05], [0.68, 0.45, 0.035], [0.6, 0.5, 0.025]]) {
      g.beginPath();
      g.arc(w * x, w * y, w * s, 0, Math.PI * 2);
      g.fill();
    }
    // the wolf, sitting with its head thrown back
    g.fillStyle = "#16203a";
    g.beginPath();
    g.moveTo(w * 0.1, w * 0.98);
    g.quadraticCurveTo(w * 0.12, w * 0.72, w * 0.22, w * 0.62);
    g.lineTo(w * 0.24, w * 0.5);
    g.lineTo(w * 0.27, w * 0.4);
    g.lineTo(w * 0.3, w * 0.33); // ear
    g.lineTo(w * 0.32, w * 0.41);
    g.lineTo(w * 0.42, w * 0.28); // snout, pointing at the moon
    g.lineTo(w * 0.43, w * 0.31);
    g.lineTo(w * 0.36, w * 0.46);
    g.quadraticCurveTo(w * 0.34, w * 0.62, w * 0.4, w * 0.8);
    g.lineTo(w * 0.42, w * 0.98);
    g.closePath();
    g.fill();
  }, 0.2);
  root.add(truth, moon);
  // Skele-Gro: a bone, growing out of the jar
  const boneMat = new THREE.MeshPhysicalMaterial({ color: 0xf0e8d4, roughness: 0.55, clearcoat: 0.3 });
  const bone = new THREE.Group();
  add(bone, new THREE.CylinderGeometry(0.0055, 0.0055, 0.07, 14), boneMat, 0, 0.035, 0);
  for (const y of [0, 0.07]) for (const x of [-0.006, 0.006]) add(bone, new THREE.SphereGeometry(0.0072, 14, 10), boneMat, x, y, 0);
  bone.visible = false;
  byKey.skelegro.g.add(bone);

  // ---------- the magic ----------

  const at = v3();
  const world = (p, y) => p.g.localToWorld(at.set(0, y, 0));
  const ENDS = { polyjuice: 3, felix: 2.4, veritaserum: 4.2, amortentia: 4, skelegro: 3.6, livingdeath: 5.2, wolfsbane: 4.2 };
  let turn = 0;
  // which potion a tap means: the bottle tapped, or the next one in turn
  function which(object) {
    for (const p of potions) if (object && p.meshes.has(object)) return p;
    return null;
  }
  function start(p) {
    p.t = 0;
    if (p.key === "polyjuice") sparks.burst(world(p, p.top + 0.01), 30, [0x5a6a20, 0x8a8a40, 0x3a4a10], { speed: 0.25, up: 0.3, life: 1.1, gravity: 0.1 });
    if (p.key === "felix") sparks.burst(world(p, 0.02), 20, [0xffd36a, 0xffffff], { speed: 0.4, up: 0.4, life: 0.8, gravity: -0.8 });
    if (p.key === "skelegro") sparks.burst(world(p, p.top + 0.01), 26, [0xd8d2c0, 0x9a9a8a, 0xffffff], { speed: 0.15, up: 0.25, life: 1.4, gravity: 0.08 });
    if (p.key === "wolfsbane") howl();
  }

  root.updateWorldMatrix(true, true);
  return {
    key: "potions",
    title: "Potion bottles",
    text: "Seven potions from the potions master's cupboard, each one labelled in a careful hand.",
    root,
    hotspot: root.localToWorld(v3(0, 0.26, 0)),
    focus: { position: root.localToWorld(v3(0.02, 0.26, 0.86)), target: root.localToWorld(v3(0, 0.12, 0)) },
    colliders: [],
    actions: [{ id: "magic", label: "Try a potion" }],
    // the name of the potion a tap on this object would set off
    nameFor(object) {
      return (which(object) ?? potions[turn % potions.length]).name;
    },
    act(id, object) {
      let p = which(object);
      if (!p) {
        p = potions[turn % potions.length];
        turn++;
      }
      start(p);
    },
    update(dt, t) {
      for (const p of potions) {
        p.liquid.uniforms.uTime.value = t;
        const active = p.t >= 0;
        if (active) p.t += dt;
        const k = active ? p.t / ENDS[p.key] : 1;
        const env = active ? Math.sin(Math.min(1, k) * Math.PI) : 0; // up, then back down
        p.liquid.uniforms.uBoil.value = env * 0.6;
        p.glow.intensity = 0.03 + env * 0.25;
        // reset what the magic moves
        p.holder.position.set(p.x, BASE, p.z);
        p.holder.rotation.set(0, 0, 0);
        p.holder.scale.set(1, 1, 1);
        if (!active) continue;
        const pt = p.t;
        switch (p.key) {
          case "polyjuice": {
            // squash, stretch and shift through the other potions' colours
            p.holder.scale.set(1 + 0.28 * Math.sin(pt * 9) * env, 1 - 0.22 * Math.sin(pt * 7 + 1) * env, 1 + 0.28 * Math.sin(pt * 8 + 2) * env);
            const other = potions[Math.floor(pt * 4) % potions.length];
            p.liquid.uniforms.uColor.value.copy(p.base).lerp(other.base, env);
            p.liquid.uniforms.uColor2.value.copy(p.base2).lerp(other.base2, env);
            if (Math.random() < dt * 10 * env) sparks.burst(world(p, p.top), 1, [0x6a7a30, 0x9a9a50], { speed: 0.05, up: 0.2, life: 1, gravity: 0.05 });
            break;
          }
          case "felix": {
            // a lucky leap with a twirl, in a fountain of gold
            const jump = Math.min(1, pt / 1.1);
            p.holder.position.y = BASE + Math.sin(jump * Math.PI) * 0.09;
            p.holder.rotation.y = ease(jump) * Math.PI * 2;
            if (pt < 1.8 && Math.random() < dt * 40) sparks.burst(world(p, p.top + 0.01), 1, [0xffd36a, 0xfff1a0, 0xffffff], { speed: 0.35, up: 1.2, spread: 0.35, life: 1.1, gravity: -1.2 });
            if (pt > 1.1 && pt - dt <= 1.1) sparks.burst(world(p, 0.01), 24, [0xffd36a, 0xffffff], { speed: 0.35, up: 0.3, life: 0.8, gravity: -0.8 });
            break;
          }
          case "veritaserum": {
            // the truth rises out of the vial, in handwriting
            truth.visible = true;
            truth.position.set(p.x, p.top + 0.04 + ease(Math.min(1, pt / 1.6)) * 0.12, p.z + 0.03);
            truth.material.opacity = Math.min(1, pt / 0.8) * (1 - smooth(ENDS.veritaserum - 0.9, ENDS.veritaserum, pt));
            if (Math.random() < dt * 8 * env) sparks.burst(world(p, p.top), 1, [0xcfe8ff, 0xffffff], { speed: 0.04, up: 0.25, life: 1, gravity: 0.05 });
            break;
          }
          case "amortentia": {
            // hearts spiral up out of the flask
            if (pt < 2.8 && Math.floor(pt / 0.17) !== Math.floor((pt - dt) / 0.17)) {
              const h = hearts[nextHeart];
              nextHeart = (nextHeart + 1) % hearts.length;
              Object.assign(h, { life: 2.2, a: Math.random() * Math.PI * 2 });
            }
            if (Math.random() < dt * 10 * env) sparks.burst(world(p, p.top + 0.005), 1, [0xffd6ea, 0xffffff], { speed: 0.03, up: 0.15, life: 1.4, gravity: 0.03 });
            break;
          }
          case "skelegro": {
            // a bone grows up out of the jar, wiggles, then shrinks back
            const grow = smooth(0, 0.9, pt) * (1 - smooth(ENDS.skelegro - 0.9, ENDS.skelegro, pt));
            bone.visible = grow > 0.01;
            bone.position.y = p.top - 0.03;
            bone.scale.set(0.6 + 0.4 * grow, grow, 0.6 + 0.4 * grow);
            bone.rotation.z = Math.sin(pt * 6) * 0.25 * grow;
            if (Math.random() < dt * 8 * env) sparks.burst(world(p, p.top), 1, [0xbab29a, 0x8a8a7a], { speed: 0.04, up: 0.18, life: 1.4, gravity: 0.04 });
            break;
          }
          case "livingdeath": {
            // it nods off, tipping forward onto its side, sleeps, then wakes up
            const down = smooth(0.2, 1.2, pt) * (1 - smooth(ENDS.livingdeath - 1.2, ENDS.livingdeath - 0.2, pt));
            const ang = down * 1.42;
            p.holder.rotation.x = ang;
            p.holder.position.y = BASE + Math.sin(ang) * p.radius;
            if (down > 0.9 && pt < ENDS.livingdeath - 1.4 && Math.floor(pt / 0.55) !== Math.floor((pt - dt) / 0.55)) {
              const z = zs[nextZ];
              nextZ = (nextZ + 1) % zs.length;
              Object.assign(z, { life: 1.8, x: p.x });
            }
            break;
          }
          case "wolfsbane": {
            // the full moon rises over the bottle and a wolf howls at it
            moon.visible = true;
            moon.position.set(p.x, p.top + 0.06 + ease(Math.min(1, pt / 1.2)) * 0.07, p.z + 0.02);
            moon.material.opacity = Math.min(1, pt / 0.8) * (1 - smooth(ENDS.wolfsbane - 0.9, ENDS.wolfsbane, pt));
            if (Math.random() < dt * 14 * env) sparks.burst(world(p, p.top), 1, [0x6a8ad0, 0x9ab8e0, 0xc8d8ff], { speed: 0.06, up: 0.12, spread: 0.6, life: 1.6, gravity: 0.02 });
            break;
          }
        }
        if (p.t > ENDS[p.key]) {
          p.t = -1;
          p.liquid.uniforms.uColor.value.copy(p.base);
          p.liquid.uniforms.uColor2.value.copy(p.base2);
          if (p.key === "veritaserum") truth.visible = false;
          if (p.key === "wolfsbane") moon.visible = false;
          if (p.key === "skelegro") bone.visible = false;
        }
      }
      // hearts spiralling up, Zs drifting off
      const am = byKey.amortentia;
      for (const h of hearts) {
        h.life = Math.max(0, h.life - dt);
        h.sp.visible = h.life > 0;
        if (!h.sp.visible) continue;
        const q = 1 - h.life / 2.2;
        const a = h.a + q * 7;
        h.sp.position.set(am.x + Math.cos(a) * (0.015 + q * 0.04), am.top + 0.02 + q * 0.26, am.z + Math.sin(a) * (0.015 + q * 0.04));
        h.sp.scale.setScalar(0.014 + q * 0.018);
        h.sp.material.opacity = Math.min(1, q * 6) * Math.min(1, h.life / 0.6);
      }
      const ld = byKey.livingdeath;
      for (const z of zs) {
        z.life = Math.max(0, z.life - dt);
        z.sp.visible = z.life > 0;
        if (!z.sp.visible) continue;
        const q = 1 - z.life / 1.8;
        z.sp.position.set(z.x + Math.sin(q * 5) * 0.015 + q * 0.03, BASE + ld.radius * 2 + q * 0.16, ld.z + 0.07);
        z.sp.scale.setScalar(0.016 + q * 0.016);
        z.sp.material.opacity = Math.min(1, q * 5) * Math.min(1, z.life / 0.5);
      }
    },
  };
}
