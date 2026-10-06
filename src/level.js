import * as THREE from 'three';
import { ZONES, ZONE_HEIGHT, zoneByIndex, zoneAt } from './zones.js';
import { makeMetalTexture } from './textures.js';
import { WALL_Z } from './world.js';
import { PW, PH } from './player.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = (p) => Math.random() < (p || 0);

const PIPE_R = 0.32;
const LIMIT = 8.6; // max |x| a platform edge may reach

// Shared geometry: unit cylinders oriented along X, scaled per pipe.
const pipeGeo = new THREE.CylinderGeometry(1, 1, 1, 20).rotateZ(Math.PI / 2);
const flangeGeo = new THREE.CylinderGeometry(1, 1, 1, 20).rotateZ(Math.PI / 2);
const holeGeo = new THREE.CircleGeometry(1, 16).rotateY(Math.PI / 2);
const shardGeo = new THREE.TetrahedronGeometry(1);
const bracketGeo = new THREE.BoxGeometry(0.14, 0.14, 1);
const plateGeo = new THREE.BoxGeometry(0.5, 0.5, 0.08);
const railGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 10);
const rungGeo = new THREE.BoxGeometry(0.64, 0.06, 0.07);
const nozzleGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.22, 14);
const columnGeo = new THREE.CylinderGeometry(0.18, 0.38, 1, 16, 1, true).translate(0, 0.5, 0);
const icicleGeo = new THREE.ConeGeometry(0.16, 0.9, 6).rotateX(Math.PI);
const gemGeo = new THREE.OctahedronGeometry(0.28, 0);
const fireballGeo = new THREE.IcosahedronGeometry(0.42, 1);
const warnGeo = new THREE.RingGeometry(0.35, 0.55, 24);
const heartGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.25);
  s.bezierCurveTo(0, 0.3, -0.05, 0.4, -0.2, 0.4);
  s.bezierCurveTo(-0.45, 0.4, -0.45, 0.12, -0.45, 0.12);
  s.bezierCurveTo(-0.45, -0.05, -0.25, -0.25, 0, -0.42);
  s.bezierCurveTo(0.25, -0.25, 0.45, -0.05, 0.45, 0.12);
  s.bezierCurveTo(0.45, 0.12, 0.45, 0.4, 0.2, 0.4);
  s.bezierCurveTo(0.05, 0.4, 0, 0.3, 0, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  g.center();
  return g;
})();

const CYCLES = {
  flame: { off: 1.8, warn: 0.7, on: 1.3, height: 2.7 },
  geyser: { off: 1.9, warn: 0.6, on: 1.0, height: 4.5 },
  charged: { idle: 2.6, warn: 0.9, active: 1.4 },
  leak: { off: 1.6, warn: 0.5, on: 1.2 },
};

const LEAK_MODE = { stone: 'dust', water: 'water', fire: 'fire', ice: 'frost', storm: 'spark' };

class Materials {
  constructor() {
    this.metal = makeMetalTexture(false);
    this.rustTex = makeMetalTexture(true);
    this.cache = new Map();
    this.dark = new THREE.MeshStandardMaterial({ color: 0x1c1c22, metalness: 0.8, roughness: 0.4 });
    this.hole = new THREE.MeshBasicMaterial({ color: 0x050505 });
    this.icy = new THREE.MeshStandardMaterial({
      color: 0x6ab8e0, metalness: 0.2, roughness: 0.3, emissive: 0x1a5a8a, emissiveIntensity: 0.45,
    });
    this.icicle = new THREE.MeshStandardMaterial({
      color: 0xdff6ff, metalness: 0.1, roughness: 0.05, emissive: 0x4ab0ff, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.9,
    });
    this.heart = new THREE.MeshStandardMaterial({ color: 0xff2a4a, emissive: 0xff1a3a, emissiveIntensity: 2.2, roughness: 0.3 });
    this.fireball = new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff5a10, emissiveIntensity: 4, flatShading: true });
    this.bolt = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 7) });
  }

  get(key, make) {
    if (!this.cache.has(key)) this.cache.set(key, make());
    return this.cache.get(key);
  }

  pipe(z) {
    return this.get('pipe' + z.key, () => new THREE.MeshStandardMaterial({ color: z.pipe, map: this.metal, metalness: 0.75, roughness: 0.38 }));
  }
  rust(z) {
    return this.get('rust' + z.key, () => new THREE.MeshStandardMaterial({ color: z.rust, map: this.rustTex, metalness: 0.45, roughness: 0.75 }));
  }
  accent(z) {
    return this.get('acc' + z.key, () => new THREE.MeshStandardMaterial({ color: z.accent, emissive: z.accent, emissiveIntensity: 2.5, roughness: 0.4 }));
  }
  warning(z) {
    return this.get('warn' + z.key, () => new THREE.MeshStandardMaterial({ color: 0xff3a1a, emissive: 0xff2a00, emissiveIntensity: 2.5, roughness: 0.4 }));
  }
  gem(z) {
    return this.get('gem' + z.key, () => new THREE.MeshStandardMaterial({
      color: z.gem, emissive: z.gem, emissiveIntensity: 2.2, metalness: 0.3, roughness: 0.15, flatShading: true,
    }));
  }
  ladder(z) {
    return this.get('lad' + z.key, () => new THREE.MeshStandardMaterial({
      color: 0xd0d0d0, map: this.metal, metalness: 0.85, roughness: 0.3, emissive: z.accent, emissiveIntensity: 0.35,
    }));
  }
}

