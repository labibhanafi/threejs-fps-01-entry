// NIGHTHAUL — Port Sable as meshes. Builds every visible thing from mapdata's
// colliders (one source of truth), paints procedural canvas textures (no external
// assets), and owns the lights, the pylons, the data core and the fighter bodies.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { BOUNDS, COLLIDERS as COL, LIGHT_POOLS as POOLS, PYLONS as PY, RAMPS as RAMP } from './mapdata.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function shade(hex, f) {
  const r = ((hex >> 16) & 255) * f, g = ((hex >> 8) & 255) * f, b = (hex & 255) * f;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function containerTexture(color) {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = shade(color, 1); g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { // corrugation
      g.fillStyle = shade(color, 0.82); g.fillRect(x, 0, 5, h);
      g.fillStyle = shade(color, 1.12); g.fillRect(x + 8, 0, 3, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.fillStyle = 'rgba(235,230,215,0.85)';
    g.font = 'bold 34px monospace'; g.textAlign = 'center';
    g.fillText(String(100 + ((color >> 4) % 900)), w / 2, h / 2 + 12); // stencilled number
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
  });
}

function concreteTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5c666e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${20 + Math.random() * 40 | 0},${25 + Math.random() * 40 | 0},${30 + Math.random() * 40 | 0},0.25)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2);
    }
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}

function groundTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#1b222b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${10 + Math.random() * 30 | 0},${16 + Math.random() * 30 | 0},${22 + Math.random() * 34 | 0},0.5)`;
      g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 14, 2 + Math.random() * 4);
    }
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke();
    }
    // wet sheen: pale streaks
    g.fillStyle = 'rgba(120,150,180,0.06)';
    for (let i = 0; i < 8; i++) g.fillRect(Math.random() * w, 0, 10 + Math.random() * 30, h);
  });
}

