// SHADOWLINE tuning: every number here was chosen by playtesting the
// stealth loop (patrol, suspicion, chase, alarm) until a near-miss felt
// fair and a mistake felt recoverable. Change one value at a time.

export const VIEW = {
  width: 1280,
  height: 720,
  tile: 40,
  cols: 32,
  rows: 18,
};

// The player, Wren. Walk is the default pace; sneak is slow and quiet;
// sprint is fast and loud enough to ring out across a room.
export const PLAYER = {
  walkSpeed: 165,
  sneakSpeed: 95,
  sprintSpeed: 265,
  radius: 13,
  // How close a guard must get to catch Wren outright.
  catchGrace: 0.12,
};

// A patrolling guard. Suspicion climbs while Wren is inside the cone and
// visible, and drains while she is not. 55 turns a guard curious, 100
// turns the whole floor hostile.
export const GUARD = {
  patrolSpeed: 62,
  investigateSpeed: 105,
  chaseSpeed: 172,
  catchDistance: 26,
  viewRange: 225,
  halfAngle: 0.61,
  detectRate: 95,
  falloffStart: 80,
  suspicionDecay: 26,
  suspiciousAt: 55,
  alertAt: 100,
  // Seconds a guard studies a spot before giving up and walking back.
  lookAround: 2.6,
  // Seconds a guard remembers where Wren was after losing sight of her.
  chaseMemory: 3.2,
  // How close Wren must be to a hiding spot for it to count as hidden.
  hiddenRange: 42,
};

// Wardens are the elite: wider cones, sharper eyes, faster feet. A warden
// that goes suspicious must keep a real investigate speed, or its position
// turns to NaN and the guard vanishes from the floor.
export const WARDEN = {
  viewRange: 285,
  halfAngle: 0.66,
  detectRate: 125,
  patrolSpeed: 78,
  investigateSpeed: 118,
  chaseSpeed: 196,
  catchDistance: 30,
};

// Detection multipliers applied on top of the base detect rate.
export const DETECT = {
  // Standing in a shadowed tile.
  shadow: 0.45,
  // Moving at a sneak.
  sneak: 0.55,
  // Running. Fast, but every guard in the room notices faster.
  sprint: 1.6,
  // Standing in a lit tile, fully exposed.
  light: 1.25,
  // Crouched inside a bush: almost invisible unless the guard is on top.
  bush: 0.12,
  // Inside a bush but closer than this, the bush stops hiding anyone.
  bushReveal: 55,
};

// The alarm meter: 0-100. One alert pushes the floor to TENSE; a
// sustained chase pushes it to ALARM, and every guard gets faster to
// notice Wren while it is high.
export const ALARM = {
  onAlert: 20,
  chasePerSecond: 6,
  decayPerSecond: 2,
  tenseAt: 20,
  alarmAt: 60,
  // Extra detect rate multiplier while the floor is at ALARM.
  alarmDetectBonus: 1.25,
};

// Smoke pellets: a thrown cloud that blocks every cone passing through it.
export const SMOKE = {
  radius: 95,
  duration: 6,
  startCount: 2,
  maxCount: 4,
};

// Noise: sprinting rings out; walking does not. A guard that hears a
// fresh pulse walks over to look at where it came from.
export const NOISE = {
  sprintInterval: 0.35,
  sprintRadius: 170,
  hearRange: 220,
  ringLife: 0.9,
  stepRingLife: 0.7,
};

// Scoring. Loot is banked per heist; the time bonus rewards a quick,
// quiet run; the ghost bonus rewards never being spotted at all.
export const SCORE = {
  ghostBonus: 500,
  cleanSweepBonus: 300,
  // Time bonus: (240 - seconds) * 4, floored at zero.
  timeBase: 240,
  timePerSecond: 4,
};

// The six gadgets offered between heists. Pick one; it lasts the run.
export const GADGETS = [
  {
    id: 'soft-boots',
    name: 'Soft Boots',
    desc: 'Sprint noise rings shrink by half. Run loud, stay quiet.',
    apply: { sprintNoise: 0.5 },
  },
  {
    id: 'smoke-pellet',
    name: 'Smoke Pellet',
    desc: 'Carry one extra smoke pellet into every heist.',
    apply: { extraSmoke: 1 },
  },
  {
    id: 'shadow-cloak',
    name: 'Shadow Cloak',
    desc: 'Guards notice you 20% slower everywhere.',
    apply: { detect: 0.8 },
  },
  {
    id: 'swift-step',
    name: 'Swift Step',
    desc: 'Move 10% faster in every stance.',
    apply: { speed: 1.1 },
  },
  {
    id: 'keen-eye',
    name: 'Keen Eye',
    desc: 'See every guard’s suspicion as a number above their head.',
    apply: { showSuspicion: true },
  },
  {
    id: 'greased-palm',
    name: 'Greased Palm',
    desc: 'Every loot pickup pays 10% more.',
    apply: { loot: 1.1 },
  },
];

// Hideout gear: permanent, bought with banked loot between runs.
export const HIDEOUT = [
  {
    id: 'spare-smoke',
    name: 'Spare Smoke',
    cost: 400,
    desc: 'Start every heist with +1 smoke pellet, forever.',
  },
  {
    id: 'silent-soles',
    name: 'Silent Soles',
    cost: 700,
    desc: 'Sneak 15% faster, forever.',
  },
  {
    id: 'insider-map',
    name: 'Insider Map',
    cost: 900,
    desc: 'The minimap shows guard patrol routes, forever.',
  },
];

// Palette: a night museum — cold floors, warm gold, warning red.
export const PALETTE = {
  floorDark: '#0b0e15',
  floorLight: '#12161f',
  floorShadow: '#080a10',
  wall: '#2a3040',
  wallTop: '#3a4156',
  wallEdge: '#4a5268',
  rug: '#5a2e35',
  rugEdge: '#7a3e46',
  bush: '#1d4a2a',
  bushEdge: '#2f7a44',
  gold: '#f2c14e',
  goldDim: '#a8842e',
  sapphire: '#4ec3f2',
  exit: '#3ddc84',
  guard: '#e8e4d8',
  guardEdge: '#8a8578',
  warden: '#c9a227',
  wardenEdge: '#7a5f10',
  player: '#2b2f3a',
  playerScarf: '#d43d3d',
  coneCalm: 'rgba(242, 193, 78, 0.30)',
  coneCalmEdge: 'rgba(242, 193, 78, 0.55)',
  coneSuspicious: 'rgba(242, 140, 78, 0.42)',
  coneSuspiciousEdge: 'rgba(242, 140, 78, 0.7)',
  coneAlert: 'rgba(224, 49, 49, 0.48)',
  coneAlertEdge: 'rgba(224, 49, 49, 0.85)',
  hudBg: 'rgba(5, 6, 10, 0.72)',
  text: '#e8e4d8',
  textDim: '#9aa0b0',
  danger: '#e03131',
  ok: '#3ddc84',
};

export const SAVE_KEY = 'shadowline.save.v1';
