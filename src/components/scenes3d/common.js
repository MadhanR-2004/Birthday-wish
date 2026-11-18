import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Shared set-up for the 3D backdrops behind the letter: a renderer with
// bloom, a resize-aware loop, scanned surfaces, and tidy disposal.

const ASSETS = `${import.meta.env.BASE_URL}room-assets/textures`;

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function createStage(host, { exposure = 1, bloom = [0.6, 0.5, 0.85], fov = 45, far = 3000, pixelRatio = 1.5 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.domElement.className = "scene3d-webgl";
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, far);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), ...bloom));
  composer.addPass(new OutputPass());

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onMove);

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let raf = 0;
  let time = 0;
  function run(update) {
    let last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;
      pointer.sx += (pointer.x - pointer.sx) * 0.03;
      pointer.sy += (pointer.y - pointer.sy) * 0.03;
      update(dt, time, pointer);
      composer.render(dt);
    };
    raf = requestAnimationFrame(frame);
  }

  function dispose() {
    cancelAnimationFrame(raf);
    observer.disconnect();
    window.removeEventListener("pointermove", onMove);
    const textures = new Set();
    scene.traverse((o) => {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) textures.add(u.value);
        m.dispose();
      }
    });
    textures.forEach((t) => t.dispose());
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  return { renderer, scene, camera, run, dispose };
}

// A scanned surface (from the tower room's CC0 set) as a tiled material.
export async function loadSurface(renderer, id, rx, ry, extra = {}) {
  const loader = new THREE.TextureLoader();
  const load = (file, color) =>
    loader.loadAsync(`${ASSETS}/${id}/${file}.jpg`).then((t) => {
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    });
  const [map, normalMap, roughnessMap] = await Promise.all([load("diff", true), load("nor", false), load("rough", false)]);
  return new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1, ...extra });
}

// A copy of a material with its maps tiled differently.
export function retile(mat, rx, ry) {
  const m = mat.clone();
  for (const key of ["map", "normalMap", "roughnessMap"]) {
    if (!mat[key]) continue;
    m[key] = mat[key].clone();
    m[key].repeat.set(rx, ry);
    m[key].needsUpdate = true;
  }
  return m;
}

export function canvasTexture(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Repeatable random numbers.
export function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
`;

// Night sky dome: deep blue, twinkling stars, a moon with a halo, and thin
// clouds drifting across it.
export function nightSky(moonDir, radius = 1500, { clouds = 0.5 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uMoon: { value: moonDir.clone().normalize() }, uTime: { value: 0 }, uClouds: { value: clouds } },
    vertexShader: `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoon;
      uniform float uTime, uClouds;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(vec3(0.05, 0.07, 0.16), vec3(0.006, 0.01, 0.03), smoothstep(0.0, 0.7, h));
        vec3 p = d * 260.0;
        float r = hash13(floor(p));
        if (r > 0.985 && h > 0.02) {
          float s = smoothstep(0.32, 0.0, length(fract(p) - 0.5)) * (r - 0.985) / 0.015;
          s *= 0.65 + 0.35 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
          col += vec3(0.9, 0.94, 1.0) * s * 2.6;
        }
        float m = dot(d, uMoon);
        col += vec3(1.0, 0.97, 0.9) * smoothstep(0.99935, 0.9996, m) * 2.4;
        col += vec3(0.35, 0.45, 0.8) * pow(max(m, 0.0), 300.0) * 0.4;
        col += vec3(0.12, 0.16, 0.3) * pow(max(m, 0.0), 20.0) * 0.35;
        // thin clouds, lit silver near the moon
        vec2 cp = d.xz / max(h + 0.15, 0.05) * 1.2 + vec2(uTime * 0.006, 0.0);
        float cl = smoothstep(0.5, 0.85, fbm(cp * 1.5)) * smoothstep(0.02, 0.3, h) * uClouds;
        col = mix(col, vec3(0.1, 0.12, 0.2) + vec3(0.45, 0.5, 0.65) * pow(max(m, 0.0), 8.0), cl * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  sky.frustumCulled = false;
  return sky;
}

// A small flame that flickers (for candles and torches); world-position seeded.
export function flameMaterial(intensity = 3) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vH;
      void main() {
        vec3 p = position;
        vH = clamp(p.y + 0.5, 0.0, 1.0);
        #ifdef USE_INSTANCING
          vec4 origin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mat4 m = modelMatrix * instanceMatrix;
        #else
          vec4 origin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mat4 m = modelMatrix;
        #endif
        float seed = origin.x * 1.7 + origin.z * 2.3 + origin.y;
        p.x += sin(uTime * 12.0 + seed) * 0.08 * vH * vH;
        p.y *= 1.0 + 0.15 * sin(uTime * 17.0 + seed);
        gl_Position = projectionMatrix * viewMatrix * m * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vH; void main() {
        vec3 c = mix(vec3(1.0, 0.92, 0.7), vec3(1.0, 0.45, 0.08), smoothstep(0.1, 0.9, vH));
        gl_FragColor = vec4(c * ${intensity.toFixed(1)}, 1.0); }`,
  });
}
