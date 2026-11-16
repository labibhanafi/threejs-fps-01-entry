// NIGHTHAUL — movement and collision. One fighter is a circle in the XZ plane
// with a height; the same resolve step serves the player and the bots, so a wall
// stops everyone alike. Ground height comes from mapdata (ramps + stack tops).

import { BOUNDS, COLLIDERS, groundHeightAt } from './mapdata.js';
import { PLAYER } from './config.js';

const R = PLAYER.radius;

// Push a circle out of every AABB it overlaps (two passes settle corners).
// A collider only blocks when the fighter's vertical span meets it: standing on
// a container top walks over it instead of into it.
export function resolveCollision(f, height) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of COLLIDERS) {
      if (f.pos.y > c.y1 - 0.25 || f.pos.y + height < c.y0) continue;
      const nx = Math.max(c.x0, Math.min(f.pos.x, c.x1));
      const nz = Math.max(c.z0, Math.min(f.pos.z, c.z1));
      const dx = f.pos.x - nx, dz = f.pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2), push = (R - d) / d;
        f.pos.x += dx * push; f.pos.z += dz * push;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = f.pos.x - (c.x0 - R), pr = (c.x1 + R) - f.pos.x;
        const pt = f.pos.z - (c.z0 - R), pb = (c.z1 + R) - f.pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) f.pos.x = c.x0 - R; else if (m === pr) f.pos.x = c.x1 + R;
        else if (m === pt) f.pos.z = c.z0 - R; else f.pos.z = c.z1 + R;
      }
    }
    f.pos.x = Math.max(BOUNDS.x0 + R, Math.min(BOUNDS.x1 - R, f.pos.x));
    f.pos.z = Math.max(BOUNDS.z0 + R, Math.min(BOUNDS.z1 - R, f.pos.z));
  }
}

// Horizontal move with acceleration toward a wish velocity (metres/second).
// Returns the achieved speed, for spread and footstep decisions.
export function moveFighter(f, wishX, wishZ, maxSpeed, dt) {
  const height = f.crouch ? PLAYER.heightCrouch : PLAYER.heightStand;
  const accel = f.onGround ? PLAYER.accel : PLAYER.airAccel;
  const wx = wishX * maxSpeed, wz = wishZ * maxSpeed;
  f.vel.x += (wx - f.vel.x) * Math.min(1, accel * dt / Math.max(1, maxSpeed));
  f.vel.z += (wz - f.vel.z) * Math.min(1, accel * dt / Math.max(1, maxSpeed));
  f.pos.x += f.vel.x * dt;
  f.pos.z += f.vel.z * dt;
  resolveCollision(f, height);
  // Gravity and the ground (ramps and stack tops included).
  const gy = groundHeightAt(f.pos.x, f.pos.z);
  if (f.pos.y <= gy + 0.02 && f.vel.y <= 0) {
    f.pos.y = gy; f.vel.y = 0; f.onGround = true;
  } else {
    f.vel.y -= PLAYER.gravity * dt;
    f.pos.y += f.vel.y * dt;
    if (f.pos.y <= gy) { f.pos.y = gy; f.vel.y = 0; f.onGround = true; }
    else f.onGround = false;
  }
  return Math.hypot(f.vel.x, f.vel.z);
}

// The human player: mouse look, WASD, sprint, crouch, jump. Frozen during the
// buy phase (rounds.js sets f.frozen) and while dead.
export function stepPlayer(state, f, input, dt) {
  if (!f.alive || f.frozen) {
    f.vel.x = 0; f.vel.z = 0;
    return 0;
  }
  f.yaw -= input.mouseDX * 0.0022;
  f.pitch -= input.mouseDY * 0.0022;
  f.pitch = Math.max(-1.5, Math.min(1.5, f.pitch));
  // Recoil recovery: the pitch kick eases back over ~0.25 s.
  if (f.recoil > 0) {
    const rec = Math.min(f.recoil, 3.2 * dt);
    f.pitch -= rec; f.recoil -= rec;
  }
  f.crouch = input.keys.has('ControlLeft') || input.keys.has('KeyC');
  const sprinting = input.keys.has('ShiftLeft') && !f.crouch && !f.carryingCore;
  let fx = 0, fz = 0;
  if (input.keys.has('KeyW')) fz -= 1;
  if (input.keys.has('KeyS')) fz += 1;
  if (input.keys.has('KeyA')) fx -= 1;
  if (input.keys.has('KeyD')) fx += 1;
  const len = Math.hypot(fx, fz) || 1;
  fx /= len; fz /= len;
  const sin = Math.sin(f.yaw), cos = Math.cos(f.yaw);
  const wx = fx * cos - fz * sin;
  const wz = fx * sin + fz * cos;
  let maxSpeed = f.crouch ? PLAYER.crouchSpeed : sprinting ? PLAYER.sprintSpeed : PLAYER.speed;
  if (f.carryingCore) maxSpeed *= PLAYER.carrierSlow;
  if (input.jumpEdge && f.onGround) { f.vel.y = PLAYER.jumpSpeed; f.onGround = false; }
  const speed = moveFighter(f, wx, wz, maxSpeed, dt);
  f.sprinting = sprinting && speed > 3;
  f.moving = speed > 0.5;
  return speed;
}

export function eyePos(f) {
  const eye = f.crouch ? PLAYER.eyeCrouch : PLAYER.eyeStand;
  return { x: f.pos.x, y: f.pos.y + eye, z: f.pos.z };
}
