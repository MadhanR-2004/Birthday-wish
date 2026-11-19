import * as THREE from "three";

// Every surface in the tower room is painted here in code, so the room needs
// no image files. Each painter returns three.js textures.

export function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, { color = true, repeat = [1, 1], anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  return tex;
}

// A small tileable grey noise image, laid over other paintings as grain.
function noiseTile(size, seed, base = 4, octaves = 4) {
  const rand = random(seed);
  const lattice = (period) => Array.from({ length: period * period }, () => rand());
  const layers = [];
  for (let o = 0, p = base; o < octaves; o++, p *= 2) layers.push({ p, v: lattice(p), amp: 0.5 ** o });
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let norm = 0;
      for (const { p, v, amp } of layers) {
        const fx = (x / size) * p;
        const fy = (y / size) * p;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const at = (i, j) => v[((j % p) * p + (i % p)) % (p * p)];
        const a = at(x0, y0);
        const b = at(x0 + 1, y0);
        const c = at(x0, y0 + 1);
        const d = at(x0 + 1, y0 + 1);
        sum += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
        norm += amp;
      }
      const g = Math.round((sum / norm) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Lays a noise tile over a painting, e.g. to darken or roughen it.
function grain(ctx, tile, w, h, mode, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(tile, "repeat");
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

// ---------- stone walls: rough blocks in grey-brown, deep mortar ----------

function stoneWall(fine, coarse) {
  const W = 1024;
  const rand = random(3);
  const color = makeCanvas(W, W);
  const bump = makeCanvas(W, W);
  const c = color.getContext("2d");
  const b = bump.getContext("2d");
  c.fillStyle = "#3b3631";
  c.fillRect(0, 0, W, W);
  b.fillStyle = "#000";
  b.fillRect(0, 0, W, W);
  const rowH = 128;
  for (let y = 0; y < W; y += rowH) {
    let x = -rand() * 200;
    while (x < W) {
      const bw = 170 + rand() * 150;
      const light = 30 + rand() * 14;
      const hue = 28 + rand() * 14;
      for (const dx of [0, -W, W]) {
        const gx = x + dx + 5;
        const gy = y + 5;
        const g = c.createLinearGradient(gx, gy, gx + bw, gy + rowH);
        g.addColorStop(0, hsl(hue, 8 + rand() * 6, light + 6));
        g.addColorStop(1, hsl(hue, 8, light - 6));
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(gx, gy, bw - 10, rowH - 10, 10);
        c.fill();
        b.save();
        b.filter = "blur(5px)";
        b.fillStyle = "#d0d0d0";
        b.beginPath();
        b.roundRect(gx + 4, gy + 4, bw - 18, rowH - 18, 12);
        b.fill();
        b.restore();
      }
      x += bw;
    }
  }
  grain(c, coarse, W, W, "multiply", 0.55);
  grain(c, fine, W, W, "overlay", 0.5);
  grain(b, fine, W, W, "multiply", 0.6);
  // a few chips and stains
  for (let i = 0; i < 90; i++) {
    c.fillStyle = `rgba(20, 16, 12, ${0.15 + rand() * 0.25})`;
    c.beginPath();
    c.ellipse(rand() * W, rand() * W, 2 + rand() * 9, 2 + rand() * 6, rand() * 3, 0, Math.PI * 2);
    c.fill();
  }
  return { map: toTexture(color), bump: toTexture(bump, { color: false }) };
}

// ---------- floor: long oak boards with grain, knots and dark gaps ----------

function floorBoards(fine) {
  const W = 1024;
  const rand = random(5);
  const color = makeCanvas(W, W);
  const bump = makeCanvas(W, W);
  const rough = makeCanvas(W, W);
  const c = color.getContext("2d");
  const b = bump.getContext("2d");
  const r = rough.getContext("2d");
  b.fillStyle = "#909090";
  b.fillRect(0, 0, W, W);
  r.fillStyle = "#9a9a9a";
  r.fillRect(0, 0, W, W);
  const plankW = 128;
  for (let x = 0; x < W; x += plankW) {
    let y = -rand() * 600;
    while (y < W) {
      const len = 500 + rand() * 500;
      const hue = 22 + rand() * 8;
      const light = 22 + rand() * 9;
      c.fillStyle = hsl(hue, 42 + rand() * 10, light);
      c.fillRect(x, y, plankW, len);
      // grain: long wavy lines along the board
      for (let i = 0; i < 26; i++) {
        const gx = x + rand() * plankW;
        const amp = 2 + rand() * 6;
        const freq = 0.004 + rand() * 0.01;
        c.strokeStyle = hsl(hue, 45, light - 8 - rand() * 6, 0.25 + rand() * 0.3);
        c.lineWidth = 0.6 + rand() * 1.6;
        c.beginPath();
        for (let t = 0; t <= len; t += 8) {
          const px = gx + Math.sin((y + t) * freq + i) * amp;
          if (t === 0) c.moveTo(px, y);
          else c.lineTo(px, y + t);
        }
        c.stroke();
      }
      if (rand() < 0.35) {
        const kx = x + 20 + rand() * (plankW - 40);
        const ky = y + rand() * len;
        for (let k = 0; k < 5; k++) {
          c.strokeStyle = hsl(hue, 50, light - 10, 0.5);
          c.beginPath();
          c.ellipse(kx, ky, 4 + k * 4, 9 + k * 7, 0, 0, Math.PI * 2);
          c.stroke();
        }
      }
      // end joint and side gaps
      c.fillStyle = "rgba(10, 6, 3, 0.85)";
      c.fillRect(x, y, plankW, 3);
      b.fillStyle = "#101010";
      b.fillRect(x, y, plankW, 3);
      // worn, glossier middle of each board
      const wear = r.createLinearGradient(x, 0, x + plankW, 0);
      wear.addColorStop(0, "#a8a8a8");
      wear.addColorStop(0.5, `rgb(${110 + rand() * 30}, ${110 + rand() * 30}, ${110 + rand() * 30})`);
      wear.addColorStop(1, "#a8a8a8");
      r.fillStyle = wear;
      r.fillRect(x, y, plankW, len);
      y += len;
    }
    c.fillStyle = "rgba(8, 5, 2, 0.9)";
    c.fillRect(x, 0, 3, W);
    b.fillStyle = "#000";
    b.fillRect(x, 0, 3, W);
  }
  grain(c, fine, W, W, "overlay", 0.35);
  return { map: toTexture(color), bump: toTexture(bump, { color: false }), rough: toTexture(rough, { color: false }) };
}

// ---------- dark polished walnut for furniture ----------

function walnut(fine, seed = 7, base = [24, 45, 17]) {
  const W = 512;
  const rand = random(seed);
  const color = makeCanvas(W, W);
  const c = color.getContext("2d");
  c.fillStyle = hsl(...base);
  c.fillRect(0, 0, W, W);
  for (let i = 0; i < 140; i++) {
    const gy = rand() * W;
    const amp = 3 + rand() * 10;
    const freq = 0.006 + rand() * 0.02;
    c.strokeStyle = hsl(base[0], base[1], base[2] + (rand() < 0.5 ? -7 : 6), 0.3 + rand() * 0.3);
    c.lineWidth = 0.6 + rand() * 2;
    c.beginPath();
    for (let x = -10; x <= W + 10; x += 8) {
      const py = gy + Math.sin(x * freq + i) * amp + Math.sin(x * freq * 3.1) * amp * 0.3;
      if (x === -10) c.moveTo(x, py);
      else c.lineTo(x, py);
    }
    c.stroke();
  }
  grain(c, fine, W, W, "overlay", 0.3);
  const bump = makeCanvas(W, W);
  const b = bump.getContext("2d");
  b.drawImage(color, 0, 0);
  b.globalCompositeOperation = "saturation";
  b.fillStyle = "#808080";
  b.fillRect(0, 0, W, W);
  return { map: toTexture(color), bump: toTexture(bump, { color: false }) };
}

// ---------- fabrics ----------

function velvet(fine, rgb) {
  const W = 256;
  const color = makeCanvas(W, W);
  const c = color.getContext("2d");
  c.fillStyle = `rgb(${rgb.join(",")})`;
  c.fillRect(0, 0, W, W);
  grain(c, fine, W, W, "multiply", 0.35);
  // fine weave
  c.globalAlpha = 0.08;
  c.strokeStyle = "#000";
  for (let i = 0; i < W; i += 2) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, W);
    c.stroke();
  }
  return toTexture(color, { repeat: [3, 3] });
}

// A quilted bedspread: crimson diamonds stitched in gold, gold border.
function quilt(fine) {
  const W = 1024;
  const color = makeCanvas(W, W);
  const bump = makeCanvas(W, W);
  const c = color.getContext("2d");
  const b = bump.getContext("2d");
  c.fillStyle = "#6a0d14";
  c.fillRect(0, 0, W, W);
  b.fillStyle = "#c0c0c0";
  b.fillRect(0, 0, W, W);
  const step = 96;
  for (const ctx of [c, b]) {
    ctx.strokeStyle = ctx === c ? "rgba(214, 166, 72, 0.75)" : "#202020";
    ctx.lineWidth = ctx === c ? 2.5 : 7;
    if (ctx === b) ctx.filter = "blur(4px)";
    for (let d = -W; d < W * 2; d += step) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + W, W);
      ctx.moveTo(d, 0);
      ctx.lineTo(d - W, W);
      ctx.stroke();
    }
    ctx.filter = "none";
  }
  c.fillStyle = "#b8862c";
  for (const e of [0, W - 40]) {
    c.fillRect(e, 0, 40, W);
    c.fillRect(0, e, W, 40);
  }
  grain(c, fine, W, W, "multiply", 0.3);
  return { map: toTexture(color), bump: toTexture(bump, { color: false }) };
}

