import * as THREE from "three";

// A long white writing quill and its ink bottle, built in detail: a gently
// curved, translucent shaft with an ink-stained nib, two uneven vanes of fine
// barbs (with a few natural splits) that taper to the tip, and soft down at
// the base. The quill's origin is the tip of its nib; it points along +y.

function canvasTexture(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The feather's vane, drawn in its own (u, v) space: u runs up the shaft
// (left to right), v out from the shaft to the edge (bottom to top). Barbs
// are fine lines sweeping towards the tip; a few splits break the edge.
function vaneTexture(seed) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return canvasTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    // soft base colour: creamy at the shaft, white at the edge
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, "#efe6d2");
    grad.addColorStop(0.35, "#fbf7ee");
    grad.addColorStop(1, "#ffffff");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // the barbs, each a fine line from the shaft out towards the tip
    for (let x = -h; x < w; x += 3) {
      g.strokeStyle = `rgba(${150 + rand() * 40},${140 + rand() * 40},${125 + rand() * 40},${0.18 + rand() * 0.22})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, h);
      g.quadraticCurveTo(x + h * 0.35, h * 0.45, x + h * 0.85, 0);
      g.stroke();
    }
    // a few soft grey bars across the feather
    for (let i = 0; i < 5; i++) {
      const x = w * (0.2 + i * 0.15 + rand() * 0.05);
      const bar = g.createLinearGradient(x - 30, 0, x + 30, 0);
      bar.addColorStop(0, "rgba(120,110,100,0)");
      bar.addColorStop(0.5, "rgba(120,110,100,0.08)");
      bar.addColorStop(1, "rgba(120,110,100,0)");
      g.fillStyle = bar;
      g.fillRect(x - 30, 0, 60, h);
    }
    // splits: thin gaps where barbs have parted, cut through the alpha
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 7; i++) {
      const x = w * (0.12 + rand() * 0.8);
      const depth = h * (0.25 + rand() * 0.45);
      g.lineWidth = 2 + rand() * 3;
      g.beginPath();
      g.moveTo(x + (h - depth) * 0.6, 0);
      g.quadraticCurveTo(x + depth * 0.2, depth * 0.5, x, depth);
      g.stroke();
    }
    // a soft, slightly ragged edge
    for (let x = 0; x < w; x += 2) {
      const r = rand();
      g.fillRect(x, 0, 2, 2 + r * r * 10);
    }
    g.globalCompositeOperation = "source-over";
  });
}

// downy fluff for the base of the feather
function downTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w;
      g.strokeStyle = `rgba(255,252,245,${0.25 + Math.random() * 0.4})`;
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x, h);
      g.bezierCurveTo(x + (Math.random() - 0.5) * 40, h * 0.6, x + (Math.random() - 0.5) * 60, h * 0.3, x + (Math.random() - 0.5) * 70, Math.random() * h * 0.3);
      g.stroke();
    }
  });
}

// One vane: a curved strip of feather on one side of the shaft.
// side: +1 or -1; width(u) gives its width up the shaft.
function vaneGeometry(curve, from, to, side, width, curl) {
  const U = 48;
  const V = 6;
  const pos = [];
  const uv = [];
  const index = [];
  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const across = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const t = from + (to - from) * u;
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tangent);
    across.crossVectors(tangent, Z).normalize().multiplyScalar(side);
    const w = width(u);
    for (let j = 0; j <= V; j++) {
      const v = j / V;
      // barbs sweep up towards the tip, and the vane curls back a little
      pos.push(
        p.x + across.x * w * v + tangent.x * w * v * 0.55,
        p.y + across.y * w * v + tangent.y * w * v * 0.55,
        p.z - curl * w * v * v,
      );
      uv.push(u, side > 0 ? v : v);
    }
  }
  for (let i = 0; i < U; i++)
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j;
      const b = a + V + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// a tube along a curve whose radius tapers from r0 to r1
function taperTube(curve, r0, r1) {
  const segs = 40;
  const radial = 10;
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const r = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildQuillModel() {
  const quill = new THREE.Group();
  const L = 0.31;
  // the shaft: a gentle bend towards the tip
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.0015, L * 0.35, 0),
    new THREE.Vector3(0.006, L * 0.7, -0.002),
    new THREE.Vector3(0.016, L, -0.006),
  ]);
  const horn = new THREE.MeshPhysicalMaterial({ color: 0xf2ead8, roughness: 0.3, transmission: 0.35, thickness: 0.002, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const shaft = new THREE.Mesh(taperTube(curve, 0.0024, 0.0005), horn);
  shaft.castShadow = true;
  quill.add(shaft);
  // the nib: cut to a point and stained with ink
  const ink = new THREE.MeshPhysicalMaterial({ color: 0x0c0e1a, roughness: 0.2, clearcoat: 1 });
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.0024, 0.016, 12, 1, true), ink);
  nib.rotation.x = Math.PI;
  nib.position.y = 0.006;
  nib.scale.z = 0.55; // flattened, like a cut quill
  quill.add(nib);
  const stain = new THREE.Mesh(new THREE.CylinderGeometry(0.00245, 0.00245, 0.03, 12, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x1a1c2c, roughness: 0.3, transparent: true, opacity: 0.55 }));
  stain.position.y = 0.025;
  quill.add(stain);

  // the vanes: a wide one and a narrow one, tapering to the tip
  const feather = new THREE.MeshPhysicalMaterial({ map: vaneTexture(7), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.65, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) });
  const feather2 = feather.clone();
  feather2.map = vaneTexture(19);
  const shape = (max) => (u) => max * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.7) * (1 - u * 0.25);
  const wide = new THREE.Mesh(vaneGeometry(curve, 0.32, 1, 1, shape(0.03), 0.25), feather);
  const narrow = new THREE.Mesh(vaneGeometry(curve, 0.34, 1, -1, shape(0.017), 0.2), feather2);
  wide.castShadow = narrow.castShadow = true;
  quill.add(wide, narrow);
  // soft down at the base of the vanes
  const down = new THREE.MeshStandardMaterial({ map: downTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 });
  for (const side of [1, -1]) {
    const fluff = new THREE.Mesh(vaneGeometry(curve, 0.24, 0.38, side, (u) => 0.02 * Math.sin(Math.PI * u), 0.4), down);
    quill.add(fluff);
  }
  return quill;
}

// A squat glass ink bottle with dark ink inside and a brass collar.
// Origin at the bottom; it's about 7 cm tall.
export function buildInkBottle(brass) {
  const bottle = new THREE.Group();
  const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb4c8, roughness: 0.05, transmission: 1, thickness: 0.008, ior: 1.5, clearcoat: 1 });
  const profile = [[0.0001, 0], [0.034, 0.001], [0.038, 0.006], [0.038, 0.034], [0.03, 0.046], [0.016, 0.052], [0.014, 0.062], [0.017, 0.064], [0.017, 0.07], [0.0145, 0.07]];
  bottle.add(new THREE.Mesh(lathe(profile), glass));
  const inkMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0d1c, roughness: 0.12, clearcoat: 1 });
  const ink = new THREE.Mesh(lathe([[0.0001, 0.003], [0.033, 0.004], [0.035, 0.008], [0.035, 0.03], [0.0001, 0.03]]), inkMat);
  bottle.add(ink);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 32, 1, true), brass);
  collar.position.y = 0.066;
  bottle.add(collar);
  bottle.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return bottle;
}
