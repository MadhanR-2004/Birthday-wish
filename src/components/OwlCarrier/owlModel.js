import * as THREE from "three";

// A snowy owl in 3D, built entirely in code: used by the letter page (where
// she carries the envelope) and by the tower room (where she flies, catches
// the letter and settles in her cage). The grip point of her talons is the
// origin of `root`, so whatever she holds or perches on lines up there.
//
// The body and head are smooth shapes covered in
// about a thousand small "feather cards" (painted, see-through feathers laid
// like roof shingles), which gives the soft outline and layered look of real
// plumage. Each wing is a chain of joints (shoulder, elbow, wrist) carrying
// rows of painted flight feathers.

// The head: its radii (broad, a little wider than tall), the face laid over
// its front (size, centre height, and the oval of feathers), and the eyes.
const HEAD = new THREE.Vector3(0.36, 0.29, 0.29);
const FACE = { w: 0.66, h: 0.58, cy: -0.02, rx: 0.295, ry: 0.255, ry0: -0.02 };
const EYE = { x: 0.115, y: 0.035, r: 0.053 };

const gauss = (d2, width2) => Math.exp(-d2 / width2);
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// How far forward the face surface sits at (x, y) on the head: the front of
// the head, hollowed into a shallow dish round each eye, soft level brows,
// a gentle ridge down to the beak, and full cheeks. A calm face.
function faceDepth(x, y) {
  const nx = x / HEAD.x;
  const ny = y / HEAD.y;
  let z = HEAD.z * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) + 0.014;
  for (const side of [-1, 1]) {
    const dx = x - side * EYE.x;
    const dy = y - EYE.y;
    z -= 0.03 * gauss(dx * dx + dy * dy, 0.007);
    const brow = segmentDistance(x, y, side * 0.2, EYE.y + 0.07, side * 0.05, EYE.y + 0.072);
    z += 0.012 * gauss(brow * brow, 0.0012);
  }
  z += 0.014 * gauss(x * x, 0.0018) * gauss((y + 0.015) ** 2, 0.008);
  z += 0.016 * gauss((y + 0.17) ** 2, 0.006) * gauss(x * x, 0.03);
  return z;
}

// Repeatable random numbers, so the owl looks the same every visit.
function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- painted feathers ----------

// One feather, base at the top of the image and rounded tip at the bottom:
// shaded at the base where it tucks under its neighbours, fine barbs, a pale
// shaft, a downy fringe, and (if asked) the snowy owl's dark speckles.
function paintFeather(ctx, w, h, rand, spots) {
  const half = (t) => 0.47 * w * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2));
  const vane = new Path2D();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = w / 2 - half(t);
    if (i === 0) vane.moveTo(x, t * h * 0.98);
    else vane.lineTo(x, t * h * 0.98);
  }
  for (let i = 40; i >= 0; i--) {
    const t = i / 40;
    vane.lineTo(w / 2 + half(t), t * h * 0.98);
  }
  vane.closePath();

  // downy fringe just outside the outline
  ctx.lineCap = "round";
  for (let i = 0; i < 320; i++) {
    const t = 0.05 + rand() * 0.93;
    const side = rand() < 0.5 ? -1 : 1;
    const x = w / 2 + side * half(t);
    const y = t * h * 0.98;
    ctx.strokeStyle = `rgba(246, 245, 240, ${0.45 + rand() * 0.5})`;
    ctx.lineWidth = Math.max(1, w / 70);
    ctx.beginPath();
    ctx.moveTo(x - side * 2, y);
    ctx.lineTo(x + side * (2 + rand() * w * 0.06), y + rand() * h * 0.04);
    ctx.stroke();
  }

  const fill = ctx.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, "#e2e0da");
  fill.addColorStop(0.3, "#f5f4f0");
  fill.addColorStop(1, "#fcfcfa");
  ctx.fillStyle = fill;
  ctx.fill(vane);

  ctx.save();
  ctx.clip(vane);
  // a little shading down each side, so neighbouring feathers separate
  const edge = ctx.createLinearGradient(0, 0, w, 0);
  edge.addColorStop(0, "rgba(150, 146, 138, 0.1)");
  edge.addColorStop(0.25, "rgba(150, 146, 138, 0)");
  edge.addColorStop(0.75, "rgba(150, 146, 138, 0)");
  edge.addColorStop(1, "rgba(150, 146, 138, 0.1)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  // barbs
  ctx.lineWidth = Math.max(0.6, w / 160);
  for (let y = 0; y < h; y += h / 150) {
    ctx.strokeStyle = `rgba(120, 116, 108, ${0.05 + rand() * 0.07})`;
    ctx.beginPath();
    ctx.moveTo(w / 2, y);
    ctx.lineTo(0, y + h * 0.07);
    ctx.moveTo(w / 2, y);
    ctx.lineTo(w, y + h * 0.07);
    ctx.stroke();
  }
  // dark speckles near the tip
  if (spots) {
    ctx.filter = "blur(0.6px)";
    for (let i = 0; i < spots; i++) {
      const t = 0.55 + rand() * 0.35;
      const x = w / 2 + (rand() - 0.5) * half(t) * 1.4;
      ctx.fillStyle = `rgba(48, 40, 34, ${0.6 + rand() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(x, t * h, w * (0.035 + rand() * 0.035), h * (0.012 + rand() * 0.012) * (128 / h) * (h / 128), (rand() - 0.5) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(208, 204, 196, 0.8)";
  ctx.lineWidth = Math.max(1, w / 60);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h * 0.88);
  ctx.stroke();
}

// The eye, painted for a sphere whose top pole faces forward: a big black
// pupil, a streaked amber iris and a dark outer ring.
function irisTexture() {
  return texture(256, 128, (ctx, w, h) => {
    const rand = random(9);
    const vAt = (v) => (1 - v) * h;
    ctx.fillStyle = "#120c06";
    ctx.fillRect(0, 0, w, h);
    const iris = ctx.createLinearGradient(0, vAt(0.785), 0, vAt(0.905));
    iris.addColorStop(0, "#c46f00");
    iris.addColorStop(0.3, "#f2a90c");
    iris.addColorStop(0.75, "#fbc832");
    iris.addColorStop(1, "#e89600");
    ctx.fillStyle = iris;
    ctx.fillRect(0, vAt(0.905), w, vAt(0.785) - vAt(0.905));
    for (let i = 0; i < 200; i++) {
      const x = rand() * w;
      ctx.strokeStyle = `rgba(${rand() < 0.55 ? "110, 50, 0" : "255, 225, 110"}, ${0.12 + rand() * 0.25})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, vAt(0.79));
      ctx.lineTo(x + (rand() - 0.5) * 4, vAt(0.9));
      ctx.stroke();
    }
    ctx.fillStyle = "#2e1500";
    ctx.fillRect(0, vAt(0.8), w, vAt(0.78) - vAt(0.8));
    ctx.fillStyle = "#030202";
    ctx.fillRect(0, 0, w, vAt(0.9));
  });
}

