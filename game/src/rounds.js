// NIGHTHAUL — match flow: buy phases, the round clock, the economy, and the
// Core Run objective (pickup, drop, return, channel, upload, scrub). Rounds
// end by upload, elimination or the clock; first to 7 takes the match.

import { BUY_MENU, ECONOMY, GRENADES, TIMING, WEAPONS } from './config.js';
import { CORE_SPAWN, PYLONS, SPAWNS } from './mapdata.js';
import { freshWeapon } from './state.js';
import { assignRoles, botBuy } from './bots.js';

function resetCore(state) {
  state.core = { state: 'spawn', pos: { x: CORE_SPAWN.x, y: 0.6, z: CORE_SPAWN.z }, holderId: -1, returnT: 0 };
  state.upload = { state: 'idle', site: null, progress: 0, channelT: 0 };
}

export function startMatch(state) {
  state.score = { R: 0, A: 0 };
  state.round = 1;
  state.winner = null;
  state.roundLog = [];
  for (const f of state.fighters) {
    f.money = ECONOMY.startMoney; f.kills = 0; f.deaths = 0;
    f.primary = null; f.armor = 0; f.grenades = { frag: 0, pulse: 0 };
    f.weapons = { sidearm: freshWeapon('sidearm'), primary: null };
    f.weapon = f.weapons.sidearm;
  }
  startRound(state);
}

export function startRound(state) {
  state.phase = 'buy';
  state.phaseT = 0;
  state.timer = TIMING.roundSeconds;
  state.roundWinner = null;
  state.banner = { title: `ROUND ${state.round}`, sub: 'Buy phase — gear up, Runners carry the core', t: state.time };
  resetCore(state);
  state.grenades.length = 0;
  assignRoles(state);
  for (const f of state.fighters) {
    const spawn = SPAWNS[f.team][f.id % 5];
    f.pos = { x: spawn.x, y: 0, z: spawn.z };
    f.vel = { x: 0, y: 0, z: 0 };
    f.yaw = spawn.yaw; f.pitch = 0;
    f.hp = 100; f.alive = true; f.frozen = true;
    f.carryingCore = false; f.revealedT = 0;
    f.channelT = 0; f.channelKind = null;
    f.weapon.reloadT = 0; f.weapon.cooldown = 0; f.weapon.bloom = 0;
    if (!f.isPlayer) botBuy(f, state.rng);
  }
}

export function buyItem(state, f, id) {
  if (state.phase !== 'buy' || !f.alive) return false;
  const entry = BUY_MENU.find((b) => b.id === id);
  if (!entry || f.money < entry.price) return false;
  if (entry.kind === 'weapon') {
    f.primary = entry.id;
    f.weapons.primary = freshWeapon(entry.id);
    f.weapon = f.weapons.primary;
  } else if (entry.kind === 'armor') {
    if (f.armor > 0) return false;
    f.armor = 1;
  } else if (entry.kind === 'grenade') {
    f.grenades[entry.id] += 1;
  }
  f.money -= entry.price;
  return true;
}

function endRound(state, winner, reason) {
  state.phase = 'roundEnd';
  state.phaseT = 0;
  state.roundWinner = winner;
  state.score[winner] += 1;
  for (const f of state.fighters) {
    const won = f.team === winner;
    f.money = Math.min(ECONOMY.maxMoney, f.money + (won ? ECONOMY.winUpload : ECONOMY.lossBonus));
    // The dead lose their kit; survivors keep it.
    if (!f.alive) {
      f.primary = null; f.armor = 0; f.grenades = { frag: 0, pulse: 0 };
      f.weapons.primary = null; f.weapon = f.weapons.sidearm;
    }
  }
  const label = winner === 'R' ? 'RUNNERS' : 'AUTHORITY';
  state.banner = { title: `${label} WIN THE ROUND`, sub: reason, t: state.time };
  state.roundLog.unshift(`R${state.round}: ${label} — ${reason}`);
  state.events.push({ kind: 'round', winner, reason, at: state.time });
}

