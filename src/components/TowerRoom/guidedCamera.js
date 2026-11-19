import * as THREE from "three";

// A camera for standing in a room rather than spinning a model: you're at a
// viewpoint and can look around a little by dragging (or by moving the mouse,
// like turning your head), zoom in a touch with the wheel, and glide smoothly
// to other viewpoints. You never end up inside a wall or a piece of furniture,
// because every viewpoint is chosen by hand.
//
// Or you can walk around: drag to look any way you like, and move with the
// keys (W A S D or the arrows) or an on-screen stick. canStand(x, z) says
// where there's room to stand, so you slide along walls and furniture.

const EYE = 1.55; // eye height when walking
const SPEED = 1.5; // metres a second

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);

export function createGuidedCamera(camera, dom, { reduceMotion = false } = {}) {
  const base = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const look = { yaw: 0, pitch: 0, yawGoal: 0, pitchGoal: 0, range: { yaw: 0.7, pitch: 0.35 } };
  const zoom = { fov: 50, goal: 50, min: 28, max: 55 };
  const hover = { x: 0, y: 0 };
  let glide = null;
  let drag = null;
  let moved = 0;
  const walk = { on: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, vel: new THREE.Vector3(), keys: new Set(), stick: { x: 0, y: 0 }, canStand: () => true, bob: 0 };

  function onPointerDown(e) {
    drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, yaw: look.yawGoal, pitch: look.pitchGoal };
    moved = 0;
    dom.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const rect = dom.getBoundingClientRect();
    hover.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    hover.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    moved = Math.max(moved, Math.hypot(dx, dy));
    if (walk.on) {
      // walking: turn freely, all the way round
      walk.yaw -= (e.clientX - drag.lastX) * 0.005;
      walk.pitch = clamp(walk.pitch - (e.clientY - drag.lastY) * 0.004, -1.0, 1.0);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      return;
    }
    look.yawGoal = clamp(drag.yaw + dx * 0.0035, -look.range.yaw, look.range.yaw);
    look.pitchGoal = clamp(drag.pitch + dy * 0.0028, -look.range.pitch, look.range.pitch);
  }
  function onPointerUp() {
    drag = null;
  }
  function onWheel(e) {
    e.preventDefault();
    zoom.goal = clamp(zoom.goal + Math.sign(e.deltaY) * 3, zoom.min, zoom.max);
  }
  dom.addEventListener("pointerdown", onPointerDown);
  dom.addEventListener("pointermove", onPointerMove);
  dom.addEventListener("pointerup", onPointerUp);
  dom.addEventListener("pointercancel", onPointerUp);
  dom.addEventListener("wheel", onWheel, { passive: false });
  // walking keys
  const KEYS = { w: "f", arrowup: "f", s: "b", arrowdown: "b", a: "l", arrowleft: "l", d: "r", arrowright: "r" };
  const typing = (e) => /input|textarea|select/i.test(e.target?.tagName ?? "");
  function onKeyDown(e) {
    const k = KEYS[e.key.toLowerCase()];
    if (!walk.on || !k || typing(e)) return;
    walk.keys.add(k);
    e.preventDefault();
  }
  function onKeyUp(e) {
    const k = KEYS[e.key.toLowerCase()];
    if (k) walk.keys.delete(k);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const onBlur = () => walk.keys.clear();
  window.addEventListener("blur", onBlur);

  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const step = new THREE.Vector3();

  return {
    // was the last press a drag (so it shouldn't count as a click)?
    get wasDrag() {
      return moved > 6;
    },
    get busy() {
      return !!glide;
    },
    get walking() {
      return walk.on;
    },
    // start walking from wherever the camera is now, looking the same way
    startWalking(canStand) {
      walk.on = true;
      walk.canStand = canStand ?? (() => true);
      glide = null;
      walk.pos.set(camera.position.x, EYE, camera.position.z);
      camera.getWorldDirection(dir);
      walk.yaw = Math.atan2(dir.x, dir.z);
      walk.pitch = clamp(Math.asin(clamp(dir.y, -1, 1)), -0.5, 0.5);
      walk.vel.set(0, 0, 0);
      walk.keys.clear();
      walk.stick.x = walk.stick.y = 0;
      zoom.goal = 60;
    },
    stopWalking() {
      walk.on = false;
      walk.keys.clear();
      walk.stick.x = walk.stick.y = 0;
    },
    // the on-screen stick: x to the right, y forwards, each -1..1
    setStick(x, y) {
      walk.stick.x = x;
      walk.stick.y = y;
    },
    // jump straight to a view
    set(view) {
      base.position.copy(view.position);
      base.target.copy(view.target);
      look.yaw = look.yawGoal = look.pitch = look.pitchGoal = 0;
      zoom.fov = zoom.goal = view.fov ?? 50;
    },
    // glide to a view
    goTo(view, duration = 1.6) {
      glide = {
        t: 0,
        duration: reduceMotion ? 0.01 : duration,
        fromPos: camera.position.clone(),
        fromTarget: lookAt.clone(),
        toPos: view.position.clone(),
        toTarget: view.target.clone(),
        fromFov: zoom.fov,
        toFov: view.fov ?? 50,
      };
      look.yawGoal = look.pitchGoal = 0;
    },
    update(dt) {
      if (glide) {
        glide.t += dt;
        const k = ease(Math.min(glide.t / glide.duration, 1));
        // rise a little in the middle of a long glide, like walking over
        const lift = Math.sin(Math.PI * k) * Math.min(0.15, glide.fromPos.distanceTo(glide.toPos) * 0.05);
        camera.position.lerpVectors(glide.fromPos, glide.toPos, k);
        camera.position.y += lift;
        lookAt.lerpVectors(glide.fromTarget, glide.toTarget, k);
        zoom.fov = zoom.goal = glide.fromFov + (glide.toFov - glide.fromFov) * k;
        look.yaw *= 1 - k;
        look.pitch *= 1 - k;
        if (k >= 1) {
          base.position.copy(glide.toPos);
          base.target.copy(glide.toTarget);
          glide = null;
        }
        camera.lookAt(lookAt);
      } else if (walk.on) {
        // where you want to go: forwards/backwards and sideways
        const fwd = (walk.keys.has("f") ? 1 : 0) - (walk.keys.has("b") ? 1 : 0) + walk.stick.y;
        const side = (walk.keys.has("r") ? 1 : 0) - (walk.keys.has("l") ? 1 : 0) + walk.stick.x;
        const len = Math.hypot(fwd, side);
        const sx = Math.sin(walk.yaw);
        const sz = Math.cos(walk.yaw);
        step.set(0, 0, 0);
        if (len > 0.05) {
          const k = Math.min(1, len) / len;
          // forwards is where you're facing; right is a quarter turn clockwise
          step.set((sx * fwd - sz * side) * k, 0, (sz * fwd + sx * side) * k).multiplyScalar(SPEED);
        }
        walk.vel.lerp(step, 1 - Math.exp(-dt * 8));
        // move, sliding along anything in the way
        const nx = walk.pos.x + walk.vel.x * dt;
        const nz = walk.pos.z + walk.vel.z * dt;
        if (walk.canStand(nx, nz)) walk.pos.set(nx, EYE, nz);
        else if (walk.canStand(nx, walk.pos.z)) walk.pos.x = nx;
        else if (walk.canStand(walk.pos.x, nz)) walk.pos.z = nz;
        // a gentle bob as you walk
        const speed = Math.hypot(walk.vel.x, walk.vel.z);
        walk.bob += dt * speed * 6.5;
        camera.position.copy(walk.pos);
        if (!reduceMotion) camera.position.y += Math.sin(walk.bob) * 0.012 * Math.min(1, speed / SPEED);
        dir.set(Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(walk.yaw) * Math.cos(walk.pitch));
        lookAt.copy(camera.position).addScaledVector(dir, 2);
        camera.lookAt(lookAt);
      } else {
        const f = 1 - Math.exp(-dt * 6);
        // gentle head-turn towards the mouse, on top of any dragging
        const sway = reduceMotion || drag ? 0 : 1;
        look.yaw += (look.yawGoal + hover.x * 0.06 * sway - look.yaw) * f;
        look.pitch += (look.pitchGoal + hover.y * 0.035 * sway - look.pitch) * f;
        // breathing: a tiny drift so the view never feels frozen
        const t = performance.now() / 1000;
        camera.position.copy(base.position);
        if (!reduceMotion) camera.position.y += Math.sin(t * 0.9) * 0.004;
        dir.copy(base.target).sub(base.position);
        const dist = dir.length();
        dir.normalize();
        right.crossVectors(dir, up).normalize();
        dir.applyAxisAngle(up, -look.yaw);
        dir.applyAxisAngle(right.crossVectors(dir, up).normalize(), -look.pitch);
        lookAt.copy(camera.position).addScaledVector(dir, dist);
        camera.lookAt(lookAt);
      }
      zoom.fov += (zoom.goal - zoom.fov) * (1 - Math.exp(-dt * 6));
      // on tall, narrow screens (phones), widen the view so you see the room
      // rather than a thin slice of it
      const fit = camera.aspect < 1.2 ? Math.pow(1.2 / camera.aspect, 0.6) : 1;
      const fov = clamp(zoom.fov * fit, 20, 88);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
    dispose() {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
