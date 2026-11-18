import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { createStage, loadSurface, retile, nightSky, random, NOISE_GLSL, v3 } from "./common.js";
import { createFlyingOwl } from "./flyingOwl.js";

// The castle at night, in 3D: a many-towered stone castle on a rocky cliff,
// hundreds of lit windows, slate spires catching the moonlight, a lake below
// that really reflects it all, mist on the water, pine forests on the hills
// and a sky full of stars. The view drifts slowly round it.

export async function createCastleScene(host, { reduceMotion = false } = {}) {
  const stage = createStage(host, { exposure: 1.05, bloom: [0.7, 0.55, 0.82], fov: 38 });
  const { renderer, scene, camera } = stage;
  scene.fog = new THREE.FogExp2(0x0a1022, 0.0032);
  const rand = random(12);

  const moonDir = v3(0.45, 0.32, -1).normalize();
  const sky = nightSky(moonDir, 1500, { clouds: 0.6 });
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0x3b4c80, 0x05060a, 0.55));
  const moon = new THREE.DirectionalLight(0xbfd0ff, 2.2);
  moon.position.copy(moonDir).multiplyScalar(300);
  scene.add(moon);
  // soft moonlight off the lake from our side, so the owl reads as white
  const fill = new THREE.DirectionalLight(0x9fb2e8, 1.1);
  fill.position.set(40, 30, 160);
  scene.add(fill);
  // a little warm light spilling from the windows onto the walls
  for (const [x, y, z] of [[-6, 38, 12], [10, 30, 14], [0, 26, 18], [-14, 30, 4]]) {
    const l = new THREE.PointLight(0xffa850, 900, 60, 2);
    l.position.set(x, y, z);
    scene.add(l);
  }

  const stoneBase = await loadSurface(renderer, "castle_wall_varriation", 1, 1, { color: 0x8e8a86 });
  const stone = (rx, ry) => retile(stoneBase, rx, ry);
  const slate = new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.42, metalness: 0.35 });
  const cliffMat = retile(stoneBase, 6, 3);
  cliffMat.color.set(0x4a4642);

  const castle = new THREE.Group();
  scene.add(castle);

  // the cliff, rough and irregular
  const cliffGeo = new THREE.CylinderGeometry(36, 60, 24, 64, 8, false);
  {
    const p = cliffGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const a = Math.atan2(z, x);
      const bump = 1 + 0.12 * Math.sin(a * 5 + y * 0.3) + 0.07 * Math.sin(a * 13 + y) + (rand() - 0.5) * 0.08;
      p.setX(i, x * bump);
      p.setZ(i, z * bump);
      if (y > 11) p.setY(i, y + (rand() - 0.5) * 1.5);
    }
    cliffGeo.computeVertexNormals();
  }
  const cliff = new THREE.Mesh(cliffGeo, cliffMat);
  cliff.position.y = 12;
  castle.add(cliff);
  const TOP = 24;

  // towers: round, with tall conical slate roofs
  const towers = [
    [0, 0, 5, 52], [-14, -6, 3.2, 38], [14, -4, 3.4, 40], [-22, 8, 2.6, 30], [22, 10, 2.8, 32],
    [-8, 16, 2.4, 26], [8, 18, 2.6, 28], [-26, -10, 2.2, 24], [27, -9, 2.3, 25], [4, -14, 3, 44],
    [-5, -16, 2.2, 34], [16, 6, 2, 22],
  ];
  const windows = [];
  for (const [x, z, r, h] of towers) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 28), stone(r * 0.9, h / 7));
    t.position.set(x, TOP + h / 2, z);
    castle.add(t);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, r * 3.4, 28), slate);
    roof.position.set(x, TOP + h + r * 1.7, z);
    castle.add(roof);
    // a little parapet ring under the roof
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.18, 1.2, 28), stone(r, 0.3));
    ring.position.set(x, TOP + h - 0.3, z);
    castle.add(ring);
    // lit windows round the tower
    const rows = Math.floor(h / 6);
    for (let k = 0; k < rows; k++) {
      for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / Math.max(4, Math.round(r * 2))) {
        if (rand() < 0.45) continue;
        windows.push({ x: x + Math.sin(a) * (r + 0.05), y: TOP + 4 + k * 6 + rand() * 1.5, z: z + Math.cos(a) * (r + 0.05), rot: a, w: 0.9, h: 1.8 });
      }
    }
  }

  // the window high in the great tower where the owl is heading: always lit
  const TOWER_WINDOW = v3(0, TOP + 40, 5.05);
  windows.push({ x: TOWER_WINDOW.x, y: TOWER_WINDOW.y, z: TOWER_WINDOW.z, rot: 0, w: 1.5, h: 2.6 });

  // the great hall: a long building with a steep roof and tall windows
  const hall = new THREE.Group();
  hall.position.set(-2, TOP, 8);
  hall.rotation.y = 0.15;
  castle.add(hall);
  const hallBody = new THREE.Mesh(new THREE.BoxGeometry(32, 16, 12), stone(5, 2.5));
  hallBody.position.y = 8;
  hall.add(hallBody);
  const roofShape = new THREE.Shape([new THREE.Vector2(-6.8, 0), new THREE.Vector2(6.8, 0), new THREE.Vector2(0, 9)]);
  const hallRoof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 33, bevelEnabled: false }), slate);
  hallRoof.rotation.y = Math.PI / 2;
  hallRoof.position.set(-16.5, 16, 0);
  hall.add(hallRoof);
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1]) {
      windows.push({ local: hall, x: -13 + i * 4.3, y: 9, z: side * 6.05, rot: side > 0 ? 0 : Math.PI, w: 1.6, h: 7, arch: true });
    }
  }

  // curtain walls with battlements between the towers
  const ring = [[-26, -10], [-14, -6], [0, -14], [14, -4], [27, -9], [22, 10], [8, 18], [-8, 16], [-22, 8], [-26, -10]];
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 10, 2.2), stone(len / 6, 1.6));
    wall.position.set((ax + bx) / 2, TOP + 5, (az + bz) / 2);
    wall.rotation.y = -Math.atan2(bz - az, bx - ax);
    castle.add(wall);
    for (let m = 0.5; m < len - 0.5; m += 1.6) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 2.3), stone(0.2, 0.2));
      merlon.position.set(ax + ((bx - ax) * m) / len, TOP + 10.6, az + ((bz - az) * m) / len);
      merlon.rotation.y = wall.rotation.y;
      castle.add(merlon);
    }
  }

  // all the windows, glowing (one instanced mesh)
  const winGeo = new THREE.PlaneGeometry(1, 1);
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.6), fog: false, side: THREE.DoubleSide });
  const winMesh = new THREE.InstancedMesh(winGeo, winMat, windows.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = v3();
  scene.updateMatrixWorld(true);
  windows.forEach((w, i) => {
    pos.set(w.x, w.y, w.z);
    if (w.local) pos.applyMatrix4(w.local.matrixWorld);
    q.setFromEuler(new THREE.Euler(0, w.rot + (w.local ? w.local.rotation.y : 0), 0));
    m4.compose(pos, q, v3(w.w, w.h, 1));
    winMesh.setMatrixAt(i, m4);
    const warm = 0.55 + rand() * 0.6;
    winMesh.setColorAt(i, new THREE.Color(warm, warm * (0.8 + rand() * 0.2), warm * 0.7));
  });
  castle.add(winMesh);

  // a bridge of arches off to the side
  for (let i = 0; i < 6; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 22, 3), stone(0.4, 4));
    pier.position.set(36 + i * 7, 11, -18 - i * 2);
    castle.add(pier);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 1.5, 3.2), stone(8, 0.3));
  deck.position.set(52, 22.5, -23);
  deck.rotation.y = 0.28;
  castle.add(deck);

  // hills of dark pine forest round the lake
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x0c1410, roughness: 1 });
  const treeGeo = new THREE.ConeGeometry(2.2, 9, 6);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x0b1a12, roughness: 1 });
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, 900);
  let n = 0;
  for (const [hx, hz, hr, hh] of [[-160, -120, 120, 60], [170, -160, 140, 70], [-60, -260, 180, 90], [240, 40, 120, 50], [-240, 30, 130, 55]]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    hill.scale.set(hr, hh, hr * 0.8);
    hill.position.set(hx, -2, hz);
    scene.add(hill);
    for (let k = 0; k < 180 && n < 900; k++, n++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 0.95;
      const y = Math.sqrt(Math.max(0, 1 - d * d)) * hh - 2;
      m4.compose(v3(hx + Math.cos(a) * d * hr, y + 3.5, hz + Math.sin(a) * d * hr * 0.8), q.identity(), v3(1, 0.8 + rand() * 0.6, 1).multiplyScalar(0.8 + rand()));
      trees.setMatrixAt(n, m4);
    }
  }
  trees.count = n;
  scene.add(trees);

  // the lake: a real reflection, rippled and darkened
  const waterGeo = new THREE.CircleGeometry(900, 64);
  const shader = {
    name: "LakeShader",
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      varying vec4 vUv;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        vec2 rip = vec2(noise(vWorld.xz * 0.08 + uTime * 0.25), noise(vWorld.xz * 0.08 - uTime * 0.2)) - 0.5;
        rip += (vec2(noise(vWorld.xz * 0.5 + uTime), noise(vWorld.xz * 0.5 - uTime)) - 0.5) * 0.4;
        vec4 uv = vUv;
        uv.xy += rip * 0.06 * uv.w;
        vec3 reflected = texture2DProj(tDiffuse, uv).rgb;
        vec3 deep = vec3(0.01, 0.02, 0.04);
        vec3 col = mix(deep, reflected, 0.62);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  };
  const lake = new Reflector(waterGeo, { textureWidth: 1024, textureHeight: 512, clipBias: 0.003, shader });
  lake.rotation.x = -Math.PI / 2;
  lake.position.y = 0;
  scene.add(lake);

  // mist lying on the water round the foot of the cliff
  const mistMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vUv * 6.0 + vec2(uTime * 0.02, uTime * 0.01);
        float m = smoothstep(0.45, 0.85, fbm(p)) * (1.0 - smoothstep(0.25, 0.5, length(vUv - 0.5)));
        gl_FragColor = vec4(vec3(0.55, 0.62, 0.8), m * 0.35);
      }`,
  });
  for (const y of [1.2, 3.5]) {
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mistMat);
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = y;
    scene.add(mist);
  }

  // the owl, carrying the letter across the lake to the tower window
  const owl = createFlyingOwl(scene, {
    scale: 1.6,
    speed: 8,
    pause: 4,
    reduceMotion,
    path: () => [v3(50, 38, 116), v3(30, 46, 80), v3(12, 56, 42), v3(3, TOP + 39, 14), TOWER_WINDOW.clone().add(v3(0, 0, 0.6))],
  });

  // the view: drifting slowly round the castle from across the lake
  stage.run((dt, t, pointer) => {
    owl.update(dt, t);
    const a = reduceMotion ? 0.25 : 0.25 + Math.sin(t * 0.03) * 0.22;
    const dist = 150;
    camera.position.set(Math.sin(a) * dist + pointer.sx * 6, 30 + Math.sin(t * 0.07) * 2 - pointer.sy * 3, Math.cos(a) * dist);
    camera.lookAt(0, 46, 0);
    sky.material.uniforms.uTime.value = t;
    lake.material.uniforms.uTime.value = t;
    mistMat.uniforms.uTime.value = t;
  });

  return {
    dispose() {
      owl.dispose();
      stage.dispose();
    },
  };
}
