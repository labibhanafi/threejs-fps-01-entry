// NIGHTHAUL — keyboard + mouse. Pointer lock owns the mouse while playing;
// menus (buy, scoreboard, overlays) read the same key set. No game logic here,
// just the raw state main.js and the bots' stand-in for the player read.

export function createInput() {
  return {
    keys: new Set(),
    mouseDX: 0, mouseDY: 0,
    firing: false, firingEdge: false,
    scoped: false, // right mouse held (Lance-8 zoom)
    locked: false,
    interact: false, // E held
    jumpEdge: false,
    reloadEdge: false,
    throwEdge: false,
    buyToggleEdge: false,
    scoreHeld: false,
    anyKeyEdge: false,
  };
}

export function bindInput(input, canvas) {
  const down = (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    if (e.code === 'KeyE') input.interact = true;
    if (e.code === 'Space') input.jumpEdge = true;
    if (e.code === 'KeyR') input.reloadEdge = true;
    if (e.code === 'KeyG') input.throwEdge = true;
    if (e.code === 'KeyB') input.buyToggleEdge = true;
    if (e.code === 'Tab') { input.scoreHeld = true; e.preventDefault(); }
    input.anyKeyEdge = true;
  };
  const up = (e) => {
    input.keys.delete(e.code);
    if (e.code === 'KeyE') input.interact = false;
    if (e.code === 'Tab') input.scoreHeld = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => { input.keys.clear(); input.firing = false; input.interact = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (!input.locked) return;
    if (e.button === 0) { input.firing = true; input.firingEdge = true; }
    if (e.button === 2) input.scoped = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
    if (e.button === 2) input.scoped = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.mouseDX += e.movementX;
    input.mouseDY += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
}

export function lockPointer(canvas) {
  if (document.pointerLockElement !== canvas) {
    // requestPointerLock rejects without a trusted user gesture (headless
    // probes, synthetic clicks); the game runs on without the lock then.
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }
}

export function consumeEdges(input) {
  // Called once per fixed step after the step read them.
  input.mouseDX = 0; input.mouseDY = 0;
  input.firingEdge = false; input.jumpEdge = false;
  input.reloadEdge = false; input.throwEdge = false;
  input.buyToggleEdge = false; input.anyKeyEdge = false;
}
