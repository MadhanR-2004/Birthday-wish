import * as THREE from "three";

// Two bigger spells, placed in front of the camera when they're cast so
// they're always in view, whatever the screen shape:
//   writing     - silver mist pours out of the mirror, writes her name in
//                 the air, then flows back into the glass
//   butterflies - the quill's words fly off the page as paper butterflies

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// a little seeded random, so each particle keeps its own personality
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const MAX = 2200;

// where in front of the camera (and how wide) something should appear
function frameAt(camera, distance, width, lift = 0) {
  const f = camera.getWorldDirection(v3());
  const r = v3().crossVectors(f, camera.up).normalize();
  const u = v3().crossVectors(r, f).normalize();
  const viewH = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const viewW = viewH * camera.aspect;
  const w = Math.min(width, viewW * 0.8, viewH * 1.1);
  const c = camera.position.clone().addScaledVector(f, distance).addScaledVector(u, lift * viewH);
  return { c, r, u, f, w };
}

// ---------- the mirror's writing: drawn on a canvas, sampled into points ----------

// `count` points (u, v) inside what was drawn, weighted by opacity.
// u runs -0.5..0.5 across the canvas width; v uses the same scale.
function sampleDrawing(w, h, draw, count) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  draw(g, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  const xs = [];
  const ys = [];
  const ws = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 16) {
        xs.push(x);
        ys.push(y);
        ws.push(a / 255);
      }
    }
  }
  const out = new Float32Array(count * 2);
  if (!xs.length) return out;
  for (let i = 0, tries = 0; i < count && tries < count * 40; tries++) {
    const k = Math.floor(Math.random() * xs.length);
    if (Math.random() > ws[k]) continue;
    out[i * 2] = (xs[k] + Math.random() * 2 - w / 2) / w;
    out[i * 2 + 1] = (h / 2 - ys[k] - Math.random() * 2) / w;
    i++;
  }
  return out;
}

function heartPath(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.35);
  g.bezierCurveTo(cx - s * 0.05, cy + s * 0.28, cx - s * 0.5, cy + s * 0.02, cx - s * 0.5, cy - s * 0.2);
  g.bezierCurveTo(cx - s * 0.5, cy - s * 0.45, cx - s * 0.15, cy - s * 0.55, cx, cy - s * 0.3);
  g.bezierCurveTo(cx + s * 0.15, cy - s * 0.55, cx + s * 0.5, cy - s * 0.45, cx + s * 0.5, cy - s * 0.2);
  g.bezierCurveTo(cx + s * 0.5, cy + s * 0.02, cx + s * 0.05, cy + s * 0.28, cx, cy + s * 0.35);
  g.closePath();
}

