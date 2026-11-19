// The four house banners, painted on a canvas: the house colour, a fine
// border in its metal, a shield with the house animal, and the house name on
// a ribbon. Used in the tower room and in the great hall.

const HOUSES = [
  { name: "SLYTHERIN", cloth: ["#1f6b3a", "#0c3a1d"], metal: "#c9d1d6", ink: "#0b2a16", animal: snake },
  { name: "RAVENCLAW", cloth: ["#22406f", "#0e1e3c"], metal: "#c58d4e", ink: "#0d1a33", animal: eagle },
  { name: "HUFFLEPUFF", cloth: ["#f2c230", "#c98f12"], metal: "#2a2218", ink: "#2a2218", animal: badger },
  { name: "GRYFFINDOR", cloth: ["#a3202a", "#5e0d14"], metal: "#e2b851", ink: "#4a0a10", animal: lion },
];

const W = 320;
const H = 880;

// the banner's outline: a long panel with a swallowtail cut at the bottom
function outline(c, inset) {
  c.beginPath();
  c.moveTo(inset, inset);
  c.lineTo(W - inset, inset);
  c.lineTo(W - inset, H - inset * 1.4);
  c.lineTo(W / 2, H * 0.8 + inset * 0.6);
  c.lineTo(inset, H - inset * 1.4);
  c.closePath();
}

function shield(c, x, y, w, h) {
  c.beginPath();
  c.moveTo(x - w / 2, y - h / 2);
  c.lineTo(x + w / 2, y - h / 2);
  c.lineTo(x + w / 2, y + h * 0.05);
  c.quadraticCurveTo(x + w / 2, y + h * 0.38, x, y + h / 2);
  c.quadraticCurveTo(x - w / 2, y + h * 0.38, x - w / 2, y + h * 0.05);
  c.closePath();
}

// ---------- the four animals, drawn around (0, 0), about 150px across ----------

function snake(c, h) {
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = h.metal;
  c.lineWidth = 15;
  c.beginPath();
  c.moveTo(-28, 70);
  c.bezierCurveTo(-70, 60, -70, 20, -20, 12);
  c.bezierCurveTo(40, 2, 48, -40, 6, -48);
  c.bezierCurveTo(-18, -52, -30, -40, -26, -28);
  c.stroke();
  // scales along the body
  c.strokeStyle = h.ink;
  c.lineWidth = 2;
  c.setLineDash([3, 7]);
  c.stroke();
  c.setLineDash([]);
  // head and tongue
  c.fillStyle = h.metal;
  c.beginPath();
  c.ellipse(-24, -30, 15, 11, -0.6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = h.ink;
  c.beginPath();
  c.arc(-20, -35, 2.6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#c0303a";
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(-36, -22);
  c.lineTo(-46, -12);
  c.moveTo(-46, -12);
  c.lineTo(-52, -14);
  c.moveTo(-46, -12);
  c.lineTo(-48, -5);
  c.stroke();
}

function eagle(c, h) {
  c.fillStyle = h.metal;
  // spread wings, each a fan of feathers
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(s * 8, -6 + i * 4);
      c.quadraticCurveTo(s * (30 + i * 6), -54 + i * 12, s * (70 - i * 4), -40 + i * 16);
      c.quadraticCurveTo(s * (40 + i * 2), -14 + i * 10, s * 8, 10 + i * 4);
      c.fill();
    }
  }
  // body, tail, head
  c.beginPath();
  c.ellipse(0, 6, 16, 32, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(-14, 32);
  c.lineTo(14, 32);
  c.lineTo(20, 64);
  c.lineTo(0, 56);
  c.lineTo(-20, 64);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(0, -32, 13, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(9, -34);
  c.quadraticCurveTo(24, -32, 18, -22);
  c.lineTo(8, -26);
  c.fill();
  c.fillStyle = h.ink;
  c.beginPath();
  c.arc(4, -35, 2.4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = h.ink;
  c.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-8, -6 + i * 10);
    c.quadraticCurveTo(0, -2 + i * 10, 8, -6 + i * 10);
    c.stroke();
  }
}

function badger(c, h) {
  // a badger's face, looking out: black and white stripes
  c.fillStyle = h.ink;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * 40, -46, 13, 15, s * 0.4, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.moveTo(-54, -30);
  c.quadraticCurveTo(-60, 30, 0, 66);
  c.quadraticCurveTo(60, 30, 54, -30);
  c.quadraticCurveTo(0, -70, -54, -30);
  c.fill();
  // the white stripe down the middle and the white cheeks
  c.fillStyle = "#f4efe2";
  c.beginPath();
  c.moveTo(-10, -58);
  c.quadraticCurveTo(0, -62, 10, -58);
  c.lineTo(13, 40);
  c.quadraticCurveTo(0, 58, -13, 40);
  c.closePath();
  c.fill();
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 52, -24);
    c.quadraticCurveTo(s * 50, 18, s * 18, 46);
    c.quadraticCurveTo(s * 34, 6, s * 30, -28);
    c.closePath();
    c.fill();
  }
  // eyes and nose
  c.fillStyle = "#f6d36a";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.arc(s * 24, -8, 4.5, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#111";
  c.beginPath();
  c.ellipse(0, 46, 9, 6, 0, 0, Math.PI * 2);
  c.fill();
}

