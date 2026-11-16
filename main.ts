// NIGHTHAUL — entry program for make.fun's threejs-fps-01 bounty (Node 22,
// standard library only).
//
// The game itself is the static site under game/: ES modules, no build step,
// three.js 0.187.0 vendored under game/vendor/three/ and reached through the one
// import map in game/index.html. This program is the hand-in. It copies game/
// and screenshots/ from beside this file into the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library, so
// the dossier is exactly the one the gate rebuilds and compares byte for byte.
// The program is deterministic: two runs over the same repository write the
// same bytes.
//
// Play the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps below are the gate's own (reference/gate.json): the dossier text is
// capped at 163,840 bytes, at most 4 screenshots of at most 256 KiB each, and
// game/ at most 993 files and 48 MiB — the numbers buildDossier needs so it
// refuses here what the gate would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);
