[![make.fun · threejs-fps-01](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![rank](https://make.fun/badge/threejs-fps-01/labibhanafi/threejs-fps-01-entry/rank.svg)](https://make.fun/bounty/threejs-fps-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![reward](https://make.fun/badge/threejs-fps-01/labibhanafi/threejs-fps-01-entry/reward.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)

# NIGHTHAUL — a three.js tactical FPS

A round-based tactical first-person shooter for make.fun's **threejs-fps-01** bounty,
in the style Counter-Strike made famous — but its own game throughout: its own map
(Port Sable, a rain-slick night container port), its own teams (the teal **Runners**
attack, the sodium-orange **Authority** defends), its own weapons, and synthesized
sounds. Single-player against bot squads, from static files, with no build step and
no network request.

## The game

- **Core Run — the objective.** Your squad carries a stolen data core across the dock
  to one of two upload pylons. The carrier moves 15% slower and cannot sprint; killed,
  the core drops where they fell and pulses a beacon. Channel 4 s at a pylon to start
  the 25 s upload; the Authority can scrub it with a 5 s channel. A dropped core can be
  returned by a defender standing on it for 3 s. **5 v 5, first to 7 rounds** (max 12).
  Rounds are won by completing the upload, by eliminating the other team, or — for the
  Authority — by running out the 1:45 clock.
- **Money between rounds**: start $800, kills pay $300, round wins up to $2,400, upload
  start pays the team $600 each. The buy phase sells five primaries (P9 Sidearm free,
  VK-9 SMG, Mule-12 scattergun, AR-57 rifle, Lance-8 bolt sniper with scope), armour,
  and two grenades: a frag and the signature **pulse grenade**, which pings every enemy
  within 25 m and shows their silhouettes through walls for 4 s.
- **Gunplay where accuracy counts**: head/body/leg hit zones (head 4×), spread that
  grows with speed and sustained fire and shrinks when you crouch, recoil with
  recovery, damage falloff. Stop, settle, burst — counter-strafing pays.
- **Bots with habits**: vision cones and line-of-sight (standing in a sodium light pool
  makes you easier to spot), hearing (gunfire and running feet), a waypoint graph over
  three lanes, carrier escorts, site anchors, lurkers and rotators, investigation of
  last-heard shots, and defenders stacking the pylon an upload starts on.
- **HUD**: health and armour, ammunition, money, round clock and score, killfeed, a
  live minimap (teammates, pylons, the core — never the enemy, unless pulse-revealed),
  channel/upload progress, damage direction, and a scoreboard with the round log.

## Play it

```sh
node serve.ts          # then open http://localhost:8080 in desktop Chrome
```

Or serve `game/` with any static file server and open `game/index.html`.

Controls: WASD move · mouse look · click fire · right-click scope (Lance-8) ·
Shift walk · Ctrl/C crouch · Space jump · R reload · 1–5 weapons · 4/5 grenades ·
G throw · E pick up core / channel / return (hold) · B buy menu · Tab scoreboard.

## Layout

- `main.ts` — the entry program (Node 22, standard library only): copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json` with the vendored
  make.fun library.
- `game/` — the playable game. `index.html` holds the one import map that maps `three`
  to the vendored three.js 0.187.0 under `game/vendor/three/`. Source modules, one job
  each, under `game/src/`: `config` (all tuning), `state` (the one match state),
  `mapdata` (the port as data + the waypoint graph), `world` (meshes, procedural
  textures, light), `combat` (rays, hit zones, line of sight, damage), `player`,
  `weapons` (firing model, grenades, view models), `bots` (perception and tactics),
  `rounds` (match flow, economy, the core and the upload), `effects` (pooled
  tracers/sparks/sonar), `audio` (synthesized WebAudio sound), `hud`, `input`, and
  `main` (fixed-step loop).
- `screenshots/` — four captures of the game, posed by its own `?shot=` scenes
  (see `shots.json`).
- `vendor/makefun-threejs.ts` — the kit's dossier library, unchanged.

The simulation runs at a fixed 120 Hz, apart from rendering; all state lives in one
object in `state.js`; effects are pooled and allocate nothing per frame.

## License

MIT (see `LICENSE`). three.js is vendored under its own license at
`game/vendor/three/LICENSE`.
