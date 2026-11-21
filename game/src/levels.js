// SHADOWLINE levels: three heists, three 32x18 ASCII floor plans.
//
// Tile legend:
//   '#' wall            '.' open floor      'B' bush (hides Wren)
//   'd' shadow floor    'r' rug            'L' loot
//   'T' heist target    'X' exit           'P' Wren's start
//
// Guard patrols are listed per level as tile coordinates; every waypoint
// sits on an open, reachable tile. True counts: museum 3 guards,
// casino 5 (1 warden), gallery 6 (2 wardens) — 14 guards, 3 wardens.

import { GADGETS } from './config.js';

export const TILE_CHARS = {
  wall: '#',
  floor: '.',
  bush: 'B',
  shadow: 'd',
  rug: 'r',
  loot: 'L',
  target: 'T',
  exit: 'X',
  player: 'P',
};

export const LEVELS = [
  {
    id: 'museum',
    name: 'The Marble Museum',
    subtitle: 'Steal the Star Sapphire from the central gallery.',
    targetValue: 350,
    lootValues: [180, 220, 150, 260, 200, 170],
    map: [
      '################################',
      '#P....d......#....L.....#......#',
      '#..B...d.....#..........#..B...#',
      '#......d.....#....r.....#......#',
      '#......d.....#....r..L..#......#',
      '####.######..#....r..####.######',
      '#......#.........r........#....#',
      '#..L...#....B....r....L...#..d.#',
      '#......#.........r........#..d.#',
      '#..B...######.####..######...d.#',
      '#......#..........T........#...#',
      '#..d...#....r..............#...#',
      '#..d...#....r....B....L....#...#',
      '####.###....r....##########..###',
      '#......#....r..............#...#',
      '#..L...#....r....B....d....#.X.#',
      '#......#....r.........d....#...#',
      '################################',
    ],
    guards: [
      { waypoints: [[15, 2], [19, 2], [19, 7], [15, 7]], warden: false },
      { waypoints: [[26, 2], [29, 2], [29, 6], [27, 6]], warden: false },
      { waypoints: [[3, 3], [3, 8], [3, 14], [9, 14]], warden: false },
    ],
  },
  {
    id: 'casino',
    name: 'The Gilded Casino',
    subtitle: 'Lift the house ledger from the cashier’s cage.',
    targetValue: 350,
    lootValues: [240, 150, 300, 180, 210, 160],
    map: [
      '################################',
      '#P....B.....#....L....#...d....#',
      '#......d....#.........#....L...#',
      '#....r......#....r....#...B....#',
      '#....r......#....r....#........#',
      '#####.#####..#....r...##.#######',
      '#..........#....r........#.....#',
      '#..L.......#....r....L......d..#',
      '#..........#....r........#.....#',
      '#..B....####.####..#####..#....#',
      '#..........#....T........#.....#',
      '#....d.....#..............#....#',
      '#....d..B..#....r....L....#....#',
      '######.######....r....#######.##',
      '#..........#....r........#.....#',
      '#..L.......#....r...B.....#..X.#',
      '#......d...#....r.........#....#',
      '################################',
    ],
    guards: [
      { waypoints: [[26, 2], [29, 7], [27, 11], [29, 3]], warden: true },
      { waypoints: [[15, 6], [19, 6], [19, 11], [15, 11]], warden: false },
      { waypoints: [[3, 6], [8, 6], [8, 11], [3, 11]], warden: false },
      { waypoints: [[5, 14], [10, 14], [10, 16], [5, 16]], warden: false },
      { waypoints: [[29, 13], [29, 16], [28, 16], [27, 16]], warden: false },
    ],
  },
  {
    id: 'gallery',
    name: 'The Sky Gallery',
    subtitle: 'Take the Dawn Canvas from the top-floor atrium.',
    targetValue: 350,
    lootValues: [200, 280, 150, 320, 190, 230],
    map: [
      '################################',
      '#P...d......#...L.....#....d...#',
      '#....d..B.L.#.........#........#',
      '#....d......#....r....#...B....#',
      '#....d......#....r....#........#',
      '####.######.....r....##.########',
      '#........#..........r.....#....#',
      '#...L....#....B.....r.....#..d.#',
      '#........#..........r.....#..d.#',
      '#..B..####..####..####....#....#',
      '#........#....T........r..#....#',
      '#...d....#............r.L.#....#',
      '#...d....#....B.......r...#....#',
      '####.#####....r.....#######...##',
      '#........#....r..........L..#..#',
      '#...L....#....r....B........#.X#',
      '#....d...#....r..........d..#..#',
      '################################',
    ],
    guards: [
      { waypoints: [[26, 2], [29, 6], [27, 9], [29, 3]], warden: true },
      { waypoints: [[15, 14], [20, 14], [20, 16], [15, 16]], warden: true },
      { waypoints: [[15, 6], [19, 6], [19, 11], [15, 11]], warden: false },
      { waypoints: [[3, 6], [8, 6], [8, 11], [3, 11]], warden: false },
      { waypoints: [[27, 11], [29, 11], [29, 14], [26, 14]], warden: false },
      { waypoints: [[3, 2], [8, 2], [8, 4], [3, 4]], warden: false },
    ],
  },
];

