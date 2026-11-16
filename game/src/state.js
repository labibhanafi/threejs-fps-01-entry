// NIGHTHAUL — the one match state. Every module reads or writes this object;
// nothing else holds match state. `rng` is a seeded mulberry32 so screenshot
// scenes and bot behaviour are reproducible from a seed.

import { ECONOMY, TIMING, WEAPONS } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshWeapon(id) {
  const w = WEAPONS[id];
  return { id, mag: w.mag, reserve: w.reserve, bloom: 0, cooldown: 0, reloadT: 0, burstLeft: 0, burstPause: 0 };
}

export function makeFighter(id, team, name, isPlayer) {
  const sidearm = freshWeapon('sidearm');
  return {
    id, team, name, isPlayer,
    alive: true, hp: 100, armor: 0,
    pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
    yaw: 0, pitch: 0, crouch: false, onGround: true,
    weapon: sidearm, weapons: { sidearm, primary: null }, primary: null,
    grenades: { frag: 0, pulse: 0 }, grenadeSel: 'frag',
    money: ECONOMY.startMoney, kills: 0, deaths: 0,
    carryingCore: false, revealedT: 0, flashT: 0,
    channelT: 0, channelKind: null, // 'upload' | 'scrub' | 'return'
    scoped: false, recoil: 0, lastShotAt: -99, heardAt: null,
    bot: null, // bot brain, null for the player
    mesh: null, hitboxes: [], // filled by world.js
  };
}

export function createState(seed) {
  const rng = mulberry32(seed);
  const fighters = [];
  const runnerNames = ['You', 'Mako', 'Sable', 'Kestrel', 'Dune'];
  const authorityNames = ['Harbormaster', 'Crane', 'Tide', 'Anchor', 'Gull'];
  for (let i = 0; i < 5; i++) fighters.push(makeFighter(i, 'R', runnerNames[i], i === 0));
  for (let i = 0; i < 5; i++) fighters.push(makeFighter(5 + i, 'A', authorityNames[i], false));
  return {
    seed, rng,
    time: 0, // match clock, seconds
    phase: 'menu', // menu | buy | live | roundEnd | matchEnd
    phaseT: 0, // seconds in this phase
    round: 1,
    score: { R: 0, A: 0 },
    timer: TIMING.roundSeconds,
    fighters,
    core: { state: 'spawn', pos: { x: -24, y: 0.6, z: 0 }, holderId: -1, returnT: 0 },
    upload: { state: 'idle', site: null, progress: 0, channelT: 0 },
    killfeed: [], // {text, t, cls}
    roundLog: [], // strings for the scoreboard
    banner: null, // {title, sub, t}
    winner: null, // 'R' | 'A' | 'draw'
    roundWinner: null,
    grenades: [], // live thrown grenades {pos, vel, kind, fuse, ownerId, mesh}
    stats: { shots: 0, hits: 0 },
    // transient per-frame intents, filled by input/bots, consumed by the step:
    events: [], // {kind:'shot'|'kill'|'pickup'|'drop'|'uploadStart'|'uploadDone'|'scrub'|'return'|'round'|'match', ...}
  };
}
