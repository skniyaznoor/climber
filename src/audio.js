import { ZONES } from './zones.js';

// Fully synthesized sound effects + a per-zone procedural soundtrack.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('ascend.muted') === '1';
    this.zone = ZONES[0];
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(this.master);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.8;
    this.sfx.connect(comp);

    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(comp);

    // Feedback delay gives the music a spacious, echoing tower feel.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.3;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.music.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(comp);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    setInterval(() => this.schedule(), 50);
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('ascend.muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  setPaused(p) {
    if (this.music) this.music.gain.setTargetAtTime(p ? 0.12 : 0.55, this.ctx.currentTime, 0.2);
  }

  setZone(zone) {
    this.zone = zone;
  }

  startMusic() {
    if (!this.ctx) return;
    if (!this.musicOn) {
      this.musicOn = true;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
    }
  }

  stopMusic() {
    this.musicOn = false;
  }

  // ---- low level voices ----
  osc(freq, t, dur, { type = 'square', vol = 0.2, slide = null, dest = this.sfx, attack = 0.005, filter = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  tone(freq, dur, opts = {}) {
    if (!this.ctx) return;
    this.osc(freq, this.ctx.currentTime + (opts.delay || 0), dur, opts);
  }

  noise(dur, { vol = 0.3, freq = 1000, type = 'lowpass', sweep = null, delay = 0, q = 1, dest = this.sfx } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  // ---- sound effects ----
  jump() { this.tone(300, 0.16, { type: 'square', vol: 0.09, slide: 620 }); }
  doubleJump() {
    this.tone(500, 0.2, { type: 'triangle', vol: 0.16, slide: 1100 });
    this.noise(0.18, { vol: 0.08, freq: 3000, type: 'highpass' });
  }
  land() { this.noise(0.09, { vol: 0.22, freq: 700 }); }
  gem() {
    this.tone(1046, 0.12, { type: 'sine', vol: 0.18 });
    this.tone(1568, 0.3, { type: 'sine', vol: 0.18, delay: 0.07 });
  }
  heart() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.15, delay: i * 0.07 }));
  }
  hurt() {
    this.tone(260, 0.35, { type: 'sawtooth', vol: 0.18, slide: 70, filter: 1800 });
    this.noise(0.25, { vol: 0.2, freq: 1500 });
  }
  crumble() { this.noise(0.6, { vol: 0.3, freq: 900, sweep: 120 }); }
  creak() { this.tone(90, 0.4, { type: 'sawtooth', vol: 0.06, slide: 60, filter: 500 }); }
  geyser() { this.noise(0.8, { vol: 0.25, freq: 2500, type: 'bandpass', sweep: 500, q: 0.7 }); }
  flame() { this.noise(0.9, { vol: 0.12, freq: 700, sweep: 300 }); }
  zap() {
    this.tone(1400, 0.15, { type: 'sawtooth', vol: 0.07, slide: 180 });
    this.noise(0.15, { vol: 0.1, freq: 4000, type: 'highpass' });
  }
  crack() { this.noise(0.12, { vol: 0.15, freq: 5000, type: 'highpass' }); }
  shatter() {
    this.noise(0.3, { vol: 0.2, freq: 6000, type: 'highpass' });
    [2200, 2900, 3500].forEach((f, i) => this.tone(f, 0.12, { type: 'sine', vol: 0.04, delay: i * 0.03 }));
  }
  thunder() {
    this.noise(0.25, { vol: 0.5, freq: 3000, sweep: 400 });
    this.noise(2.2, { vol: 0.55, freq: 380, sweep: 60, delay: 0.05 });
  }
  whoosh() { this.noise(0.5, { vol: 0.15, freq: 400, type: 'bandpass', sweep: 1600, q: 1.5 }); }
  wind() { this.noise(2.5, { vol: 0.12, freq: 300, type: 'bandpass', sweep: 900, q: 2 }); }
  splash() { this.noise(0.7, { vol: 0.35, freq: 2000, sweep: 200 }); }
  zoneUp() {
    [0, 4, 7, 12, 16].forEach((s, i) =>
      this.tone(440 * 2 ** (s / 12), 0.45, { type: 'triangle', vol: 0.12, delay: i * 0.09 }));
    this.noise(1.2, { vol: 0.08, freq: 6000, type: 'highpass', delay: 0.3 });
  }
  milestone() {
    this.tone(880, 0.12, { type: 'square', vol: 0.06 });
    this.tone(1320, 0.2, { type: 'square', vol: 0.06, delay: 0.09 });
  }
  death() {
    [392, 330, 262, 196].forEach((f, i) =>
      this.tone(f, 0.35, { type: 'triangle', vol: 0.16, delay: i * 0.16 }));
  }
  click() { this.tone(660, 0.06, { type: 'square', vol: 0.06 }); }

  // ---- procedural music ----
  schedule() {
    if (!this.musicOn || !this.ctx) return;
    const m = this.zone.music;
    const eighth = 60 / m.tempo / 2;
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, m, eighth);
      this.nextTime += eighth;
      this.step++;
    }
  }

  note(midi, t, dur, type, vol, attack = 0.01, filter = 2400) {
    this.osc(440 * 2 ** ((midi - 69) / 12), t, dur, { type, vol, attack, dest: this.music, filter });
  }

  playStep(step, t, m, eighth) {
    const chord = m.chords[Math.floor(step / 8) % m.chords.length];
    const s = step % 8;
    if (s === 0 || s === 4 || (m.drums && s === 6)) this.note(chord[0] - 12, t, eighth * 1.8, m.bass, 0.16, 0.01, 600);
    const pattern = [0, 1, 2, 1, 2, 3, 1, 2];
    const idx = pattern[s] % chord.length;
    this.note(chord[idx] + (m.octave || 12), t, eighth * 0.9, m.wave, m.leadVol);
    if (s === 0) chord.forEach((n) => this.note(n, t, eighth * 8, 'sine', 0.03, 0.5, 1200));
    if (m.drums) {
      if (s % 4 === 0) this.osc(140, t, 0.18, { type: 'sine', vol: 0.3, slide: 45, dest: this.music });
      if (s % 2 === 1) this.noiseAt(t, 0.04, 0.05, 8000);
    }
  }

  noiseAt(t, dur, vol, freq) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.music);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }
}
