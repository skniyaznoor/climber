// Each zone is a themed band of the tower. After the last zone the tower loops
// back to the first theme with a higher "lap", which raises difficulty.
export const ZONE_HEIGHT = 70;

export const ZONES = [
  {
    key: 'stone',
    name: 'ANCIENT RUINS',
    subtitle: 'Every legend starts at the bottom',
    icon: '🏛',
    skyTop: 0x1d2b4a, skyBottom: 0xc99a6b, stars: 0.0,
    fog: 0x6b5f5a, fogDensity: 0.016,
    hemiSky: 0xbfd4ff, hemiGround: 0x4a3a2a, hemiIntensity: 1.0,
    sun: 0xffd9a8, sunIntensity: 2.0,
    pipe: 0x9a8f80, rust: 0x8a5a3a, accent: 0xffb347, gem: 0xffd24a,
    lamp: 0xffcf8a,
    tide: { color: 0x4b6b3a, deep: 0x101a0c, foam: 0xc8d9a0, glow: 0.0, lava: 0, ice: 0, plasma: 0 },
    particles: 'dust',
    wall: { brick: '#7a6e5f', mortar: '#2b2620', variance: 0.18, extra: 'moss', seed: 11, emissive: false },
    backdrop: 'tower',
    features: { ladder: 0.12, split: 0.16, broken: 0.14, moving: 0.10, side: 0.28 },
    music: {
      tempo: 100, wave: 'triangle', bass: 'sine', leadVol: 0.07, drums: false,
      chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
    },
  },
  {
    key: 'water',
    name: 'FLOODED DEPTHS',
    subtitle: 'Ride the geysers. Don\'t drown.',
    icon: '🌊',
    skyTop: 0x020c1a, skyBottom: 0x0f5a7a, stars: 0.35,
    fog: 0x0d3a50, fogDensity: 0.02,
    hemiSky: 0x7ad4ff, hemiGround: 0x02202a, hemiIntensity: 1.1,
    sun: 0x9ae0ff, sunIntensity: 1.6,
    pipe: 0x5a9a88, rust: 0x3a6a5a, accent: 0x3affd8, gem: 0xffd24a,
    lamp: 0xaef6ff,
    tide: { color: 0x1a8ac0, deep: 0x011a30, foam: 0xd0faff, glow: 0.15, lava: 0, ice: 0, plasma: 0 },
    particles: 'drip',
    wall: { brick: '#3e5a63', mortar: '#122228', variance: 0.16, extra: 'wet', seed: 23, emissive: true },
    backdrop: 'tank',
    features: { ladder: 0.10, split: 0.25, broken: 0.18, moving: 0.18, side: 0.25, geyser: 0.3 },
    music: {
      tempo: 86, wave: 'sine', bass: 'sine', leadVol: 0.08, drums: false,
      chords: [[50, 53, 57, 60], [48, 52, 55, 59], [46, 50, 53, 57], [48, 52, 55, 60]],
    },
  },
  {
    key: 'fire',
    name: 'INFERNO CORE',
    subtitle: 'Mind the vents. The pipes run hot.',
    icon: '🔥',
    skyTop: 0x120202, skyBottom: 0x8a2a08, stars: 0.0,
    fog: 0x4a1408, fogDensity: 0.02,
    hemiSky: 0xff9a60, hemiGround: 0x300800, hemiIntensity: 1.0,
    sun: 0xff8a4a, sunIntensity: 1.8,
    pipe: 0x6a5a54, rust: 0x7a2a10, accent: 0xff6a1a, gem: 0x7affff,
    lamp: 0xffb070,
    tide: { color: 0xff5a10, deep: 0x5a0a00, foam: 0xffe080, glow: 1.0, lava: 1, ice: 0, plasma: 0 },
    particles: 'ember',
    wall: { brick: '#4a2a22', mortar: '#140806', variance: 0.2, extra: 'cracks', seed: 37, emissive: true },
    backdrop: 'spire',
    features: { ladder: 0.08, split: 0.22, broken: 0.2, moving: 0.15, side: 0.2, vent: 0.3, hot: 0.2, fireball: true },
    music: {
      tempo: 132, wave: 'square', bass: 'sawtooth', leadVol: 0.035, drums: true,
      chords: [[52, 55, 59], [53, 57, 60], [52, 55, 59], [50, 53, 57]],
    },
  },
  {
    key: 'ice',
    name: 'FROZEN SPIRE',
    subtitle: 'Slippery footing. Howling winds.',
    icon: '❄',
    skyTop: 0x0a1a3a, skyBottom: 0x6aa8d8, stars: 0.2,
    fog: 0x5a7c9c, fogDensity: 0.018,
    hemiSky: 0xc8e8ff, hemiGround: 0x2a4a6a, hemiIntensity: 0.6,
    sun: 0xeaf6ff, sunIntensity: 1.5,
    pipe: 0xa8c0d0, rust: 0x6a8aa8, accent: 0x8ae8ff, gem: 0xff4ad2,
    lamp: 0xd8f4ff,
    tide: { color: 0xcdeeff, deep: 0x3a6a9a, foam: 0xffffff, glow: 0.25, lava: 0, ice: 1, plasma: 0 },
    particles: 'snow',
    wall: { brick: '#3f5a72', mortar: '#152230', variance: 0.12, extra: 'frost', seed: 51, emissive: true, glow: 0.5 },
    backdrop: 'peak',
    features: { ladder: 0.10, split: 0.16, broken: 0.18, moving: 0.15, side: 0.22, icy: 0.5, icicle: 0.3, wind: true },
    music: {
      tempo: 94, wave: 'sine', bass: 'triangle', leadVol: 0.08, drums: false, octave: 24,
      chords: [[54, 57, 61], [50, 54, 57], [45, 49, 52], [52, 56, 59]],
    },
  },
  {
    key: 'storm',
    name: 'STORM SUMMIT',
    subtitle: 'Lightning seeks the highest point.',
    icon: '⚡',
    skyTop: 0x05030f, skyBottom: 0x3a2a6a, stars: 1.0,
    fog: 0x1a1430, fogDensity: 0.022,
    hemiSky: 0x9a8aff, hemiGround: 0x100820, hemiIntensity: 1.0,
    sun: 0xb8b0ff, sunIntensity: 1.5,
    pipe: 0x5a5a70, rust: 0x403a55, accent: 0xb06aff, gem: 0x6aff9a,
    lamp: 0xd0c0ff,
    tide: { color: 0x8a3aff, deep: 0x12043a, foam: 0xe0b0ff, glow: 0.8, lava: 0, ice: 0, plasma: 1 },
    particles: 'rain',
    wall: { brick: '#3a3550', mortar: '#121020', variance: 0.15, extra: 'circuit', seed: 67, emissive: true, glow: 0.7 },
    backdrop: 'rock',
    features: { ladder: 0.08, split: 0.2, broken: 0.22, moving: 0.25, side: 0.2, electric: 0.25, wind: true, lightning: true },
    music: {
      tempo: 144, wave: 'sawtooth', bass: 'sawtooth', leadVol: 0.03, drums: true,
      chords: [[48, 51, 55], [44, 48, 51], [46, 50, 53], [43, 47, 50]],
    },
  },
];

export function zoneByIndex(i) {
  if (i < 0) return ZONES[0];
  return ZONES[i % ZONES.length];
}

export function zoneAt(y) {
  const index = Math.max(0, Math.floor(y / ZONE_HEIGHT));
  return { index, zone: zoneByIndex(index), lap: Math.floor(index / ZONES.length) };
}

// Returns two zones and a blend factor so colours cross-fade near boundaries.
export function zoneBlend(y, edge = 8) {
  const i = Math.floor(y / ZONE_HEIGHT);
  const local = y - i * ZONE_HEIGHT;
  const s = (t) => t * t * (3 - 2 * t);
  if (local > ZONE_HEIGHT - edge) {
    return { a: zoneByIndex(i), b: zoneByIndex(i + 1), t: s((local - (ZONE_HEIGHT - edge)) / (2 * edge)) };
  }
  if (local < edge && i > 0) {
    return { a: zoneByIndex(i - 1), b: zoneByIndex(i), t: s(0.5 + local / (2 * edge)) };
  }
  const z = zoneByIndex(i);
  return { a: z, b: z, t: 0 };
}