export class Level {
  constructor(scene, fx, audio) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.mats = new Materials();
    this.root = new THREE.Group();
    scene.add(this.root);
    this.callbacks = { hurt: () => {}, gem: () => {}, heart: () => {} };
    this.col = new THREE.Color();
    this.reset();
  }

  reset() {
    for (const c of [...this.root.children]) this.removeObj(c);
    this.platforms = [];
    this.ladders = [];
    this.vents = [];
    this.leaks = [];
    this.icicles = [];
    this.pickups = [];
    this.fireballs = [];
    this.strikes = [];
    this.nextY = 2.6;
    this.lastX = 0;
    this.count = 0;
    this.wind = { state: 'calm', t: 3, dir: 1, strength: 0 };
    this.windForce = 0;
    this.fireT = 3;
    this.lightningT = 4;
    this.flash = 0;
    this.addPipe({ x: 0, y: -0.45, len: 17.4, r: 0.45, zone: ZONES[0], floor: true });
  }

  removeObj(obj) {
    if (!obj) return;
    obj.parent && obj.parent.remove(obj);
    obj.traverse((o) => {
      if (o.material && o.material.userData.own) o.material.dispose();
    });
  }

  // ---------------------------------------------------------------- building
  buildPipe(len, r, mat, zone, opts) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(pipeGeo, mat);
    body.scale.set(len, r, r);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    for (const side of [-1, 1]) {
      const ex = side * len / 2;
      if (opts.brokenEnd === side) {
        const hole = new THREE.Mesh(holeGeo, this.mats.hole);
        hole.scale.setScalar(r * 0.8);
        hole.position.x = ex + side * 0.005;
        hole.rotation.y = side > 0 ? 0 : Math.PI;
        g.add(hole);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + rand(0, 0.6);
          const sh = new THREE.Mesh(shardGeo, mat);
          sh.scale.setScalar(rand(0.08, 0.16));
          sh.position.set(ex + side * 0.06, Math.cos(a) * r, Math.sin(a) * r);
          sh.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
          g.add(sh);
        }
      } else {
        const f = new THREE.Mesh(flangeGeo, mat);
        f.scale.set(0.16, r * 1.3, r * 1.3);
        f.position.x = ex - side * 0.08;
        f.castShadow = true;
        g.add(f);
      }
    }

    const bandMat = opts.broken ? this.mats.warning(zone) : this.mats.accent(zone);
    const bands = Math.max(1, Math.floor(len / 1.8));
    for (let k = 0; k < bands; k++) {
      const band = new THREE.Mesh(flangeGeo, bandMat);
      band.scale.set(0.07, r * 1.08, r * 1.08);
      band.position.x = -len / 2 + (len * (k + 0.5)) / bands;
      g.add(band);
    }

    if (!opts.moving) {
      const nb = len > 4 ? 2 : 1;
      for (let k = 0; k < nb; k++) {
        const bx = nb === 1 ? 0 : (k === 0 ? -len / 3 : len / 3);
        const br = new THREE.Mesh(bracketGeo, this.mats.dark);
        const depth = -WALL_Z;
        br.scale.z = depth;
        br.position.set(bx, 0, -depth / 2);
        g.add(br);
        const plate = new THREE.Mesh(plateGeo, this.mats.dark);
        plate.position.set(bx, 0, WALL_Z + 0.04);
        g.add(plate);
      }
    }
    return g;
  }

  addPipe(o) {
    const zone = o.zone;
    const r = o.r || PIPE_R;
    let mat;
    if (o.icy) mat = this.mats.icy;
    else if (o.broken) mat = this.mats.rust(zone);
    else if (o.charged) {
      mat = this.mats.pipe(zone).clone();
      mat.userData.own = true;
    } else mat = this.mats.pipe(zone);
    const mesh = this.buildPipe(o.len, r, mat, zone, o);
    mesh.position.set(o.x, o.y, 0);
    this.root.add(mesh);
    const p = {
      ...o, r, mesh, mat, top: o.y + r, x0: o.x - o.len / 2, x1: o.x + o.len / 2,
      alive: true, falling: false, vy: 0, dx: 0, baseX: o.x, crumble: -1,
      state: 'idle', t: rand(0.5, CYCLES.charged.idle), spin: rand(-2, 2),
    };
    this.platforms.push(p);
    return p;
  }

  addLadder(x, y0, y1, zone) {
    const g = new THREE.Group();
    const h = y1 - y0;
    const mat = this.mats.ladder(zone);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, mat);
      rail.scale.y = h + 0.4;
      rail.position.set(s * 0.32, h / 2 + 0.2, 0);
      rail.castShadow = true;
      g.add(rail);
    }
    for (let yy = 0.35; yy < h + 0.3; yy += 0.42) {
      const rung = new THREE.Mesh(rungGeo, mat);
      rung.position.y = yy;
      rung.castShadow = true;
      g.add(rung);
    }
    g.position.set(x, y0, -0.6);
    this.root.add(g);
    this.ladders.push({ x, y0, y1, mesh: g });
  }

  addVent(p, type) {
    const ox = (chance(0.5) ? -1 : 1) * p.len * 0.27;
    const nozzle = new THREE.Mesh(nozzleGeo, this.mats.dark);
    nozzle.position.set(ox, p.r + 0.08, 0);
    p.mesh.add(nozzle);
    const ring = new THREE.Mesh(flangeGeo, this.mats.warning(p.zone));
    ring.rotation.z = Math.PI / 2;
    ring.scale.set(0.05, 0.2, 0.2);
    ring.position.set(ox, p.r + 0.19, 0);
    p.mesh.add(ring);
    const colMat = new THREE.MeshBasicMaterial({
      color: type === 'flame' ? new THREE.Color(2.5, 0.9, 0.2) : new THREE.Color(0.6, 1.6, 2.2),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    colMat.userData.own = true;
    const col = new THREE.Mesh(columnGeo, colMat);
    col.position.set(ox, p.r + 0.15, 0);
    col.visible = false;
    p.mesh.add(col);
    const cyc = CYCLES[type];
    this.vents.push({ p, ox, type, state: 'off', t: rand(0.3, cyc.off), col, colMat, height: cyc.height, cyc, power: 0 });
  }

  addLeak(a, b, zone) {
    const mode = LEAK_MODE[zone.key];
    const hazardous = mode === 'fire' || mode === 'spark';
    let arc = null;
    if (mode === 'spark') {
      arc = new THREE.Mesh(new THREE.BufferGeometry(), this.mats.bolt);
      arc.visible = false;
      this.root.add(arc);
    }
    this.leaks.push({ a, b, y: a.y, mode, hazardous, state: hazardous ? 'off' : 'on', t: rand(0.3, 1.6), arc, acc: 0 });
  }

  addIcicle(p) {
    const ox = rand(-p.len * 0.35, p.len * 0.35);
    const mesh = new THREE.Mesh(icicleGeo, this.mats.icicle);
    const y = p.y - p.r - 0.42;
    mesh.position.set(p.x + ox, y, 0);
    mesh.castShadow = true;
    this.root.add(mesh);
    this.icicles.push({ p, x: p.x + ox, y, y0: y, vy: 0, state: 'hang', t: 0, mesh });
  }

  addPickup(x, y, kind, zone) {
    const mesh = new THREE.Mesh(kind === 'heart' ? heartGeo : gemGeo, kind === 'heart' ? this.mats.heart : this.mats.gem(zone));
    if (kind === 'heart') mesh.scale.setScalar(0.85);
    mesh.position.set(x, y, 0);
    this.root.add(mesh);
    this.pickups.push({ x, y, kind, mesh, phase: Math.random() * 6, zone });
  }

  // -------------------------------------------------------------- generation
  pickX(len) {
    const lim = LIMIT - len / 2;
    let dir = chance(0.5) ? -1 : 1;
    if (this.lastX > 3.5) dir = -1;
    else if (this.lastX < -3.5) dir = 1;
    return clamp(this.lastX + dir * rand(1.6, 4.8), -lim, lim);
  }

  generateUpTo(targetY) {
    while (this.nextY < targetY) {
      const y = this.nextY;
      const zi = Math.floor(y / ZONE_HEIGHT);
      const zone = zoneByIndex(zi);
      const lap = Math.floor(zi / ZONES.length);
      const diff = Math.min(1, (zi + lap * 2) / 7);
      this.count++;
      // Keep the first few metres of every zone gentle so the banner can be read.
      const local = y - zi * ZONE_HEIGHT;
      if (this.count > 3 && local > 6 && chance(zone.features.ladder)) {
        this.genLadder(y, zone);
        continue;
      }
      if (this.count > 2 && chance(zone.features.split)) this.genSplit(y, zone, diff, local);
      else this.genSingle(y, zone, diff, local);
      this.nextY = y + rand(1.9, 2.5) + diff * 0.45;
    }
  }

  genSingle(y, zone, diff, local) {
    const f = zone.features;
    const easy = local < 5;
    let len = rand(2.4, 4.4) * (1 - diff * 0.3);
    const type = { zone };
    if (chance(f.icy)) type.icy = true;
    if (!easy && chance((f.moving || 0) + diff * 0.08)) type.moving = true;
    else if (!easy && chance((f.broken || 0) + diff * 0.1)) type.broken = true;
    if (!type.broken && !type.icy && !easy) {
      if (chance(f.hot)) type.charged = 'hot';
      else if (chance(f.electric)) type.charged = 'electric';
    }
    if (type.charged) len = Math.max(len, 3);
    const lim = LIMIT - len / 2;
    let x = this.pickX(len);
    if (type.moving) {
      const amp = Math.min(rand(1.2, 2.6), lim * 0.9);
      x = clamp(x, -lim + amp, lim - amp);
      Object.assign(type, { amp, speed: rand(0.7, 1.3) * (1 + diff * 0.3), phase: rand(0, 6.28) });
    }
    const p = this.addPipe({ x, y, len, ...type });
    const stable = !type.moving && !type.broken && !type.charged;
    if (stable && len >= 3 && !easy) {
      if (chance((f.vent || 0) + (f.vent ? diff * 0.1 : 0))) this.addVent(p, 'flame');
      else if (chance(f.geyser)) this.addVent(p, 'geyser');
    }
    if (!type.moving && chance(f.icicle)) this.addIcicle(p);
    if (chance(0.45)) this.addPickup(x + rand(-len * 0.3, len * 0.3), p.top + 0.85, 'gem', zone);
    if (chance(f.side)) this.genSide(y + rand(-0.3, 0.5), zone, p);
    this.lastX = x;
  }

  genSide(y, zone, main) {
    const len = rand(1.8, 2.6);
    const left = main.x > 0;
    const lo = left ? -LIMIT + len / 2 : main.x1 + 2 + len / 2;
    const hi = left ? main.x0 - 2 - len / 2 : LIMIT - len / 2;
    if (hi <= lo) return;
    const x = rand(lo, hi);
    const p = this.addPipe({ x, y, len, zone, broken: chance(0.3) });
    this.addPickup(x, p.top + 0.85, chance(0.07) ? 'heart' : 'gem', zone);
  }

  genSplit(y, zone, diff, local) {
    const gap = rand(1.2, 1.7) + diff * 0.6;
    const seg = rand(1.9, 2.9);
    const total = seg * 2 + gap;
    const x = this.pickX(total);
    const a = this.addPipe({ x: x - gap / 2 - seg / 2, y, len: seg, zone, brokenEnd: 1, broken: local > 5 && chance(diff * 0.3) });
    const b = this.addPipe({ x: x + gap / 2 + seg / 2, y, len: seg, zone, brokenEnd: -1 });
    this.addLeak(a, b, zone);
    if (chance(0.6)) this.addPickup(x, y + 1.6, 'gem', zone);
    this.lastX = x;
  }

  genLadder(y, zone) {
    const len = rand(2.6, 3.6);
    const x = this.pickX(len);
    const base = this.addPipe({ x, y, len, zone });
    const side = chance(0.5) ? -1 : 1;
    const lx = clamp(x + side * len * 0.3, -7.8, 7.8);
    const h = rand(4.4, 6.6);
    const y0 = base.top, y1 = y0 + h;
    this.addLadder(lx, y0, y1, zone);
    const tlen = rand(2.8, 3.8);
    const tlim = LIMIT - tlen / 2;
    let tx = clamp(lx + side * rand(0.4, tlen / 2 - 0.5), -tlim, tlim);
    if (Math.abs(tx - lx) > tlen / 2 - 0.3) tx = clamp(lx, -tlim, tlim);
    this.addPipe({ x: tx, y: y1 - PIPE_R, len: tlen, zone });
    for (let k = 1; k <= 2; k++) this.addPickup(lx, y0 + (h * k) / 3 + 0.5, 'gem', zone);
    this.lastX = tx;
    this.nextY = y1 - PIPE_R + rand(1.9, 2.5);
  }

  onLand(p) {
    if (p.broken && p.crumble < 0) {
      p.crumble = 0;
      this.audio.creak();
    }
  }

  // ------------------------------------------------------------------ update
  update(dt, time, player, view, active) {
    this.flash = Math.max(0, this.flash - dt * 4);
    const pz = zoneAt(player.y);
    this.updateWind(dt, active ? pz.zone : ZONES[0]);
    this.updatePlatforms(dt, time);
    const g = player.ground;
    if (active && g && g.charged && g.state === 'active') {
      if (this.callbacks.hurt(g.x) && g.charged === 'electric') this.audio.zap();
    }
    this.updateVents(dt, player, active);
    this.updateLeaks(dt, player, active);
    this.updateIcicles(dt, time, player, active);
    this.updatePickups(time, player, active);
    if (active) this.updateSkyHazards(dt, player, view, pz);
  }

  updateWind(dt, zone) {
    const w = this.wind;
    if (!zone.features.wind) w.state = 'calm';
    else {
      w.t -= dt;
      if (w.t <= 0) {
        if (w.state === 'calm') {
          w.state = 'gust';
          w.t = rand(2, 3.2);
          w.dir = chance(0.5) ? -1 : 1;
          w.strength = rand(9, 14) * (zone.key === 'storm' ? 1.2 : 1);
          this.audio.wind();
        } else {
          w.state = 'calm';
          w.t = rand(2.5, 4.5);
        }
      }
    }
    const target = w.state === 'gust' ? w.dir * w.strength : 0;
    this.windForce += (target - this.windForce) * Math.min(1, dt * 2.5);
  }

  updatePlatforms(dt, time) {
    const col = this.col;
    for (const p of this.platforms) {
      if (!p.alive) continue;
      p.dx = 0;
      if (p.moving && !p.falling) {
        const nx = p.baseX + Math.sin(time * p.speed + p.phase) * p.amp;
        p.dx = nx - p.x;
        p.x = nx;
        p.x0 = nx - p.len / 2;
        p.x1 = nx + p.len / 2;
        p.mesh.position.x = nx;
      }
      if (p.broken && p.crumble >= 0 && !p.falling) {
        p.crumble += dt;
        p.mesh.position.x = p.x + Math.sin(time * 70) * 0.05 * (1 + p.crumble * 2);
        if (Math.random() < 0.4) {
          this.fx.burst(rand(p.x0, p.x1), p.y - p.r, 0.2, 1, { color: 0x9a7a5a, glow: false, speed: 0.5, gravity: 10, life: 0.7, size: 0.12, alpha: 0.8 });
        }
        if (p.crumble > 0.55) {
          p.falling = true;
          this.audio.crumble();
          for (let k = 0; k < 4; k++) {
            this.fx.burst(rand(p.x0, p.x1), p.y, 0.2, 6, { color: 0x8a6a4a, color2: 0x4a3a2a, glow: false, speed: 4, gravity: 18, life: 0.9, size: 0.18, alpha: 0.9 });
          }
        }
      }
      if (p.falling) {
        p.vy -= 28 * dt;
        p.y += p.vy * dt;
        p.top = p.y + p.r;
        p.mesh.position.y = p.y;
        p.mesh.rotation.z += p.spin * dt;
      }
      if (p.charged) {
        p.t -= dt;
        if (p.t <= 0) {
          const C = CYCLES.charged;
          p.state = p.state === 'idle' ? 'warn' : p.state === 'warn' ? 'active' : 'idle';
          p.t = p.state === 'idle' ? rand(C.idle * 0.8, C.idle * 1.3) : C[p.state];
          if (p.state === 'active' && p.charged === 'electric') this.audio.zap();
        }
        const hot = p.charged === 'hot';
        p.mat.emissive.setHex(hot ? 0xff3a00 : 0x40c0ff);
        if (p.state === 'idle') p.mat.emissiveIntensity = hot ? 0.15 : 0.05;
        else if (p.state === 'warn') p.mat.emissiveIntensity = (Math.sin(time * 28) * 0.5 + 0.5) * (hot ? 1.2 : 1.5);
        else {
          p.mat.emissiveIntensity = hot ? 2.2 : 1.5 + Math.random() * 2;
          if (Math.random() < 0.6) {
            col.setHex(hot ? 0xff8a20 : 0xa0e8ff);
            this.fx.glow.spawn(rand(p.x0, p.x1), p.top, rand(-0.2, 0.3),
              rand(-1, 1), hot ? rand(1, 3) : rand(-2, 4), 0, hot ? 0.6 : 0.15, hot ? 0.16 : 0.12, col, 1);
          }
        }
      }
    }
  }

  updateVents(dt, player, active) {
    const col = this.col;
    for (const v of this.vents) {
      if (!v.p.alive) continue;
      v.t -= dt;
      if (v.t <= 0) {
        v.state = v.state === 'off' ? 'warn' : v.state === 'warn' ? 'on' : 'off';
        v.t = v.cyc[v.state] * (v.state === 'off' ? rand(0.8, 1.3) : 1);
        if (v.state === 'on' && active && Math.abs(player.y - v.p.y) < 12) {
          v.type === 'flame' ? this.audio.flame() : this.audio.geyser();
        }
      }
      const wx = v.p.x + v.ox, wy = v.p.top + 0.15;
      v.power += ((v.state === 'on' ? 1 : 0) - v.power) * Math.min(1, dt * 12);
      v.col.visible = v.power > 0.02;
      v.col.scale.set(1 + Math.sin(v.t * 40) * 0.08, v.height * v.power, 1 + Math.cos(v.t * 37) * 0.08);
      v.colMat.opacity = 0.45 * v.power;
      if (v.state === 'warn' && Math.random() < 0.5) {
        col.setHex(v.type === 'flame' ? 0xff7a20 : 0xbff4ff);
        (v.type === 'flame' ? this.fx.glow : this.fx.soft).spawn(wx + rand(-0.1, 0.1), wy, 0.1, rand(-0.5, 0.5), rand(1, 2.5), 0, 0.35, 0.12, col, 0.9);
      }
      if (v.state === 'on') {
        for (let k = 0; k < 3; k++) {
          if (v.type === 'flame') {
            col.setHex(Math.random() < 0.5 ? 0xff6a10 : 0xffd040);
            this.fx.glow.spawn(wx + rand(-0.15, 0.15), wy, rand(-0.1, 0.2), rand(-0.6, 0.6), rand(6, 9), 0, rand(0.25, 0.4), rand(0.25, 0.45), col, 1, 0, 1.5, -0.5);
          } else {
            col.setHex(Math.random() < 0.5 ? 0xd8f8ff : 0x6ad0ff);
            this.fx.soft.spawn(wx + rand(-0.15, 0.15), wy, rand(-0.1, 0.2), rand(-0.8, 0.8), rand(10, 14), 0, 0.45, rand(0.14, 0.26), col, 0.85, 12, 0.5, 0.6);
          }
        }
        if (active && !player.dead) {
          const hw = PW / 2;
          if (Math.abs(player.x - wx) < hw + 0.3 && player.y < wy + v.height && player.y + PH > wy) {
            if (v.type === 'flame') this.callbacks.hurt(wx);
            else if (player.launch(20)) {
              this.audio.whoosh();
              this.fx.burst(wx, wy + 0.4, 0.3, 20, { color: 0xd8f8ff, glow: false, speed: 5, gravity: 10, life: 0.6, size: 0.18, alpha: 0.8 });
            }
          }
        }
      }
    }
  }

  updateLeaks(dt, player, active) {
    const col = this.col;
    for (const L of this.leaks) {
      const { a, b } = L;
      if (!a.alive || !b.alive) continue;
      if (a.falling) { L.state = 'off'; if (L.arc) L.arc.visible = false; continue; }
      if (L.hazardous) {
        L.t -= dt;
        if (L.t <= 0) {
          L.state = L.state === 'off' ? 'warn' : L.state === 'warn' ? 'on' : 'off';
          L.t = CYCLES.leak[L.state] * (L.state === 'off' ? rand(0.8, 1.4) : 1);
        }
      }
      const xa = a.x1, xb = b.x0, y = L.y;
      const mid = (xa + xb) / 2;
      switch (L.mode) {
        case 'water':
          for (const [ex, dir] of [[xa, 1], [xb, -1]]) {
            col.setHex(Math.random() < 0.5 ? 0x8ad8ff : 0xd8f8ff);
            this.fx.soft.spawn(ex, y + rand(-0.15, 0.15), rand(-0.15, 0.15), dir * rand(0.6, 1.8), rand(-0.5, 0.8), 0, 0.9, rand(0.1, 0.18), col, 0.75, 18, 0.3);
          }
          break;
        case 'dust':
          if (Math.random() < 0.35) {
            col.setHex(0xb8a080);
            this.fx.soft.spawn(rand(xa, xb), y - 0.2, 0, rand(-0.2, 0.2), -0.5, 0, 1.5, 0.08, col, 0.6, 6);
          }
          break;
        case 'frost':
          if (Math.random() < 0.5) {
            col.setHex(0xe8faff);
            this.fx.soft.spawn(rand(xa, xb), y, rand(-0.2, 0.2), rand(-0.3, 0.3), rand(0.8, 1.6), 0, 1.4, rand(0.2, 0.35), col, 0.35, 0, 0.5, 1.5, 0.5);
          }
          break;
        case 'fire':
          if (L.state === 'on') {
            for (let k = 0; k < 4; k++) {
              col.setHex(Math.random() < 0.5 ? 0xff5a10 : 0xffc030);
              this.fx.glow.spawn(rand(xa, xb), y + rand(-0.2, 0.1), rand(-0.2, 0.2), rand(-0.5, 0.5), rand(4, 7), 0, rand(0.25, 0.4), rand(0.25, 0.42), col, 1, 0, 1.5, -0.5);
            }
          } else if (Math.random() < (L.state === 'warn' ? 0.8 : 0.15)) {
            col.setHex(L.state === 'warn' ? 0xff8a30 : 0x553322);
            (L.state === 'warn' ? this.fx.glow : this.fx.soft).spawn(rand(xa, xb), y, 0, 0, rand(1, 2), 0, 0.5, 0.15, col, 0.7);
          }
          break;
        case 'spark':
          if (L.arc) {
            L.arc.visible = L.state === 'on';
            if (L.state === 'on') {
              L.acc -= dt;
              if (L.acc <= 0) {
                L.acc = 0.05;
                const pts = [];
                for (let k = 0; k <= 8; k++) pts.push(new THREE.Vector3(xa + ((xb - xa) * k) / 8, y + (k % 8 ? rand(-0.35, 0.6) : 0), rand(-0.1, 0.1)));
                L.arc.geometry.dispose();
                L.arc.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 4, false);
              }
              if (Math.random() < 0.6) {
                col.setHex(0xc0a0ff);
                this.fx.glow.spawn(rand(xa, xb), y + rand(-0.3, 0.5), 0.1, rand(-3, 3), rand(-2, 3), 0, 0.15, 0.12, col, 1);
              }
            } else if (L.state === 'warn' && Math.random() < 0.4) {
              col.setHex(0x9a7aff);
              this.fx.glow.spawn(Math.random() < 0.5 ? xa : xb, y, 0.1, rand(-1, 1), rand(-1, 1), 0, 0.12, 0.1, col, 1);
            }
          }
          break;
      }
      if (!active || player.dead) continue;
      const hw = PW / 2;
      const inX = player.x + hw > xa && player.x - hw < xb;
      if (L.hazardous && L.state === 'on' && inX) {
        const top = y + (L.mode === 'fire' ? 2.2 : 1.1);
        if (player.y < top && player.y + PH > y - 0.4) this.callbacks.hurt(mid);
      }
      if (L.mode === 'water' && inX && player.y < y && player.y > y - 6 && player.vy < 4) {
        player.vy -= 18 * dt;
      }
    }
  }

  updateIcicles(dt, time, player, active) {
    for (const ic of this.icicles) {
      if (ic.state === 'gone') continue;
      if (ic.state === 'hang') {
        if (ic.p.falling) ic.state = 'fall';
        else if (active && !player.dead && Math.abs(player.x - ic.x) < 1.1 && player.y < ic.y && player.y > ic.y - 10) {
          ic.state = 'shake';
          ic.t = 0.5;
          this.audio.crack();
        }
      } else if (ic.state === 'shake') {
        ic.mesh.position.x = ic.x + Math.sin(time * 70) * 0.05;
        ic.t -= dt;
        if (ic.t <= 0) ic.state = 'fall';
      } else if (ic.state === 'fall') {
        const prevTip = ic.y - 0.45;
        ic.vy -= 30 * dt;
        ic.y += ic.vy * dt;
        ic.mesh.position.set(ic.x, ic.y, 0);
        const tip = ic.y - 0.45;
        let hit = false;
        if (active && !player.dead && Math.abs(player.x - ic.x) < PW / 2 + 0.15 && tip < player.y + PH && ic.y + 0.45 > player.y) {
          this.callbacks.hurt(ic.x);
          hit = true;
        }
        if (!hit) {
          for (const p of this.platforms) {
            if (p === ic.p || !p.alive || p.falling) continue;
            if (ic.x > p.x0 && ic.x < p.x1 && prevTip >= p.top && tip < p.top) { hit = true; break; }
          }
        }
        if (hit || ic.y < ic.y0 - 25) {
          ic.state = 'gone';
          this.removeObj(ic.mesh);
          if (hit) {
            this.audio.shatter();
            this.fx.burst(ic.x, tip + 0.2, 0.2, 16, { color: 0xffffff, color2: 0x8ad8ff, glow: false, speed: 4, gravity: 14, life: 0.6, size: 0.12 });
          }
        }
      }
    }
  }

  updatePickups(time, player, active) {
    for (const g of this.pickups) {
      if (g.taken) continue;
      g.mesh.rotation.y = time * 2 + g.phase;
      g.mesh.position.y = g.y + Math.sin(time * 3 + g.phase) * 0.12;
      if (!active || player.dead) continue;
      const dx = player.x - g.x, dy = player.cy - g.y;
      if (dx * dx + dy * dy < 0.8 * 0.8) {
        g.taken = true;
        this.removeObj(g.mesh);
        const color = g.kind === 'heart' ? 0xff3a5a : g.zone.gem;
        this.fx.burst(g.x, g.y, 0.3, 22, { color, color2: 0xffffff, speed: 5, life: 0.5, size: 0.14 });
        this.callbacks[g.kind](g);
      }
    }
  }

  updateSkyHazards(dt, player, view, pz) {
    const f = pz.zone.features;
    const rate = 1 + pz.lap * 0.35;
    const col = this.col;

    if (f.fireball && !player.dead) {
      this.fireT -= dt * rate;
      if (this.fireT <= 0) {
        this.fireT = rand(2.2, 3.8);
        const x = clamp(player.x + rand(-3, 3) + player.vx * 0.4, -8.2, 8.2);
        const warn = new THREE.Mesh(warnGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.8, 0.2), transparent: true, side: THREE.DoubleSide }));
        warn.material.userData.own = true;
        this.root.add(warn);
        this.fireballs.push({ x, y: 0, vy: 0, state: 'warn', t: 1.0, warn, mesh: null });
      }
    }
    for (const fb of this.fireballs) {
      if (fb.state === 'warn') {
        fb.t -= dt;
        fb.warn.position.set(fb.x, view.top - 1.2, 1);
        const s = 1 + Math.sin(fb.t * 25) * 0.25;
        fb.warn.scale.setScalar(s);
        if (fb.t <= 0) {
          this.removeObj(fb.warn);
          fb.state = 'fall';
          fb.y = view.top + 2;
          fb.vy = -11;
          fb.mesh = new THREE.Mesh(fireballGeo, this.mats.fireball);
          this.root.add(fb.mesh);
          this.audio.flame();
        }
      } else if (fb.state === 'fall') {
        fb.vy -= 6 * dt;
        fb.y += fb.vy * dt;
        fb.mesh.position.set(fb.x, fb.y, 0);
        fb.mesh.rotation.x += dt * 5;
        fb.mesh.rotation.y += dt * 3;
        for (let k = 0; k < 2; k++) {
          col.setHex(Math.random() < 0.5 ? 0xff5a10 : 0xffc040);
          this.fx.glow.spawn(fb.x + rand(-0.2, 0.2), fb.y + 0.2, 0, rand(-0.5, 0.5), rand(1, 3), 0, 0.5, rand(0.2, 0.4), col, 1, 0, 1, -0.5);
        }
        const dx = player.x - fb.x, dy = player.cy - fb.y;
        if (!player.dead && dx * dx + dy * dy < 0.8 * 0.8) {
          this.callbacks.hurt(fb.x);
          fb.y = -1e9;
        }
        if (fb.y < view.bottom - 4) {
          if (fb.y < -1e8) this.fx.burst(fb.x, player.cy, 0.3, 30, { color: 0xff5a10, color2: 0xffe080, speed: 6, life: 0.5, size: 0.2 });
          fb.state = 'gone';
          this.removeObj(fb.mesh);
        }
      }
    }
    this.fireballs = this.fireballs.filter((fb) => fb.state !== 'gone');

    if (f.lightning && !player.dead) {
      this.lightningT -= dt * rate;
      if (this.lightningT <= 0) {
        this.lightningT = rand(2.8, 4.6);
        const x = clamp(player.x + rand(-1.5, 1.5), -8.2, 8.2);
        const warn = new THREE.Mesh(
          new THREE.PlaneGeometry(1.8, 60),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.6, 2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        warn.material.userData.own = true;
        warn.position.set(x, player.y, 0.6);
        this.root.add(warn);
        this.strikes.push({ x, state: 'warn', t: 1.2, warn, bolt: null });
      }
    }
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.state === 'warn') {
        s.warn.position.y = (view.top + view.bottom) / 2;
        s.warn.material.opacity = (0.08 + 0.12 * (1 - s.t / 1.2)) * (Math.sin(s.t * 30) * 0.3 + 0.7);
        if (s.t <= 0) {
          this.removeObj(s.warn);
          s.state = 'strike';
          s.t = 0.3;
          s.hitWindow = 0.15;
          const pts = [];
          const top = view.top + 4, bottom = view.bottom - 4;
          for (let y = top, k = 0; y > bottom; y -= 1.1, k++) pts.push(new THREE.Vector3(s.x + (k ? rand(-0.5, 0.5) : 0), y, 0.3));
          s.bolt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.09, 5, false), this.mats.bolt);
          this.root.add(s.bolt);
          this.flash = 1;
          this.audio.thunder();
          this.fx.burst(s.x, player.y, 0.4, 30, { color: 0xd0c0ff, color2: 0xffffff, speed: 8, life: 0.4, size: 0.14 });
        }
      } else if (s.state === 'strike') {
        s.hitWindow -= dt;
        s.bolt.visible = Math.random() > 0.3;
        if (s.hitWindow > 0 && !player.dead && Math.abs(player.x - s.x) < 0.95) this.callbacks.hurt(s.x);
        if (s.t <= 0) {
          s.state = 'gone';
          s.bolt.geometry.dispose();
          this.removeObj(s.bolt);
        }
      }
    }
    this.strikes = this.strikes.filter((s) => s.state !== 'gone');
  }

  // Free everything that has sunk far below the tide.
  cleanup(minY) {
    const keep = (arr, yOf, objOf) => arr.filter((e) => {
      if (yOf(e) >= minY) return true;
      const o = objOf(e);
      if (o) {
        this.removeObj(o);
        if (o.geometry && o.isMesh && o.geometry.type === 'TubeGeometry') o.geometry.dispose();
      }
      return false;
    });
    this.vents = this.vents.filter((v) => v.p.y >= minY);
    this.leaks = keep(this.leaks, (l) => l.y, (l) => l.arc);
    this.icicles = keep(this.icicles, (i) => i.y, (i) => i.mesh);
    this.pickups = keep(this.pickups, (g) => g.y, (g) => g.mesh);
    this.ladders = keep(this.ladders, (l) => l.y1, (l) => l.mesh);
    this.platforms = keep(this.platforms, (p) => p.y, (p) => p.mesh);
  }
}
