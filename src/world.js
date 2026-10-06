import * as THREE from 'three';
import { ZONE_HEIGHT as ZH, zoneByIndex, zoneBlend } from './zones.js';
import { makeWallTextures, makeMetalTexture } from './textures.js';

export const WALL_Z = -1.3;
const rand = (a, b) => a + Math.random() * (b - a);

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop, uBottom;
  uniform float uStars, uTime, uFlash;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y * 0.5 + 0.5;
    vec3 col = mix(uBottom, uTop, smoothstep(0.25, 0.85, h));
    vec3 p = floor(d * 240.0);
    float s = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float star = step(0.997, s) * smoothstep(0.4, 0.8, h);
    col += vec3(star) * uStars * (0.6 + 0.4 * sin(uTime * 3.0 + s * 60.0)) * 1.5;
    col += vec3(0.75, 0.7, 1.0) * uFlash;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.segments = new Map();
    this.zoneMats = new Map();
    this.metal = makeMetalTexture(false);

    this.skyUniforms = {
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uFlash: { value: 0 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        side: THREE.BackSide, depthWrite: false,
      }),
    );
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    scene.fog = new THREE.FogExp2(0x000000, 0.02);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.tmpA = new THREE.Color();
    this.tmpB = new THREE.Color();
  }

  mats(zone) {
    if (this.zoneMats.has(zone.key)) return this.zoneMats.get(zone.key);
    const { map, emissiveMap } = makeWallTextures(zone.wall);
    map.repeat.set(2.5, ZH / 8);
    if (emissiveMap) emissiveMap.repeat.set(2.5, ZH / 8);
    const wall = new THREE.MeshStandardMaterial({
      map, emissiveMap, emissive: emissiveMap ? 0xffffff : 0x000000, emissiveIntensity: zone.wall.glow ?? 1.6,
      roughness: 0.92, metalness: 0.0,
    });
    const pmap = map.clone();
    pmap.repeat.set(0.25, ZH / 8);
    pmap.needsUpdate = true;
    const pillar = new THREE.MeshStandardMaterial({
      map: pmap, color: 0xb0b0b0, roughness: 0.85,
    });
    const beam = new THREE.MeshStandardMaterial({ color: zone.pipe, map: this.metal, metalness: 0.8, roughness: 0.35 });
    const glow = new THREE.MeshStandardMaterial({
      color: zone.accent, emissive: zone.accent, emissiveIntensity: 3.5, roughness: 0.4,
    });
    const deco = new THREE.MeshStandardMaterial({
      color: new THREE.Color(zone.pipe).multiplyScalar(0.45), map: this.metal, metalness: 0.7, roughness: 0.5,
    });
    const backdrop = new THREE.MeshStandardMaterial({
      color: new THREE.Color(zone.fog).lerp(new THREE.Color(zone.pipe), 0.35).multiplyScalar(0.7),
      roughness: 1, flatShading: true,
    });
    const set = { wall, pillar, beam, glow, deco, backdrop };
    this.zoneMats.set(zone.key, set);
    return set;
  }

  buildSegment(i) {
    const zone = zoneByIndex(i);
    const m = this.mats(zone);
    const g = new THREE.Group();
    const y0 = i * ZH, cy = y0 + ZH / 2;

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, ZH), m.wall);
    wall.position.set(0, cy, WALL_Z);
    wall.receiveShadow = true;
    g.add(wall);

    const pillarGeo = new THREE.BoxGeometry(1.6, ZH, 2.6);
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(pillarGeo, m.pillar);
      p.position.set(side * 9.7, cy, -0.1);
      p.receiveShadow = true;
      g.add(p);
      // Glowing runes / lamps running up the pillar faces
      for (let k = 0; k < 6; k++) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.1), m.glow);
        lamp.position.set(side * 9.7, y0 + (k + 0.5) * (ZH / 6), 1.22);
        g.add(lamp);
      }
    }

    if (i >= 1) {
      // Zone gate: a heavy beam with a glowing strip in the new zone's colour.
      const beam = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.7, 1.0), m.beam);
      beam.position.set(0, y0, WALL_Z + 0.5);
      beam.receiveShadow = true;
      g.add(beam);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.14, 1.04), m.glow);
      strip.position.set(0, y0, WALL_Z + 0.5);
      g.add(strip);
    }

    // Decorative (non-collidable) wall plumbing.
    for (let k = 0; k < 5; k++) {
      const h = rand(8, 26);
      const x = rand(-8, 8);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, h, 12), m.deco);
      pipe.position.set(x, y0 + rand(h / 2, ZH - h / 2), WALL_Z + 0.25);
      g.add(pipe);
      for (const e of [-1, 1]) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 12), m.deco);
        f.position.set(x, pipe.position.y + e * h * 0.5, WALL_Z + 0.25);
        g.add(f);
      }
    }
    for (let k = 0; k < 8; k++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), m.glow);
      lamp.position.set(rand(-8, 8), y0 + rand(1, ZH - 1), WALL_Z + 0.15);
      g.add(lamp);
    }

    this.addBackdrop(g, zone, m, y0);
    this.scene.add(g);
    return g;
  }

  addBackdrop(g, zone, m, y0) {
    for (let k = 0; k < 14; k++) {
      const side = k % 2 ? 1 : -1;
      const x = side * rand(14, 55);
      const z = rand(-70, -22);
      const y = y0 + rand(0, ZH);
      let mesh;
      switch (zone.backdrop) {
        case 'tower': {
          const h = rand(10, 30);
          mesh = new THREE.Mesh(new THREE.BoxGeometry(rand(3, 7), h, rand(3, 7)), m.backdrop);
          break;
        }
        case 'tank': {
          const h = rand(12, 30);
          mesh = new THREE.Mesh(new THREE.CylinderGeometry(rand(1.5, 4), rand(1.5, 4), h, 10), m.backdrop);
          break;
        }
        case 'spire': {
          mesh = new THREE.Mesh(new THREE.ConeGeometry(rand(3, 6), rand(14, 30), 6), m.backdrop);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), m.glow);
          tip.position.y = mesh.geometry.parameters.height / 2;
          mesh.add(tip);
          break;
        }
        case 'peak':
          mesh = new THREE.Mesh(new THREE.ConeGeometry(rand(3, 7), rand(12, 26), 5), m.backdrop);
          break;
        default:
          mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(2, 5), 0), m.backdrop);
          mesh.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
          mesh.userData.spin = rand(-0.2, 0.2);
      }
      mesh.position.set(x, y, z);
      g.add(mesh);
    }
  }

  updateSegments(camY) {
    const lo = Math.max(-1, Math.floor((camY - 28) / ZH));
    const hi = Math.floor((camY + 28) / ZH);
    for (let i = lo; i <= hi; i++) {
      if (!this.segments.has(i)) this.segments.set(i, this.buildSegment(i));
    }
    for (const [i, g] of this.segments) {
      if (i < lo || i > hi) {
        this.scene.remove(g);
        g.traverse((o) => o.geometry && o.geometry.dispose());
        this.segments.delete(i);
      }
    }
  }

  applyBlend(y, flash) {
    const { a, b, t } = zoneBlend(y);
    const L = (ka, kb = ka) => this.tmpA.setHex(a[ka]).lerp(this.tmpB.setHex(b[kb]), t);
    this.skyUniforms.uTop.value.copy(L('skyTop'));
    this.skyUniforms.uBottom.value.copy(L('skyBottom'));
    this.skyUniforms.uStars.value = a.stars + (b.stars - a.stars) * t;
    this.skyUniforms.uFlash.value = flash;
    this.scene.fog.color.copy(L('fog'));
    this.scene.fog.density = a.fogDensity + (b.fogDensity - a.fogDensity) * t;
    this.hemi.color.copy(L('hemiSky'));
    this.hemi.groundColor.copy(L('hemiGround'));
    this.hemi.intensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t + flash * 3;
    this.sun.color.copy(L('sun'));
    this.sun.intensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
    return { a, b, t };
  }

  update(time, dt, camera, tx, ty) {
    this.skyUniforms.uTime.value = time;
    this.sky.position.copy(camera.position);
    this.sun.position.set(tx + 6, ty + 12, 14);
    this.sun.target.position.set(tx, ty, 0);
    for (const g of this.segments.values()) {
      for (const c of g.children) if (c.userData.spin) c.rotation.y += c.userData.spin * dt;
    }
  }
}
