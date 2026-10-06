import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

const P_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  uniform float uScale;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const P_FRAG = /* glsl */ `
  varying vec4 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vColor.a <= 0.0) discard;
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }
`;

// A pooled CPU particle system rendered as a single draw call.
export class Particles {
  constructor(scene, max, blending) {
    this.max = max;
    this.head = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max * 2); // size, alpha
    this.phys = new Float32Array(max * 4); // gravity, drag, grow, windFactor

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: P_VERT,
      fragmentShader: P_FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, life, size, color, alpha = 1, gravity = 0, drag = 0, grow = 0, wind = 0) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i4] = color.r; this.col[i4 + 1] = color.g; this.col[i4 + 2] = color.b; this.col[i4 + 3] = alpha;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.base[i * 2] = size;
    this.base[i * 2 + 1] = alpha;
    this.phys[i4] = gravity; this.phys[i4 + 1] = drag; this.phys[i4 + 2] = grow; this.phys[i4 + 3] = wind;
    this.size[i] = size;
  }

  update(dt, windX) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      const i3 = i * 3, i4 = i * 4;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        this.col[i4 + 3] = 0;
        continue;
      }
      const drag = Math.max(0, 1 - this.phys[i4 + 1] * dt);
      this.vel[i3] = (this.vel[i3] + windX * this.phys[i4 + 3] * dt) * drag;
      this.vel[i3 + 1] = (this.vel[i3 + 1] - this.phys[i4] * dt) * drag;
      this.vel[i3 + 2] *= drag;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.size[i] = this.base[i * 2] * (1 + this.phys[i4 + 2] * (1 - t));
      this.col[i4 + 3] = this.base[i * 2 + 1] * Math.min(1, t * 3) * Math.min(1, (1 - t) * 12 + 0.2);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.size.fill(0);
  }
}

const TIDE_VERT = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const TIDE_FRAG = /* glsl */ `
  uniform float uTime, uTop, uLava, uIce, uPlasma, uGlow;
  uniform vec3 uColor, uDeep, uFoam;
  varying vec3 vW;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    float x = vW.x;
    float wave = sin(x * 0.55 + uTime * 1.6) * 0.28 + sin(x * 1.3 - uTime * 2.3) * 0.12 + sin(x * 3.1 + uTime * 4.0) * 0.05;
    wave *= (1.0 - uIce * 0.75);
    float depth = uTop + wave - vW.y;
    if (depth < 0.0) discard;
    vec3 col = mix(uColor, uDeep, smoothstep(0.0, 14.0, depth));
    float n = fbm(vec2(x * 0.35 + uTime * 0.15, vW.y * 0.35 - uTime * 0.3));
    col += uColor * (n - 0.5) * 0.4;
    float cells = fbm(vec2(x * 0.5 - uTime * 0.1, vW.y * 0.6 + uTime * 0.25));
    col += vec3(2.2, 0.9, 0.15) * smoothstep(0.52, 0.75, cells) * uLava * 1.4;
    float spark = step(0.985, hash(floor(vec2(x, vW.y) * 6.0) + floor(uTime * 3.0)));
    col += vec3(1.5) * spark * uIce;
    float bolt = abs(sin(x * 2.0 + n * 9.0 + uTime * 3.0));
    col += uFoam * smoothstep(0.97, 1.0, bolt) * uPlasma * 2.0 * smoothstep(8.0, 0.0, depth);
    float foam = smoothstep(0.35, 0.0, depth) + smoothstep(1.0, 0.0, depth) * 0.4 * noise(vec2(x * 3.0 + uTime * 2.0, uTime));
    col = mix(col, uFoam * (1.0 + uGlow * 1.5), clamp(foam, 0.0, 1.0));
    col += uColor * uGlow * 0.8 * smoothstep(5.0, 0.0, depth);
    float alpha = mix(0.72, 0.95, smoothstep(0.0, 4.0, depth));
    gl_FragColor = vec4(col, alpha);
  }
`;

// The ever-rising flood/lava/frost that chases the player up the tower.
export class Tide {
  constructor(scene) {
    this.uniforms = {
      uTime: { value: 0 },
      uTop: { value: 0 },
      uLava: { value: 0 },
      uIce: { value: 0 },
      uPlasma: { value: 0 },
      uGlow: { value: 0 },
      uColor: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color() },
      uFoam: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: TIDE_VERT,
      fragmentShader: TIDE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), mat);
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);

    this.light = new THREE.PointLight(0xff6a20, 0, 22, 1.5);
    scene.add(this.light);
    this.y = -14;
  }

  apply(blend) {
    const { a, b, t } = blend;
    const u = this.uniforms;
    u.uColor.value.setHex(a.tide.color).lerp(new THREE.Color(b.tide.color), t);
    u.uDeep.value.setHex(a.tide.deep).lerp(new THREE.Color(b.tide.deep), t);
    u.uFoam.value.setHex(a.tide.foam).lerp(new THREE.Color(b.tide.foam), t);
    for (const k of ['glow', 'lava', 'ice', 'plasma']) {
      u['u' + k[0].toUpperCase() + k.slice(1)].value = a.tide[k] + (b.tide[k] - a.tide[k]) * t;
    }
    this.light.color.copy(u.uColor.value);
  }

  update(time, camX) {
    this.uniforms.uTime.value = time;
    this.uniforms.uTop.value = this.y;
    this.mesh.position.set(camX, this.y - 45 + 1.0, 2.6);
    this.light.position.set(camX, this.y + 1.5, 3);
    this.light.intensity = 25 + this.uniforms.uGlow.value * 70;
  }
}

