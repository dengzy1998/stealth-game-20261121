// SHADOWLINE's three heists. Each level is a tile map plus its cast:
//   '#' wall   '.' floor   'B' bush (hide spot)   'D' dark floor (shadow)
//   'P' player start   'E' exit   'T' the heist target (must grab to finish)
// Loot pieces and guard patrols are listed separately so the map stays readable.
// Guards walk their waypoint loop, pausing at each point; a 'warden' is an
// elite guard with a wider cone, faster feet and sharper eyes.
export const LEVELS = [
  {
    id: 'museum',
    name: 'The Marble Museum',
    par: 150,
    briefing: 'Lift the Star Sapphire from the east gallery. Three guards walk the halls — learn their patrols, slip between the cones, and leave through the west door.',
    map: [
      '################################',
      '#P.....#......B......#.........#',
      '#......#.............#....T....#',
      '#..B...#.....####....#.........#',
      '#......#.....#.......#....B....#',
      '#......#.....#..D....#.........#',
      '#............#.......#...####..#',
      '#......D.....#..B....#......#..#',
      '#...........##.......#..D...#..#',
      '#..B....#...........##......#..#',
      '#......#....D....#..........#..#',
      '#...........#....#....B.....#..#',
      '#......D....#....#..........#..#',
      '#...........#....#...####...#..#',
      '#..B....#........#......#......#',
      '#......#....D....#..B...#...D..#',
      '#......#.........#......#......#',
      '#E.............................#',
    ],
    loot: [
      { col: 6, row: 2, kind: 'painting', value: 150 },
      { col: 14, row: 4, kind: 'gem', value: 220 },
      { col: 24, row: 5, kind: 'painting', value: 150 },
      { col: 10, row: 9, kind: 'gem', value: 220 },
      { col: 20, row: 12, kind: 'painting', value: 150 },
      { col: 27, row: 15, kind: 'gem', value: 220 },
    ],
    guards: [
      { waypoints: [[8, 2], [9, 9], [14, 9], [14, 2]], pause: 1.2 },
      { waypoints: [[20, 4], [26, 4], [26, 12], [20, 12]], pause: 1.0 },
      { waypoints: [[4, 12], [13, 12], [12, 16], [4, 16]], pause: 1.4 },
    ],
  },
  {
    id: 'casino',
    name: 'The Gilded Casino',
    par: 180,
    briefing: 'The Golden Chip sits in the high-rollers room. Four guards and a Warden circle the tables — the Warden sees further and forgets nothing. Use the planters and the dark corners.',
    map: [
      '################################',
      '#P....#.....B.....#......D.....#',
      '#.....#...........#............#',
      '#..B..#....###....#...B....T...#',
      '#.....#....#......#............#',
      '#.....#....#..D...#....####....#',
      '#..###.....#......#....#.......#',
      '#.....D....#..B...#....#...B...#',
      '#..........#......#....#.......#',
      '#..B...#.........#..D..#....#..#',
      '#......#....D....#.....#....#..#',
      '#..####.....#....#..B..#....#..#',
      '#.....D.....#....#.....#..B....#',
      '#...........#....#.....#.......#',
      '#..B....#.......##..D..#....#..#',
      '#......#....B...#......#....#..#',
      '#......#........#..B...#....D..#',
      '#E.............................#',
    ],
    loot: [
      { col: 7, row: 2, kind: 'gem', value: 260 },
      { col: 13, row: 4, kind: 'painting', value: 180 },
      { col: 25, row: 6, kind: 'gem', value: 260 },
      { col: 5, row: 10, kind: 'painting', value: 180 },
      { col: 18, row: 11, kind: 'gem', value: 260 },
      { col: 27, row: 13, kind: 'painting', value: 180 },
      { col: 11, row: 15, kind: 'gem', value: 260 },
      { col: 22, row: 16, kind: 'painting', value: 180 },
    ],
    guards: [
      { waypoints: [[7, 3], [14, 3], [13, 8], [7, 8]], pause: 0.9 },
      { waypoints: [[19, 2], [27, 2], [27, 7], [19, 7]], pause: 1.1 },
      { waypoints: [[4, 12], [11, 11], [11, 15], [4, 15]], pause: 1.3 },
      { waypoints: [[18, 12], [24, 12], [24, 16], [17, 16]], pause: 1.0 },
      { waypoints: [[14, 5], [22, 5], [22, 10], [14, 10]], pause: 0.8, warden: true },
    ],
  },
  {
    id: 'gallery',
    name: 'The Sky Gallery',
    par: 210,
    briefing: 'The Moonlight Portrait hangs at the top of the gallery. Two Wardens sweep the long hall — their cones are wide and their patience is short. Grab everything, ghost it, and vanish.',
    map: [
      '################################',
      '#P....#....B....#.....D.....T..#',
      '#.....#.........#..............#',
      '#..B..#...###...#...B....#.....#',
      '#.....#...#.....#.......#..B...#',
      '#..##.....#..D..#...####....#..#',
      '#.....D...#.....#.......#......#',
      '#.........#..B..#...D...#..B...#',
      '#..B..#.........#.......#......#',
      '#.....#....D....#..B....#..D...#',
      '#..###.....#....#.......#......#',
      '#.....D....#....#...###....B...#',
      '#..........#....#...#......#...#',
      '#..B...#.......##...#..D...#...#',
      '#......#...B...#....#......#...#',
      '#..####....#...#..B..#...B.....#',
      '#......D...#...#....#......D...#',
      '#E.............................#',
    ],
    loot: [
      { col: 8, row: 2, kind: 'painting', value: 200 },
      { col: 17, row: 3, kind: 'gem', value: 300 },
      { col: 26, row: 5, kind: 'painting', value: 200 },
      { col: 7, row: 8, kind: 'gem', value: 300 },
      { col: 20, row: 9, kind: 'painting', value: 200 },
      { col: 12, row: 12, kind: 'gem', value: 300 },
      { col: 25, row: 13, kind: 'painting', value: 200 },
      { col: 9, row: 15, kind: 'gem', value: 300 },
      { col: 22, row: 16, kind: 'painting', value: 200 },
    ],
    guards: [
      { waypoints: [[7, 3], [13, 3], [12, 7], [6, 7]], pause: 0.9 },
      { waypoints: [[18, 3], [26, 3], [25, 8], [18, 8]], pause: 1.0 },
      { waypoints: [[4, 11], [10, 11], [10, 15], [4, 16]], pause: 1.2 },
      { waypoints: [[17, 12], [24, 12], [24, 16], [16, 16]], pause: 1.1 },
      { waypoints: [[13, 5], [19, 5], [19, 11], [13, 11]], pause: 0.7, warden: true },
      { waypoints: [[8, 9], [15, 9], [16, 14], [8, 14]], pause: 0.8, warden: true },
    ],
  },
];

/** Tile lookups for a level: walls block movement and sight, bushes hide, dark slows detection. */
export function parseLevel(def) {
  const walls = [];
  const bushes = [];
  const dark = [];
  let playerStart = { x: 60, y: 60 };
  let exit = { x: 60, y: 660 };
  let target = { x: 1100, y: 60 };
  for (let row = 0; row < def.map.length; row += 1) {
    const line = def.map[row];
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col];
      const x = col * 40;
      const y = row * 40;
      if (ch === '#') walls.push({ x, y, w: 40, h: 40 });
      else if (ch === 'B') bushes.push({ x, y, w: 40, h: 40 });
      else if (ch === 'D') dark.push({ x, y, w: 40, h: 40 });
      else if (ch === 'P') playerStart = { x: x + 20, y: y + 20 };
      else if (ch === 'E') exit = { x: x + 20, y: y + 20 };
      else if (ch === 'T') target = { x: x + 20, y: y + 20 };
    }
  }
  return { def, walls, bushes, dark, playerStart, exit, target };
}