// her name in handwriting, with a little heart and flourishes beneath
function drawWriting(name) {
  return (g, w, h) => {
    g.fillStyle = "#fff";
    g.strokeStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const font = (size) => `${size}px "Homemade Apple", "Brush Script MT", cursive`;
    let size = h * 0.42;
    g.font = font(size);
    while (g.measureText(name).width > w * 0.9 && size > 20) {
      size *= 0.9;
      g.font = font(size);
    }
    g.lineWidth = size * 0.05;
    g.fillText(name, w / 2, h * 0.38);
    g.strokeText(name, w / 2, h * 0.38);
    heartPath(g, w / 2, h * 0.8, h * 0.22);
    g.lineWidth = h * 0.018;
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.3, h * 0.8);
    g.quadraticCurveTo(w * 0.38, h * 0.74, w * 0.44, h * 0.8);
    g.moveTo(w * 0.56, h * 0.8);
    g.quadraticCurveTo(w * 0.62, h * 0.86, w * 0.7, h * 0.8);
    g.stroke();
  };
}

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.2, "rgba(255,255,255,0.75)");
  r.addColorStop(0.5, "rgba(255,255,255,0.18)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createWriting(scene, camera, { name, reduceMotion }) {
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.014, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);
  // load the handwriting font early; the shape is sampled on first use
  document.fonts?.load?.('80px "Homemade Apple"').catch(() => {});
  let local = null;

  const slow = reduceMotion ? 0.6 : 1;
  const GATHER = 1.1 * slow;
  const STAGGER = 1.8 * slow; // written left to right
  const HOLD = 2.6 * slow;
  const RELEASE = 2.2 * slow;
  const GAIN = 1.5;
  const tints = [0xe8eeff, 0xc6d4ff, 0xffffff, 0xe9dcff, 0xffe6f0].map((c) => new THREE.Color(c));
  let show = null;
  const S = v3();
  const T = v3();
  const M = v3();
  const tmp = v3();

  function place(i, t, out) {
    const x = local[i * 2] * show.w;
    const y = local[i * 2 + 1] * show.w + Math.sin(t * 1.6 + local[i * 2] * 5) * show.w * 0.008;
    return out.copy(show.c).addScaledVector(show.r, x).addScaledVector(show.u, y).addScaledVector(show.f, (hash(i * 1.7) - 0.5) * show.w * 0.04);
  }

  return {
    // source: the glass; then: called as the mist flows back in
    cast(source, then) {
      local ??= sampleDrawing(640, 300, drawWriting(name), MAX);
      show = { t: 0, source: source.clone(), then, released: false, ...frameAt(camera, 0.95, 0.85, 0.06) };
    },
    update(dt) {
      if (!show) return;
      const s = show;
      s.t += dt;
      const t = s.t;
      const releaseAt = GATHER + STAGGER + HOLD;
      if (!s.released && t >= releaseAt) {
        s.released = true;
        s.then?.();
      }
      for (let i = 0; i < MAX; i++) {
        const h1 = hash(i + 0.5);
        const h2 = hash(i * 2.3 + 1);
        const h3 = hash(i * 4.7 + 2);
        const te = t - ((local[i * 2] + 0.5) * STAGGER * 0.9 + h1 * STAGGER * 0.1);
        let bright = 0;
        if (te < 0) {
          T.set(0, -100, 0);
        } else if (t < releaseAt) {
          place(i, t, T);
          if (te < GATHER) {
            // from the glass along a curve, into its place in the letters
            const g = easeInOut(te / GATHER);
            S.copy(s.source).add(tmp.set(h1 - 0.5, h2 - 0.5, h3 - 0.5).multiplyScalar(0.5));
            M.copy(S).lerp(T, 0.5).addScaledVector(s.u, (h2 - 0.3) * s.w * 0.6).addScaledVector(s.r, (h3 - 0.5) * s.w * 0.8);
            const a = 1 - g;
            T.multiplyScalar(g * g).addScaledVector(M, 2 * a * g).addScaledVector(S, a * a);
            bright = 0.5 + 0.5 * g;
          } else {
            bright = 0.78 + 0.22 * Math.sin(t * 6 + i);
          }
        } else {
          // the mist flows back into the glass
          const g = easeInOut(clamp01((t - releaseAt) / (RELEASE * 0.8)));
          place(i, releaseAt, T);
          S.copy(s.source).add(tmp.set(h1 - 0.5, h2 - 0.5, 0).multiplyScalar(0.35));
          T.lerp(S, g);
          T.y += Math.sin(g * Math.PI) * 0.12 * (h3 - 0.3);
          bright = 1 - g * 0.85 - clamp01((t - releaseAt - RELEASE * 0.8) / 0.4) * 0.15;
        }
        const c = tints[Math.floor(hash(i * 3.1 + 7) * tints.length)];
        const k = GAIN * Math.max(0, bright);
        pos[i * 3] = T.x;
        pos[i * 3 + 1] = T.y;
        pos[i * 3 + 2] = T.z;
        col[i * 3] = c.r * k;
        col[i * 3 + 1] = c.g * k;
        col[i * 3 + 2] = c.b * k;
      }
      if (t > releaseAt + RELEASE + 0.4) {
        show = null;
        col.fill(0);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---------- the quill's paper butterflies ----------

function wingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  // the body runs down the left edge; the forewing at the top (the front)
  g.beginPath();
  g.moveTo(2, 60);
  g.bezierCurveTo(30, 0, 110, -6, 122, 22);
  g.bezierCurveTo(128, 46, 90, 64, 60, 66);
  g.bezierCurveTo(100, 76, 112, 112, 84, 124);
  g.bezierCurveTo(56, 132, 16, 100, 2, 70);
  g.closePath();
  const fill = g.createLinearGradient(0, 0, 128, 0);
  fill.addColorStop(0, "#fffaf0");
  fill.addColorStop(1, "#f5e3bd");
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = "#e3b55a";
  g.stroke();
  // ink veins, as if cut from a letter
  g.strokeStyle = "rgba(120, 82, 40, 0.55)";
  g.lineWidth = 1.5;
  for (const [x, y] of [[110, 18], [90, 40], [64, 56], [84, 112], [50, 104]]) {
    g.beginPath();
    g.moveTo(4, 64);
    g.quadraticCurveTo((x + 4) / 2, (y + 64) / 2 - 6, x, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createButterflies(scene, camera, sparks, count = 22) {
  const map = wingTexture();
  // a 1×1 wing hinged on the body (x = 0), lying flat, its front towards +z
  const right = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2).translate(0.5, 0, 0);
  const left = right.clone().scale(-1, 1, 1);
  const tints = [0xffffff, 0xfff0c8, 0xffd9e2, 0xf0e2ff];
  const flies = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ map, color: tints[i % tints.length], transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, opacity: 0 });
    const group = new THREE.Group();
    const r = new THREE.Mesh(right, mat);
    const l = new THREE.Mesh(left, mat);
    group.add(r, l);
    group.visible = false;
    scene.add(group);
    flies.push({ group, r, l, mat, pos: v3(), vel: v3(), seed: i + 1, t: null });
  }
  let frame = null;
  const target = v3();
  const look = v3();
  return {
    cast(source, delay = 0) {
      frame = frameAt(camera, 1.4, 1.2, 0.08);
      for (const b of flies) {
        b.t = -(delay + hash(b.seed) * 1.4 + b.seed * 0.03);
        b.life = 6.5 + hash(b.seed * 3) * 2;
        b.pos.copy(source).add(v3(hash(b.seed * 5) - 0.5, 0, hash(b.seed * 7) - 0.5).multiplyScalar(0.25));
        b.vel.copy(frame.u).multiplyScalar(0.6).addScaledVector(frame.r, (hash(b.seed * 11) - 0.5) * 0.6);
        b.group.visible = false;
        b.group.scale.setScalar(0.06 + hash(b.seed * 13) * 0.035);
      }
    },
    update(dt, time) {
      if (!frame) return;
      let alive = 0;
      for (const b of flies) {
        if (b.t === null) continue;
        b.t += dt;
        alive++;
        if (b.t < 0) continue;
        if (b.t > b.life + 1.5) {
          b.group.visible = false;
          b.t = null;
          continue;
        }
        const t = b.t;
        const s = b.seed;
        const w = frame.w;
        // each one wanders its own loop in front of you, then flies off up
        target
          .copy(frame.c)
          .addScaledVector(frame.r, Math.sin(time * (0.5 + hash(s) * 0.5) + s) * w * 0.38)
          .addScaledVector(frame.u, Math.sin(time * (0.7 + hash(s * 2) * 0.4) + s * 2) * w * 0.16)
          .addScaledVector(frame.f, Math.sin(time * 0.45 + s * 3) * w * 0.25);
        if (t > b.life) target.addScaledVector(frame.u, 2.5).addScaledVector(frame.f, 1.2).addScaledVector(frame.r, (hash(s * 9) - 0.5) * 3);
        b.vel.addScaledVector(target.sub(b.pos), dt * 2.4);
        b.vel.multiplyScalar(1 - dt * 1.3);
        b.pos.addScaledVector(b.vel, dt);
        // a little hop with each wing beat
        const beat = Math.sin(time * 15 + s * 4);
        b.group.position.copy(b.pos).addScaledVector(frame.u, beat * 0.006);
        look.copy(b.pos).add(b.vel);
        if (b.vel.lengthSq() > 1e-5) b.group.lookAt(look);
        const flap = 0.15 + 1.05 * (0.5 + 0.5 * beat);
        b.r.rotation.z = flap;
        b.l.rotation.z = -flap;
        b.mat.opacity = Math.min(clamp01(t / 0.4), clamp01(b.life + 1.5 - t));
        b.group.visible = true;
        if (Math.random() < dt * 7) sparks.burst(b.pos, 1, [0xffe7a0, 0xffffff, 0xffc0d0], { speed: 0.05, up: 0, spread: 1, life: 0.8, gravity: -0.15 });
      }
      if (!alive) frame = null;
    },
  };
}

export function createSpells(scene, camera, sparks, { name = "you", reduceMotion = false } = {}) {
  const writing = createWriting(scene, camera, { name, reduceMotion });
  const butterflies = createButterflies(scene, camera, sparks);
  return {
    writing: writing.cast,
    butterflies: butterflies.cast,
    update(dt, time) {
      writing.update(dt);
      butterflies.update(dt, time);
    },
  };
}
