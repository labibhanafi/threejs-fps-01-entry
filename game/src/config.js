// NIGHTHAUL — every tunable number in one place: palette, weapons, grenades,
// economy, timings. Nothing in this file touches the DOM or three.js; the other
// modules read it, never mutate it.

// Night over a container port: deep navy sky, sodium-orange light pools, teal core.
export const PALETTE = {
  sky: 0x0a1420,
  fog: 0x0d1a26,
  ground: 0x1b222b,
  groundLine: 0x141b22,
  concrete: 0x5c666e,
  wallDark: 0x2e3841,
  crate: 0x8a6b3f,
  accent: 0xff9a2e, // sodium orange
  teal: 0x2fd6c0, // core / runners
  runners: 0x2fd6c0, // attackers: teal
  authority: 0xff9a2e, // defenders: sodium orange
  containers: [0x8a4a38, 0x2e6b7a, 0x4d7c59, 0xa67c2e, 0x5d6d7e, 0x7a4a63, 0x94502e],
  ink: '#e8ecef',
  muted: '#8b98a3',
};

export const TIMING = {
  buySeconds: 12,
  roundSeconds: 105, // 1:45
  channelSeconds: 4, // carrier channels at a pylon to start the upload
  uploadSeconds: 25, // upload itself
  scrubSeconds: 5, // defender channels to scrub an upload
  returnSeconds: 3, // defender stands on a dropped core to return it
  endSeconds: 5.5, // round-end banner before the next buy phase
  roundsToWin: 7,
  maxRounds: 12,
};

export const ECONOMY = {
  startMoney: 800,
  maxMoney: 9000,
  killReward: 300,
  winUpload: 2400,
  winElimination: 2400,
  winTimeout: 2400, // defenders win on time
  lossBonus: 1400,
  uploadTeamBonus: 600, // each Runner, when the upload starts
  armorPrice: 650,
};

// Damage is per bullet at the chest. Head multiplies, legs divide, armour absorbs.
// spreadBase is the resting cone in radians; spreadMove is added at full run speed;
// bloom is added per shot and decays. The lesson the numbers teach: stop, crouch,
// then fire. Counter-strafing pays.
export const WEAPONS = {
  sidearm: {
    name: 'P9 Sidearm', slot: 'sidearm', price: 0, damage: 26, headMult: 4, legMult: 0.75,
    rpm: 340, mag: 12, reserve: 48, reloadSeconds: 1.5, auto: false,
    spreadBase: 0.011, spreadMove: 0.045, spreadCrouch: 0.6, bloom: 0.006, bloomMax: 0.05,
    recoil: 0.011, range: 60, falloffFrom: 18, falloffTo: 0.55, pellets: 1, tracer: 0xffd9a0,
    kick: 0.35, soundPitch: 1.25,
  },
  smg: {
    name: 'VK-9', slot: 'primary', price: 1200, damage: 21, headMult: 4, legMult: 0.75,
    rpm: 800, mag: 32, reserve: 96, reloadSeconds: 2.1, auto: true,
    spreadBase: 0.017, spreadMove: 0.05, spreadCrouch: 0.65, bloom: 0.005, bloomMax: 0.06,
    recoil: 0.008, range: 55, falloffFrom: 12, falloffTo: 0.45, pellets: 1, tracer: 0xffd9a0,
    kick: 0.22, soundPitch: 1.5,
  },
  shotgun: {
    name: 'Mule-12', slot: 'primary', price: 1800, damage: 10, headMult: 2.6, legMult: 0.8,
    rpm: 68, mag: 6, reserve: 24, reloadSeconds: 2.9, auto: false,
    spreadBase: 0.055, spreadMove: 0.03, spreadCrouch: 0.85, bloom: 0.01, bloomMax: 0.03,
    recoil: 0.05, range: 26, falloffFrom: 6, falloffTo: 0.3, pellets: 8, tracer: 0xffc98a,
    kick: 1.0, soundPitch: 0.7,
  },
  rifle: {
    name: 'AR-57', slot: 'primary', price: 2700, damage: 33, headMult: 4, legMult: 0.75,
    rpm: 600, mag: 30, reserve: 90, reloadSeconds: 2.4, auto: true,
    spreadBase: 0.008, spreadMove: 0.055, spreadCrouch: 0.55, bloom: 0.007, bloomMax: 0.055,
    recoil: 0.014, range: 90, falloffFrom: 30, falloffTo: 0.7, pellets: 1, tracer: 0xffe2b0,
    kick: 0.5, soundPitch: 1.0,
  },
  sniper: {
    name: 'Lance-8', slot: 'primary', price: 4300, damage: 88, headMult: 4, legMult: 0.7,
    rpm: 105, mag: 5, reserve: 25, reloadSeconds: 2.8, auto: false,
    spreadBase: 0.0015, spreadMove: 0.09, spreadCrouch: 0.5, bloom: 0.02, bloomMax: 0.04,
    recoil: 0.045, range: 140, falloffFrom: 60, falloffTo: 0.85, pellets: 1, tracer: 0xfff3cf,
    kick: 1.4, soundPitch: 0.55, scoped: true,
  },
};

export const GRENADES = {
  frag: { name: 'Frag Grenade', price: 300, radius: 6.5, damage: 96, fuse: 1.6 },
  pulse: { name: 'Pulse Grenade', price: 400, radius: 25, revealSeconds: 4, fuse: 1.3 },
};

export const BUY_MENU = [
  { key: '1', id: 'smg', label: WEAPONS.smg.name, price: WEAPONS.smg.price, kind: 'weapon' },
  { key: '2', id: 'shotgun', label: WEAPONS.shotgun.name, price: WEAPONS.shotgun.price, kind: 'weapon' },
  { key: '3', id: 'rifle', label: WEAPONS.rifle.name, price: WEAPONS.rifle.price, kind: 'weapon' },
  { key: '4', id: 'sniper', label: WEAPONS.sniper.name, price: WEAPONS.sniper.price, kind: 'weapon' },
  { key: '5', id: 'armor', label: 'Port Armour', price: ECONOMY.armorPrice, kind: 'armor' },
  { key: '6', id: 'frag', label: GRENADES.frag.name, price: GRENADES.frag.price, kind: 'grenade' },
  { key: '7', id: 'pulse', label: GRENADES.pulse.name, price: GRENADES.pulse.price, kind: 'grenade' },
];

export const BOT = {
  count: 5, // per team, including the player's slot on the Runners
  speed: 4.55,
  reactionSeconds: 0.42,
  burstMin: 3,
  burstMax: 6,
  burstPause: 0.34,
  visionRange: 46,
  visionCos: Math.cos((104 * Math.PI) / 360), // half of a 104-degree cone
  hearingRange: 30,
  aimErrorBase: 0.016, // radians of aim wander, grows with range and target speed
  thinkEvery: 0.15,
};

export const PLAYER = {
  speed: 4.9,
  sprintSpeed: 6.4, // Shift: loud and inaccurate
  crouchSpeed: 2.2,
  accel: 42,
  airAccel: 6,
  jumpSpeed: 4.6,
  gravity: 13.5,
  eyeStand: 1.62,
  eyeCrouch: 1.12,
  radius: 0.42,
  heightStand: 1.78,
  heightCrouch: 1.28,
  carrierSlow: 0.85, // core carrier: -15% move speed, no sprint
};