const AMBIENT = {
  dust: { rate: 22, blend: 'soft' },
  drip: { rate: 70, blend: 'soft' },
  ember: { rate: 70, blend: 'glow' },
  snow: { rate: 110, blend: 'soft' },
  rain: { rate: 160, blend: 'soft' },
};

export class FX {
  constructor(scene) {
    this.glow = new Particles(scene, 3000, THREE.AdditiveBlending);
    this.soft = new Particles(scene, 3000, THREE.NormalBlending);
    this.tide = new Tide(scene);
    this.acc = {};
    this.c = new THREE.Color();
    this.c2 = new THREE.Color();
  }

  setScale(px) {
    this.glow.material.uniforms.uScale.value = px;
    this.soft.material.uniforms.uScale.value = px;
  }

  burst(x, y, z, n, o = {}) {
    const {
      color = 0xffffff, color2 = null, speed = 4, life = 0.6, size = 0.15, gravity = 0, drag = 1.5,
      glow = true, up = 0, grow = 0, alpha = 1, spreadX = 1, spreadY = 1, spreadZ = 0.6,
    } = o;
    const sys = glow ? this.glow : this.soft;
    this.c.set(color);
    if (color2 !== null) this.c2.set(color2);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      col.copy(this.c);
      if (color2 !== null) col.lerp(this.c2, Math.random());
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      sys.spawn(
        x, y, z,
        Math.cos(a) * s * spreadX, Math.sin(a) * s * spreadY + up, (Math.random() - 0.5) * s * spreadZ,
        life * rand(0.6, 1.2), size * rand(0.6, 1.3), col, alpha, gravity, drag, grow,
      );
    }
  }

  // Zone-themed ambient particles filling the camera view.
  ambient(dt, mode, weight, cx, cy, windX) {
    const cfg = AMBIENT[mode];
    if (!cfg || weight <= 0) return;
    this.acc[mode] = (this.acc[mode] || 0) + cfg.rate * weight * dt;
    const c = this.c;
    while (this.acc[mode] >= 1) {
      this.acc[mode] -= 1;
      const x = cx + rand(-16, 16), z = rand(-1, 6);
      switch (mode) {
        case 'dust':
          c.setHex(0xe8d8b8);
          this.soft.spawn(x, cy + rand(-10, 10), z, rand(-0.3, 0.3), rand(-0.2, 0.3), 0, rand(4, 7), rand(0.05, 0.1), c, 0.45, 0, 0, 0, 0.1);
          break;
        case 'drip':
          if (Math.random() < 0.25) {
            c.setHex(0x5affe0);
            this.glow.spawn(x, cy + rand(-10, 10), z, rand(-0.2, 0.2), rand(0.2, 0.6), 0, rand(3, 5), rand(0.06, 0.12), c, 0.8);
          } else {
            c.setHex(0x9ad8ff);
            this.soft.spawn(x, cy + 11, z, 0, rand(-12, -8), 0, 1.8, rand(0.05, 0.08), c, 0.6, 12);
          }
          break;
        case 'ember':
          c.setHex(Math.random() < 0.5 ? 0xff7a20 : 0xffc040);
          this.glow.spawn(x, cy - 10, z, rand(-0.6, 0.6), rand(2.5, 5), 0, rand(2.5, 4.5), rand(0.07, 0.15), c, 1, -0.4, 0.2, 0, 0.3);
          break;
        case 'snow':
          c.setHex(0xffffff);
          this.soft.spawn(x, cy + 11, z, rand(-0.5, 0.5), rand(-3.2, -1.6), 0, 7, rand(0.07, 0.16), c, 0.9, 0, 0.3, 0, 0.8);
          break;
        case 'rain':
          c.setHex(0xb8b0ff);
          this.soft.spawn(x, cy + 11, z, 0, rand(-24, -18), 0, 1.3, rand(0.04, 0.06), c, 0.55, 0, 0, 0, 0.6);
          break;
      }
    }
  }

  update(dt, windX) {
    this.glow.update(dt, windX);
    this.soft.update(dt, windX);
  }

  clear() {
    this.glow.clear();
    this.soft.clear();
  }
}