// A woven rug: bands of deep red, navy and gold around a central medallion.
function rug(fine) {
  const W = 1024;
  const H = 640;
  const rand = random(13);
  const color = makeCanvas(W, H);
  const c = color.getContext("2d");
  c.fillStyle = "#5c1418";
  c.fillRect(0, 0, W, H);
  const bands = [["#1d2340", 36], ["#c49a4a", 14], ["#5c1418", 20], ["#1d2340", 26], ["#c49a4a", 8]];
  let inset = 0;
  for (const [col, size] of bands) {
    c.fillStyle = col;
    c.fillRect(inset, inset, W - inset * 2, H - inset * 2);
    inset += size;
    c.fillStyle = "#6b181d";
    c.fillRect(inset, inset, W - inset * 2, H - inset * 2);
  }
  // little repeating motifs in the border
  c.fillStyle = "#c49a4a";
  for (let x = 60; x < W - 60; x += 40) {
    for (const y of [18, H - 18]) {
      c.beginPath();
      c.moveTo(x, y - 8);
      c.lineTo(x + 8, y);
      c.lineTo(x, y + 8);
      c.lineTo(x - 8, y);
      c.fill();
    }
  }
  // medallion
  c.save();
  c.translate(W / 2, H / 2);
  for (let k = 0; k < 6; k++) {
    c.fillStyle = ["#1d2340", "#c49a4a", "#8a2228", "#1d2340", "#d9b46a", "#5c1418"][k];
    c.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 8) {
      const r = (190 - k * 30) * (a % (Math.PI / 4) < 0.01 ? 1 : 0.82);
      c.lineTo(Math.cos(a) * r * 1.4, Math.sin(a) * r * 0.8);
    }
    c.fill();
  }
  c.restore();
  // wear: patchy fading
  for (let i = 0; i < 40; i++) {
    c.fillStyle = `rgba(200, 170, 130, ${rand() * 0.08})`;
    c.beginPath();
    c.ellipse(rand() * W, rand() * H, 30 + rand() * 90, 20 + rand() * 50, rand(), 0, Math.PI * 2);
    c.fill();
  }
  grain(c, fine, W, H, "overlay", 0.6);
  // pile texture
  c.globalAlpha = 0.07;
  c.fillStyle = "#000";
  for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
  return toTexture(color, { repeat: [1, 1] });
}

