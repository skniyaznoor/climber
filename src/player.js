import * as THREE from 'three';

export const PW = 0.6;
export const PH = 1.35;
const SPEED = 7.5;
const GRAVITY = 34;
const JUMP = 14;
const DOUBLE_JUMP = 12.5;
const MAX_FALL = 22;
const CLIMB = 5.2;
export const BOUND = 8.55;

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export class Player {
  constructor(scene, fx, audio) {
    this.fx = fx;
    this.audio = audio;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.build();
    this.light = new THREE.PointLight(0xffd9a0, 14, 11, 1.6);
    scene.add(this.light);
    this.dust = new THREE.Color();
    this.reset(0, 0);
  }

  build() {
    const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
    const jacket = M(0xff5a1f);
    const pants = M(0x26334f);
    const skin = M(0xffc9a0, { roughness: 0.8 });
    const helmet = M(0xffd23a, { roughness: 0.35, metalness: 0.2 });
    const boot = M(0x3b2a1e);
    const pack = M(0x2f6f4f);
    const black = M(0x111111, { roughness: 0.3 });
    const scarf = M(0xc8102e);
    const rope = M(0xe8c070);
    const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 3 });

    this.squashG = new THREE.Group();
    this.root.add(this.squashG);
    this.pivot = new THREE.Group();
    this.pivot.position.y = 0.75;
    this.squashG.add(this.pivot);
    const model = new THREE.Group();
    model.position.y = -0.75;
    this.pivot.add(model);

    const add = (geo, mat, x, y, z, parent = model) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    add(new THREE.CapsuleGeometry(0.2, 0.26, 6, 14), jacket, 0, 0.9, 0);
    add(new THREE.TorusGeometry(0.14, 0.05, 8, 16), scarf, 0, 1.2, 0.0).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.17, 18, 14), skin, 0, 1.36, 0);
    add(new THREE.SphereGeometry(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmet, 0, 1.39, 0);
    add(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 18), helmet, 0, 1.39, 0.02);
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 12), lamp, 0, 1.47, 0.17).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.028, 8, 6), black, -0.065, 1.37, 0.155);
    add(new THREE.SphereGeometry(0.028, 8, 6), black, 0.065, 1.37, 0.155);
    add(new THREE.BoxGeometry(0.34, 0.42, 0.2), pack, 0, 0.95, -0.24);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.38, 12), rope, 0, 1.2, -0.24).rotation.z = Math.PI / 2;

    const limb = (x, y, len, r, mat, end, endMat) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      model.add(pivot);
      add(new THREE.CapsuleGeometry(r, len, 4, 10), mat, 0, -len / 2 - r * 0.5, 0, pivot);
      add(end, endMat, 0, -len - r * 1.2, 0.03, pivot);
      return pivot;
    };
    this.armL = limb(-0.27, 1.17, 0.28, 0.07, jacket, new THREE.SphereGeometry(0.075, 10, 8), skin);
    this.armR = limb(0.27, 1.17, 0.28, 0.07, jacket, new THREE.SphereGeometry(0.075, 10, 8), skin);
    this.legL = limb(-0.11, 0.62, 0.36, 0.09, pants, new THREE.BoxGeometry(0.17, 0.12, 0.26), boot);
    this.legR = limb(0.11, 0.62, 0.36, 0.09, pants, new THREE.BoxGeometry(0.17, 0.12, 0.26), boot);
  }

  reset(x, y) {
    Object.assign(this, {
      x, y, vx: 0, vy: 0, ground: null, coyote: 0, jumpBuffer: 0, airJumps: 1,
      climbing: null, ladderCD: 0, facing: 1, hearts: 3, maxHearts: 3, invuln: 0,
      dead: false, maxY: y, flip: 0, squash: 0, animT: 0, climbAnim: 0, dropT: 0,
      dropPlat: null, jumpCut: true, launchCD: 0, deathT: 0, runDust: 0,
    });
    this.root.visible = true;
    this.root.rotation.set(0, 1.15, 0);
    this.pivot.rotation.set(0, 0, 0);
    this.squashG.scale.set(1, 1, 1);
  }

  get cx() { return this.x; }
  get cy() { return this.y + PH / 2; }

  findLadder(level) {
    for (const l of level.ladders) {
      if (Math.abs(this.x - l.x) < 0.6 && this.y >= l.y0 - 0.25 && this.y < l.y1 - 0.15) return l;
    }
    return null;
  }

  update(dt, input, level) {
    if (this.dead) return this.updateDeath(dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.dropT -= dt;
    this.ladderCD -= dt;
    this.launchCD -= dt;

    const ladder = this.findLadder(level);
    if (input.jumpPressed || (input.upPressed && !ladder && !this.climbing)) this.jumpBuffer = 0.14;
    else this.jumpBuffer -= dt;

    if (!this.climbing && ladder && input.up && this.ladderCD <= 0 && this.vy < 8) {
      this.climbing = ladder;
      this.ground = null;
      this.vx = 0;
      this.vy = 0;
      this.airJumps = 1;
      this.jumpBuffer = 0;
    }

    if (this.climbing) this.updateClimb(dt, input);
    else this.updateMove(dt, input, level);

    if (this.ground || this.climbing) this.maxY = Math.max(this.maxY, this.y);
    this.animate(dt);
  }

  updateClimb(dt, input) {
    const l = this.climbing;
    this.x += (l.x - this.x) * Math.min(1, dt * 14);
    const dy = input.y * CLIMB;
    this.y += dy * dt;
    this.climbAnim += Math.abs(dy) * dt * 1.4;
    if (this.jumpBuffer > 0) {
      this.climbing = null;
      this.jumpBuffer = 0;
      this.vy = JUMP * 0.85;
      this.vx = input.x * SPEED;
      this.ladderCD = 0.3;
      this.jumpCut = false;
      this.audio.jump();
      return;
    }
    if (this.y >= l.y1) {
      // Pop over the top onto the platform above.
      this.y = l.y1;
      this.climbing = null;
      this.vy = 7;
      this.jumpCut = true;
      this.ladderCD = 0.4;
    } else if (this.y <= l.y0) {
      this.y = l.y0;
      if (input.y < 0) {
        this.climbing = null;
        this.ladderCD = 0.3;
      }
    }
  }

  updateMove(dt, input, level) {
    const g = this.ground;
    const icy = g && g.icy;
    const wind = level.windForce;
    const windShift = wind * 0.45 * (g ? (icy ? 0.9 : 0.25) : 1);
    const target = input.x * SPEED + windShift;
    const accel = g ? (icy ? 9 : 60) : 30;
    this.vx = approach(this.vx, target, accel * dt);
    if (input.x) this.facing = Math.sign(input.x);

    if (g) {
      this.coyote = 0.11;
      this.airJumps = 1;
    } else this.coyote -= dt;

    if (input.downPressed && g && !g.floor) {
      this.dropPlat = g;
      this.dropT = 0.3;
      this.ground = null;
    } else if (this.jumpBuffer > 0) {
      if (this.coyote > 0) {
        this.vy = JUMP;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpCut = false;
        this.squash = 1;
        this.audio.jump();
        this.fx.burst(this.x, this.y + 0.05, 0.3, 8, { color: 0xd8d0c0, glow: false, speed: 2.5, life: 0.4, size: 0.18, spreadY: 0.3, alpha: 0.6 });
      } else if (this.airJumps > 0) {
        this.airJumps--;
        this.vy = DOUBLE_JUMP;
        this.jumpBuffer = 0;
        this.jumpCut = false;
        this.flip = 1;
        this.squash = 0.8;
        this.audio.doubleJump();
        this.fx.burst(this.x, this.y + 0.2, 0.3, 18, { color: 0xffffff, color2: 0x9ae8ff, speed: 5, life: 0.35, size: 0.14, spreadY: 0.35 });
      }
    }
    if (!input.jumpHeld && !this.jumpCut && this.vy > 0) {
      this.vy *= 0.5;
      this.jumpCut = true;
    }

    this.vy = Math.max(this.vy - GRAVITY * dt, -MAX_FALL);
    const prevY = this.y;
    const carry = g && g.alive ? g.dx : 0;
    this.x += this.vx * dt + carry;
    this.y += this.vy * dt;

    if (this.x < -BOUND) { this.x = -BOUND; this.vx = Math.max(0, this.vx); }
    if (this.x > BOUND) { this.x = BOUND; this.vx = Math.min(0, this.vx); }

    const wasGrounded = !!g;
    this.ground = null;
    if (this.vy <= 0) {
      const hw = PW * 0.5;
      for (const p of level.platforms) {
        if (!p.alive || p.falling) continue;
        if (p === this.dropPlat && this.dropT > 0) continue;
        if (this.x + hw < p.x0 || this.x - hw > p.x1) continue;
        if (prevY >= p.top - 0.02 && this.y <= p.top) {
          this.y = p.top;
          if (!wasGrounded && this.vy < -5) {
            this.squash = -Math.min(1, -this.vy / 20);
            this.audio.land();
            this.fx.burst(this.x, this.y + 0.05, 0.3, 10, { color: 0xd8d0c0, glow: false, speed: 3, life: 0.45, size: 0.2, spreadY: 0.25, alpha: 0.55 });
          }
          this.vy = 0;
          this.ground = p;
          level.onLand(p);
          break;
        }
      }
    }

    if (this.ground && Math.abs(this.vx) > 3) {
      this.runDust -= dt;
      if (this.runDust <= 0) {
        this.runDust = 0.12;
        this.fx.burst(this.x - this.facing * 0.2, this.y + 0.05, 0.2, 1, { color: 0xd8d0c0, glow: false, speed: 1, life: 0.35, size: 0.14, up: 0.6, alpha: 0.4 });
      }
    }
  }

  launch(power) {
    if (this.launchCD > 0 && this.vy > power * 0.5) return false;
    this.vy = power;
    this.ground = null;
    this.climbing = null;
    this.airJumps = 1;
    this.jumpCut = true;
    this.squash = 1;
    this.launchCD = 0.4;
    return true;
  }

  hurt(srcX) {
    if (this.invuln > 0 || this.dead) return false;
    this.hearts--;
    this.invuln = 1.6;
    this.vy = 9;
    this.vx = (this.x >= srcX ? 1 : -1) * 7;
    this.ground = null;
    this.climbing = null;
    this.jumpCut = true;
    this.audio.hurt();
    this.fx.burst(this.x, this.cy, 0.4, 24, { color: 0xff3a3a, color2: 0xffd060, speed: 6, life: 0.5, size: 0.16 });
    if (this.hearts <= 0) this.die('hit');
    return true;
  }

  die(kind) {
    if (this.dead) return;
    this.dead = true;
    this.deathKind = kind;
    this.climbing = null;
    this.vy = kind === 'tide' ? 2 : 11;
    this.vx = 0;
    this.deathT = 0;
    this.root.visible = true;
    if (kind === 'tide') this.audio.splash();
    this.audio.death();
  }

  updateDeath(dt) {
    this.deathT += dt;
    this.vy -= GRAVITY * 0.6 * dt;
    this.y += this.vy * dt;
    this.pivot.rotation.z += dt * 7;
    this.root.position.set(this.x, this.y, 0.4);
    this.light.position.set(this.x, this.y + 1.6, 1.4);
    this.light.intensity = Math.max(0, 14 - this.deathT * 10);
  }

  animate(dt) {
    this.animT += dt;
    const k = Math.min(1, dt * 16);
    const targetRot = this.climbing ? Math.PI : this.facing * 1.15;
    this.root.rotation.y = lerpAngle(this.root.rotation.y, targetRot, Math.min(1, dt * 14));
    this.root.position.set(this.x, this.y, this.climbing ? -0.2 : 0);
    this.light.position.set(this.x + this.facing * 0.3, this.y + 1.7, 1.3);
    this.light.intensity = 14;

    const s = this.squash;
    this.squashG.scale.set(1 - s * 0.16, 1 + s * 0.24, 1 - s * 0.16);
    this.squash = approach(s, 0, dt * 5);

    if (this.flip > 0) {
      this.flip = Math.max(0, this.flip - dt * 2.8);
      this.pivot.rotation.x = (1 - this.flip) * Math.PI * 2;
    } else this.pivot.rotation.x = 0;

    let aL = 0, aR = 0, lL = 0, lR = 0, spread = 0;
    if (this.climbing) {
      const c = this.climbAnim * Math.PI;
      aL = -2.7 + Math.sin(c) * 0.45;
      aR = -2.7 - Math.sin(c) * 0.45;
      lL = -0.5 - Math.sin(c) * 0.5;
      lR = -0.5 + Math.sin(c) * 0.5;
    } else if (this.ground) {
      const speed = Math.abs(this.vx);
      if (speed > 0.5) {
        const ph = (this.animT * (8 + speed)) % (Math.PI * 2);
        const amp = Math.min(1, speed / SPEED);
        lL = Math.sin(ph) * 0.95 * amp;
        lR = -lL;
        aL = -Math.sin(ph) * 0.85 * amp;
        aR = -aL;
        this.squashG.position.y = Math.abs(Math.sin(ph)) * 0.06 * amp;
      } else {
        const b = Math.sin(this.animT * 2.5);
        aL = 0.05 * b; aR = -0.05 * b;
        this.squashG.position.y = 0;
        spread = 0.08;
      }
    } else if (this.vy > 0) {
      aL = -2.6; aR = -2.2; lL = -0.9; lR = 0.35;
    } else {
      aL = -1.6; aR = -1.6; lL = -0.4; lR = 0.25; spread = 0.7;
    }
    if (!this.ground) this.squashG.position.y = 0;
    this.armL.rotation.x = lerp(this.armL.rotation.x, aL, k);
    this.armR.rotation.x = lerp(this.armR.rotation.x, aR, k);
    this.legL.rotation.x = lerp(this.legL.rotation.x, lL, k);
    this.legR.rotation.x = lerp(this.legR.rotation.x, lR, k);
    this.armL.rotation.z = lerp(this.armL.rotation.z, -spread, k);
    this.armR.rotation.z = lerp(this.armR.rotation.z, spread, k);

    this.root.visible = this.invuln > 0 ? Math.floor(this.animT * 20) % 2 === 0 : true;
  }
}