function lion(c, h) {
  // a lion's head: a flame-like mane round a broad face
  c.fillStyle = h.metal;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
    c.quadraticCurveTo(Math.cos(a + 0.2) * 82, Math.sin(a + 0.2) * 82, Math.cos(a + 0.45) * 60, Math.sin(a + 0.45) * 60);
    c.lineTo(Math.cos(a + 0.35) * 40, Math.sin(a + 0.35) * 40);
    c.fill();
  }
  c.beginPath();
  c.arc(0, 0, 58, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#f3d58a";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.arc(s * 26, -30, 9, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.moveTo(-30, -16);
  c.quadraticCurveTo(0, -30, 30, -16);
  c.quadraticCurveTo(36, 22, 0, 40);
  c.quadraticCurveTo(-36, 22, -30, -16);
  c.fill();
  c.fillStyle = h.ink;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * 13, -8, 4, 3, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.moveTo(-8, 10);
  c.lineTo(8, 10);
  c.lineTo(0, 18);
  c.closePath();
  c.fill();
  c.strokeStyle = h.ink;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(0, 18);
  c.lineTo(0, 24);
  c.moveTo(-10, 28);
  c.quadraticCurveTo(0, 32, 10, 28);
  c.stroke();
}

// ---------- painting one banner ----------

function paint(c, h) {
  c.clearRect(0, 0, W, H);
  const grad = c.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, h.cloth[0]);
  grad.addColorStop(1, h.cloth[1]);
  outline(c, 0);
  c.fillStyle = grad;
  c.fill();
  // folds of cloth
  for (let x = 0; x < W; x += 40) {
    const g = c.createLinearGradient(x, 0, x + 40, 0);
    g.addColorStop(0, "rgba(0,0,0,0.08)");
    g.addColorStop(0.5, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0.08)");
    c.fillStyle = g;
    outline(c, 0);
    c.save();
    c.clip();
    c.fillRect(x, 0, 40, H);
    c.restore();
  }
  // a fine border in the house metal, with little corner flourishes
  c.strokeStyle = h.metal;
  c.lineWidth = 3;
  outline(c, 20);
  c.stroke();
  c.lineWidth = 1.2;
  outline(c, 28);
  c.stroke();
  // the shield and the animal
  const cy = H * 0.34;
  c.save();
  shield(c, W / 2, cy, 200, 236);
  c.fillStyle = h.cloth[1];
  c.shadowColor = "rgba(0,0,0,0.45)";
  c.shadowBlur = 14;
  c.fill();
  c.restore();
  c.lineWidth = 7;
  c.strokeStyle = h.metal;
  shield(c, W / 2, cy, 200, 236);
  c.stroke();
  c.save();
  c.translate(W / 2, cy - 4);
  h.animal(c, h);
  c.restore();
  // the house name on a ribbon
  const ry = cy + 150;
  c.fillStyle = h.metal;
  c.beginPath();
  c.moveTo(34, ry - 22);
  c.lineTo(W - 34, ry - 22);
  c.lineTo(W - 18, ry);
  c.lineTo(W - 34, ry + 22);
  c.lineTo(34, ry + 22);
  c.lineTo(18, ry);
  c.closePath();
  c.fill();
  c.fillStyle = h.ink;
  c.textAlign = "center";
  c.textBaseline = "middle";
  let size = 30;
  c.font = `700 ${size}px Cinzel, Georgia, serif`;
  while (c.measureText(h.name).width > W - 90 && size > 14) {
    size -= 1;
    c.font = `700 ${size}px Cinzel, Georgia, serif`;
  }
  c.fillText(h.name, W / 2, ry + 1);
}

// A canvas with house i's banner (0 Slytherin, 1 Ravenclaw, 2 Hufflepuff,
// 3 Gryffindor). onRepaint is called once the Cinzel font has loaded and the
// house name has been painted again with it.
export function houseBannerCanvas(i, onRepaint) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  paint(c, HOUSES[i]);
  document.fonts
    ?.load?.("700 30px Cinzel")
    .then(() => {
      paint(c, HOUSES[i]);
      onRepaint?.();
    })
    .catch(() => {});
  return canvas;
}

export const HOUSE_COLOURS = HOUSES.map((h) => h.cloth[0]);
