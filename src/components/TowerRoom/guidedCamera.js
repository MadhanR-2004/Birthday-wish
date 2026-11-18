import * as THREE from "three";

// A camera for standing in a room rather than spinning a model: you're at a
// viewpoint and can look around a little by dragging (or by moving the mouse,
// like turning your head), zoom in a touch with the wheel, and glide smoothly
// to other viewpoints. You never end up inside a wall or a piece of furniture,
// because every viewpoint is chosen by hand.

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

  function onPointerDown(e) {
    drag = { x: e.clientX, y: e.clientY, yaw: look.yawGoal, pitch: look.pitchGoal };
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

  const dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  return {
    // was the last press a drag (so it shouldn't count as a click)?
    get wasDrag() {
      return moved > 6;
    },
    get busy() {
      return !!glide;
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
    },
  };
}
