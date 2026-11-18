import * as THREE from "three";

// All textures are painted in code at load time: no image files needed.

function hash(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Value noise whose lattice wraps every `period` cells, so it tiles seamlessly.
function tileNoise(x, y, period, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const xa = x0 % period;
  const xb = (x0 + 1) % period;
  const ya = y0 % period;
  const yb = (y0 + 1) % period;
  const a = hash(xa, ya, seed);
  const b = hash(xb, ya, seed);
  const c = hash(xa, yb, seed);
  const d = hash(xb, yb, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(u, v, period, octaves, seed) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * tileNoise(u * period, v * period, period, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  return new THREE.CanvasTexture(canvas);
}

function pixelTexture(size, data) {
  return canvasTexture(size, size, (ctx) => ctx.putImageData(new ImageData(data, size, size), 0, 0));
}

// Weathered grey stone: colour, bump (for carved relief) and roughness maps.
export function makeStoneTextures(anisotropy = 4, size = 512) {
  const color = new Uint8ClampedArray(size * size * 4);
  const bump = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const large = fbm(u, v, 3, 4, 1);
      const grain = fbm(u, v, 48, 2, 7);
      const vein = fbm(u, v, 5, 3, 13);
      const crack = 0.55 * (1 - smoothstep(0, 0.01, Math.abs(vein - 0.5))) * smoothstep(0.48, 0.62, fbm(u, v, 2, 2, 19));
      const pits = smoothstep(0.7, 0.8, fbm(u, v, 24, 2, 29));
      const moss = smoothstep(0.56, 0.72, fbm(u, v, 4, 3, 41));

      const shade = 0.56 + (large - 0.5) * 1.15 + (grain - 0.5) * 0.4 - crack * 0.4 - pits * 0.18;
      const i = (y * size + x) * 4;
      color[i] = 124 * shade - moss * 10;
      color[i + 1] = 121 * shade + moss * 3;
      color[i + 2] = 112 * shade - moss * 8;
      color[i + 3] = 255;

      const b = 255 * (0.5 + (large - 0.5) * 0.7 + (grain - 0.5) * 0.55 - crack * 0.5 - pits * 0.3);
      bump[i] = bump[i + 1] = bump[i + 2] = b;
      bump[i + 3] = 255;

      const r = 255 * (0.84 + (grain - 0.5) * 0.25 + crack * 0.1 - moss * 0.05);
      rough[i] = rough[i + 1] = rough[i + 2] = r;
      rough[i + 3] = 255;
    }
  }

  const maps = { color: pixelTexture(size, color), bump: pixelTexture(size, bump), roughness: pixelTexture(size, rough) };
  maps.color.colorSpace = THREE.SRGBColorSpace;
  for (const tex of Object.values(maps)) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
  }
  return maps;
}

// Repeatable random numbers, so the runes are the same every visit.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A strip of invented runes for the band around the rim (white on black).
export function makeRuneTexture() {
  const tex = canvasTexture(1024, 64, (ctx, w, h) => {
    const rand = mulberry32(5);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = ctx.fillStyle = "#fff";
    ctx.lineCap = ctx.lineJoin = "round";

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(w, 6);
    ctx.moveTo(0, 58);
    ctx.lineTo(w, 58);
    ctx.stroke();

    const count = 18;
    const step = w / count;
    const top = 14;
    const bottom = 50;
    const mid = (top + bottom) / 2;
    ctx.lineWidth = 3.2;
    for (let g = 0; g < count; g++) {
      const cx = step * (g + 0.5);
      const half = 9;
      const strokes = [
        () => { ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); },
        () => { const y = top + rand() * 14; ctx.moveTo(cx, y); ctx.lineTo(cx - half, y + 10); },
        () => { const y = top + rand() * 14; ctx.moveTo(cx, y); ctx.lineTo(cx + half, y + 10); },
        () => { ctx.moveTo(cx - half, mid + 6); ctx.lineTo(cx, mid - 8); ctx.lineTo(cx + half, mid + 6); },
        () => { ctx.moveTo(cx + 7, top + 4); ctx.arc(cx, top + 4, 7, 0, Math.PI * 2); },
        () => { ctx.moveTo(cx, bottom); ctx.lineTo(cx + half, bottom - 10); },
        () => { ctx.moveTo(cx - half, mid); ctx.lineTo(cx + half, mid); },
        () => { const s = rand() < 0.5 ? 1 : -1; ctx.moveTo(cx - half * s, bottom - 4); ctx.quadraticCurveTo(cx + half * s, mid, cx - half * s, top + 4); },
      ];
      ctx.beginPath();
      if (rand() < 0.75) strokes[0]();
      const extra = 2 + Math.floor(rand() * 2);
      for (let s = 0; s < extra; s++) strokes[1 + Math.floor(rand() * (strokes.length - 1))]();
      ctx.stroke();

      // a small diamond between runes
      const dx = cx + step / 2;
      ctx.beginPath();
      ctx.moveTo(dx, mid - 3.5);
      ctx.lineTo(dx + 3.5, mid);
      ctx.lineTo(dx, mid + 3.5);
      ctx.lineTo(dx - 3.5, mid);
      ctx.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

// A tall arched window with leaded glass, lit by the moon outside.
export function makeWindowTexture() {
  const tex = canvasTexture(256, 512, (ctx, w, h) => {
    const arch = () => {
      ctx.beginPath();
      ctx.moveTo(30, h);
      ctx.lineTo(30, 170);
      ctx.quadraticCurveTo(30, 34, 128, 18);
      ctx.quadraticCurveTo(226, 34, 226, 170);
      ctx.lineTo(226, h);
      ctx.closePath();
    };
    const glass = ctx.createLinearGradient(0, 0, 0, h);
    glass.addColorStop(0, "#dfe7ff");
    glass.addColorStop(0.5, "#9fb2e6");
    glass.addColorStop(1, "#5e72ad");
    arch();
    ctx.fillStyle = glass;
    ctx.fill();

    ctx.save();
    arch();
    ctx.clip();
    ctx.strokeStyle = "rgba(10, 12, 22, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let d = -h; d < w + h; d += 34) {
      ctx.moveTo(d, 0);
      ctx.lineTo(d + h, h);
      ctx.moveTo(d, 0);
      ctx.lineTo(d - h, h);
    }
    ctx.stroke();
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#0a0c16";
    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, h);
    ctx.moveTo(0, 300);
    ctx.lineTo(w, 300);
    ctx.stroke();
    ctx.restore();

    arch();
    ctx.lineWidth = 16;
    ctx.strokeStyle = "#0a0c16";
    ctx.stroke();
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft round shadow that settles the basin onto the floor.
export function makeContactShadowTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
