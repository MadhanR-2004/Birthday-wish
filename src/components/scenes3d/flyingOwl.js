import * as THREE from "three";
import { createOwlModel } from "../OwlCarrier/owlModel.js";

// The owl, flying along a path with the letter hanging from her talons, over
// and over (with a pause between flights). Used by the opening scenes, where
// she's on her way to the tower.
//
// `path` is a function returning the flight's points; it's called afresh for
// each flight, so it can follow a moving camera.

const LETTER_SCALE = 3; // the letter's size relative to the owl model

export function createFlyingOwl(scene, { path, scale = 1, speed = 6, pause = 3, reduceMotion = false }) {
  const owl = createOwlModel({ reduceMotion });
  owl.root.scale.setScalar(scale);
  owl.root.rotation.order = "YXZ";
  scene.add(owl.root);

  const letter = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.004, 0.16), new THREE.MeshStandardMaterial({ color: 0xd9c393, roughness: 0.9 }));
  letter.add(paper);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.006, 20), new THREE.MeshStandardMaterial({ color: 0x8e0f1c, roughness: 0.35 }));
  seal.position.y = -0.004;
  letter.add(seal);
  letter.position.set(0, -0.36, 0.08);
  letter.rotation.set(Math.PI / 2 - 0.15, 0, 0);
  letter.scale.setScalar(LETTER_SCALE);
  owl.root.add(letter);

  let curve = null;
  let length = 1;
  let t = 0;
  let waiting = 0.5;
  let yawPrev = 0;
  let roll = 0;
  const tangent = new THREE.Vector3();

  function newFlight() {
    curve = new THREE.CatmullRomCurve3(path(), false, "centripetal");
    length = curve.getLength();
    t = 0;
    curve.getTangentAt(0, tangent);
    yawPrev = Math.atan2(tangent.x, tangent.z);
  }

  return {
    update(dt, time) {
      if (waiting > 0) {
        waiting -= dt;
        owl.root.visible = false;
        if (waiting <= 0) newFlight();
        return;
      }
      t += dt;
      const u = Math.min((t * speed) / length, 1);
      curve.getPointAt(u, owl.root.position);
      curve.getTangentAt(Math.min(u, 0.999), tangent);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const rate = Math.atan2(Math.sin(yaw - yawPrev), Math.cos(yaw - yawPrev)) / Math.max(dt, 1e-3);
      yawPrev = yaw;
      roll += (Math.max(-0.6, Math.min(0.6, -rate * 0.35)) - roll) * (1 - Math.exp(-dt * 3));
      const climb = -Math.asin(Math.max(-1, Math.min(1, tangent.y))) * 0.7;
      owl.root.rotation.set(0.85 + climb, yaw, roll);
      // she shrinks away into the window at the very end
      const fade = 1 - Math.max(0, (u - 0.94) / 0.06);
      owl.root.scale.setScalar(scale * Math.max(0.001, fade));
      owl.root.visible = true;
      owl.animate(dt, { flapRate: 2.6, glide: Math.sin(time * 0.4) > 0.6 ? 1 : 0, headPitch: -0.75 });
      if (u >= 1) waiting = pause;
    },
    dispose: () => owl.dispose(),
  };
}