function endMatch(state) {
  state.phase = 'matchEnd';
  state.phaseT = 0;
  const { R, A } = state.score;
  state.winner = R === A ? 'draw' : R > A ? 'R' : 'A';
  state.banner = {
    title: state.winner === 'draw' ? 'DRAW' : state.winner === 'R' ? 'RUNNERS TAKE THE MATCH' : 'AUTHORITY TAKES THE MATCH',
    sub: `${R} — ${A} · press Enter to play again`,
    t: state.time,
  };
  state.events.push({ kind: 'match', winner: state.winner, at: state.time });
}

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Core pickup (walk-over), defender return, carrier channel, upload, scrub.
function stepObjective(state, input, dt) {
  const player = state.fighters[0];
  // Pickup: any living Runner walks over a loose core.
  if (state.core.state !== 'carried') {
    for (const f of state.fighters) {
      if (!f.alive || f.team !== 'R') continue;
      if (dist2D(f.pos, state.core.pos) < 1.3) {
        state.core.state = 'carried';
        state.core.holderId = f.id;
        f.carryingCore = true;
        state.events.push({ kind: 'pickup', by: f.id, at: state.time });
        break;
      }
    }
  }
  // Defender return: stand on a dropped core for 3 s.
  if (state.core.state === 'dropped') {
    let returning = false;
    for (const f of state.fighters) {
      if (!f.alive || f.team !== 'A') continue;
      if (dist2D(f.pos, state.core.pos) < 1.4) {
        f.channelT += dt; f.channelKind = 'return';
        returning = true;
        if (f.channelT >= TIMING.returnSeconds) {
          resetCore(state);
          state.events.push({ kind: 'return', at: state.time });
          for (const g of state.fighters) { g.channelT = 0; g.channelKind = null; }
        }
        break;
      }
    }
    if (!returning) for (const f of state.fighters) if (f.channelKind === 'return') { f.channelT = 0; f.channelKind = null; }
  }
  // Channel + upload + scrub.
  const up = state.upload;
  const holder = state.core.holderId >= 0 ? state.fighters[state.core.holderId] : null;
  if (up.state === 'idle' || up.state === 'channel') {
    // Carrier channels at a pylon (player holds E, bots do it on their own).
    let site = null, carrier = null;
    if (holder && holder.alive) {
      for (const [key, p] of Object.entries(PYLONS)) {
        if (dist2D(holder.pos, p) < 2.6) { site = key; carrier = holder; break; }
      }
    }
    if (carrier) {
      const wants = carrier.isPlayer ? input.interact : true;
      if (wants) {
        up.state = 'channel'; up.site = site; up.channelT += dt;
        carrier.channelT = up.channelT; carrier.channelKind = 'upload';
        if (up.channelT >= TIMING.channelSeconds) {
          up.state = 'uploading'; up.progress = 0; up.channelT = 0;
          carrier.channelT = 0; carrier.channelKind = null;
          for (const r of state.fighters) if (r.team === 'R') r.money = Math.min(ECONOMY.maxMoney, r.money + ECONOMY.uploadTeamBonus);
          state.banner = { title: 'UPLOAD STARTED', sub: `Site ${site} — defend the pylon`, t: state.time };
          state.events.push({ kind: 'uploadStart', site, at: state.time });
        }
      } else { up.state = 'idle'; up.site = null; up.channelT = 0; carrier.channelT = 0; carrier.channelKind = null; }
    } else if (up.state === 'channel') { up.state = 'idle'; up.site = null; up.channelT = 0; }
  } else if (up.state === 'uploading') {
    up.progress += dt;
    // Defenders scrub: 5 s channel at the live pylon.
    const p = PYLONS[up.site];
    let scrubber = null;
    for (const f of state.fighters) {
      if (!f.alive || f.team !== 'A') continue;
      if (dist2D(f.pos, p) < 2.6) { scrubber = f; break; }
    }
    if (scrubber) {
      const wants = scrubber.isPlayer ? input.interact : true;
      if (wants) {
        scrubber.channelT += dt; scrubber.channelKind = 'scrub';
        if (scrubber.channelT >= TIMING.scrubSeconds) {
          // Upload scrubbed: the core returns to mid-dock, the round goes on.
          state.core = { state: 'dropped', pos: { x: 0, y: 0.6, z: 0 }, holderId: -1, returnT: 0 };
          if (holder) holder.carryingCore = false;
          state.upload = { state: 'idle', site: null, progress: 0, channelT: 0 };
          for (const g of state.fighters) { g.channelT = 0; g.channelKind = null; }
          state.banner = { title: 'UPLOAD SCRUBBED', sub: 'The core is back on mid-dock', t: state.time };
          state.events.push({ kind: 'scrub', at: state.time });
          return;
        }
      } else { scrubber.channelT = 0; scrubber.channelKind = null; }
    }
    if (up.progress >= TIMING.uploadSeconds) {
      state.events.push({ kind: 'uploadDone', site: up.site, at: state.time });
      endRound(state, 'R', `Upload complete at Site ${up.site}`);
    }
  }
}

function aliveCount(state, team) {
  return state.fighters.filter((f) => f.team === team && f.alive).length;
}

export function stepRounds(state, input, dt) {
  if (state.phase === 'menu' || state.phase === 'matchEnd') return;
  state.phaseT += dt;
  if (state.phase === 'buy') {
    if (state.phaseT >= TIMING.buySeconds) {
      state.phase = 'live'; state.phaseT = 0;
      for (const f of state.fighters) f.frozen = false;
      state.banner = { title: 'GO', sub: 'Carry the core to a pylon', t: state.time };
    }
    return;
  }
  if (state.phase === 'live') {
    state.timer -= dt;
    stepObjective(state, input, dt);
    if (state.phase !== 'live') return; // uploadDone ended the round
    if (aliveCount(state, 'R') === 0) { endRound(state, 'A', 'Runners eliminated'); return; }
    if (aliveCount(state, 'A') === 0) { endRound(state, 'R', 'Authority eliminated'); return; }
    if (state.timer <= 0) { endRound(state, 'A', 'Time expired — Authority holds the dock'); return; }
    return;
  }
  if (state.phase === 'roundEnd') {
    if (state.phaseT >= TIMING.endSeconds) {
      if (state.score.R >= TIMING.roundsToWin || state.score.A >= TIMING.roundsToWin || state.round >= TIMING.maxRounds) {
        endMatch(state);
      } else {
        state.round += 1;
        startRound(state);
      }
    }
  }
}