// The face, painted to fit the sculpted face surface (see faceDepth): fine
// white feathers radiating from each eye, the brows sweeping down into a V,
// grey bristles over the beak, and a soft feathered edge where the face meets
// the rest of the head. Transparent outside the face.
function faceTexture(face, eyeX, eyeY) {
  const W = 512;
  const H = Math.round((512 * face.h) / face.w);
  return texture(W, H, (ctx) => {
    const rand = random(21);
    const px = (x) => ((x + face.w / 2) / face.w) * W;
    const py = (y) => (1 - (y - face.cy + face.h / 2) / face.h) * H;
    const scale = W / face.w; // pixels per unit
    const cx = px(0);
    const cy = py(face.ry0);
    const rx = face.rx * scale;
    const ry = face.ry * scale;

    // soft fringe around the edge, then the face itself
    ctx.lineCap = "round";
    for (let i = 0; i < 900; i++) {
      const a = rand() * Math.PI * 2;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      ctx.strokeStyle = `rgba(244, 243, 238, ${0.5 + rand() * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
      ctx.lineTo(x + Math.cos(a) * (4 + rand() * 14), y + Math.sin(a) * (4 + rand() * 14) + 4);
      ctx.stroke();
    }
    ctx.fillStyle = "#f6f5f1";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 12, ry + 12, 0, 0, Math.PI * 2);
    ctx.clip();
    // feathers radiating from each eye, slightly curved
    for (const side of [-1, 1]) {
      const ex = px(side * eyeX);
      const ey = py(eyeY);
      for (let i = 0; i < 520; i++) {
        const a = rand() * Math.PI * 2;
        const r0 = 0.052 * scale + rand() * 6;
        const r1 = r0 + (0.04 + rand() * 0.13) * scale;
        const bend = (rand() - 0.5) * 0.25;
        ctx.strokeStyle = `rgba(140, 136, 128, ${0.03 + rand() * 0.06})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0);
        ctx.quadraticCurveTo(
          ex + Math.cos(a + bend) * (r0 + r1) / 2, ey + Math.sin(a + bend) * (r0 + r1) / 2,
          ex + Math.cos(a) * r1, ey + Math.sin(a) * r1
        );
        ctx.stroke();
      }
      // a faint grey hollow around the eye
      const hollow = ctx.createRadialGradient(ex, ey, 0.045 * scale, ex, ey, 0.09 * scale);
      hollow.addColorStop(0, "rgba(110, 106, 100, 0.35)");
      hollow.addColorStop(1, "rgba(110, 106, 100, 0)");
      ctx.fillStyle = hollow;
      ctx.fillRect(0, 0, W, H);
      // soft brow feathers lying level above the eye
      for (let i = 0; i < 70; i++) {
        const t = rand();
        const x = px(side * (0.2 - 0.15 * t)) + (rand() - 0.5) * 6;
        const y = py(eyeY + 0.075) + (rand() - 0.5) * 10;
        ctx.strokeStyle = `rgba(130, 126, 118, ${0.06 + rand() * 0.1})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + side * (8 + rand() * 10), y + 2 + rand() * 3);
        ctx.stroke();
      }
    }
    // grey bristles fanning down over the beak
    const bx = px(0);
    const by = py(-0.035);
    for (let i = 0; i < 140; i++) {
      const a = Math.PI / 2 + (rand() - 0.5) * 1.6;
      const r = (0.02 + rand() * 0.07) * scale;
      ctx.strokeStyle = `rgba(90, 86, 80, ${0.15 + rand() * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(bx + (rand() - 0.5) * 10, by - 0.04 * scale);
      ctx.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  });
}

// ---------- shapes ----------

// A feather card: a unit plane hanging down (-y) from its base at the
// origin, curving away towards the tip and cupped slightly across.
function cardGeometry(curl = 0.14, cup = 0.1) {
  const geo = new THREE.PlaneGeometry(1, 1, 2, 5);
  geo.translate(0, -0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getY(i);
    const x = pos.getX(i);
    pos.setZ(i, -curl * t * t - cup * x * x);
  }
  geo.computeVertexNormals();
  return geo;
}

const tmp = {
  x: new THREE.Vector3(),
  y: new THREE.Vector3(),
  z: new THREE.Vector3(),
  axis: new THREE.Vector3(1, 0, 0),
  m: new THREE.Matrix4(),
  q: new THREE.Quaternion(),
  lift: new THREE.Quaternion(),
  p: new THREE.Vector3(),
  s: new THREE.Vector3(),
  c: new THREE.Color(),
};

// Lays feather cards over a surface. Each sample gives a point, its outward
// normal, the direction the feather should point along the surface, its size
// and whether it is speckled. Plain and speckled cards are two instanced
// meshes (one draw call each).
function coat(parent, samples, plainMat, spotMat, geometry, rand) {
  const groups = [samples.filter((s) => !s.spotted), samples.filter((s) => s.spotted)];
  [plainMat, spotMat].forEach((mat, gi) => {
    const list = groups[gi];
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(geometry, mat, list.length);
    list.forEach((s, i) => {
      const z = tmp.z.copy(s.normal).normalize();
      const back = tmp.y.copy(s.dir).addScaledVector(z, -s.dir.dot(z));
      if (back.lengthSq() < 1e-6) back.set(0, 0, -1);
      back.normalize().negate(); // local +y points back towards the base
      const x = tmp.x.crossVectors(back, z).normalize();
      tmp.y.crossVectors(z, x);
      tmp.m.makeBasis(x, tmp.y, z);
      tmp.q.setFromRotationMatrix(tmp.m);
      tmp.lift.setFromAxisAngle(tmp.axis, -(s.lift ?? 0.22 + rand() * 0.2));
      tmp.q.multiply(tmp.lift);
      tmp.p.copy(s.position).addScaledVector(z, 0.004);
      tmp.s.set(s.width, s.length, 1);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      inst.setMatrixAt(i, tmp.m);
      inst.setColorAt(i, tmp.c.setRGB(0.93 + rand() * 0.07, 0.93 + rand() * 0.07, 0.9 + rand() * 0.08));
    });
    parent.add(inst);
  });
}

// Builds the owl. Returns { root, animate, ruffle, hoot, dispose }:
// animate(dt, { flapRate, glide, fold, headYaw, headPitch }) poses her for one frame
// (flapRate in beats per second; glide and fold from 0 to 1; headYaw in
// radians, or leave it out to let her look around on her own) and returns the
// wingbeat phase. ruffle() and hoot() play short gestures.
export function createOwlModel({ reduceMotion = false } = {}) {
  // ---------- materials ----------

  const rand = random(7);
  const tex = {
    card: texture(128, 128, (ctx, w, h) => paintFeather(ctx, w, h, rand, 0)),
    cardSpot: texture(128, 128, (ctx, w, h) => paintFeather(ctx, w, h, rand, 3)),
    flight: texture(96, 384, (ctx, w, h) => paintFeather(ctx, w, h, rand, 0)),
    flightSpot: texture(96, 384, (ctx, w, h) => paintFeather(ctx, w, h, rand, 6)),
    iris: irisTexture(),
    face: faceTexture(FACE, EYE.x, EYE.y),
  };
  const featherMat = (map) =>
    new THREE.MeshPhysicalMaterial({
      map,
      alphaTest: 0.5,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 0.82,
      sheen: 0.7,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
    });
  const mats = {
    card: featherMat(tex.card),
    cardSpot: featherMat(tex.cardSpot),
    flight: featherMat(tex.flight),
    flightSpot: featherMat(tex.flightSpot),
    // under the feathers: soft grey, so gaps read as depth, not holes
    under: new THREE.MeshStandardMaterial({ color: 0xcfccc6, roughness: 0.95 }),
    face: new THREE.MeshPhysicalMaterial({
      map: tex.face,
      alphaTest: 0.5,
      alphaToCoverage: true,
      roughness: 0.85,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xffffff),
    }),
    lid: new THREE.MeshPhysicalMaterial({ color: 0xf1f0ec, roughness: 0.9, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
    eye: new THREE.MeshPhysicalMaterial({ map: tex.iris, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
    dark: new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.3, clearcoat: 0.6 }),
    beak: new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.4 }),
  };
  const geos = { card: cardGeometry(), flat: cardGeometry(0.08, 0.06) };

  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // ---------- body ----------

  const root = new THREE.Group();
  const owl = new THREE.Group();
  root.add(owl);
  const body = new THREE.Group();
  owl.add(body);

  const PROFILE = [
    [0.0, 0.2], [0.16, 0.21], [0.27, 0.27], [0.355, 0.38], [0.39, 0.52],
    [0.385, 0.66], [0.37, 0.8], [0.355, 0.9], [0.33, 0.98], [0.27, 1.05], [0.0, 1.09],
  ];
  const DEPTH = 0.86; // the body is a little flatter front to back
  const torso = mesh(
    new THREE.LatheGeometry(PROFILE.map(([x, y]) => new THREE.Vector2(x, y)), 48),
    mats.under,
    body
  );
  torso.scale.set(1, 1, DEPTH);

  const radiusAt = (y) => {
    for (let i = 0; i < PROFILE.length - 1; i++) {
      const [r0, y0] = PROFILE[i];
      const [r1, y1] = PROFILE[i + 1];
      if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
    return 0;
  };

  // Shingles of feathers over the body, pointing down; speckled mostly on
  // the back, only a few on the chest.
  const bodySamples = [];
  for (let y = 1.06; y > 0.24; y -= 0.05) {
    const r = radiusAt(y);
    const slope = (radiusAt(y + 0.01) - radiusAt(y - 0.01)) / 0.02;
    const count = Math.max(6, Math.round((2 * Math.PI * r) / 0.05));
    const offset = rand() * Math.PI;
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.08;
      const s = Math.sin(a);
      const c = Math.cos(a);
      const onBack = c < -0.2;
      // Skip feathers that would poke through the face (the head sits at
      // y 1.02, z 0.03 in the body). Below the chin, where the face tucks
      // behind the chest, they stay, so the chest blends up into the face.
      const hx = r * s;
      const hy = y - 1.02;
      const inFace = c > 0.2 && Math.hypot(hx / FACE.rx, (hy - FACE.ry0) / FACE.ry) < 1.05;
      if (inFace && faceDepth(hx, hy) + 0.03 > r * c * DEPTH - 0.01) continue;
      bodySamples.push({
        position: new THREE.Vector3(r * s, y + (rand() - 0.5) * 0.015, r * c * DEPTH),
        normal: new THREE.Vector3(s, -slope, c / DEPTH),
        dir: new THREE.Vector3(0, -1, 0),
        width: 0.09 + rand() * 0.04,
        length: 0.12 + rand() * 0.06,
        spotted: rand() < (onBack ? 0.35 : y > 0.75 ? 0.1 : 0.04),
      });
    }
  }
  coat(body, bodySamples, mats.card, mats.cardSpot, geos.card, rand);

  // Tail feathers fanned out behind and below.
  for (let i = 0; i < 7; i++) {
    const f = mesh(geos.flat, i % 3 === 1 ? mats.flightSpot : mats.flight, body, (i - 3) * 0.035, 0.3, -0.22);
    f.scale.set(0.12, 0.38, 1);
    f.rotation.set(-0.5, 0, (i - 3) * 0.12);
  }

  // ---------- head ----------

  const head = new THREE.Group();
  head.position.set(0, 1.02, 0.03);
  body.add(head);
  // a broad round head, flatter on the crown
  const skullGeo = new THREE.SphereGeometry(1, 48, 32);
  {
    const pos = skullGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) pos.setY(i, y * (1 - 0.12 * y));
    }
    skullGeo.computeVertexNormals();
  }
  const skull = mesh(skullGeo, mats.under, head);
  skull.scale.copy(HEAD);

  const onFace = (p) => p.z > 0.1 && Math.hypot(p.x / (FACE.rx - 0.01), (p.y - FACE.ry0) / (FACE.ry - 0.01)) < 1;
  const headSamples = [];
  for (let lat = 0.1; lat < 2.2; lat += 0.11) {
    const ring = Math.sin(lat);
    const count = Math.max(5, Math.round((2 * Math.PI * ring * 0.34) / 0.045));
    const offset = rand() * Math.PI;
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      const unit = new THREE.Vector3(ring * Math.sin(a), Math.cos(lat), ring * Math.cos(a));
      const p = unit.clone().multiply(HEAD);
      if (p.y > 0) p.y *= 1 - 0.12 * unit.y;
      if (onFace(p)) continue;
      headSamples.push({
        position: p,
        normal: new THREE.Vector3(unit.x / HEAD.x, unit.y / HEAD.y, unit.z / HEAD.z),
        dir: new THREE.Vector3(0, -1, -0.35),
        width: 0.085 + rand() * 0.035,
        length: 0.11 + rand() * 0.05,
        spotted: rand() < (unit.y > 0.55 ? 0.3 : 0.06),
      });
    }
  }
  coat(head, headSamples, mats.card, mats.cardSpot, geos.card, rand);

  // The face: a sculpted surface over the front of the head (see faceDepth).
  const faceGeo = new THREE.PlaneGeometry(FACE.w, FACE.h, 96, 84);
  faceGeo.translate(0, FACE.cy, 0);
  {
    const pos = faceGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, faceDepth(pos.getX(i), pos.getY(i)));
    faceGeo.computeVertexNormals();
  }
  mesh(faceGeo, mats.face, head);

  // Chin feathers: they start on the lower face and hang down over the chest,
  // so the face flows into the body instead of ending at a line.
  const chin = [];
  for (let y = -0.1; y > -0.26; y -= 0.035) {
    for (let x = -0.24; x <= 0.24; x += 0.04) {
      const jx = x + (rand() - 0.5) * 0.02;
      const jy = y + (rand() - 0.5) * 0.015;
      if (Math.hypot(jx / FACE.rx, (jy - FACE.ry0) / FACE.ry) > 0.97) continue;
      chin.push({
        position: new THREE.Vector3(jx, jy, faceDepth(jx, jy)),
        normal: new THREE.Vector3(jx * 1.5, 0.15, 1),
        dir: new THREE.Vector3(jx * 0.5, -1, -0.15),
        width: 0.07 + rand() * 0.03,
        length: 0.12 + rand() * 0.06 + (-0.1 - y) * 0.4,
        lift: 0.04 + rand() * 0.06,
        spotted: false,
      });
    }
  }
  coat(head, chin, mats.card, mats.cardSpot, geos.card, rand);

  // Eyes set in the face, the lids resting just over the top of the iris for
  // a calm, gentle look.
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * EYE.x, EYE.y, faceDepth(side * EYE.x, EYE.y) - 0.024);
    head.add(eye);
    const ball = mesh(new THREE.SphereGeometry(EYE.r, 40, 24), mats.eye, eye);
    ball.rotation.x = Math.PI / 2; // painted pole faces forward
    // thin black rim where the eye meets the feathers
    mesh(new THREE.TorusGeometry(Math.sqrt(EYE.r ** 2 - 0.028 ** 2), 0.0045, 8, 40), mats.dark, eye, 0, 0, 0.028);
    // the upper lid: a feathered cap over the top of the eye, level
    const lid = mesh(new THREE.SphereGeometry(EYE.r * 1.06, 32, 12, 0, Math.PI * 2, 0, 0.95), mats.lid, eye);
    lid.rotation.set(0.27, 0, side * 0.04);
    eyes.push(eye);
  }

  // A small hooked beak, mostly hidden in bristly feathers.
  const beakGeo = new THREE.ConeGeometry(0.026, 0.075, 16, 6);
  {
    const pos = beakGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = 0.5 + pos.getY(i) / 0.075; // 0 at the base, 1 at the tip
      pos.setZ(i, pos.getZ(i) + 0.02 * t * t); // hooks back towards the face
    }
    beakGeo.computeVertexNormals();
  }
  const beak = mesh(beakGeo, mats.beak, head, 0, -0.045, faceDepth(0, -0.03) - 0.008);
  beak.rotation.x = Math.PI - 0.35;
  const bristles = [];
  for (let i = 0; i < 14; i++) {
    const x = (rand() - 0.5) * 0.07;
    const y = -0.005 + rand() * 0.03;
    bristles.push({
      position: new THREE.Vector3(x, y, faceDepth(x, y)),
      normal: new THREE.Vector3(x * 4, 0.3, 1),
      dir: new THREE.Vector3(x * 2, -1, 0.2),
      width: 0.035,
      length: 0.05 + rand() * 0.02,
      spotted: false,
    });
  }
  coat(head, bristles, mats.card, mats.cardSpot, geos.card, rand);

  // ---------- legs and talons ----------

  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.08, 0.15, 6, 12), mats.under, owl, side * 0.1, 0.17, 0.02);
    leg.rotation.z = side * -0.12;
    // thick, fluffy feathered legs
    const legSamples = [];
    for (let y = 0.13; y > -0.12; y -= 0.045) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + y * 3;
        legSamples.push({
          position: new THREE.Vector3(Math.sin(a) * 0.085, y, Math.cos(a) * 0.085),
          normal: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)),
          dir: new THREE.Vector3(0, -1, 0),
          width: 0.07,
          length: 0.09 + rand() * 0.03,
          spotted: false,
        });
      }
    }
    coat(leg, legSamples, mats.card, mats.cardSpot, geos.card, rand);

    const foot = new THREE.Group();
    foot.position.set(side * 0.09, 0.035, 0.02);
    owl.add(foot);
    // three toes forward over the paper's edge, one behind
    [-0.45, 0, 0.45, Math.PI].forEach((angle, i) => {
      const toe = new THREE.Group();
      toe.rotation.y = angle * (i === 3 ? 1 : 0.7);
      foot.add(toe);
      const knuckle = mesh(new THREE.CapsuleGeometry(0.03, 0.05, 4, 8), mats.under, toe, 0, 0, 0.04);
      knuckle.rotation.x = Math.PI / 2;
      const claw = mesh(new THREE.TorusGeometry(0.042, 0.013, 6, 12, Math.PI * 0.75), mats.dark, toe, 0, -0.035, 0.08);
      claw.rotation.set(0, Math.PI / 2, Math.PI / 2);
    });
  }

  // ---------- wings ----------

  // Feathers along a bone, hanging down and fanned between two angles.
  function featherRow(parent, { count, from, to, width, length, angleFrom, angleTo, z = 0, lengthTo = length, spots = 0.25 }) {
    const row = [];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const f = mesh(geos.card, rand() < spots ? mats.flightSpot : mats.flight, parent, THREE.MathUtils.lerp(from, to, t), 0, z + i * 0.002);
      f.scale.set(width * (0.9 + rand() * 0.2), THREE.MathUtils.lerp(length, lengthTo, t) * (0.93 + rand() * 0.14), 1);
      f.rotation.set((rand() - 0.5) * 0.12, (rand() - 0.5) * 0.15, THREE.MathUtils.lerp(angleFrom, angleTo, t) + (rand() - 0.5) * 0.06);
      row.push({ mesh: f, t, base: f.rotation.z + 1.02 * t * 0.75 });
    }
    return row;
  }

  function buildWing(side) {
    const mirror = new THREE.Group();
    mirror.scale.x = side;
    body.add(mirror);

    // Long wings, as a snowy owl's are: about three times its body length
    // from tip to tip.
    const shoulder = new THREE.Group();
    shoulder.position.set(0.25, 0.8, -0.04);
    mirror.add(shoulder);
    const arm = mesh(new THREE.CapsuleGeometry(0.065, 0.46, 6, 12), mats.under, shoulder, 0.28, 0, 0);
    arm.rotation.z = Math.PI / 2;
    featherRow(shoulder, { count: 8, from: 0.04, to: 0.56, width: 0.2, length: 0.6, angleFrom: 0.15, angleTo: 0.05, spots: 0.2 });
    featherRow(shoulder, { count: 8, from: 0.03, to: 0.56, width: 0.18, length: 0.3, angleFrom: 0.1, angleTo: 0, z: 0.03, spots: 0.35 });
    featherRow(shoulder, { count: 9, from: 0.0, to: 0.58, width: 0.15, length: 0.14, angleFrom: 0.05, angleTo: 0, z: 0.07, spots: 0.3 });

    const elbow = new THREE.Group();
    elbow.position.set(0.56, 0, 0);
    shoulder.add(elbow);
    const forearm = mesh(new THREE.CapsuleGeometry(0.055, 0.56, 6, 12), mats.under, elbow, 0.32, 0, 0);
    forearm.rotation.z = Math.PI / 2;
    featherRow(elbow, { count: 13, from: 0.0, to: 0.64, width: 0.2, length: 0.66, angleFrom: 0.05, angleTo: -0.14, spots: 0.25 });
    featherRow(elbow, { count: 10, from: 0.0, to: 0.62, width: 0.17, length: 0.3, angleFrom: 0.0, angleTo: -0.1, z: 0.03, spots: 0.4 });
    featherRow(elbow, { count: 10, from: 0.0, to: 0.64, width: 0.14, length: 0.13, angleFrom: 0.0, angleTo: -0.05, z: 0.07, spots: 0.3 });

    const wrist = new THREE.Group();
    wrist.position.set(0.64, 0, 0);
    elbow.add(wrist);
    const hand = mesh(new THREE.CapsuleGeometry(0.045, 0.36, 6, 12), mats.under, wrist, 0.2, 0, 0);
    hand.rotation.z = Math.PI / 2;
    const primaries = featherRow(wrist, {
      count: 11, from: 0.0, to: 0.4, width: 0.17, length: 0.78, lengthTo: 1.0, angleFrom: -0.18, angleTo: -1.2, spots: 0.45,
    });
    featherRow(wrist, { count: 7, from: 0.0, to: 0.38, width: 0.15, length: 0.28, angleFrom: -0.2, angleTo: -0.85, z: 0.03, spots: 0.4 });
    featherRow(wrist, { count: 6, from: 0.0, to: 0.4, width: 0.12, length: 0.12, angleFrom: -0.1, angleTo: -0.5, z: 0.07, spots: 0.3 });

    return { side, mirror, shoulder, elbow, wrist, primaries };
  }

  const wings = [buildWing(1), buildWing(-1)];

  // Folded wings, for perching: a feathered shape along each side of the
  // body, with the long flight feathers crossing down over the tail. The
  // open wings shrink into these as she folds them.
  function buildFoldedWing(side) {
    const group = new THREE.Group();
    group.position.set(side * 0.3, 0.6, -0.07);
    group.rotation.set(0.12, side * -0.14, side * 0.07);
    body.add(group);
    const mirror = new THREE.Group();
    mirror.scale.x = side;
    group.add(mirror);
    const R = new THREE.Vector3(0.11, 0.38, 0.27);
    mesh(new THREE.SphereGeometry(1, 24, 16), mats.under, mirror).scale.copy(R);
    const samples = [];
    for (let v = 0.92; v > -0.95; v -= 0.13) {
      for (let u = -1.4; u <= 1.4; u += 0.22) {
        const ring = Math.sqrt(1 - v * v);
        const unit = new THREE.Vector3(Math.cos(u) * ring, v, Math.sin(u) * ring);
        samples.push({
          position: unit.clone().multiply(R),
          normal: new THREE.Vector3(unit.x / R.x, unit.y / R.y, unit.z / R.z),
          dir: new THREE.Vector3(0, -1, -0.5),
          width: 0.1 + rand() * 0.03,
          length: 0.15 + rand() * 0.06,
          spotted: rand() < 0.4,
        });
      }
    }
    coat(mirror, samples, mats.card, mats.cardSpot, geos.card, rand);
    for (let i = 0; i < 6; i++) {
      const f = mesh(geos.card, rand() < 0.45 ? mats.flightSpot : mats.flight, mirror, 0.02 + i * 0.012, -0.22, -0.14 - i * 0.02);
      f.scale.set(0.15, 0.55 + i * 0.03, 1);
      f.rotation.set(-0.45, 0.25, -0.12 + i * 0.03);
    }
    group.visible = false;
    return group;
  }
  const foldedWings = [buildFoldedWing(1), buildFoldedWing(-1)];

  // ---------- motion ----------

  const lerp = THREE.MathUtils.lerp;
  const smoothstep = THREE.MathUtils.smoothstep;
  // the open wings' joints when tucked away
  const TUCK = { shoulder: [0, 0.9, -1.25], elbow: [0, 1.5, 0.1], wrist: [0, 1.7, -0.3] };
  const state = { flapRate: 2.1, glide: 0, fold: 0, headYaw: 0, headPitch: 0 };
  let flap = 0;
  let time = 0;
  let blinkAt = 2.5;
  let ruffleLeft = 0;
  let hootLeft = 0;

  function animate(dt, target = {}) {
    time += dt;
    const ease = 1 - Math.exp(-dt * 5);
    state.flapRate += ((target.flapRate ?? 2.1) - state.flapRate) * ease;
    state.glide += ((target.glide ?? 0) - state.glide) * ease;
    state.fold += ((target.fold ?? 0) - state.fold) * (1 - Math.exp(-dt * 6));
    const f = state.fold;
    if (!reduceMotion) flap += dt * state.flapRate * Math.PI * 2 * (1 - 0.9 * f);
    const phase = reduceMotion ? 0.6 : flap;

    const beat = (1 - state.glide) * (1 - f); // how much the wings are beating
    const up = Math.cos(phase); // +1 top of the beat, -1 bottom
    const down = Math.max(0, Math.sin(phase)); // pushing down
    const recover = Math.max(0, -Math.sin(phase)); // coming back up

    for (const w of wings) {
      w.shoulder.rotation.set(
        0,
        lerp(-0.35 * Math.sin(phase) * beat, TUCK.shoulder[1], f),
        lerp(0.28 * (1 - state.glide) + 0.12 * state.glide + 0.72 * up * beat, TUCK.shoulder[2], f)
      );
      w.elbow.rotation.set(0, lerp(0.45 * recover * beat, TUCK.elbow[1], f), lerp(0.18 * Math.cos(phase - 0.7) * beat, TUCK.elbow[2], f));
      w.wrist.rotation.set(
        0,
        lerp(0.6 * recover * beat, TUCK.wrist[1], f),
        lerp((0.28 * Math.cos(phase - 1.3) - 0.1) * beat - 0.05 * state.glide, TUCK.wrist[2], f)
      );
      // primaries spread like fingers on the downstroke and when gliding
      const spread = lerp(lerp(0.6 + 0.3 * down, 0.9, state.glide), 0.35, f);
      for (const p of w.primaries) p.mesh.rotation.z = p.base - 1.02 * p.t * (spread - 0.75);
      const shrink = 1 - 0.75 * f;
      w.mirror.scale.set(w.side * shrink, shrink, shrink);
      w.mirror.visible = f < 0.97;
    }

    // a quick shake of the feathers
    let shake = 0;
    if (ruffleLeft > 0) {
      ruffleLeft = Math.max(0, ruffleLeft - dt);
      shake = Math.sin(Math.PI * (1 - ruffleLeft / 0.9));
    }
    const tucked = smoothstep(f, 0.35, 1);
    for (const g of foldedWings) {
      g.visible = tucked > 0.01;
      g.scale.set(tucked * (1 + 0.25 * shake * Math.abs(Math.sin(time * 19))), tucked, tucked);
    }
    // a little puff when she shakes, and a slow, gentle breath
    const puff = 1 + 0.04 * shake;
    owl.scale.set(puff, puff * (1 + (reduceMotion ? 0 : 0.012 * Math.sin(time * 1.7))), puff);

    // a soft hoot: two little bows of the head
    let nod = 0;
    if (hootLeft > 0) {
      hootLeft = Math.max(0, hootLeft - dt);
      nod = Math.sin(Math.PI * 2 * (1 - hootLeft / 1.2)) ** 2;
    }

    // The body rocks a little with each beat; the head stays steady, as owls' do.
    body.rotation.set(0.06 * Math.sin(phase + 0.5) * beat, 0, Math.sin(time * 38) * 0.05 * shake);
    const wander = reduceMotion ? 0 : 0.22 * Math.sin(time * 0.37) * Math.sin(time * 0.11 + 1);
    const yaw = Math.max(-1.7, Math.min(1.7, target.headYaw ?? wander));
    state.headYaw += (yaw - state.headYaw) * (1 - Math.exp(-dt * 3));
    // headPitch tips the head back up when her body leans forward in flight
    state.headPitch += ((target.headPitch ?? 0) - state.headPitch) * ease;
    head.rotation.set(-body.rotation.x + 0.06 + 0.22 * nod + state.headPitch, state.headYaw, 0);

    if (time > blinkAt) {
      const k = (time - blinkAt) / 0.16;
      const closed = k < 1 ? Math.sin(Math.PI * k) : 0;
      for (const eye of eyes) eye.scale.y = 1 - 0.9 * closed;
      if (k >= 1) blinkAt = time + 2.5 + Math.random() * 4;
    }
    return phase;
  }

  function dispose() {
    root.traverse((obj) => {
      if (obj.isInstancedMesh) obj.dispose();
      else obj.geometry?.dispose();
    });
    Object.values(geos).forEach((g) => g.dispose());
    Object.values(mats).forEach((m) => m.dispose());
    Object.values(tex).forEach((t) => t.dispose());
  }

  return {
    root,
    animate,
    ruffle: () => {
      ruffleLeft = 0.9;
    },
    hoot: () => {
      hootLeft = 1.2;
    },
    dispose,
  };
}
