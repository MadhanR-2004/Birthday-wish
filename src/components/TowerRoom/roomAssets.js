import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

// Real-world assets for the tower room: CC0 scanned surfaces, furniture and
// props from Poly Haven (polyhaven.com), kept in public/room-assets.

const BASE = `${import.meta.env.BASE_URL}room-assets`;

export const MODELS = [
  "GothicBed_01",
  "ClassicNightstand_01",
  "ArmChair_01",
  "side_table_01",
  "chess_set",
  "treasure_chest",
  "wooden_broom",
  "round_spectacles",
  "lantern_chandelier_01",
  "mantel_clock_01",
  "ornate_mirror_01",
  "fancy_picture_frame_01",
  "lion_head",
  "book_encyclopedia_set_01",
  "vintage_oil_lamp",
  "throw_pillows_01",
  "potted_plant_02",
];

// scanned surfaces: diffuse colour, normal and roughness maps
const SURFACES = {
  stone: "castle_wall_varriation",
  floor: "dark_wooden_planks",
  velvet: "velour_velvet",
  leather: "brown_leather",
  wood: "dark_wood",
};

export async function loadRoomAssets(renderer, onProgress) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress?.(loaded / total);
  const gltf = new GLTFLoader(manager);
  const textures = new THREE.TextureLoader(manager);
  const hdr = new HDRLoader(manager);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  const models = {};
  const surfaces = {};
  const tasks = MODELS.map((id) =>
    gltf.loadAsync(`${BASE}/models/${id}/${id}.gltf`).then((g) => {
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      models[id] = g.scene;
    })
  );
  for (const [key, id] of Object.entries(SURFACES)) {
    surfaces[key] = {};
    for (const [slot, file, isColor] of [["map", "diff", true], ["normalMap", "nor", false], ["roughnessMap", "rough", false]]) {
      tasks.push(
        textures.loadAsync(`${BASE}/textures/${id}/${file}.jpg`).then((t) => {
          t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = anisotropy;
          surfaces[key][slot] = t;
        })
      );
    }
  }
  let environment = null;
  tasks.push(
    hdr.loadAsync(`${BASE}/hdri/fireplace_1k.hdr`).then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      environment = t;
    })
  );
  await Promise.all(tasks);
  return { models, surfaces, environment };
}

// A scanned surface as a material, tiled `rx` by `ry` times.
export function surfaceMaterial(set, rx, ry, extra = {}) {
  const tile = (t) => {
    const c = t.clone();
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    return c;
  };
  return new THREE.MeshStandardMaterial({
    map: tile(set.map),
    normalMap: tile(set.normalMap),
    roughnessMap: tile(set.roughnessMap),
    roughness: 1,
    ...extra,
  });
}