// Total guards and wardens across all three heists, counted from the data.
export function countForces() {
  let guards = 0;
  let wardens = 0;
  for (const level of LEVELS) {
    for (const g of level.guards) {
      guards++;
      if (g.warden) wardens++;
    }
  }
  return { heists: LEVELS.length, guards, wardens, gadgets: GADGETS.length };
}

// Turn a level definition into a playable floor: a tile grid plus the
// placed loot, target, exit, player start and guard patrols.
export function parseLevel(level, tileSize) {
  const rows = level.map.length;
  const cols = level.map[0].length;
  const tiles = [];
  const loot = [];
  let target = null;
  let exit = null;
  let playerStart = null;
  let lootIndex = 0;
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const ch = level.map[y][x];
      if (ch === TILE_CHARS.loot) {
        const value = level.lootValues[lootIndex % level.lootValues.length];
        loot.push({
          x: x * tileSize + tileSize / 2,
          y: y * tileSize + tileSize / 2,
          tx: x,
          ty: y,
          value,
          taken: false,
        });
        lootIndex++;
        row.push(TILE_CHARS.floor);
      } else if (ch === TILE_CHARS.target) {
        target = {
          x: x * tileSize + tileSize / 2,
          y: y * tileSize + tileSize / 2,
          tx: x,
          ty: y,
          value: level.targetValue,
          taken: false,
        };
        row.push(TILE_CHARS.floor);
      } else if (ch === TILE_CHARS.exit) {
        exit = {
          x: x * tileSize + tileSize / 2,
          y: y * tileSize + tileSize / 2,
          tx: x,
          ty: y,
        };
        row.push(TILE_CHARS.floor);
      } else if (ch === TILE_CHARS.player) {
        playerStart = {
          x: x * tileSize + tileSize / 2,
          y: y * tileSize + tileSize / 2,
          tx: x,
          ty: y,
        };
        row.push(TILE_CHARS.floor);
      } else {
        row.push(ch);
      }
    }
    tiles.push(row);
  }
  const guards = level.guards.map((g) => ({
    waypoints: g.waypoints.map(([tx, ty]) => ({
      x: tx * tileSize + tileSize / 2,
      y: ty * tileSize + tileSize / 2,
      tx,
      ty,
    })),
    warden: g.warden,
  }));
  return { tiles, loot, target, exit, playerStart, guards, rows, cols };
}

// Is this tile a wall? Anything that is not a wall can be walked on.
export function isWallTile(ch) {
  return ch === TILE_CHARS.wall;
}

// Flood-fill from the player start over every walkable tile. Returns the
// set of reachable tile keys ("x,y") so validation can prove that loot,
// the target, the exit and every guard waypoint can actually be reached.
export function reachableTiles(parsed) {
  const seen = new Set();
  const start = parsed.playerStart;
  if (!start) return seen;
  const queue = [[start.tx, start.ty]];
  seen.add(`${start.tx},${start.ty}`);
  while (queue.length > 0) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= parsed.cols || ny >= parsed.rows) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      if (isWallTile(parsed.tiles[ny][nx])) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

// Validate one level definition: exact row sizes, intact borders, every
// objective on a reachable tile, and exactly one target / exit / start.
export function validateLevel(level, tileSize) {
  const errors = [];
  const rows = level.map.length;
  if (rows !== 18) errors.push(`expected 18 rows, got ${rows}`);
  level.map.forEach((row, y) => {
    if (row.length !== 32) errors.push(`row ${y} is ${row.length} chars, not 32`);
  });
  if (errors.length > 0) return { ok: false, errors };
  const parsed = parseLevel(level, tileSize);
  let openTiles = 0;
  for (let y = 0; y < parsed.rows; y++) {
    for (let x = 0; x < parsed.cols; x++) {
      const ch = parsed.tiles[y][x];
      if (x === 0 || y === 0 || x === parsed.cols - 1 || y === parsed.rows - 1) {
        if (!isWallTile(ch)) errors.push(`border tile (${x},${y}) is not a wall`);
      }
      if (!isWallTile(ch)) openTiles++;
    }
  }
  if (!parsed.target) errors.push('no target (T) on the map');
  if (!parsed.exit) errors.push('no exit (X) on the map');
  if (!parsed.playerStart) errors.push('no player start (P) on the map');
  const reach = reachableTiles(parsed);
  const checkReach = (spot, label) => {
    if (spot && !reach.has(`${spot.tx},${spot.ty}`)) {
      errors.push(`${label} at (${spot.tx},${spot.ty}) is not reachable`);
    }
  };
  for (const item of parsed.loot) checkReach(item, 'loot');
  checkReach(parsed.target, 'target');
  checkReach(parsed.exit, 'exit');
  for (const g of parsed.guards) {
    for (const wp of g.waypoints) checkReach(wp, 'guard waypoint');
  }
  return {
    ok: errors.length === 0,
    errors,
    openTiles,
    lootCount: parsed.loot.length,
    guardCount: parsed.guards.length,
    wardenCount: parsed.guards.filter((g) => g.warden).length,
  };
}
