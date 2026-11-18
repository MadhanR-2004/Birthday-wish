import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildBasinProfile, radiusAtHeight } from "./basinShape.js";
import { makeStoneTextures, makeRuneTexture, makeWindowTexture, makeContactShadowTexture } from "./basinTextures.js";
import * as glsl from "./basinShaders.js";

// The 3D memory basin, drawn with three.js. React only talks to it through
// the small object returned at the bottom: setFocus, dive, surface, dispose.

const LIQUID_Y = 1.215;
const CENTER = new THREE.Vector3(0, LIQUID_Y, 0);
const MOON_POS = new THREE.Vector3(-2.4, 6.6, -3.6);

// Where the camera rests: distance, angle down from straight above, turn
// around the basin, how far below the liquid it looks (to leave room for
// the memory cards), and lens.
const IDLE = { radius: 4.1, polar: 1.02, azimuth: 0.18, lookDrop: 0.5, fov: 36 };
const CLOSEST = 0.045;

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const lerp = THREE.MathUtils.lerp;

function additive(material) {
  material.transparent = true;
  material.depthWrite = false;
  material.blending = THREE.AdditiveBlending;
  return material;
}

export function createBasinScene(host, { reduceMotion = false } = {}) {
  // Throws if the browser can't do WebGL; the caller falls back to plain CSS.
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = "mb-webgl";
  host.appendChild(renderer.domElement);

  // ---------- room ----------

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.FogExp2(0x04060c, 0.085);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTexture;
  scene.environmentIntensity = 0.16;

  const camera = new THREE.PerspectiveCamera(IDLE.fov, 1, 0.01, 60);

  scene.add(new THREE.HemisphereLight(0x2a3a66, 0x07070a, 0.55));

  // Moonlight pouring through a high window onto the basin.
  const moon = new THREE.SpotLight(0xb8c8ff, 70, 20, 0.36, 0.7, 2);
  moon.position.copy(MOON_POS);
  moon.target.position.set(0, 0.7, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 2;
  moon.shadow.camera.far = 14;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  moon.shadow.radius = 4;
  scene.add(moon, moon.target);

  // A faint cool fill from the viewer's side, so the carving reads.
  const fill = new THREE.DirectionalLight(0x8090c0, 0.9);
  fill.position.set(2.5, 3, 4.5);
  scene.add(fill);

  // The liquid itself gives off light onto the inside of the rim.
  const glowLight = new THREE.PointLight(0x40d0e8, 2.4, 4, 2);
  glowLight.position.set(0, LIQUID_Y + 0.12, 0);
  scene.add(glowLight);

  const stone = makeStoneTextures(renderer.capabilities.getMaxAnisotropy());

  const floorMaps = {};
  for (const [key, tex] of Object.entries(stone)) {
    const copy = tex.clone();
    copy.repeat.set(9, 9);
    floorMaps[key] = copy;
  }
  for (const tex of Object.values(stone)) tex.repeat.set(6, 3);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    new THREE.MeshStandardMaterial({
      color: 0x7a766e,
      map: floorMaps.color,
      bumpMap: floorMaps.bump,
      bumpScale: 1.5,
      roughnessMap: floorMaps.roughness,
      roughness: 1,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({ color: 0x000000, map: makeContactShadowTexture(), transparent: true, opacity: 0.8, depthWrite: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.003;
  scene.add(contact);

  // The window the moonlight comes through, far back in the dark.
  const windowPane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 3.4),
    new THREE.MeshBasicMaterial({ map: makeWindowTexture(), transparent: true, fog: false, depthWrite: false })
  );
  windowPane.material.color.setScalar(1.2);
  windowPane.position.copy(MOON_POS).multiplyScalar(1.55);
  windowPane.position.y = 5.2;
  windowPane.lookAt(0, 3.2, 4);
  scene.add(windowPane);

  // A soft shaft of light from the window to the basin.
  const beamLength = MOON_POS.distanceTo(new THREE.Vector3(0, 0, 0.1));
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 1.35, beamLength, 48, 1, true),
    additive(
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uStrength: { value: 0.05 } },
        vertexShader: glsl.beamVertex,
        fragmentShader: glsl.beamFragment,
        side: THREE.DoubleSide,
      })
    )
  );
  beam.position.copy(MOON_POS).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), MOON_POS.clone().normalize());
  scene.add(beam);

  // ---------- the stone basin ----------

  const profile = buildBasinProfile();
  const basin = new THREE.Mesh(
    new THREE.LatheGeometry(profile.points, 180),
    new THREE.MeshStandardMaterial({
      color: 0xd6d2c8,
      map: stone.color,
      bumpMap: stone.bump,
      bumpScale: 2.2,
      roughnessMap: stone.roughness,
      roughness: 1,
      metalness: 0,
    })
  );
  basin.castShadow = true;
  basin.receiveShadow = true;
  scene.add(basin);

  // A band of runes carved round the outside of the rim, faintly lit from within.
  const bandLow = 1.19;
  const bandHigh = 1.258;
  const runes = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusAtHeight(profile.outer, bandHigh, true) + 0.004,
      radiusAtHeight(profile.outer, bandLow, true) + 0.004,
      bandHigh - bandLow,
      180,
      1,
      true
    ),
    new THREE.MeshStandardMaterial({
      color: 0x111216,
      roughness: 0.7,
      alphaMap: makeRuneTexture(),
      transparent: true,
      depthWrite: false,
      emissive: 0x4fd8ff,
      emissiveIntensity: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  runes.material.emissiveMap = runes.material.alphaMap;
  runes.position.y = (bandLow + bandHigh) / 2;
  scene.add(runes);

  // ---------- the liquid, its mist and motes ----------

  const liquidRadius = radiusAtHeight(profile.inner, LIQUID_Y) + 0.012;
  const liquid = new THREE.Mesh(
    new THREE.RingGeometry(0.0005, liquidRadius, 128, 48),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: liquidRadius },
        uAgitation: { value: 0.3 },
        uRippleAge: { value: -1 },
        uVortex: { value: 0 },
        uSwirl: { value: 0 },
        uGlow: { value: 1 },
        uLightDir: { value: MOON_POS.clone().normalize() },
      },
      vertexShader: glsl.liquidVertex,
      fragmentShader: glsl.liquidFragment,
    })
  );
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = LIQUID_Y;
  scene.add(liquid);

  const vapors = [0.018, 0.05, 0.095].map((lift, i) => {
    const radius = liquidRadius * (1.02 + i * 0.04);
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 96),
      additive(
        new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uRadius: { value: radius },
            uOpacity: { value: 0.12 },
            uSpin: { value: (i % 2 ? -1 : 1) * (0.05 + i * 0.03) },
            uSeed: { value: i * 7.3 },
          },
          vertexShader: glsl.vaporVertex,
          fragmentShader: glsl.vaporFragment,
          side: THREE.DoubleSide,
        })
      )
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = LIQUID_Y + lift;
    scene.add(mesh);
    return mesh;
  });

  const MOTES = 160;
  const seeds = new Float32Array(MOTES * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
  moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  const motes = new THREE.Points(
    moteGeo,
    additive(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uRadius: { value: liquidRadius },
          uRise: { value: 0.55 },
          uViewport: { value: 800 },
          uIntensity: { value: 1 },
        },
        vertexShader: glsl.moteVertex,
        fragmentShader: glsl.moteFragment,
      })
    )
  );
  motes.position.copy(CENTER);
  motes.frustumCulled = false;
  scene.add(motes);

  // The silver thread of a memory, curling down into the centre.
  const strandPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.1, 2.9, 1.1),
    new THREE.Vector3(0.55, 2.2, 0.6),
    new THREE.Vector3(-0.25, 1.85, 0.25),
    new THREE.Vector3(0.18, 1.55, -0.12),
    new THREE.Vector3(-0.06, 1.36, 0.04),
    new THREE.Vector3(0, LIQUID_Y - 0.01, 0),
  ]);
  const strand = new THREE.Mesh(
    new THREE.TubeGeometry(strandPath, 260, 0.0055, 8, false),
    additive(
      new THREE.ShaderMaterial({
        uniforms: { uProgress: { value: 0 }, uDrain: { value: 0 }, uTime: { value: 0 } },
        vertexShader: glsl.strandVertex,
        fragmentShader: glsl.strandFragment,
      })
    )
  );
  strand.visible = false;
  scene.add(strand);

  // ---------- full-screen mist, drawn on top while falling and remembering ----------

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // Pictures of the memory, shown drifting up through the water as you sink.
  const blankPicture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blankPicture.needsUpdate = true;
  const pictureCache = new Map();
  const loader = new THREE.TextureLoader();
  function loadPicture(url) {
    if (!pictureCache.has(url)) {
      const loading = loader.loadAsync(url).then(
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          return { texture, aspect: texture.image.width / texture.image.height || 1 };
        },
        () => null // a missing picture is simply skipped
      );
      pictureCache.set(url, loading);
    }
    return pictureCache.get(url);
  }

  const mist = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMix: { value: 0 },
        uRush: { value: 0 },
        uDepth: { value: 0 },
        uAspect: { value: 1 },
        uPic0: { value: blankPicture },
        uPic1: { value: blankPicture },
        uPic2: { value: blankPicture },
        uPicAspect: { value: new THREE.Vector3(1, 1, 1) },
        uPicLife: { value: new THREE.Vector3(-1, -1, -1) },
      },
      vertexShader: glsl.mistVertex,
      fragmentShader: glsl.mistFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  mist.frustumCulled = false;
  overlayScene.add(mist);

  // ---------- post-processing: bloom for the dreamy glow ----------

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.5, 0.85);
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(outputPass);

  // ---------- state ----------

  const lv = {
    focus: 0,
    focusTarget: 0,
    surge: 0,
    vortex: 0,
    overlay: 0,
    rush: 0,
    strand: 0,
    drain: 0,
    ripple: -1,
    swirl: 0,
    depth: 0,
    sinking: 1,
  };
  const cam = { dive: 0, polar: IDLE.polar, azimuth: IDLE.azimuth, lookDrop: IDLE.lookDrop, fov: IDLE.fov, parallax: 1 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let fit = 1;
  let time = 0;
  let busy = false;

  const tweens = [];
  function tween(duration, update) {
    return new Promise((resolve) => tweens.push({ t: 0, duration, update, resolve }));
  }
  function runTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = tw.duration > 0 ? clamp01(tw.t / tw.duration) : 1;
      tw.update(k);
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.resolve();
      }
    }
  }

  const lookAt = new THREE.Vector3();
  function placeCamera() {
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    const drift = reduceMotion ? 0 : Math.sin(time * 0.11) * 0.07;
    const az = cam.azimuth + (pointer.sx * 0.22 + drift) * cam.parallax;
    const polar = cam.polar + pointer.sy * 0.05 * cam.parallax;
    const far = IDLE.radius * fit;
    const r = far * (CLOSEST / far) ** cam.dive;
    camera.position.set(Math.sin(polar) * Math.sin(az) * r, Math.cos(polar) * r, Math.sin(polar) * Math.cos(az) * r).add(CENTER);
    lookAt.copy(CENTER).y -= cam.lookDrop;
    camera.lookAt(lookAt);
    if (camera.fov !== cam.fov) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
  }

  function updateUniforms(dt) {
    lv.focus += (lv.focusTarget - lv.focus) * (1 - Math.exp(-dt * 3));
    const agitation = 0.3 + lv.focus * 0.5 + lv.surge * 0.8 + lv.vortex * 1.5;
    const glow = 1 + lv.focus * 0.35 + lv.surge * 0.7;
    lv.swirl += dt * (reduceMotion ? 0.04 : 0.1 + lv.focus * 0.12 + lv.surge * 0.4 + lv.vortex * 2.4);
    lv.depth += dt * (0.06 + lv.rush * 6) * lv.sinking;
    if (lv.ripple >= 0) lv.ripple += dt;

    const lu = liquid.material.uniforms;
    lu.uTime.value = time;
    lu.uAgitation.value = agitation;
    lu.uGlow.value = glow;
    lu.uSwirl.value = lv.swirl;
    lu.uVortex.value = lv.vortex;
    lu.uRippleAge.value = lv.ripple;

    for (const v of vapors) {
      v.material.uniforms.uTime.value = time;
      v.material.uniforms.uOpacity.value = 0.12 + lv.focus * 0.1 + lv.surge * 0.25;
    }
    motes.material.uniforms.uTime.value = time;
    motes.material.uniforms.uIntensity.value = 1 + lv.focus * 0.6 + lv.surge;
    beam.material.uniforms.uTime.value = time;

    strand.material.uniforms.uTime.value = time;
    strand.material.uniforms.uProgress.value = lv.strand;
    strand.material.uniforms.uDrain.value = lv.drain;

    runes.material.emissiveIntensity = 0.45 + lv.focus * 0.3 + lv.surge * 0.8 + 0.08 * Math.sin(time * 1.3);
    glowLight.intensity = 2 * glow * (1 + 0.05 * Math.sin(time * 3.1) * Math.sin(time * 1.7));

    const mu = mist.material.uniforms;
    mu.uTime.value = time;
    mu.uMix.value = lv.overlay;
    mu.uRush.value = lv.rush;
    mu.uDepth.value = lv.depth;
  }

  // ---------- loop ----------

  let raf = 0;
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    runTweens(dt);
    placeCamera();
    updateUniforms(dt);

    if (lv.overlay < 0.999) {
      composer.render(dt);
    } else {
      renderer.setRenderTarget(null);
      renderer.clear();
    }
    if (lv.overlay > 0.001) {
      renderer.autoClear = false;
      renderer.render(overlayScene, overlayCamera);
      renderer.autoClear = true;
    }
  }

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Step back on tall, narrow screens so the whole basin fits.
    fit = camera.aspect < 1.1 ? (1.1 / camera.aspect) ** 0.8 : 1;
    mist.material.uniforms.uAspect.value = camera.aspect;
    motes.material.uniforms.uViewport.value = h * pixelRatio;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function onPointerMove(event) {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener("pointermove", onPointerMove);

  raf = requestAnimationFrame(frame);

  // ---------- what React can ask for ----------

  // Hovering a memory stirs the basin.
  function setFocus(on) {
    lv.focusTarget = on ? 1 : 0;
  }

  // A thread of memory falls in, the surface ripples, and we fall after it,
  // sinking past dreamlike glimpses of the memory's pictures.
  async function dive({ pictures = [] } = {}) {
    if (busy) return;
    busy = true;
    lv.focusTarget = 0;
    const loading = Promise.all(pictures.slice(0, 3).map(loadPicture));

    if (reduceMotion) {
      await tween(0.7, (k) => {
        lv.overlay = k;
      });
      busy = false;
      return;
    }

    strand.visible = true;
    lv.drain = 0;
    await tween(1.4, (k) => {
      lv.strand = easeInOut(k);
    });
    lv.ripple = 0;
    tween(1.1, (k) => {
      lv.drain = easeInOut(k);
    }).then(() => {
      strand.visible = false;
    });
    tween(0.6, (k) => {
      lv.surge = smooth(0, 1, k);
    });
    await tween(0.45, () => {});

    const fromAzimuth = cam.azimuth;
    lv.sinking = 1;
    lv.rush = 1;
    await tween(2.9, (k) => {
      cam.dive = 0.5 * easeInOut(k) + 0.5 * k * k;
      cam.polar = lerp(IDLE.polar, 0.16, smooth(0, 0.65, k));
      cam.azimuth = fromAzimuth + 1.9 * easeIn(k);
      cam.lookDrop = lerp(IDLE.lookDrop, 0, smooth(0, 0.55, k));
      cam.fov = lerp(IDLE.fov, 76, easeIn(k));
      cam.parallax = 1 - smooth(0, 0.3, k);
      lv.vortex = smooth(0.15, 0.85, k);
      lv.overlay = smooth(0.6, 0.96, k);
    });

    // Glimpses of the memory, one after another (waiting at most 2s for slow images).
    const loaded = await Promise.race([loading, new Promise((resolve) => setTimeout(() => resolve([]), 2000))]);
    const shown = loaded.filter(Boolean);
    if (shown.length > 0) {
      const mu = mist.material.uniforms;
      shown.forEach((pic, i) => {
        mu[`uPic${i}`].value = pic.texture;
        mu.uPicAspect.value.setComponent(i, pic.aspect);
      });
      const gap = 1.6;
      const span = 3.6;
      const total = gap * (shown.length - 1) + span;
      await tween(total, (k) => {
        const t = k * total;
        lv.rush = 1 - 0.5 * smooth(0, 0.2, k);
        for (let i = 0; i < 3; i++) mu.uPicLife.value.setComponent(i, i < shown.length ? (t - i * gap) / span : -1);
      });
      mu.uPicLife.value.set(-1, -1, -1);
    }

    // Inside now: let the water settle into a slow haze.
    const fromRush = lv.rush;
    tween(2.2, (k) => {
      lv.rush = fromRush * (1 - easeInOut(k));
    });
    busy = false;
  }

  // Rise back out of the memory to the basin.
  async function surface() {
    if (busy) return;
    busy = true;

    if (reduceMotion) {
      await tween(0.6, (k) => {
        lv.overlay = 1 - k;
      });
      busy = false;
      return;
    }

    const fromAzimuth = cam.azimuth;
    lv.sinking = -1;
    await tween(2.7, (k) => {
      cam.dive = 1 - easeInOut(k);
      cam.polar = lerp(0.16, IDLE.polar, smooth(0.15, 1, k));
      cam.azimuth = lerp(fromAzimuth, IDLE.azimuth, easeInOut(k));
      cam.lookDrop = lerp(0, IDLE.lookDrop, smooth(0.3, 1, k));
      cam.fov = lerp(76, IDLE.fov, easeOut(k));
      cam.parallax = smooth(0.6, 1, k);
      lv.overlay = 1 - smooth(0, 0.45, k);
      lv.rush = Math.sin(Math.PI * clamp01(k / 0.45)) * 0.5;
      lv.vortex = 1 - smooth(0, 0.8, k);
      lv.surge = 1 - smooth(0.3, 1, k);
    });
    lv.ripple = -1;
    busy = false;
  }

  function dispose() {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    const textures = new Set();
    for (const root of [scene, overlayScene]) {
      root.traverse((obj) => {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        for (const m of mats) {
          for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
          m.dispose();
        }
      });
    }
    textures.forEach((t) => t.dispose());
    Object.values(stone).forEach((t) => t.dispose());
    envTexture.dispose();
    blankPicture.dispose();
    pictureCache.forEach((loading) => loading.then((pic) => pic?.texture.dispose()));
    bloom.dispose();
    outputPass.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  return { setFocus, dive, surface, dispose };
}
