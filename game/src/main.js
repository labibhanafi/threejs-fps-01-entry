// NIGHTHAUL — entry point. Boots the renderer, runs the fixed-step simulation
// (120 Hz, apart from rendering), routes input, and poses the deterministic
// screenshot scenes (?shot=cover|buy|action|upload&seed=N) that freeze on a
// frame built by the game's own systems and set window.__shotReady.
//
// Screenshot scenes are presentation and never feed back into the simulation.

import * as THREE from 'three';
import { BUY_MENU, TIMING, WEAPONS } from './config.js';
import { createState, freshWeapon } from './state.js';
import { buildWorld, createFighterMesh, syncWorld } from './world.js';
import { bindInput, consumeEdges, createInput, lockPointer } from './input.js';
import { eyePos, stepPlayer } from './player.js';
import { buyItem, startMatch, startRound, stepRounds } from './rounds.js';
import { createEffects } from './effects.js';
import { createHud, updateHud } from './hud.js';
import { ensureAudio, playSound } from './audio.js';
import { fireWeapon, startReload, syncViewmodel, createViewmodel, throwGrenade, updateGrenades, updateWeapon } from './weapons.js';
import { stepBot } from './bots.js';
import { PYLONS } from './mapdata.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = shot ? (Number.parseInt(params.get('seed') ?? '1', 10) || 1) : (Date.now() % 2147483647);

const state = createState(seed);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = buildWorld(scene);
for (const f of state.fighters) createFighterMesh(scene, f);
const fx = createEffects(scene);
const hud = createHud();
const input = createInput();
bindInput(input, renderer.domElement);
const viewmodel = createViewmodel(camera);

// Debug handle for headless play-tests (no secrets, no network).
window.__game = { state, input };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const STEP = 1 / 120;
const player = state.fighters[0];
let prevKeys = new Set();
let prevFov = 75;

function switchWeapon(slot) {
  if (slot === 'primary' && player.weapons.primary) player.weapon = player.weapons.primary;
  else if (slot === 'sidearm') player.weapon = player.weapons.sidearm;
}

function digitEdges() {
  const pressed = [];
  for (const k of input.keys) {
    if (!prevKeys.has(k) && /^Digit[1-9]$/.test(k)) pressed.push(k);
  }
  prevKeys = new Set(input.keys);
  return pressed;
}

function drainEvents() {
  for (const ev of state.events) {
    if (ev.kind === 'pickup') playSound('pickup');
    else if (ev.kind === 'uploadStart') playSound('upload');
    else if (ev.kind === 'round' || ev.kind === 'scrub' || ev.kind === 'return') playSound('round');
  }
  state.events.length = 0;
}

function step(dt) {
  state.time += dt;
  if (state.phase === 'menu') return;
  stepRounds(state, input, dt);
  if (state.phase === 'matchEnd') {
    if (input.anyKeyEdge && input.keys.has('Enter')) {
      startMatch(state);
      state.phase = 'buy';
    }
    return;
  }
  // Player input routing.
  if (state.phase === 'buy') {
    for (const d of digitEdges()) {
      const entry = BUY_MENU[Number(d.slice(5)) - 1];
      if (entry && buyItem(state, player, entry.id)) playSound('buy');
    }
    if (input.buyToggleEdge) hud.buyOpen = !hud.buyOpen;
  } else if (state.phase === 'live' && player.alive) {
    for (const d of digitEdges()) {
      if (d === 'Digit1') switchWeapon('sidearm');
      else if (d === 'Digit2') switchWeapon('primary');
      else if (d === 'Digit3') player.grenadeSel = player.grenadeSel === 'frag' ? 'pulse' : 'frag';
    }
    if (input.buyToggleEdge) hud.buyOpen = false;
    if (input.reloadEdge) { startReload(player); playSound('reload'); }
    if (input.throwEdge) {
      if (throwGrenade(state, world, player)) playSound('reload');
    }
    const w = WEAPONS[player.weapon.id];
    const wantFire = w.auto ? input.firing : input.firingEdge;
    if (wantFire && !player.frozen) {
      const eye = eyePos(player);
      const dx = -Math.sin(player.yaw) * Math.cos(player.pitch);
      const dy = Math.sin(player.pitch);
      const dz = -Math.cos(player.yaw) * Math.cos(player.pitch);
      if (fireWeapon(state, world, fx, playSound, player, eye.x, eye.y, eye.z, dx, dy, dz)) {
        viewmodel.kick = 1;
      }
    }
  }
  stepPlayer(state, player, input, dt);
  updateWeapon(player, dt);
  if (player.revealedT > 0) player.revealedT -= dt;
  for (const f of state.fighters) {
    if (f.isPlayer) continue;
    stepBot(state, world, fx, playSound, f, dt);
  }
  updateGrenades(state, world, fx, playSound, dt);
  drainEvents();
  consumeEdges(input);
}

