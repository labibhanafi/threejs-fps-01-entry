// NIGHTHAUL — Port Sable as data. One source of truth: the same colliders build
// the visible geometry (world.js) and the collision the player, bots and grenades
// share. Plain data, no three.js here. Units are metres; y is up; x east, z south.

export const BOUNDS = { x0: -32, x1: 32, z0: -24, z1: 22 };

export const SPAWNS = {
  R: [
    { x: -28, z: -4, yaw: -Math.PI / 2 }, // faces east (+x)
    { x: -28, z: 0, yaw: -Math.PI / 2 },
    { x: -28, z: 4, yaw: -Math.PI / 2 },
    { x: -26, z: -8, yaw: -Math.PI / 2 },
    { x: -26, z: 8, yaw: -Math.PI / 2 },
  ],
  A: [
    { x: 28, z: -4, yaw: Math.PI / 2 },
    { x: 28, z: 0, yaw: Math.PI / 2 },
    { x: 28, z: 4, yaw: Math.PI / 2 },
    { x: 26, z: -8, yaw: Math.PI / 2 },
    { x: 26, z: 8, yaw: Math.PI / 2 },
  ],
};

export const CORE_SPAWN = { x: -24, z: 0 };

// Upload pylons: A under the gantry crane (Crane Row), B at the quay crane (Dockside).
export const PYLONS = {
  A: { x: -20, z: -18 },
  B: { x: 20, z: 18 },
};

// A collider is an axis-aligned box. kind: 'wall' | 'container' | 'barrel' |
// 'building' | 'crane' | 'edge'. tex picks the procedural texture world.js paints.
export const COLLIDERS = [
  // Perimeter: north fence, west wall, east wall, south quay edge (low, keeps you off the water).
  { x0: -32, z0: -24, x1: 32, z1: -23.4, y0: 0, y1: 4, kind: 'wall', tex: 'concrete' },
  { x0: -32, z0: -24, x1: -31.4, z1: 22, y0: 0, y1: 4, kind: 'wall', tex: 'concrete' },
  { x0: 31.4, z0: -24, x1: 32, z1: 22, y0: 0, y1: 4, kind: 'wall', tex: 'concrete' },
  { x0: -32, z0: 21.4, x1: 32, z1: 22, y0: 0, y1: 1.1, kind: 'edge', tex: 'concrete' },

  // Container stacks — the mid maze (corridor z -3.6..3.6 stays open).
  { x0: -16, z0: -6, x1: -10, z1: -3.6, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0x8a4a38 },
  { x0: -16, z0: 3.6, x1: -10, z1: 6, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0x2e6b7a },
  { x0: 10, z0: -6, x1: 16, z1: -3.6, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0x4d7c59 },
  { x0: 10, z0: 3.6, x1: 16, z1: 6, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0xa67c2e },
  { x0: -4, z0: -10, x1: 2, z1: -7.6, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0x5d6d7e }, // climbable via ramp
  { x0: 14, z0: 10, x1: 20, z1: 12.4, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0x7a4a63 },
  { x0: -24, z0: -10, x1: -18, z1: -7.6, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0x94502e },
  { x0: 22, z0: -6, x1: 28, z1: -3.6, y0: 0, y1: 2.6, kind: 'container', tex: 'container', color: 0x8a4a38 },
  // Second layer on two stacks (visual height, still one collider each).
  { x0: -16, z0: -6, x1: -10, z1: -3.6, y0: 2.6, y1: 5.2, kind: 'container', tex: 'container', color: 0x2e6b7a },
  { x0: 10, z0: -6, x1: 16, z1: -3.6, y0: 2.6, y1: 5.2, kind: 'container', tex: 'container', color: 0x8a4a38 },

  // Customs Office (mid-south building, two doors: gaps at x -1..1 on both faces).
  { x0: -6, z0: 4, x1: -1, z1: 4.6, y0: 0, y1: 3.4, kind: 'building', tex: 'concrete' },
  { x0: 1, z0: 4, x1: 6, z1: 4.6, y0: 0, y1: 3.4, kind: 'building', tex: 'concrete' },
  { x0: -6, z0: 9.4, x1: -1, z1: 10, y0: 0, y1: 3.4, kind: 'building', tex: 'concrete' },
  { x0: 1, z0: 9.4, x1: 6, z1: 10, y0: 0, y1: 3.4, kind: 'building', tex: 'concrete' },
  { x0: -6, z0: 4, x1: -5.4, z1: 10, y0: 0, y1: 3.4, kind: 'building', tex: 'concrete' },
  { x0: 5.4, z0: 4, x1: 6, z1: 10, y0: 0, y1: 3.4, kind: 'building', tex: 'concrete' },

  // Fuel Yard barrels (cover, not physics): south-west.
  { x0: -21.5, z0: 12.5, x1: -20.6, z1: 13.4, y0: 0, y1: 1.1, kind: 'barrel', tex: 'barrel' },
  { x0: -20.2, z0: 12.5, x1: -19.3, z1: 13.4, y0: 0, y1: 1.1, kind: 'barrel', tex: 'barrel' },
  { x0: -20.9, z0: 14.2, x1: -20, z1: 15.1, y0: 0, y1: 1.1, kind: 'barrel', tex: 'barrel' },
  { x0: -18.6, z0: 13.2, x1: -17.7, z1: 14.1, y0: 0, y1: 1.1, kind: 'barrel', tex: 'barrel' },
  { x0: -17.4, z0: 15.4, x1: -16.5, z1: 16.3, y0: 0, y1: 1.1, kind: 'barrel', tex: 'barrel' },

  // Gantry crane legs flanking Pylon A (Crane Row).
  { x0: -24.4, z0: -20, x1: -22.8, z1: -16, y0: 0, y1: 8, kind: 'crane', tex: 'steel' },
  { x0: -17.2, z0: -20, x1: -15.6, z1: -16, y0: 0, y1: 8, kind: 'crane', tex: 'steel' },
  // Quay crane legs flanking Pylon B (Dockside).
  { x0: 16.6, z0: 16, x1: 18.2, z1: 20, y0: 0, y1: 8, kind: 'crane', tex: 'steel' },
  { x0: 21.8, z0: 16, x1: 23.4, z1: 20, y0: 0, y1: 8, kind: 'crane', tex: 'steel' },
];

