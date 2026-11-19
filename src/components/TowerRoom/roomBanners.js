import * as THREE from "three";
import { onWall } from "./roomProps.js";
import { houseBannerCanvas, HOUSE_COLOURS } from "../houseBanners.js";

const GRYFFINDOR = 3; // see houseBanners.js

// The Gryffindor banner, on the wall left of the window.
export function buildGryffindorBanner(scene, mats, angle = -2.8) {
  const map = new THREE.CanvasTexture(houseBannerCanvas(GRYFFINDOR, () => (map.needsUpdate = true)));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(0.56, 1.54, 20, 30);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin(pos.getX(k) * 18) * 0.01 * (0.45 - pos.getY(k) * 0.3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(HOUSE_COLOURS[GRYFFINDOR]), side: THREE.DoubleSide, alphaTest: 0.1 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(onWall(angle, 0.06, 1.8));
  m.rotation.y = angle + Math.PI;
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.68, 10), mats.brass);
  rod.position.copy(onWall(angle, 0.08, 2.58));
  rod.rotation.set(0, angle + Math.PI, Math.PI / 2);
  scene.add(rod);
}
