// NIGHTHAUL — the firing model, grenades and the view model. Player and bots
// fire through the same `fireWeapon`, so the spread, recoil and damage rules
// are identical for both sides. No allocation in the per-shot path beyond the
// pooled tracer the effects module owns.

import * as THREE from 'three';
import { GRENADES, WEAPONS } from './config.js';
import { damageFighter, raycastShot, hasLineOfSight } from './combat.js';
import { eyePos } from './player.js';

const tmpDir = { x: 0, y: 0, z: 0 };

// Current spread cone (radians) for a fighter: base + bloom + movement, crouch
// and air multipliers. Stopping to aim is the whole game.
export function currentSpread(f) {
  const w = WEAPONS[f.weapon.id];
  let s = w.spreadBase + f.weapon.bloom;
  const speed = Math.hypot(f.vel.x, f.vel.z);
  s += w.spreadMove * Math.min(1, speed / 4.9);
  if (f.crouch) s *= w.spreadCrouch;
  if (!f.onGround) s *= 4;
  if (f.sprinting) s *= 1.6;
  return s;
}

function coneDir(rng, dx, dy, dz, spread) {
  // Random direction inside a cone around (dx,dy,dz), uniform over the disc.
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * spread;
  const ux = Math.cos(a) * r, uy = Math.sin(a) * r;
  // Build an orthonormal basis around the direction.
  let bx = 0, by = 1, bz = 0;
  if (Math.abs(dy) > 0.9) { bx = 1; by = 0; bz = 0; }
  // right = dir x up, up2 = right x dir
  let rx = dy * bz - dz * by, ry = dz * bx - dx * bz, rz = dx * by - dy * bx;
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  let ux2 = ry * dz - rz * dy, uy2 = rz * dx - rx * dz, uz2 = rx * dy - ry * dx;
  const ul = Math.hypot(ux2, uy2, uz2) || 1; ux2 /= ul; uy2 /= ul; uz2 /= ul;
  tmpDir.x = dx + rx * ux + ux2 * uy;
  tmpDir.y = dy + ry * ux + uy2 * uy;
  tmpDir.z = dz + rz * ux + uz2 * uy;
  const l = Math.hypot(tmpDir.x, tmpDir.y, tmpDir.z) || 1;
  return { x: tmpDir.x / l, y: tmpDir.y / l, z: tmpDir.z / l };
}

export function startReload(f) {
  const w = WEAPONS[f.weapon.id];
  if (f.weapon.reloadT > 0 || f.weapon.mag >= w.mag || f.weapon.reserve <= 0) return;
  f.weapon.reloadT = w.reloadSeconds;
}

export function updateWeapon(f, dt) {
  const w = f.weapon;
  if (w.cooldown > 0) w.cooldown -= dt;
  if (w.burstPause > 0) w.burstPause -= dt;
  w.bloom = Math.max(0, w.bloom - dt * 0.09);
  if (w.reloadT > 0) {
    w.reloadT -= dt;
    if (w.reloadT <= 0) {
      const def = WEAPONS[f.weapon.id];
      const need = def.mag - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take; w.reserve -= take;
    }
  }
}

// Fire one trigger pull (all pellets). `dir` is the aim direction before spread.
// Returns true when a shot left the barrel.
export function fireWeapon(state, world, fx, audio, f, ox, oy, oz, dx, dy, dz) {
  const w = WEAPONS[f.weapon.id];
  const ws = f.weapon;
  if (!f.alive || ws.cooldown > 0 || ws.reloadT > 0 || ws.mag <= 0) {
    if (ws.mag <= 0 && ws.reloadT <= 0) startReload(f);
    return false;
  }
  ws.cooldown = 60 / w.rpm;
  ws.mag -= 1;
  ws.bloom = Math.min(w.bloomMax, ws.bloom + w.bloom);
  f.recoil = Math.min(0.12, f.recoil + w.recoil);
  if (f.isPlayer) f.pitch += w.recoil * 0.8; // kick up; stepPlayer recovers it
  f.lastShotAt = state.time;
  state.stats.shots += 1;
  const spread = currentSpread(f);
  for (let p = 0; p < w.pellets; p++) {
    const d = coneDir(state.rng, dx, dy, dz, spread);
    const hit = raycastShot(state, world, ox, oy, oz, d.x, d.y, d.z, w.range, f);
    const end = hit ? hit.point : { x: ox + d.x * w.range, y: oy + d.y * w.range, z: oz + d.z * w.range };
    fx.tracer(ox, oy, oz, end.x, end.y, end.z, w.tracer);
    if (!hit) continue;
    if (hit.kind === 'wall') { fx.impact(end.x, end.y, end.z); continue; }
    const dist = hit.dist;
    const falloff = dist <= w.falloffFrom ? 1 : Math.max(w.falloffTo, 1 - (dist - w.falloffFrom) / (w.range - w.falloffFrom) * (1 - w.falloffTo));
    state.stats.hits += 1;
    if (hit.fighter.isPlayer) fx.damageFrom(hit.fighter, f);
    const died = damageFighter(state, hit.fighter, w.damage * falloff, f, hit.part, 'shot');
    fx.hitmark(hit.part === 'head');
    if (died) audio('kill');
    else audio('hit');
  }
  fx.muzzle(ox, oy, oz, dx, dy, dz);
  audio('shot', w.soundPitch);
  return true;
}