// Ramps: walkable slopes onto the two climbable stacks. A ramp rises along +x
// from y0 to top across its x span; the stack top beside it is flat at top.
export const RAMPS = [
  { x0: -8, z0: -10, x1: -4, z1: -7.6, top: 2.6 },
  { x0: 16, z0: 3.6, x1: 20, z1: 6, top: 2.6 },
];

export function groundHeightAt(x, z) {
  let h = 0;
  for (const r of RAMPS) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
      h = Math.max(h, r.top * ((x - r.x0) / (r.x1 - r.x0)));
    }
  }
  // Stack tops reached by the ramps.
  if (x >= -4 && x <= 2 && z >= -10 && z <= -7.6) h = Math.max(h, 2.6);
  if (x >= 10 && x <= 16 && z >= 3.6 && z <= 6) h = Math.max(h, 2.6);
  return h;
}

// Sodium light pools: standing inside one makes a fighter easier to spot.
export const LIGHT_POOLS = [
  { x: -20, z: -18, r: 6 }, { x: 20, z: 18, r: 6 },
  { x: -28, z: 0, r: 5 }, { x: 28, z: 0, r: 5 },
  { x: 0, z: 18, r: 5 }, { x: 0, z: -18, r: 5 },
  { x: -14, z: 0, r: 4 }, { x: 14, z: 0, r: 4 },
  { x: 0, z: 7, r: 4 }, { x: -19, z: 14, r: 4 },
];

export function inLightPool(x, z) {
  for (const p of LIGHT_POOLS) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz < p.r * p.r) return true;
  }
  return false;
}

// Waypoint graph: three lanes (Dockside z=18, Stacks z=0, Crane Row z=-18)
// plus connectors. Indices are stable; bots BFS over EDGES.
export const WAYPOINTS = [
  { x: -28, z: 18 }, { x: -14, z: 18 }, { x: 0, z: 18 }, { x: 14, z: 18 }, { x: 28, z: 18 }, // 0-4 Dockside
  { x: -28, z: 0 }, { x: -18, z: 0 }, { x: -9, z: 0 }, { x: 0, z: 0 }, { x: 9, z: 0 }, { x: 18, z: 0 }, { x: 28, z: 0 }, // 5-11 Stacks
  { x: -28, z: -18 }, { x: -14, z: -18 }, { x: 0, z: -18 }, { x: 14, z: -18 }, { x: 28, z: -18 }, // 12-16 Crane Row
  { x: -20, z: 10 }, { x: -20, z: -10 }, // 17-18 west connector
  { x: 12, z: 10 }, { x: 12, z: -10 }, // 19-20 east connector
  { x: 0, z: 7 }, // 21 Customs Office interior
  { x: -20, z: -18 }, { x: 20, z: 18 }, // 22 Pylon A, 23 Pylon B
  { x: -24, z: 0 }, // 24 core spawn
  { x: -19, z: 14 }, // 25 Fuel Yard
];

export const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11],
  [12, 13], [13, 14], [14, 15], [15, 16],
  [0, 5], [1, 17], [2, 19], [3, 19], [4, 11],
  [17, 18], [18, 12], [17, 25], [5, 17],
  [19, 20], [20, 14], [19, 21], [2, 21], [21, 8],
  [12, 22], [13, 22], [4, 23], [3, 23], [18, 22],
  [5, 24], [6, 24],
];

export function nearestWaypoint(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const dx = WAYPOINTS[i].x - x, dz = WAYPOINTS[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Breadth-first path over the waypoint graph; returns an array of node indices
// from the node nearest (x,z) to `target`, not including the start node.
export function findPath(x, z, target) {
  const start = nearestWaypoint(x, z);
  if (start === target) return [target];
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const queue = [start];
  prev[start] = start;
  while (queue.length) {
    const cur = queue.shift();
    if (cur === target) break;
    for (const [a, b] of EDGES) {
      const n = a === cur ? b : b === cur ? a : -1;
      if (n >= 0 && prev[n] === -1) { prev[n] = cur; queue.push(n); }
    }
  }
  if (prev[target] === -1) return [target];
  const path = [];
  let cur = target;
  while (cur !== start) { path.unshift(cur); cur = prev[cur]; }
  return path;
}