export function buildWorld(scene) {
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 18, 95);

  // Lights: cold moon + dim blue ambient + sodium pools.
  scene.add(new THREE.AmbientLight(0x2a3a4d, 1.15));
  const moon = new THREE.DirectionalLight(0x8fb0d8, 0.7);
  moon.position.set(-20, 40, -25);
  scene.add(moon);
  const poolLights = [];
  for (const p of POOLS.slice(0, 6)) {
    const l = new THREE.PointLight(0xff9a2e, 22, 16, 1.8);
    l.position.set(p.x, 5.2, p.z);
    scene.add(l); poolLights.push(l);
  }

  // Wet ground: dark, glossy (high metalness, low roughness) so the sodium pools
  // read as reflections on rain-slick asphalt.
  const groundTex = groundTexture();
  groundTex.repeat.set(8, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(BOUNDS.x1 - BOUNDS.x0, BOUNDS.z1 - BOUNDS.z0 + 14),
    new THREE.MeshStandardMaterial({ map: groundTex, metalness: 0.65, roughness: 0.32 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (BOUNDS.z0 + BOUNDS.z1 + 14) / 2 - 7);
  scene.add(ground);

  // Water south of the quay edge.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 26),
    new THREE.MeshStandardMaterial({ color: 0x0a1a26, metalness: 0.9, roughness: 0.12 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, BOUNDS.z1 + 13);
  scene.add(water);

  // Stars.
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.1, r = 180;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0f0, size: 0.9, sizeAttenuation: false })));

  // Colliders become boxes. Second-layer containers stack on the first.
  const occluders = [];
  const concreteTex = concreteTexture();
  const texCache = new Map();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x6b5a33, metalness: 0.7, roughness: 0.5 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x7a3a28, metalness: 0.6, roughness: 0.55 });
  for (const c of COL) {
    const w = c.x1 - c.x0, d = c.z1 - c.z0, h = c.y1 - c.y0;
    let mat;
    if (c.tex === 'container') {
      const key = c.color;
      if (!texCache.has(key)) texCache.set(key, containerTexture(c.color));
      mat = new THREE.MeshStandardMaterial({ map: texCache.get(key), metalness: 0.55, roughness: 0.6 });
    } else if (c.tex === 'concrete') {
      mat = new THREE.MeshStandardMaterial({ map: concreteTex, metalness: 0.2, roughness: 0.85 });
    } else if (c.tex === 'steel') mat = steelMat;
    else mat = barrelMat;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set((c.x0 + c.x1) / 2, c.y0 + h / 2, (c.z0 + c.z1) / 2);
    scene.add(mesh);
    if (c.kind !== 'edge') occluders.push(mesh);
  }

  // Ramps: sloped walkways onto the climbable stacks.
  for (const r of RAMP) {
    const len = r.x1 - r.x0, wid = r.z1 - r.z0;
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(Math.hypot(len, r.top), 0.18, wid),
      new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.5, roughness: 0.6 }),
    );
    ramp.position.set((r.x0 + r.x1) / 2, r.top / 2, (r.z0 + r.z1) / 2);
    ramp.rotation.z = -Math.atan2(r.top, len);
    scene.add(ramp);
  }

  // Gantry crane beams over Pylon A; quay crane beam over Pylon B.
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x8a6b2f, metalness: 0.7, roughness: 0.45 });
  const beamA = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1.2), beamMat);
  beamA.position.set(-20, 8.4, -18); scene.add(beamA);
  const beamB = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 10), beamMat);
  beamB.position.set(20, 8.4, 18); scene.add(beamB);

  // Lamp posts at the light pools: pole + glowing sodium head.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3841, metalness: 0.6, roughness: 0.5 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xff9a2e, emissiveIntensity: 2.2 });
  for (const p of POOLS) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), poleMat);
    pole.position.set(p.x + 2.2, 2.6, p.z + 2.2); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.35), headMat);
    head.position.set(p.x + 2.2, 5.3, p.z + 2.2); scene.add(head);
  }

  // Upload pylons: base + column + glowing ring + teal beacon light.
  const pylonMeshes = {};
  for (const [key, p] of Object.entries(PY)) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.9, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e3841, metalness: 0.6, roughness: 0.5 }),
    );
    base.position.y = 0.25; g.add(base);
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 3.4, 10),
      new THREE.MeshStandardMaterial({ color: 0x3d4a55, metalness: 0.7, roughness: 0.4 }),
    );
    col.position.y = 2.1; g.add(col);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.09, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0x2fd6c0, emissive: 0x2fd6c0, emissiveIntensity: 1.6 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 3.9; g.add(ring);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2fd6c0, emissive: 0x2fd6c0, emissiveIntensity: 2.5 }),
    );
    tip.position.y = 4.1; g.add(tip);
    const light = new THREE.PointLight(0x2fd6c0, 14, 14, 1.8);
    light.position.y = 3.6; g.add(light);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    pylonMeshes[key] = { group: g, ring, tip, light };
  }

  // The data core: a glowing teal octahedron. It bobs and pulses; world.js moves
  // it every frame from state.core (carried, dropped or at spawn).
  const coreMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshStandardMaterial({ color: 0x2fd6c0, emissive: 0x2fd6c0, emissiveIntensity: 2.4, metalness: 0.3, roughness: 0.2 }),
  );
  const coreLight = new THREE.PointLight(0x2fd6c0, 10, 10, 1.8);
  coreMesh.add(coreLight);
  scene.add(coreMesh);

  return { scene, occluders, pylonMeshes, coreMesh };
}

