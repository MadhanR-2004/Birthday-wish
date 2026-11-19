import * as THREE from "three";
import { EYES, MOUTH, sculptMandrake } from "./mandrakeShape.js";

// The mandrake as a three.js model: its sculpted body and arms (shaped in
// mandrakeShape.js, off the main thread), beady eyes, a singing mouth and
// straggly root hairs.

// thin root hairs, as tapering tubes
function hair(points, r0, r1) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const segs = 16;
  const radial = 6;
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const ctr = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, ctr);
    const r = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(ctr).multiplyScalar(r).add(ctr);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

const geometryOf = (m) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(m.color, 3));
  geo.setIndex(new THREE.BufferAttribute(m.index, 1));
  return geo;
};

// Sculpts the mandrake in a background worker (or here, if workers aren't
// available) and resolves with the built model, see buildMandrakeModel.
export function loadMandrake() {
  return new Promise((resolve) => {
    const here = () => resolve(buildMandrakeModel(sculptMandrake()));
    try {
      const worker = new Worker(new URL("./mandrakeWorker.js", import.meta.url), { type: "module" });
      worker.onmessage = (e) => {
        worker.terminate();
        resolve(buildMandrakeModel(e.data));
      };
      worker.onerror = () => {
        worker.terminate();
        here();
      };
    } catch {
      here();
    }
  });
}

// Builds the mandrake from its sculpted meshes. Returns { group, arms:
// [right, left], mouth } where mouth.open(0..1) opens its singing mouth.
export function buildMandrakeModel(meshes) {
  const skin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.92, sheen: 0.25, sheenRoughness: 0.9, sheenColor: new THREE.Color(0xc8b090) });
  const group = new THREE.Group();

  const bodyGeo = geometryOf(meshes.body);
  const body = new THREE.Mesh(bodyGeo, skin);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const armGeo = geometryOf(meshes.arm);
  const arms = [1, -1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.034, 0.046, 0.004);
    pivot.scale.x = s; // the left arm is the right one, mirrored
    const arm = new THREE.Mesh(armGeo, skin);
    arm.castShadow = arm.receiveShadow = true;
    pivot.add(arm);
    group.add(pivot);
    return pivot;
  });

  // small, beady eyes glinting deep in their sockets
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x120a06, roughness: 0.15, clearcoat: 1 });
  for (const [ex, ey, ez] of EYES) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 16, 12), eyeMat);
    eye.position.set(ex, ey, ez - 0.002);
    group.add(eye);
  }

  // the mouth: gnarled lips round a dark opening, set in the mouth hollow
  const lipsMat = new THREE.MeshPhysicalMaterial({ color: 0x5e3e26, roughness: 0.85 });
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(MOUTH[0], MOUTH[1], MOUTH[2]);
  mouthGroup.rotation.x = -0.05;
  group.add(mouthGroup);
  const inside = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: 0x2a0d08, roughness: 0.6 }));
  inside.scale.set(0.0145, 0.009, 0.006);
  mouthGroup.add(inside);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshPhysicalMaterial({ color: 0xc0505a, roughness: 0.45 }));
  tongue.position.set(0, -0.006, 0.001);
  tongue.scale.set(0.008, 0.0035, 0.003);
  mouthGroup.add(tongue);
  const lips = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.003, 12, 48), lipsMat);
  lips.position.z = 0.002;
  lips.scale.y = 0.6;
  mouthGroup.add(lips);

  // root hairs from the feet and bottom
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5e4228, roughness: 0.95 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = 0.02 + (i % 3) * 0.008;
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r * 0.8;
    const m = new THREE.Mesh(
      hair([
        [sx, -0.06, sz],
        [sx * 1.6, -0.1, sz * 1.6],
        [sx * 2.2 + Math.sin(i) * 0.01, -0.13, sz * 2.2],
        [sx * 2.6 + Math.cos(i) * 0.015, -0.16 - (i % 4) * 0.01, sz * 2.6],
      ], 0.0022, 0.0004),
      hairMat,
    );
    m.castShadow = true;
    group.add(m);
  }
  for (const s of [-1, 1])
    for (const k of [0, 1, 2]) {
      // straggly hairs off the knees and toes
      const m = new THREE.Mesh(hair([[s * 0.03, -0.1 - k * 0.025, 0.012], [s * (0.045 + k * 0.006), -0.112 - k * 0.025, 0.018 + k * 0.004], [s * (0.058 + k * 0.01), -0.13 - k * 0.025, 0.012]], 0.0016, 0.0003), hairMat);
      group.add(m);
    }

  return {
    group,
    arms,
    mouth: {
      open(k) {
        const o = Math.min(Math.max(k, 0), 1);
        const sy = 0.25 + 0.95 * o;
        inside.scale.y = 0.009 * sy;
        lips.scale.set(1 - 0.1 * o, 0.6 * sy, 1);
        tongue.visible = o > 0.35;
      },
    },
  };
}
