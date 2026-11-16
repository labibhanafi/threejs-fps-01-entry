// NIGHTHAUL — bot squads. Roles, a waypoint graph, perception (view cone +
// line of sight + light pools + hearing), burst fire through the same weapon
// code the player uses, and reactions to the core and the upload.

import { BOT, ECONOMY, WEAPONS } from './config.js';
import { findPath, inLightPool, nearestWaypoint, WAYPOINTS } from './mapdata.js';
import { hasLineOfSight } from './combat.js';
import { eyePos, moveFighter } from './player.js';
import { fireWeapon, startReload, throwGrenade, updateWeapon } from './weapons.js';

function angleTo(f, x, z) {
  return Math.atan2(-(x - f.pos.x), -(z - f.pos.z));
}

function turnToward(f, targetYaw, dt, rate = 6) {
  let d = targetYaw - f.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  f.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
}

export function makeBot(role) {
  return {
    role, // escort | anchor | lurker | rotator
    path: [], pathI: 0,
    holdNode: -1, holdT: 0,
    enemy: null, firstSeenAt: -99, lastSeenPos: null,
    heardPos: null, heardAt: -99,
    burstLeft: 0, burstPause: 0,
    thinkT: Math.random() * 0.15,
    strafeDir: 1, strafeT: 0,
    destNode: -1,
  };
}

export function assignRoles(state) {
  // Runners: two escorts on the carrier, one lurker, one rotator.
  // Authority: one anchor per pylon, one lurker, two rotators.
  const rolesR = ['escort', 'escort', 'lurker', 'rotator'];
  const rolesA = ['anchor', 'anchor', 'lurker', 'rotator', 'rotator'];
  let ri = 0, ai = 0;
  for (const f of state.fighters) {
    if (f.isPlayer) { f.bot = null; continue; }
    if (!f.bot) f.bot = makeBot('rotator');
    if (f.team === 'R') { f.bot.role = rolesR[ri++ % 4]; f.bot.holdNode = -1; }
    else {
      f.bot.role = rolesA[ai];
      f.bot.holdNode = f.bot.role === 'anchor' ? (ai === 0 ? 22 : 23) : -1;
      ai++;
    }
    f.bot.path = []; f.bot.pathI = 0; f.bot.enemy = null;
  }
}

export function botBuy(f, rng) {
  // Simple economy: rifle when rich, SMG when broke, armour when it fits.
  if (f.money >= WEAPONS.rifle.price + 300) {
    f.primary = 'rifle'; f.money -= WEAPONS.rifle.price;
  } else if (f.money >= WEAPONS.smg.price) {
    f.primary = 'smg'; f.money -= WEAPONS.smg.price;
  }
  if (f.primary) {
    f.weapons.primary = { id: f.primary, mag: WEAPONS[f.primary].mag, reserve: WEAPONS[f.primary].reserve, bloom: 0, cooldown: 0, reloadT: 0, burstLeft: 0, burstPause: 0 };
    f.weapon = f.weapons.primary;
  }
  if (f.money >= ECONOMY.armorPrice + 300) { f.armor = 1; f.money -= ECONOMY.armorPrice; }
  if (f.money >= 400 && rng() < 0.5) { f.grenades.pulse += 1; f.money -= 400; }
  else if (f.money >= 300 && rng() < 0.4) { f.grenades.frag += 1; f.money -= 300; }
}

// Where this bot wants to be right now, as a waypoint index.
function objectiveNode(state, f) {
  const b = f.bot;
  const up = state.upload;
  if (f.team === 'R') {
    if (f.carryingCore) {
      // Carrier walks the nearest pylon.
      const dA = Math.hypot(f.pos.x + 20, f.pos.z + 18);
      const dB = Math.hypot(f.pos.x - 20, f.pos.z - 18);
      return dA < dB ? 22 : 23;
    }
    if (state.core.state === 'dropped') return nearestWaypoint(state.core.pos.x, state.core.pos.z);
    if (b.role === 'escort') {
      const carrier = state.fighters[state.core.holderId] || state.fighters[0];
      return nearestWaypoint(carrier.pos.x, carrier.pos.z);
    }
    if (b.role === 'lurker') return 8; // mid, then push with the pack
    return state.rng() < 0.5 ? 22 : 23; // rotator drifts between pylons
  }
  // Authority
  if (up.state === 'uploading' || up.state === 'channel') return up.site === 'A' ? 22 : 23; // stack the pylon
  if (state.core.state === 'dropped') return nearestWaypoint(state.core.pos.x, state.core.pos.z); // go return it
  if (b.role === 'anchor') return b.holdNode;
  if (b.role === 'lurker') return 8;
  return state.rng() < 0.5 ? 22 : 23;
}

function perceive(state, world, f) {
  const b = f.bot;
  const eye = eyePos(f);
  let best = null, bestD = Infinity;
  for (const e of state.fighters) {
    if (!e.alive || e.team === f.team) continue;
    const dx = e.pos.x - f.pos.x, dz = e.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz);
    let range = BOT.visionRange;
    if (inLightPool(e.pos.x, e.pos.z)) range *= 1.35;
    if (e.crouch) range *= 0.8;
    if (e.sprinting) range *= 1.15;
    if (dist > range) continue;
    const yawTo = Math.atan2(-dx, -dz);
    let d = yawTo - f.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) > Math.acos(BOT.visionCos) + 0.25) continue; // outside the cone
    if (!hasLineOfSight(state, world, eye, { x: e.pos.x, y: e.pos.y + 1.2, z: e.pos.z })) continue;
    if (dist < bestD) { bestD = dist; best = e; }
  }
  if (best) {
    if (b.enemy !== best) b.firstSeenAt = state.time;
    b.enemy = best;
    b.lastSeenPos = { x: best.pos.x, y: best.pos.y, z: best.pos.z };
  } else if (b.enemy && state.time - b.firstSeenAt > 1.2) {
    b.enemy = null;
  }
  // Hearing: a recent shot inside the hearing radius pulls an investigation.
  for (const e of state.fighters) {
    if (!e.alive || e.team === f.team) continue;
    if (state.time - e.lastShotAt < 0.6) {
      const d = Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z);
      if (d < BOT.hearingRange) { b.heardPos = { x: e.pos.x, z: e.pos.z }; b.heardAt = state.time; }
    }
  }
}

