import * as THREE from "three";
import { createStage, loadSurface, retile, flameMaterial, canvasTexture, random, NOISE_GLSL, v3 } from "./common.js";
import { createFlyingOwl } from "./flyingOwl.js";

// The great hall, in 3D: a long stone hall with tall arched windows, four
// long tables laid with gold plates and goblets, hundreds of floating candles
// bobbing under an enchanted ceiling of drifting clouds and stars, house
// banners, wall torches and a staff table on a dais. The view glides slowly
// down the middle of the hall.

const LENGTH = 64; // along z
const HALF_W = 11; // x from -11 to 11
const WALL_H = 15;

export async function createHallScene(host, { reduceMotion = false } = {}) {
  const stage = createStage(host, { exposure: 1.0, bloom: [0.55, 0.5, 0.86], fov: 55, far: 400 });
  const { renderer, scene, camera } = stage;
  scene.background = new THREE.Color(0x05060c);
  scene.fog = new THREE.FogExp2(0x120c08, 0.012);
  const rand = random(31);

  const [stoneBase, woodBase] = await Promise.all([
    loadSurface(renderer, "castle_wall_varriation", 1, 1, { color: 0x9a948c }),
    loadSurface(renderer, "dark_wood", 1, 1, { roughness: 0.75 }),
  ]);

  // ---------- the hall ----------

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, LENGTH), retile(stoneBase, 5, 14));
  floor.material.color.set(0x6a625a);
  floor.material.roughness = 0.7;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // side walls, with tall arched (lancet) windows cut as glowing glass
  const wallMat = retile(stoneBase, LENGTH / 4, WALL_H / 4);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, WALL_H), wallMat);
    wall.position.set(side * HALF_W, WALL_H / 2, 0);
    wall.rotation.y = -side * Math.PI / 2;
    scene.add(wall);
  }
  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, WALL_H), retile(stoneBase, 5, 4));
  endWall.position.set(0, WALL_H / 2, -LENGTH / 2);
  scene.add(endWall);
  const backWall = endWall.clone();
  backWall.position.z = LENGTH / 2;
  backWall.rotation.y = Math.PI;
  scene.add(backWall);

  // leaded window glass, cool with moonlight
  const glassTex = canvasTexture(128, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#9fb6ff");
    g.addColorStop(1, "#33467e");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(10, 12, 20, 0.9)";
    c.lineWidth = 3;
    for (let d = -h; d < w + h; d += 22) {
      c.beginPath();
      c.moveTo(d, 0);
      c.lineTo(d + h, h);
      c.moveTo(d, 0);
      c.lineTo(d - h, h);
      c.stroke();
    }
  });
  const lancet = (() => {
    const s = new THREE.Shape();
    s.moveTo(-1, 0);
    s.lineTo(1, 0);
    s.lineTo(1, 5);
    s.quadraticCurveTo(1, 6.6, 0, 7.6);
    s.quadraticCurveTo(-1, 6.6, -1, 5);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s, 16);
    // UVs from the shape's bounds
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1) / 2, p.getY(i) / 7.6);
    return geo;
  })();
  const glassMat = new THREE.MeshBasicMaterial({ map: glassTex, color: new THREE.Color(0.7, 0.75, 0.9), fog: false });
  const frameMat = retile(stoneBase, 0.5, 2);
  for (let i = 0; i < 7; i++) {
    const z = -LENGTH / 2 + 8 + i * 8;
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(lancet, glassMat);
      win.position.set(side * (HALF_W - 0.02), 4.2, z);
      win.rotation.y = -side * Math.PI / 2;
      win.scale.setScalar(1.05);
      scene.add(win);
      // deep stone reveal round it
      const reveal = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8.4, 0.25), frameMat);
      reveal.position.set(side * (HALF_W - 0.3), 7.9, z - 1.25);
      scene.add(reveal);
      const reveal2 = reveal.clone();
      reveal2.position.z = z + 1.25;
      scene.add(reveal2);
    }
  }
  // the great window at the far end, behind the staff table
  const bigWin = new THREE.Mesh(lancet, glassMat);
  bigWin.position.set(0, 3.2, -LENGTH / 2 + 0.03);
  bigWin.scale.set(2.6, 1.45, 1);
  scene.add(bigWin);

  // ---------- the enchanted ceiling: a night sky with drifting clouds ----------

  const ceilingMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vUv * vec2(4.0, 12.0);
        vec3 col = mix(vec3(0.02, 0.03, 0.09), vec3(0.06, 0.08, 0.2), smoothstep(0.0, 1.0, abs(vUv.x - 0.5) * 2.0));
        vec2 sp = vUv * vec2(260.0, 780.0);
        float r = hash(floor(sp));
        if (r > 0.975) {
          float s = smoothstep(0.35, 0.0, length(fract(sp) - 0.5)) * (r - 0.975) / 0.025;
          col += vec3(0.95, 0.95, 1.0) * s * (0.6 + 0.4 * sin(uTime * (1.0 + r * 4.0) + r * 50.0)) * 2.4;
        }
        float cl = smoothstep(0.45, 0.85, fbm(p * 0.6 + vec2(uTime * 0.02, uTime * 0.008)));
        col = mix(col, vec3(0.2, 0.22, 0.32), cl * 0.65);
        // fades into darkness where it meets the walls
        col *= smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, LENGTH, 1, 1), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_H;
  scene.add(ceiling);
  // heavy beams across, between the walls and the sky
  const beamMat = retile(woodBase, 4, 0.5);
  for (let i = 0; i < 9; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2, 0.6, 0.5), beamMat);
    beam.position.set(0, WALL_H - 0.3, -LENGTH / 2 + 4 + i * 7.5);
    scene.add(beam);
  }

  // ---------- four long tables, benches, gold plates and goblets ----------

  const tableMat = retile(woodBase, 8, 0.5);
  const gold = new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 1, roughness: 0.28 });
  const plateGeo = new THREE.CylinderGeometry(0.16, 0.12, 0.02, 20);
  const gobletGeo = new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.05, 0.01], [0.01, 0.02], [0.01, 0.1], [0.045, 0.14], [0.05, 0.2], [0.046, 0.2], [0.04, 0.15], [0, 0.13]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const TABLE_L = 40;
  const tableXs = [-7.2, -2.4, 2.4, 7.2];
  const per = Math.floor(TABLE_L / 0.8);
  const plates = new THREE.InstancedMesh(plateGeo, gold, tableXs.length * per * 2);
  const goblets = new THREE.InstancedMesh(gobletGeo, gold, tableXs.length * per * 2);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let k = 0;
  for (const x of tableXs) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, TABLE_L), tableMat);
    top.position.set(x, 0.78, 2);
    scene.add(top);
    for (const lz of [-18, -6, 6, 18]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.74, 0.12), tableMat);
      leg.position.set(x, 0.37, 2 + lz);
      scene.add(leg);
    }
    for (const side of [-1, 1]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, TABLE_L), tableMat);
      bench.position.set(x + side * 0.95, 0.46, 2);
      scene.add(bench);
      const benchLeg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, TABLE_L - 1), tableMat);
      benchLeg.position.set(x + side * 0.95, 0.22, 2);
      scene.add(benchLeg);
      for (let i = 0; i < per; i++) {
        const z = 2 - TABLE_L / 2 + 0.5 + i * 0.8;
        m4.compose(v3(x + side * 0.38, 0.83, z), q.identity(), v3(1, 1, 1));
        plates.setMatrixAt(k, m4);
        m4.compose(v3(x + side * 0.2, 0.82, z + 0.25), q, v3(1, 1, 1));
        goblets.setMatrixAt(k, m4);
        k += 1;
      }
    }
  }
  scene.add(plates, goblets);

  // the staff table, raised on a dais at the far end
  const dais = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2, 0.6, 7), retile(stoneBase, 5, 2));
  dais.position.set(0, 0.3, -LENGTH / 2 + 3.5);
  scene.add(dais);
  const staff = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 1.3), tableMat);
  staff.position.set(0, 1.4, -LENGTH / 2 + 4);
  scene.add(staff);
  const staffFront = new THREE.Mesh(new THREE.BoxGeometry(14, 0.75, 0.08), tableMat);
  staffFront.position.set(0, 0.98, -LENGTH / 2 + 4.65);
  scene.add(staffFront);
  // a great carved chair in the middle
  const throne = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 0.25), gold);
  throne.position.set(0, 2.0, -LENGTH / 2 + 3.0);
  scene.add(throne);

  // ---------- banners in four house colours ----------

  const houses = [
    ["#7a0f18", "#d4a640"],
    ["#0f4a2a", "#b8bcc4"],
    ["#14285e", "#b98a52"],
    ["#c79a1c", "#1a1a1a"],
  ];
  const bannerGeo = new THREE.PlaneGeometry(3, 9, 20, 30);
  {
    const p = bannerGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * 0.06 * (0.5 - p.getY(i) / 9));
    bannerGeo.computeVertexNormals();
  }
  houses.forEach(([field, trim], i) => {
    const tex = canvasTexture(256, 768, (c, w, h) => {
      c.fillStyle = field;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(w, 0);
      c.lineTo(w, h * 0.86);
      c.lineTo(w / 2, h);
      c.lineTo(0, h * 0.86);
      c.fill();
      c.strokeStyle = trim;
      c.lineWidth = 12;
      c.strokeRect(16, 16, w - 32, h * 0.8);
      c.fillStyle = trim;
      c.beginPath();
      for (let s = 0; s < 10; s++) {
        const r = s % 2 ? 32 : 80;
        const a = -Math.PI / 2 + (s * Math.PI) / 5;
        c.lineTo(w / 2 + Math.cos(a) * r, h * 0.4 + Math.sin(a) * r);
      }
      c.fill();
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.1, transparent: true });
    const banner = new THREE.Mesh(bannerGeo, mat);
    banner.position.set(tableXs[i], 9.5, -LENGTH / 2 + 10);
    scene.add(banner);
    const back = banner.clone();
    back.position.z = LENGTH / 2 - 6;
    scene.add(back);
  });

  // ---------- light: torches on the walls and hundreds of floating candles ----------

  scene.add(new THREE.HemisphereLight(0x3a3a60, 0x1a0e06, 0.35));
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0.5);
  moon.position.set(-20, 30, -10);
  scene.add(moon);
  const flameGeo = new THREE.SphereGeometry(0.5, 10, 8);
  const flameMat = flameMaterial(3.2);
  const torchLights = [];
  for (let i = 0; i < 8; i++) {
    const z = -LENGTH / 2 + 4 + i * 8;
    for (const side of [-1, 1]) {
      const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x1c1a18, metalness: 0.8, roughness: 0.5 }));
      bracket.position.set(side * (HALF_W - 0.3), 4.2, z);
      bracket.rotation.z = side * 0.5;
      scene.add(bracket);
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.scale.set(0.22, 0.5, 0.22);
      flame.position.set(side * (HALF_W - 0.42), 4.65, z);
      scene.add(flame);
      if (i % 2 === 0) {
        const light = new THREE.PointLight(0xff9a40, 60, 18, 2);
        light.position.set(side * (HALF_W - 0.8), 4.8, z);
        scene.add(light);
        torchLights.push({ light, seed: rand() * 9 });
      }
    }
  }
  const CANDLES = 420;
  const waxGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10);
  waxGeo.translate(0, -0.16, 0);
  const wax = new THREE.InstancedMesh(waxGeo, new THREE.MeshStandardMaterial({ color: 0xf0e4c8, roughness: 0.5, emissive: 0x3a2405, emissiveIntensity: 0.5 }), CANDLES);
  const flames = new THREE.InstancedMesh(flameGeo, flameMat, CANDLES);
  const candles = [];
  for (let i = 0; i < CANDLES; i++) {
    candles.push({ x: (rand() - 0.5) * HALF_W * 1.8, y: 7 + rand() * 5.5, z: -LENGTH / 2 + 6 + rand() * (LENGTH - 10), phase: rand() * 6, h: 0.8 + rand() * 0.5 });
  }
  scene.add(wax, flames);
  // their warm light, gathered into a few soft lights over the tables
  const glow = [];
  for (let i = 0; i < 5; i++) {
    const l = new THREE.PointLight(0xffb060, 140, 30, 2);
    l.position.set(0, 9, -LENGTH / 2 + 8 + i * 12);
    scene.add(l);
    glow.push(l);
  }

  // ---------- the owl, flying the length of the hall with the letter ----------

  const owl = createFlyingOwl(scene, {
    scale: 0.6,
    speed: 4.5,
    pause: 5,
    reduceMotion,
    path: () => {
      const z = camera.position.z;
      return [v3(1.6, 3.6, z - 2.5), v3(-1.5, 6.5, z - 14), v3(1.2, 8.2, Math.max(z - 28, -24)), v3(0, 8.7, -LENGTH / 2 + 0.6)];
    },
  });

  // ---------- the view: gliding slowly up and down the hall ----------

  const scale = v3();
  stage.run((dt, t, pointer) => {
    const k = reduceMotion ? 0.3 : 0.5 - 0.5 * Math.cos(t * 0.035);
    const z = 26 - k * 30;
    camera.position.set(Math.sin(t * 0.07) * 0.6 + pointer.sx * 0.8, 2.3 + Math.sin(t * 0.11) * 0.08 - pointer.sy * 0.3, z);
    camera.lookAt(pointer.sx * 2, 4.5 + Math.sin(t * 0.05) * 1.2, z - 20);
    ceilingMat.uniforms.uTime.value = t;
    flameMat.uniforms.uTime.value = t;
    owl.update(dt, t);
    for (let i = 0; i < CANDLES; i++) {
      const c = candles[i];
      const y = c.y + (reduceMotion ? 0 : Math.sin(t * 0.6 + c.phase) * 0.12);
      m4.compose(v3(c.x, y, c.z), q.identity(), scale.set(1, c.h, 1));
      wax.setMatrixAt(i, m4);
      m4.compose(v3(c.x, y + 0.08, c.z), q, scale.set(0.07, 0.16, 0.07));
      flames.setMatrixAt(i, m4);
    }
    wax.instanceMatrix.needsUpdate = true;
    flames.instanceMatrix.needsUpdate = true;
    for (const { light, seed } of torchLights) light.intensity = 60 * (0.85 + 0.1 * Math.sin(t * 9 + seed) + 0.05 * Math.sin(t * 23 + seed));
  });

  return {
    dispose() {
      owl.dispose();
      stage.dispose();
    },
  };
}