// Worn brown leather with creases, for the school trunk.
function leather(fine, coarse) {
  const W = 512;
  const color = makeCanvas(W, W);
  const c = color.getContext("2d");
  c.fillStyle = "#4a2a17";
  c.fillRect(0, 0, W, W);
  grain(c, coarse, W, W, "multiply", 0.6);
  grain(c, fine, W, W, "overlay", 0.7);
  const rand = random(17);
  c.strokeStyle = "rgba(20, 10, 4, 0.35)";
  for (let i = 0; i < 60; i++) {
    c.lineWidth = 0.5 + rand();
    c.beginPath();
    const x = rand() * W;
    const y = rand() * W;
    c.moveTo(x, y);
    c.quadraticCurveTo(x + rand() * 40 - 20, y + rand() * 40 - 20, x + rand() * 60 - 30, y + rand() * 60 - 30);
    c.stroke();
  }
  return toTexture(color);
}

// Book spines: cloth or leather colours with gilt bands and a title block.
function bookSpines(fine) {
  const colors = [
    [352, 55, 26], [215, 45, 22], [140, 35, 20], [28, 45, 24], [45, 55, 32],
    [0, 0, 12], [265, 30, 22], [190, 35, 22], [20, 60, 18], [35, 30, 40],
  ];
  return colors.map((col, i) => {
    const W = 64;
    const H = 256;
    const rand = random(40 + i);
    const canvas = makeCanvas(W, H);
    const c = canvas.getContext("2d");
    c.fillStyle = hsl(...col);
    c.fillRect(0, 0, W, H);
    const shade = c.createLinearGradient(0, 0, W, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.45)");
    shade.addColorStop(0.35, "rgba(255,255,255,0.08)");
    shade.addColorStop(1, "rgba(0,0,0,0.45)");
    c.fillStyle = shade;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(212, 170, 80, 0.85)";
    const bands = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < bands; k++) {
      c.fillRect(0, 14 + k * 9, W, 3);
      c.fillRect(0, H - 17 - k * 9, W, 3);
    }
    c.fillRect(W * 0.2, H * 0.36, W * 0.6, H * 0.02);
    c.fillRect(W * 0.25, H * 0.42, W * 0.5, H * 0.012);
    c.fillRect(W * 0.3, H * 0.46, W * 0.4, H * 0.012);
    grain(c, fine, W, H, "overlay", 0.5);
    const tex = toTexture(canvas, { anisotropy: 4 });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

// Leaded diamond panes for the window glass (transparent between the lead).
function leadedGlass() {
  const W = 256;
  const H = 512;
  const canvas = makeCanvas(W, H);
  const c = canvas.getContext("2d");
  c.fillStyle = "rgba(150, 175, 215, 0.16)";
  c.fillRect(0, 0, W, H);
  c.strokeStyle = "rgba(25, 22, 20, 1)";
  c.lineWidth = 5;
  for (let d = -H; d < W + H; d += 64) {
    c.beginPath();
    c.moveTo(d, 0);
    c.lineTo(d + H, H);
    c.moveTo(d, 0);
    c.lineTo(d - H, H);
    c.stroke();
  }
  const tex = toTexture(canvas, { repeat: [1, 1] });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Old parchment; the canvas is returned too so writing can be added later.
export function parchment(fine) {
  const W = 512;
  const H = 700;
  const canvas = makeCanvas(W, H);
  const c = canvas.getContext("2d");
  c.fillStyle = "#e6d3a6";
  c.fillRect(0, 0, W, H);
  grain(c, fine, W, H, "multiply", 0.35);
  const edge = c.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
  edge.addColorStop(0, "rgba(120, 80, 30, 0)");
  edge.addColorStop(1, "rgba(120, 80, 30, 0.45)");
  c.fillStyle = edge;
  c.fillRect(0, 0, W, H);
  const base = makeCanvas(W, H);
  base.getContext("2d").drawImage(canvas, 0, 0);
  const tex = toTexture(canvas, { repeat: [1, 1] });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return { canvas, base, texture: tex };
}

// Straw for the broom's bristles.
function straw() {
  const W = 256;
  const canvas = makeCanvas(W, W);
  const c = canvas.getContext("2d");
  const rand = random(31);
  c.fillStyle = "#7a5a2a";
  c.fillRect(0, 0, W, W);
  for (let i = 0; i < 260; i++) {
    c.strokeStyle = hsl(36 + rand() * 12, 45 + rand() * 20, 28 + rand() * 25, 0.8);
    c.lineWidth = 1 + rand() * 1.5;
    const x = rand() * W;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x + (rand() - 0.5) * 12, W);
    c.stroke();
  }
  return toTexture(canvas, { repeat: [4, 1] });
}

export function makeRoomTextures() {
  const fine = noiseTile(256, 1, 16, 3);
  const coarse = noiseTile(256, 2, 4, 4);
  return {
    stone: stoneWall(fine, coarse),
    floor: floorBoards(fine),
    walnut: walnut(fine),
    oak: walnut(fine, 9, [30, 38, 30]),
    beams: walnut(fine, 11, [25, 30, 14]),
    velvet: velvet(fine, [108, 14, 24]),
    linen: velvet(fine, [226, 218, 200]),
    quilt: quilt(fine),
    rug: rug(fine),
    leather: leather(fine, coarse),
    spines: bookSpines(fine),
    glass: leadedGlass(),
    straw: straw(),
    fine,
  };
}
