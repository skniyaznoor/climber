import * as THREE from 'three';

// Procedural canvas textures, so the game ships with zero image assets.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 + amt;
  const c = (v) => Math.max(0, Math.min(255, v * f)) | 0;
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function polyline(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

export function makeWallTextures(style) {
  // 1024px covers 8x8 world units, so the tiling repeats less obviously.
  const S = 1024;
  const [c, g] = makeCanvas(S, S);
  const [ec, eg] = makeCanvas(S, S);
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, S, S);
  const r = rng(style.seed);

  g.fillStyle = style.mortar;
  g.fillRect(0, 0, S, S);
  const rows = 16, bh = S / rows, bw = S / 8;
  const bricks = [];
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * bw / 2;
    for (let col = -1; col < 9; col++) {
      const x = col * bw + off, y = row * bh;
      g.fillStyle = shade(style.brick, (r() - 0.5) * style.variance * 2);
      g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      bricks.push([x + 3, y + 3, bw - 6, bh - 6]);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.18})` : `rgba(255,255,255,${r() * 0.07})`;
        g.fillRect(x + 4 + r() * (bw - 12), y + 4 + r() * (bh - 12), 1 + r() * 5, 1 + r() * 4);
      }
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + 3, y + 3, bw - 6, 3);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x + 3, y + bh - 7, bw - 6, 4);
    }
  }

  if (style.extra === 'moss') {
    for (let i = 0; i < 200; i++) {
      g.fillStyle = `rgba(${(60 + r() * 40) | 0},${(110 + r() * 50) | 0},${(40 + r() * 20) | 0},${0.25 + r() * 0.35})`;
      g.beginPath();
      g.arc(r() * S, r() * S, 4 + r() * 14, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(70,120,50,0.6)';
    g.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      let x = r() * S, y = 0;
      const pts = [[x, y]];
      while (y < S) { x += (r() - 0.5) * 14; y += 8; pts.push([x, y]); }
      polyline(g, pts);
    }
  }

  if (style.extra === 'wet') {
    for (let i = 0; i < 140; i++) {
      const x = r() * S, w = 2 + r() * 6, y = r() * S, h = 40 + r() * 200;
      const grd = g.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, 'rgba(0,20,30,0)');
      grd.addColorStop(0.5, 'rgba(0,30,40,0.4)');
      grd.addColorStop(1, 'rgba(0,20,30,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, w, h);
    }
    for (let i = 0; i < 120; i++) {
      eg.fillStyle = `rgba(40,255,210,${0.2 + r() * 0.4})`;
      eg.beginPath();
      eg.arc(r() * S, r() * S, 1 + r() * 2.5, 0, Math.PI * 2);
      eg.fill();
    }
  }

  if (style.extra === 'cracks') {
    for (let i = 0; i < 60; i++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 70;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(0,0,0,0.45)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 9; i++) {
      let x = r() * S, y = r() * S;
      let dir = r() * Math.PI * 2;
      const pts = [[x, y]];
      for (let k = 0; k < 22; k++) {
        dir += (r() - 0.5) * 1.2;
        x += Math.cos(dir) * 26; y += Math.sin(dir) * 26;
        pts.push([x, y]);
        if (r() < 0.12) {
          const bx = x + (r() - 0.5) * 70, by = y + (r() - 0.5) * 70;
          eg.strokeStyle = '#ff4a08'; eg.lineWidth = 2; polyline(eg, [[x, y], [bx, by]]);
        }
      }
      g.strokeStyle = '#1a0500'; g.lineWidth = 6; polyline(g, pts);
      eg.strokeStyle = '#ff4a08'; eg.lineWidth = 4; polyline(eg, pts);
      eg.strokeStyle = '#ffd060'; eg.lineWidth = 1.5; polyline(eg, pts);
    }
  }

  if (style.extra === 'frost') {
    for (const [x, y, w, h] of bricks) {
      const grd = g.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, 'rgba(240,250,255,0.85)');
      grd.addColorStop(0.35, 'rgba(220,240,255,0.15)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, w, h);
    }
    for (let i = 0; i < 300; i++) {
      eg.fillStyle = `rgba(150,210,255,${0.2 + r() * 0.4})`;
      eg.fillRect(r() * S, r() * S, 1.5, 1.5);
    }
  }

  if (style.extra === 'circuit') {
    for (let i = 0; i < 60; i++) {
      let x = ((r() * 32) | 0) * 32, y = ((r() * 32) | 0) * 32;
      const pts = [[x, y]];
      for (let k = 0; k < 5; k++) {
        const step = (r() < 0.5 ? -1 : 1) * 32 * (1 + ((r() * 3) | 0));
        if (r() < 0.5) x += step; else y += step;
        pts.push([x, y]);
      }
      const col = r() < 0.5 ? 'rgba(160,100,255,0.95)' : 'rgba(80,220,255,0.95)';
      eg.strokeStyle = col; eg.lineWidth = 2; polyline(eg, pts);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; polyline(g, pts);
      eg.fillStyle = col;
      eg.beginPath(); eg.arc(x, y, 4, 0, Math.PI * 2); eg.fill();
    }
  }

  return { map: toTexture(c), emissiveMap: style.emissive ? toTexture(ec) : null };
}

export function makeMetalTexture(rusty) {
  const [c, g] = makeCanvas(256, 128);
  const r = rng(rusty ? 99 : 42);
  g.fillStyle = rusty ? '#9a7a66' : '#d4d4d4';
  g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 1400; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${r() * 0.07})`;
    g.fillRect(r() * 256, r() * 128, 1 + r() * 3, 1 + r() * 2);
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    g.fillRect(0, r() * 128, 256, 1);
  }
  if (rusty) {
    for (let i = 0; i < 50; i++) {
      const x = r() * 256, y = r() * 128, rad = 3 + r() * 16;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(120,50,15,0.8)');
      grd.addColorStop(1, 'rgba(120,50,15,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  return toTexture(c);
}

export function makeLabelTexture(text, color = '#ffd36a') {
  const [c, g] = makeCanvas(256, 64);
  g.font = 'bold 34px "Bungee", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
