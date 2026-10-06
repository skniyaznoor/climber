import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ZONES, zoneAt, zoneBlend } from './zones.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { FX } from './effects.js';
import { World } from './world.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { makeLabelTexture } from './textures.js';
import './style.css';

const FOV = 50;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

class Game {
  constructor() {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 600);
    // Image-based lighting so the metal pipes get believable reflections.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.5, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.audio = new AudioEngine();
    this.input = new Input();
    this.ui = new UI();
    this.fx = new FX(this.scene);
    this.world = new World(this.scene);
    this.level = new Level(this.scene, this.fx, this.audio);
    this.player = new Player(this.scene, this.fx, this.audio);
    this.level.callbacks = {
      hurt: (x) => this.onHurt(x),
      gem: () => this.onGem(),
      heart: () => this.onHeart(),
    };

    this.best = Number(localStorage.getItem('ascend.best') || 0);
    this.ui.setBest(this.best);
    this.ui.setMuted(this.audio.muted);
    this.buildBestMarker();

    this.state = 'menu';
    this.time = 0;
    this.camX = 0;
    this.camY = 3;
    this.shake = 0;
    this.camDist = 18;
    this.view = { top: 12, bottom: -6 };
    this.resetRun();

    this.bindUI();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  bindUI() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.audio.click();
      fn();
    });
    on('btn-play', () => this.start());
    on('btn-retry', () => this.start());
    on('btn-resume', () => this.setPaused(false));
    on('btn-restart', () => this.start());
    on('btn-menu', () => this.toMenu());
    on('btn-menu2', () => this.toMenu());
    on('btn-pause', () => this.setPaused(this.state !== 'paused'));
    on('btn-mute', () => {
      this.audio.init();
      this.audio.setMuted(!this.audio.muted);
      this.ui.setMuted(this.audio.muted);
    });

    this.input.onKey((code) => {
      if (code === 'KeyM') {
        this.audio.setMuted(!this.audio.muted);
        this.ui.setMuted(this.audio.muted);
      }
      if ((code === 'Escape' || code === 'KeyP') && (this.state === 'playing' || this.state === 'paused')) {
        this.setPaused(this.state === 'playing');
      }
      if ((code === 'Enter' || code === 'Space') && (this.state === 'menu' || this.state === 'over')) this.start();
    });

    const t = (id, code) => this.input.bindTouch(document.getElementById(id), code);
    t('t-left', 'ArrowLeft');
    t('t-right', 'ArrowRight');
    t('t-up', 'ArrowUp');
    t('t-down', 'ArrowDown');
    t('t-jump', 'Space');

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.setPaused(true);
    });
  }

  buildBestMarker() {
    const g = new THREE.Group();
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(17.4, 0.07),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.4), transparent: true, opacity: 0.8 }),
    );
    g.add(line);
    this.bestLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture('BEST'), transparent: true, depthWrite: false }));
    this.bestLabel.scale.set(3.2, 0.8, 1);
    this.bestLabel.position.set(-6.6, 0.45, 0);
    g.add(this.bestLabel);
    g.position.z = -1.1;
    this.bestMarker = g;
    this.scene.add(g);
    this.updateBestMarker();
  }

  updateBestMarker() {
    this.bestMarker.visible = this.best > 5;
    this.bestMarker.position.y = this.best;
    this.bestLabel.material.map?.dispose();
    this.bestLabel.material.map = makeLabelTexture(`BEST ${this.best}m`);
  }

  resetRun() {
    this.level.reset();
    this.fx.clear();
    this.player.reset(0, 0);
    this.fx.tide.y = -14;
    this.elapsed = 0;
    this.gems = 0;
    this.bonus = 0;
    this.maxZone = 0;
    this.milestone = 50;
    this.level.generateUpTo(45);
    this.camY = 3;
    this.camX = 0;
  }

  start() {
    this.audio.init();
    this.audio.startMusic();
    this.audio.setPaused(false);
    this.resetRun();
    this.updateBestMarker();
    this.state = 'playing';
    this.ui.show('hud');
    this.ui.banner(0, ZONES[0], 0);
  }

  toMenu() {
    this.resetRun();
    this.state = 'menu';
    this.audio.setPaused(false);
    this.ui.setBest(this.best);
    this.ui.show('menu');
  }

  setPaused(p) {
    if (p && this.state === 'playing') {
      this.state = 'paused';
      this.ui.show('pause');
      this.audio.setPaused(true);
    } else if (!p && this.state === 'paused') {
      this.state = 'playing';
      this.ui.show('hud');
      this.audio.setPaused(false);
    }
  }

  // ---------------------------------------------------------------- events
  onHurt(x) {
    if (this.state !== 'playing') return false;
    const hit = this.player.hurt(x);
    if (hit) {
      this.shake = 0.5;
      this.ui.hurtFlash();
      if (this.player.dead) this.beginDeath('hit');
    }
    return hit;
  }

  onGem() {
    this.gems++;
    this.bonus += 100;
    this.audio.gem();
  }

  onHeart() {
    this.audio.heart();
    if (this.player.hearts < this.player.maxHearts) {
      this.player.hearts++;
      this.ui.toast('+1 ♥', '#ff5a7a');
    } else {
      this.bonus += 500;
      this.ui.toast('+500', '#ff5a7a');
    }
  }

  beginDeath(kind) {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathCause = kind;
    this.deathTimer = 1.6;
    this.shake = 0.8;
  }

  get height() { return Math.max(0, Math.floor(this.player.maxY)); }
  get score() { return this.height * 10 + this.bonus; }

  gameOver() {
    this.state = 'over';
    const height = this.height;
    const newBest = height > this.best;
    if (newBest) {
      this.best = height;
      localStorage.setItem('ascend.best', String(height));
    }
    const z = zoneAt(this.player.maxY);
    const tideName = z.zone.key === 'fire' ? 'Swallowed by the lava' : z.zone.key === 'ice' ? 'Frozen solid by the rising frost'
      : z.zone.key === 'storm' ? 'Consumed by the plasma storm' : 'Dragged under by the flood';
    this.ui.gameOver({
      height, score: this.score, gems: this.gems, zoneName: z.zone.name, best: this.best, newBest,
      cause: this.deathCause === 'tide' ? tideName : 'Out of hearts',
    });
  }

  // ------------------------------------------------------------------ loop
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    // Keep the full playable width (±9.2) visible on narrow / portrait screens.
    this.camDist = Math.max(18, 9.6 / (halfTan * this.camera.aspect));
    this.camera.updateProjectionMatrix();
    this.fx.setScale((h * this.renderer.getPixelRatio()) / (2 * halfTan));
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    this.time += dt;
    const p = this.player;
    const tide = this.fx.tide;

    if (this.state === 'playing' || this.state === 'dying') {
      this.elapsed += dt;
      this.level.generateUpTo(p.y + 45);
      this.level.update(dt, this.time, p, this.view, this.state === 'playing');
      p.update(dt, this.input, this.level);
      this.updateTide(dt);

      if (this.state === 'playing') {
        if (p.y + 0.35 < tide.y) {
          p.die('tide');
          this.fx.burst(p.x, tide.y, 1.5, 40, { color: tide.uniforms.uFoam.value.getHex(), glow: false, speed: 7, gravity: 16, up: 4, life: 0.9, size: 0.2 });
          this.beginDeath('tide');
        }
        this.updateProgress();
      } else {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) this.gameOver();
      }
      this.level.cleanup(tide.y - 22);
    } else if (this.state === 'menu') {
      this.level.update(dt, this.time, p, this.view, false);
      p.animate(dt);
      tide.y = -6 + Math.sin(this.time * 0.5) * 0.4;
    }

    this.updateCamera(dt);
    const blend = this.world.applyBlend(this.camY, this.level.flash);
    tide.apply(this.tideBlend());
    tide.update(this.time, this.camX);
    p.light.color.setHex(blend.t < 0.5 ? blend.a.lamp : blend.b.lamp);
    this.world.update(this.time, dt, this.camera, this.camX, this.camY);
    this.world.updateSegments(this.camY);

    if (this.state !== 'paused') {
      const wind = this.level.windForce;
      this.fx.ambient(dt, blend.a.particles, 1 - blend.t, this.camX, this.camY, wind);
      if (blend.t > 0) this.fx.ambient(dt, blend.b.particles, blend.t, this.camX, this.camY, wind);
      this.fx.update(dt, wind);
    }

    if (this.state === 'playing' || this.state === 'paused' || this.state === 'dying') {
      const z = zoneAt(p.y);
      this.ui.hud({
        height: this.height, score: this.score, gems: this.gems, hearts: Math.max(0, p.hearts), maxHearts: p.maxHearts,
        zoneName: z.zone.name, zoneColor: hex(z.zone.accent), y: p.y, tideY: tide.y,
        tideColor: hex(tide.uniforms.uColor.value.getHex()), wind: this.level.windForce, flash: this.level.flash,
      });
    }

    this.composer.render();
    this.input.endFrame();
  }

  tideBlend() {
    return zoneBlend(Math.max(0, this.fx.tide.y));
  }

  updateTide(dt) {
    const tide = this.fx.tide;
    const p = this.player;
    const tz = zoneAt(Math.max(0, tide.y));
    let speed = this.elapsed < 4 ? 0 : 0.8 + 0.13 * tz.index + tz.lap * 0.3;
    const gap = p.maxY - tide.y;
    if (gap > 16) speed += (gap - 16) * 0.3; // rubber-band so it never falls too far behind
    tide.y = Math.max(tide.y + speed * dt, p.maxY - 30);
  }

  updateProgress() {
    const p = this.player;
    const z = zoneAt(p.maxY);
    if (z.index > this.maxZone) {
      this.maxZone = z.index;
      this.ui.banner(z.index % ZONES.length, z.zone, z.lap);
      this.audio.zoneUp();
      this.bonus += 500;
      if (p.hearts < p.maxHearts) {
        p.hearts++;
        this.ui.toast('ZONE CLEAR  +1 ♥  +500', '#7affc8');
      } else this.ui.toast('ZONE CLEAR  +500', '#7affc8');
      this.fx.burst(p.x, p.cy, 0.5, 60, { color: z.zone.accent, color2: 0xffffff, speed: 9, life: 0.9, size: 0.16 });
    }
    this.audio.setZone(zoneAt(p.y).zone);
    if (this.height >= this.milestone) {
      this.ui.toast(`${this.milestone} m`, '#ffffff');
      this.audio.milestone();
      this.milestone += 50;
    }
    if (this.best > 5 && this.height > this.best && !this.passedBest) {
      this.passedBest = true;
      this.ui.toast('NEW BEST!', '#ffd36a');
    }
    if (this.height <= this.best) this.passedBest = false;
  }

  updateCamera(dt) {
    const p = this.player;
    let ty, tx;
    if (this.state === 'menu') {
      ty = 2.5 + Math.sin(this.time * 0.3) * 0.5;
      tx = Math.sin(this.time * 0.2) * 1.5;
    } else {
      ty = p.y + 2.2 + THREE.MathUtils.clamp(p.vy * 0.08, -1.2, 1.2);
      tx = p.x * 0.4;
    }
    this.camY += (ty - this.camY) * Math.min(1, dt * 4);
    this.camX += (tx - this.camX) * Math.min(1, dt * 3);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const s = this.shake * this.shake;
    const sx = (Math.random() - 0.5) * s * 1.2, sy = (Math.random() - 0.5) * s * 1.2;
    const menuDist = this.state === 'menu' ? 2 : 0;
    this.camera.position.set(this.camX + sx, this.camY + 1.6 + sy, this.camDist + menuDist);
    this.camera.lookAt(this.camX * 0.85, this.camY, 0);
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * this.camDist;
    this.view = { top: this.camY + halfH, bottom: this.camY - halfH };
  }
}

const game = new Game();
if (import.meta.env.DEV) window.__game = game;
