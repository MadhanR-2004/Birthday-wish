import * as THREE from "three";
import { createOwlModel } from "./owlModel.js";

// The owl on the letter page: hovering with wings beating, gripping the top
// edge of the envelope. The model's grip point is the world origin; the camera
// is set so that point lands on the envelope's top edge on the page.

// Vertical view: half the visible height, and where the grip point sits
// (as a fraction of that, below the centre). See owl-host in OwlCarrier.css.
const HALF_HEIGHT = 1.4;
const GRIP_NDC = -0.94;
const FOV = 28;

export function createOwl(host, { reduceMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const distance = HALF_HEIGHT / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const lift = -GRIP_NDC * HALF_HEIGHT;
  camera.position.set(0, lift, distance);
  camera.lookAt(0, lift, 0);

  // Night lighting: cool moonlight from above, a blue rim from behind, and a
  // little warm torchlight from the castle below.
  scene.add(new THREE.HemisphereLight(0xa8bbff, 0x2a2030, 1.15));
  const moon = new THREE.DirectionalLight(0xf0f3ff, 3.4);
  moon.position.set(-2, 4, 3);
  const rim = new THREE.DirectionalLight(0x86a6ff, 2.4);
  rim.position.set(1.5, 2.5, -3);
  const torch = new THREE.DirectionalLight(0xffd2a8, 0.25);
  torch.position.set(1, -2, 2);
  scene.add(moon, rim, torch);

  const owl = createOwlModel({ reduceMotion });
  scene.add(owl.root);

  const pose = { roll: 0, yaw: 0, pitch: 0 };

  // animate(dt, { flapRate, roll, yaw, pitch }) draws a frame and returns the
  // wingbeat phase, so the page can bob the envelope in time with it.
  function animate(dt, target) {
    const ease = 1 - Math.exp(-dt * 4);
    for (const key of Object.keys(pose)) pose[key] += ((target[key] ?? pose[key]) - pose[key]) * ease;
    owl.root.rotation.set(-0.12 + pose.pitch, pose.yaw, pose.roll);
    const phase = owl.animate(dt, { flapRate: target.flapRate });
    renderer.render(scene, camera);
    return phase;
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function dispose() {
    resizeObserver.disconnect();
    owl.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  return { animate, dispose };
}
