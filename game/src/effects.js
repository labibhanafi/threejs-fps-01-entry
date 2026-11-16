// NIGHTHAUL — pooled visual effects: tracers, muzzle flashes, impact sparks,
// frag blasts and the pulse sonar ring. Everything is pre-allocated; the hot
// loop never news an object. The HUD-side bits (hitmarker, damage direction)
// live here as plain numbers hud.js reads.

import * as THREE from 'three';

const TRACERS = 32;
const SPARKS = 48;

export function createEffects(scene) {
  // Tracer pool: thin stretched boxes, one material each so opacity can fade.
  const tracers = [];
  for (let i = 0; i < TRACERS; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), mat);
    m.visible = false; scene.add(m);
    tracers.push({ mesh: m, life: 0 });
  }
  let tracerI = 0;
  // Spark pool: tiny tetrahedra with a velocity each.
  const sparks = [];
  for (let i = 0; i < SPARKS; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0 });
    const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.05), mat);
    m.visible = false; scene.add(m);
    sparks.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
  }
  let sparkI = 0;
  // One muzzle flash quad, one blast sphere, one sonar ring (reused, not pooled).
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const muzzle = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), muzzleMat);
  muzzle.visible = false; scene.add(muzzle);
  let muzzleLife = 0;
  const blastMat = new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const blast = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), blastMat);
  blast.visible = false; scene.add(blast);
  let blastLife = 0, blastR = 1;
  const sonarMat = new THREE.MeshBasicMaterial({ color: 0x2fd6c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const sonar = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), sonarMat);
  sonar.rotation.x = -Math.PI / 2; sonar.visible = false; scene.add(sonar);
  let sonarLife = 0;

  const fx = {
    hitmarkT: 0, hitmarkHead: false,
    damageT: 0, damageAngle: 0, // radians, 0 = the shot came from ahead
    tracer(x1, y1, z1, x2, y2, z2, color) {
      const t = tracers[tracerI]; tracerI = (tracerI + 1) % TRACERS;
      const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
      const len = Math.hypot(dx, dy, dz) || 0.001;
      t.mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      t.mesh.lookAt(x2, y2, z2);
      t.mesh.scale.set(1, 1, len);
      t.mesh.material.color.setHex(color);
      t.mesh.material.opacity = 0.9;
      t.mesh.visible = true;
      t.life = 0.07;
    },
    muzzle(x, y, z, dx, dy, dz) {
      muzzle.position.set(x + dx * 0.85, y + dy * 0.85, z + dz * 0.85);
      muzzle.lookAt(x + dx * 2, y + dy * 2, z + dz * 2);
      muzzle.material.opacity = 0.95;
      muzzle.visible = true;
      muzzleLife = 0.05;
    },
    impact(x, y, z) {
      for (let i = 0; i < 6; i++) {
        const s = sparks[sparkI]; sparkI = (sparkI + 1) % SPARKS;
        s.mesh.position.set(x, y, z);
        s.vel.set((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6);
        s.mesh.material.opacity = 1;
        s.mesh.visible = true;
        s.life = 0.35;
      }
    },
    blast(x, y, z, r) {
      blast.position.set(x, y + 0.3, z);
      blast.scale.setScalar(0.2);
      blast.material.opacity = 0.85;
      blast.visible = true;
      blastLife = 0.5; blastR = r;
    },
    sonar(x, y, z) {
      sonar.position.set(x, 0.15, z);
      sonar.scale.setScalar(0.5);
      sonar.material.opacity = 0.9;
      sonar.visible = true;
      sonarLife = 1.4;
    },
    hitmark(head) { fx.hitmarkT = 0.18; fx.hitmarkHead = head; },
    damageFrom(target, attacker) {
      if (!target.isPlayer) return;
      // Bearing of the attacker relative to where the player looks.
      const dx = attacker.pos.x - target.pos.x, dz = attacker.pos.z - target.pos.z;
      const bearing = Math.atan2(-dx, -dz);
      let d = bearing - target.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      fx.damageAngle = d;
      fx.damageT = 0.9;
    },
    update(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
        if (t.life <= 0) t.mesh.visible = false;
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        s.vel.y -= 12 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.material.opacity = Math.max(0, s.life / 0.35);
        if (s.life <= 0) s.mesh.visible = false;
      }
      if (muzzleLife > 0) {
        muzzleLife -= dt;
        muzzle.material.opacity = Math.max(0, muzzleLife / 0.05) * 0.95;
        if (muzzleLife <= 0) muzzle.visible = false;
      }
      if (blastLife > 0) {
        blastLife -= dt;
        const k = 1 - blastLife / 0.5;
        blast.scale.setScalar(0.2 + k * blastR);
        blast.material.opacity = Math.max(0, blastLife / 0.5) * 0.85;
        if (blastLife <= 0) blast.visible = false;
      }
      if (sonarLife > 0) {
        sonarLife -= dt;
        const k = 1 - sonarLife / 1.4;
        sonar.scale.setScalar(0.5 + k * 24);
        sonar.material.opacity = Math.max(0, sonarLife / 1.4) * 0.9;
        if (sonarLife <= 0) sonar.visible = false;
      }
      if (fx.hitmarkT > 0) fx.hitmarkT -= dt;
      if (fx.damageT > 0) fx.damageT -= dt;
    },
  };
  return fx;
}
