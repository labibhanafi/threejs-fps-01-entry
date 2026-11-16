// NIGHTHAUL — rays, hit zones, line of sight, damage. Hitscan against capsule
// hitboxes: head 4x, body 1x, legs 0.75x, armour halves body damage. A wall
// between shooter and target always wins over a body part.

import * as THREE from 'three';
import { ECONOMY } from './config.js';

const raycaster = new THREE.Raycaster();
const origin = new THREE.Vector3();
const dir = new THREE.Vector3();
const toTarget = new THREE.Vector3();

// One shot against the world and every living fighter but the shooter.
// Returns {kind:'fighter', fighter, part, point, dist} or {kind:'wall', point, dist} or null.
export function raycastShot(state, world, ox, oy, oz, dx, dy, dz, range, shooter) {
  origin.set(ox, oy, oz);
  dir.set(dx, dy, dz).normalize();
  raycaster.set(origin, dir);
  raycaster.far = range;
  let best = null;
  const meshes = [];
  for (const f of state.fighters) {
    if (!f.alive || f === shooter) continue;
    for (const m of f.hitboxes) meshes.push(m);
  }
  const bodyHits = raycaster.intersectObjects(meshes, false);
  if (bodyHits.length) {
    const h = bodyHits[0];
    best = { kind: 'fighter', fighter: state.fighters[h.object.userData.fighterId], part: h.object.userData.part, point: h.point, dist: h.distance };
  }
  const wallHits = raycaster.intersectObjects(world.occluders, false);
  if (wallHits.length && (!best || wallHits[0].distance < best.dist)) {
    best = { kind: 'wall', point: wallHits[0].point, dist: wallHits[0].distance };
  }
  // The ground plane stops a shot too (long downward shots).
  if (dir.y < -0.001) {
    const t = -oy / dir.y;
    if (t > 0 && t < range && (!best || t < best.dist)) {
      best = { kind: 'wall', point: { x: ox + dx * t, y: 0, z: oz + dz * t }, dist: t };
    }
  }
  return best;
}

export function hasLineOfSight(state, world, from, to) {
  toTarget.set(to.x - from.x, to.y - from.y, to.z - from.z);
  const dist = toTarget.length();
  if (dist < 0.01) return true;
  origin.set(from.x, from.y, from.z);
  dir.copy(toTarget).normalize();
  raycaster.set(origin, dir);
  raycaster.far = dist;
  return raycaster.intersectObjects(world.occluders, false).length === 0;
}

// Apply damage; returns true when the target died. Handles armour, the kill
// reward, the killfeed, and dropping the core when its carrier dies.
export function damageFighter(state, target, rawDmg, shooter, part, cause) {
  if (!target.alive) return false;
  let dmg = rawDmg;
  if (part === 'head') dmg *= 4;
  else if (part === 'legs') dmg *= 0.75;
  if (part === 'body' && target.armor > 0) dmg *= 0.6;
  target.hp -= dmg;
  if (target.hp > 0) return false;
  target.hp = 0;
  target.alive = false;
  target.deaths += 1;
  target.carryingCore = false;
  if (shooter && shooter !== target) {
    shooter.kills += 1;
    shooter.money = Math.min(9000, shooter.money + ECONOMY.killReward);
  }
  const name = (f) => f.name;
  state.killfeed.unshift({
    text: `${shooter ? name(shooter) : 'Port'} ✕ ${name(target)}${part === 'head' ? ' ⌖' : ''}`,
    cls: shooter && shooter.team === 'R' ? 'r' : 'a', t: state.time,
  });
  if (state.killfeed.length > 5) state.killfeed.pop();
  if (state.core.holderId === target.id) {
    state.core.state = 'dropped';
    state.core.holderId = -1;
    state.core.pos = { x: target.pos.x, y: 0.6, z: target.pos.z };
    state.core.returnT = 0;
    state.events.push({ kind: 'drop', at: state.time });
  }
  return true;
}