export function stepBot(state, world, fx, audio, f, dt) {
  const b = f.bot;
  if (!f.alive || f.frozen) { f.vel.x = 0; f.vel.z = 0; return; }
  updateWeapon(f, dt);
  if (f.revealedT > 0) f.revealedT -= dt;
  b.thinkT -= dt;
  if (b.thinkT <= 0) {
    b.thinkT = BOT.thinkEvery;
    perceive(state, world, f);
    const dest = objectiveNode(state, f);
    if (dest !== b.destNode) {
      b.destNode = dest;
      b.path = findPath(f.pos.x, f.pos.z, dest);
      b.pathI = 0;
    }
  }

  const engaging = b.enemy && b.enemy.alive && state.time - b.firstSeenAt >= BOT.reactionSeconds;
  let wishX = 0, wishZ = 0, maxSpeed = BOT.speed;
  if (f.carryingCore) maxSpeed *= 0.85;
  if (engaging) {
    // Face the enemy, strafe, burst fire.
    const e = b.enemy;
    turnToward(f, angleTo(f, e.pos.x, e.pos.z), dt, 8);
    b.strafeT -= dt;
    if (b.strafeT <= 0) { b.strafeDir *= -1; b.strafeT = 0.7 + state.rng() * 0.7; }
    const px = -Math.cos(f.yaw) * b.strafeDir, pz = Math.sin(f.yaw) * b.strafeDir;
    wishX = px * 0.5; wishZ = pz * 0.5;
    if (b.burstLeft > 0) {
      if (f.weapon.cooldown <= 0 && f.weapon.reloadT <= 0) {
        const eye = eyePos(f);
        const dist = Math.hypot(e.pos.x - f.pos.x, e.pos.z - f.pos.z);
        const err = BOT.aimErrorBase * (1 + dist / 30 + Math.hypot(e.vel.x, e.vel.z) * 0.08);
        const tx = e.pos.x + (state.rng() - 0.5) * err * dist * 2;
        const ty = e.pos.y + 1.15 + (state.rng() - 0.5) * err * dist * 2;
        const tz = e.pos.z + (state.rng() - 0.5) * err * dist * 2;
        const dx = tx - eye.x, dy = ty - eye.y, dz = tz - eye.z;
        const l = Math.hypot(dx, dy, dz) || 1;
        const fired = fireWeapon(state, world, fx, audio, f, eye.x, eye.y, eye.z, dx / l, dy / l, dz / l);
        if (fired) b.burstLeft -= 1;
        if (f.weapon.mag === 0) startReload(f);
      }
    } else {
      b.burstPause -= dt;
      if (b.burstPause <= 0) {
        b.burstLeft = BOT.burstMin + Math.floor(state.rng() * (BOT.burstMax - BOT.burstMin + 1));
        b.burstPause = BOT.burstPause;
      }
    }
  } else {
    // Move along the waypoint path; investigate a heard shot on the way.
    let target = null;
    if (b.heardPos && state.time - b.heardAt < 4 && !b.enemy) {
      target = b.heardPos;
    } else if (b.pathI < b.path.length) {
      target = WAYPOINTS[b.path[b.pathI]];
      if (Math.hypot(target.x - f.pos.x, target.z - f.pos.z) < 0.9) { b.pathI += 1; target = b.pathI < b.path.length ? WAYPOINTS[b.path[b.pathI]] : null; }
    }
    if (target) {
      const dx = target.x - f.pos.x, dz = target.z - f.pos.z;
      const l = Math.hypot(dx, dz) || 1;
      wishX = dx / l; wishZ = dz / l;
      turnToward(f, angleTo(f, target.x, target.z), dt, 5);
    } else if (b.enemy) {
      turnToward(f, angleTo(f, b.lastSeenPos.x, b.lastSeenPos.z), dt, 5);
    }
    // Anchors hold their pylon and scan; a lurker that arrived waits.
    if (b.pathI >= b.path.length && (f.bot.role === 'anchor' || f.bot.role === 'lurker')) {
      f.yaw += dt * 0.5; // slow scan
    }
  }
  f.crouch = false;
  const speed = moveFighter(f, wishX, wishZ, maxSpeed, dt);
  f.moving = speed > 0.5;
  // Bots reload when the mag runs dry and no enemy is in front of them.
  if (f.weapon.mag === 0 && !engaging) startReload(f);
  // Pulse grenade at a heard enemy the bot cannot see: face the sound, throw.
  if (b.heardPos && state.time - b.heardAt < 1.5 && f.grenades.pulse > 0 && !b.enemy) {
    turnToward(f, angleTo(f, b.heardPos.x, b.heardPos.z), dt, 8);
    let d = angleTo(f, b.heardPos.x, b.heardPos.z) - f.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.3) {
      f.grenadeSel = 'pulse';
      if (throwGrenade(state, world, f)) b.heardPos = null;
    }
  }
}
