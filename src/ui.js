import { ZONES, ZONE_HEIGHT } from './zones.js';

const $ = (id) => document.getElementById(id);
const HEART_SVG = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4 6.3 4c2.4 0 3.9 1.4 5.7 3.4C13.8 5.4 15.3 4 17.7 4c4 0 5.9 4.4 4.3 7.7C19.5 16.4 12 21 12 21z"/></svg>';

export class UI {
  constructor() {
    this.el = {
      menu: $('menu'), pause: $('pause'), over: $('gameover'), hud: $('hud'), touch: $('touch'),
      height: $('hud-height'), score: $('hud-score'), gems: $('hud-gems'), zone: $('hud-zone'),
      hearts: $('hud-hearts'), banner: $('banner'), toast: $('toast'), vignette: $('vignette'),
      hurt: $('hurt-flash'), wind: $('wind-indicator'), flash: $('flash'),
      progPlayer: $('progress-player'), progTide: $('progress-tide'), progZones: $('progress-zones'), progLap: $('progress-lap'),
      menuBest: $('menu-best'), mute: $('btn-mute'),
    };
    this.lastHearts = -1;
    this.lastZoneName = '';

    this.el.progZones.innerHTML = ZONES.map((z) =>
      `<div class="pz" style="--c:#${z.accent.toString(16).padStart(6, '0')}"><span>${z.icon}</span></div>`).join('');
    $('menu-zones').innerHTML = ZONES.map((z, i) =>
      `<div class="zone-chip" style="--c:#${z.accent.toString(16).padStart(6, '0')}"><b>${z.icon}</b><span>${i + 1}. ${z.name}</span></div>`).join('');

    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
  }

  show(name) {
    for (const k of ['menu', 'pause', 'over']) this.el[k].classList.toggle('hidden', k !== name);
    const inGame = name === 'hud' || name === 'pause';
    this.el.hud.classList.toggle('hidden', !inGame && name !== 'over');
    this.el.touch.classList.toggle('hidden', name !== 'hud');
  }

  setBest(best) {
    this.el.menuBest.textContent = best > 0 ? `BEST CLIMB: ${best} m` : 'No climbs yet — be the first!';
  }

  setMuted(m) {
    this.el.mute.classList.toggle('off', m);
  }

  hud(s) {
    this.el.height.textContent = s.height;
    this.el.score.textContent = s.score.toLocaleString();
    this.el.gems.textContent = s.gems;
    if (s.zoneName !== this.lastZoneName) {
      this.lastZoneName = s.zoneName;
      this.el.zone.textContent = s.zoneName;
      this.el.zone.style.setProperty('--c', s.zoneColor);
    }
    if (s.hearts !== this.lastHearts || s.maxHearts !== this.lastMax) {
      const gained = s.hearts > this.lastHearts && this.lastHearts >= 0;
      this.lastHearts = s.hearts;
      this.lastMax = s.maxHearts;
      this.el.hearts.innerHTML = Array.from({ length: s.maxHearts }, (_, i) =>
        `<i class="heart ${i < s.hearts ? 'full' : 'empty'} ${gained && i === s.hearts - 1 ? 'pop' : ''}">${HEART_SVG}</i>`).join('');
    }
    const lapSpan = ZONE_HEIGHT * ZONES.length;
    const lap = Math.floor(Math.max(0, s.y) / lapSpan);
    const base = lap * lapSpan;
    const pct = (y) => Math.max(0, Math.min(100, ((y - base) / lapSpan) * 100));
    this.el.progPlayer.style.bottom = pct(s.y) + '%';
    this.el.progTide.style.height = pct(s.tideY) + '%';
    this.el.progLap.textContent = lap > 0 ? `LAP ${lap + 1}` : '';

    const danger = Math.max(0, Math.min(1, 1 - (s.y - s.tideY) / 7));
    this.el.vignette.style.opacity = danger;
    this.el.vignette.style.setProperty('--c', s.tideColor);

    const w = s.wind;
    if (Math.abs(w) > 2) {
      this.el.wind.classList.add('on');
      this.el.wind.textContent = w > 0 ? 'WIND ≫≫≫' : '≪≪≪ WIND';
      this.el.wind.style.opacity = Math.min(1, Math.abs(w) / 10);
    } else this.el.wind.classList.remove('on');

    this.el.flash.style.opacity = s.flash * 0.6;
  }

  banner(index, zone, lap) {
    const b = this.el.banner;
    b.querySelector('.banner-zone').textContent = lap > 0 ? `ZONE ${index + 1} · LAP ${lap + 1}` : `ZONE ${index + 1}`;
    b.querySelector('.banner-name').textContent = zone.name;
    b.querySelector('.banner-sub').textContent = zone.subtitle;
    b.style.setProperty('--c', '#' + zone.accent.toString(16).padStart(6, '0'));
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  toast(text, color = '#ffd36a') {
    const t = document.createElement('div');
    t.className = 'toast-item';
    t.textContent = text;
    t.style.color = color;
    this.el.toast.appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }

  hurtFlash() {
    const h = this.el.hurt;
    h.classList.remove('on');
    void h.offsetWidth;
    h.classList.add('on');
  }

  gameOver(s) {
    $('go-height').textContent = s.height + ' m';
    $('go-score').textContent = s.score.toLocaleString();
    $('go-gems').textContent = s.gems;
    $('go-zone').textContent = s.zoneName;
    $('go-best').textContent = s.best + ' m';
    $('go-cause').textContent = s.cause;
    $('go-newbest').classList.toggle('hidden', !s.newBest);
    this.show('over');
  }
}