// One fighter body: boxes with team colours. Hit meshes carry userData so the
// raycaster in combat.js can name the fighter and the body part it hit.
export function createFighterMesh(scene, fighter) {
  const teamColor = fighter.team === 'R' ? PALETTE.runners : PALETTE.authority;
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a31, metalness: 0.4, roughness: 0.7 });
  const teamMat = new THREE.MeshStandardMaterial({ color: teamColor, metalness: 0.3, roughness: 0.6, emissive: teamColor, emissiveIntensity: 0.25 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a7a66, metalness: 0.1, roughness: 0.8 });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), dark);
  legL.position.set(-0.13, 0.39, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.13; g.add(legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), teamMat);
  torso.position.y = 1.14; g.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.36), dark);
  vest.position.y = 1.1; g.add(vest);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
  head.position.y = 1.66; g.add(head);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.32), teamMat);
  band.position.y = 1.78; g.add(band);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.85), dark);
  gun.position.set(0.2, 1.25, 0.42); g.add(gun);

  for (const [mesh, part] of [[head, 'head'], [torso, 'body'], [vest, 'body'], [legL, 'legs'], [legR, 'legs']]) {
    mesh.userData.fighterId = fighter.id;
    mesh.userData.part = part;
  }
  fighter.teamMat = teamMat; // pulse-reveal glows this material
  fighter.hitboxes = [head, torso, vest, legL, legR];
  fighter.mesh = g;
  g.visible = false;
  scene.add(g);
  return g;
}

// Per-frame: place bodies, bob the core, pulse the pylons. No allocation here.
export function syncWorld(state, world, time) {
  for (const f of state.fighters) {
    if (!f.mesh) continue;
    f.mesh.visible = f.alive && state.phase !== 'menu';
    if (!f.alive) continue;
    f.mesh.position.set(f.pos.x, f.pos.y, f.pos.z);
    f.mesh.rotation.y = f.yaw;
    const moving = Math.hypot(f.vel.x, f.vel.z) > 0.5;
    const bob = moving ? Math.sin(time * 11) * 0.05 : 0;
    f.mesh.position.y = f.pos.y + bob;
    f.mesh.scale.y = f.crouch ? 0.78 : 1;
    // Pulse-revealed enemies glow through the dark (their silhouette reads).
    if (f.teamMat) f.teamMat.emissiveIntensity = (f.revealedT > 0 && !f.isPlayer) ? 1.6 : 0.25;
  }
  // Core: carried on the carrier's shoulder — except the player's own core,
  // which rides low and forward of the camera so it reads as carried, never
  // as a wall of light across the lens.
  const core = state.core;
  if (core.state === 'carried') {
    const holder = state.fighters[core.holderId];
    if (holder) {
      if (holder.isPlayer) {
        const fx0 = -Math.sin(holder.yaw), fz0 = -Math.cos(holder.yaw);
        const rx = Math.cos(holder.yaw), rz = -Math.sin(holder.yaw);
        world.coreMesh.position.set(
          holder.pos.x + fx0 * 0.7 + rx * 0.35,
          holder.pos.y + 1.15,
          holder.pos.z + fz0 * 0.7 + rz * 0.35,
        );
      } else {
        world.coreMesh.position.set(holder.pos.x, holder.pos.y + 1.5 + Math.sin(time * 4) * 0.08, holder.pos.z);
      }
    }
  } else {
    world.coreMesh.position.set(core.pos.x, 0.6 + Math.sin(time * 3) * 0.12, core.pos.z);
  }
  const pulse = 1 + Math.sin(time * 5) * 0.18;
  // The player's own carried core rides small so it never fills the lens.
  const playerCarries = core.state === 'carried' && state.fighters[core.holderId] && state.fighters[core.holderId].isPlayer;
  world.coreMesh.scale.setScalar(playerCarries ? 0.5 * pulse : pulse);
  world.coreMesh.rotation.y = time * 1.4;
  // Pylons: the active one pulses faster; its ring spins while uploading.
  for (const [key, pm] of Object.entries(world.pylonMeshes)) {
    const active = state.upload.site === key && state.upload.state !== 'idle';
    pm.ring.material.emissiveIntensity = active ? 2.5 + Math.sin(time * 8) * 1.2 : 1.6;
    if (active) pm.ring.rotation.z = time * 1.5;
    pm.light.intensity = active ? 22 : 14;
  }
}