function render() {
  scene.updateMatrixWorld(true);
  syncWorld(state, world, state.time);
  if (state.phase === 'menu') {
    // Slow orbit over the port behind the menu.
    const t = state.time * 0.05;
    camera.position.set(Math.sin(t) * 26, 12, Math.cos(t) * 20 - 2);
    camera.lookAt(0, 1, 0);
  } else {
    const eye = eyePos(player);
    camera.position.set(eye.x, eye.y, eye.z);
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    const scoped = input.scoped && player.weapon.id === 'sniper' && player.alive;
    const fov = scoped ? 30 : 75;
    if (fov !== prevFov) { camera.fov = fov; camera.updateProjectionMatrix(); prevFov = fov; }
    syncViewmodel(viewmodel, player, 1 / 60);
  }
  fx.update(1 / 60);
  updateHud(hud, state, fx, input, 1 / 60);
  renderer.render(scene, camera);
}

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now() / 1000;
  const dt = Math.min(0.1, now - (frame.last ?? now));
  frame.last = now;
  let acc = (frame.acc ?? 0) + dt;
  while (acc >= STEP) { step(STEP); acc -= STEP; }
  frame.acc = acc;
  render();
}

// --- Overlay: click to play. ---
const overlay = document.getElementById('overlay');
document.getElementById('play').addEventListener('click', () => {
  ensureAudio();
  overlay.hidden = true;
  lockPointer(renderer.domElement);
  startMatch(state);
  playSound('round');
});
document.addEventListener('pointerlockchange', () => {
  // Leaving pointer lock mid-round pauses into the overlay; the match keeps its state.
  if (!document.pointerLockElement && state.phase !== 'menu' && !shot) {
    overlay.hidden = false;
    document.getElementById('overlay-title').textContent = 'Paused';
    document.getElementById('overlay-copy').textContent = 'Click to resume the match.';
    document.getElementById('play').textContent = 'Resume';
  }
});

// --- Screenshot scenes: deterministic poses built from the game's own systems. ---
function poseCommon() {
  overlay.hidden = true;
  startMatch(state);
  state.phase = 'live';
  state.timer = 60;
  for (const f of state.fighters) f.frozen = false;
}

function runShot(name) {
  poseCommon();
  if (name === 'cover') {
    // Pylon A in view, the carrier channeling, Authority bots in the open.
    player.pos = { x: -12, y: 0, z: -8 }; player.yaw = Math.atan2(8, 10); player.pitch = 0.02;
    const carrier = state.fighters[1];
    carrier.pos = { x: -19, y: 0, z: -16 }; carrier.carryingCore = true;
    state.core.state = 'carried'; state.core.holderId = 1;
    state.upload = { state: 'channel', site: 'A', progress: 0, channelT: 2.4 };
    carrier.channelT = 2.4; carrier.channelKind = 'upload';
    state.fighters[6].pos = { x: -16, y: 0, z: -20 };
    state.fighters[7].pos = { x: -24, y: 0, z: -14 };
    state.fighters[2].pos = { x: -14, y: 0, z: -12 };
    state.banner = { title: 'CHANNELING', sub: 'Site A — Crane Row', t: state.time };
  } else if (name === 'buy') {
    state.phase = 'buy'; state.phaseT = 2;
    player.money = 9000; // posed with a full wallet so the menu reads as bought
    buyItem(state, player, 'rifle');
    buyItem(state, player, 'armor');
    buyItem(state, player, 'pulse');
    hud.buyOpen = true;
    player.pos = { x: -27.5, y: 0, z: -3 }; player.yaw = -Math.PI / 2; player.pitch = 0;
    state.fighters[1].pos = { x: -27, y: 0, z: -6 };
    state.fighters[2].pos = { x: -27, y: 0, z: 1 };
    state.banner = null;
  } else if (name === 'action') {
    // Mid-fight: an Authority bot down the Stacks lane; the shot itself is
    // fired after the pose settles, so the tracer is mid-flight in the frame.
    player.pos = { x: -6, y: 0, z: 0 }; player.yaw = -Math.PI / 2; player.pitch = 0;
    if (!player.weapons.primary) { player.weapons.primary = freshWeapon('rifle'); player.weapon = player.weapons.primary; }
    const foe = state.fighters[6];
    foe.pos = { x: 8, y: 0, z: 0 }; foe.yaw = Math.PI / 2;
    state.fighters[7].pos = { x: 12, y: 0, z: -4 }; state.fighters[7].yaw = Math.PI / 2;
    state.fighters[1].pos = { x: -9, y: 0, z: 2 };
    state.banner = null;
  } else if (name === 'upload') {
    // Upload running at Site A: the player carries the channel, sonar ring out.
    player.pos = { x: -13.5, y: 0, z: -11.5 }; player.yaw = Math.PI / 4; player.pitch = 0.02;
    player.carryingCore = true;
    state.core.state = 'carried'; state.core.holderId = 0;
    state.upload = { state: 'uploading', site: 'A', progress: 15, channelT: 0 };
    state.fighters[1].pos = { x: -22, y: 0, z: -15 };
    state.fighters[6].pos = { x: -14, y: 0, z: -20 };
    state.fighters[7].pos = { x: -24, y: 0, z: -21 };
    if (!params.get('nosonar')) fx.sonar(-20, 0, -18);
    state.banner = { title: 'UPLOAD 15 / 25 s', sub: 'Site A — defend the pylon', t: state.time };
  }
  // Let the pose settle through the real simulation, then freeze on a frame.
  for (let i = 0; i < 30; i++) step(STEP);
  if (name === 'action') {
    const eye = eyePos(player);
    fireWeapon(state, world, fx, playSound, player, eye.x, eye.y, eye.z, 1, 0, 0);
    viewmodel.kick = 1;
  }
  scene.updateMatrixWorld(true);
  render();
  render();
  window.__shotReady = true;
}

if (shot) {
  runShot(shot);
} else {
  requestAnimationFrame(frame);
}