// Throw the selected grenade: a short arc from the fighter's eye.
export function throwGrenade(state, world, f) {
  const kind = f.grenadeSel;
  if (f.grenades[kind] <= 0) return false;
  f.grenades[kind] -= 1;
  const eye = eyePos(f);
  const dir = { x: -Math.sin(f.yaw) * Math.cos(f.pitch), y: Math.sin(f.pitch), z: -Math.cos(f.yaw) * Math.cos(f.pitch) };
  const g = {
    pos: { x: eye.x + dir.x * 0.5, y: eye.y - 0.1, z: eye.z + dir.z * 0.5 },
    vel: { x: dir.x * 14 + f.vel.x * 0.5, y: dir.y * 14 + 3.2, z: dir.z * 14 + f.vel.z * 0.5 },
    kind, fuse: GRENADES[kind].fuse, ownerId: f.id, mesh: null,
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshStandardMaterial({ color: kind === 'pulse' ? 0x2fd6c0 : 0x3a3f45, emissive: kind === 'pulse' ? 0x2fd6c0 : 0x000000, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.4 }),
  );
  mesh.position.set(g.pos.x, g.pos.y, g.pos.z);
  world.scene.add(mesh);
  g.mesh = mesh;
  state.grenades.push(g);
  return true;
}

export function updateGrenades(state, world, fx, audio, dt) {
  for (let i = state.grenades.length - 1; i >= 0; i--) {
    const g = state.grenades[i];
    g.vel.y -= 13.5 * dt;
    g.pos.x += g.vel.x * dt; g.pos.y += g.vel.y * dt; g.pos.z += g.vel.z * dt;
    if (g.pos.y < 0.1) { g.pos.y = 0.1; g.vel.y = Math.abs(g.vel.y) * 0.45; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    if (g.pos.x < -31.5 || g.pos.x > 31.5) g.vel.x *= -0.5;
    if (g.pos.z < -23.5 || g.pos.z > 21.5) g.vel.z *= -0.5;
    g.mesh.position.set(g.pos.x, g.pos.y, g.pos.z);
    g.fuse -= dt;
    if (g.fuse > 0) continue;
    world.scene.remove(g.mesh);
    state.grenades.splice(i, 1);
    const owner = state.fighters[g.ownerId];
    if (g.kind === 'frag') {
      fx.blast(g.pos.x, g.pos.y, g.pos.z, GRENADES.frag.radius);
      audio('blast');
      for (const t of state.fighters) {
        if (!t.alive || t === owner) continue;
        const dx = t.pos.x - g.pos.x, dy = (t.pos.y + 1) - g.pos.y, dz = t.pos.z - g.pos.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > GRENADES.frag.radius) continue;
        const los = hasLineOfSight(state, world, g.pos, { x: t.pos.x, y: t.pos.y + 1, z: t.pos.z });
        const dmg = GRENADES.frag.damage * (1 - d / GRENADES.frag.radius) * (los ? 1 : 0.5);
        damageFighter(state, t, dmg, owner, 'body', 'frag');
      }
    } else {
      // Pulse: ping every enemy within 25 m — silhouettes through walls for 4 s.
      fx.sonar(g.pos.x, g.pos.y, g.pos.z);
      audio('pulse');
      for (const t of state.fighters) {
        if (!t.alive || !owner || t.team === owner.team) continue;
        const dx = t.pos.x - g.pos.x, dz = t.pos.z - g.pos.z;
        if (Math.hypot(dx, dz) <= GRENADES.pulse.radius) t.revealedT = GRENADES.pulse.revealSeconds;
      }
    }
  }
}

// --- View model: a simple gun held at the camera's lower right. ---
export function createViewmodel(camera) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x22282e, metalness: 0.6, roughness: 0.45 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x2fd6c0, emissive: 0x2fd6c0, emissiveIntensity: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.55), dark);
  g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.4); g.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.08), accent);
  sight.position.set(0, 0.09, -0.1); g.add(sight);
  g.position.set(0.28, -0.26, -0.5);
  camera.add(g);
  return { group: g, kick: 0 };
}

export function syncViewmodel(vm, f, dt) {
  vm.kick = Math.max(0, vm.kick - dt * 6);
  vm.group.position.z = -0.5 + vm.kick * 0.12;
  vm.group.position.y = -0.26 + Math.sin(performance.now() * 0.004) * 0.002;
  vm.group.visible = f.alive;
}
