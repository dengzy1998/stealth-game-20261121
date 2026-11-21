// SHADOWLINE — tuning numbers and colours, all in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it
// to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

/** Fixed simulation step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  sneakSpeed: 95,
  sprintSpeed: 265,
  /** Noise radius in pixels while walking / sneaking / sprinting. */
  noiseWalk: 55,
  noiseSneak: 0,
  noiseSprint: 190,
  stepIntervalWalk: 0.42,
  stepIntervalSprint: 0.26,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  investigateSpeed: 105,
  chaseSpeed: 172,
  /** Vision cone: how far and how wide a guard sees. */
  viewRange: 225,
  viewHalfAngle: 0.61, // ~35 degrees each side
  /** Suspicion per second at point-blank range, in full light, player standing. */
  detectRate: 95,
  /** How fast suspicion drains when the player is out of sight. */
  suspicionDecay: 26,
  /** Suspicion level that makes a guard walk over to look. */
  suspiciousAt: 55,
  /** Suspicion level that raises the alarm and starts a chase. */
  alertAt: 100,
  /** Seconds a guard stares at a spot before giving up and patrolling again. */
  lookAroundTime: 2.6,
  /** Seconds a chase lasts with no sighting before the guard searches. */
  chaseMemory: 3.2,
  /** How close a guard must get to catch the player. */
  catchDistance: 26,
  /** A hidden player is only spotted inside this range, even in a cone. */
  hiddenSpotRange: 42,
};

export const WARDEN = {
  viewRange: 285,
  viewHalfAngle: 0.66,
  detectRate: 125,
  patrolSpeed: 78,
  investigateSpeed: 118,
  chaseSpeed: 196,
  catchDistance: 30,
};

/** Multipliers on the detection rate for the player's state and the light. */
export const DETECT = {
  inShadow: 0.45,
  sneaking: 0.55,
  sprinting: 1.5,
  standing: 1.0,
  /** Detection falls off with distance: this is the range where it halves. */
  falloffRange: 120,
};

export const NOISE = {
  /** A guard investigates a noise it hears; hearing range is noise radius + this. */
  hearBonus: 55,
  /** Seconds a noise pulse stays visible. */
  pulseLife: 0.8,
};

export const SMOKE = {
  radius: 95,
  life: 4.5,
  startCount: 1,
  maxCount: 3,
};

export const ALARM = {
  /** Alarm added when a guard first goes alert, and per second while any guard chases. */
  onAlert: 22,
  chasePerSecond: 4,
  decayPerSecond: 3.5,
  /** Alarm level that makes every guard patrol faster and suspicion drain slower. */
  hotAt: 55,
};

export const SCORE = {
  ghostBonus: 500,
  cleanSweepBonus: 300,
  timeBonusPerSecond: 12,
};

/** The upgrade cards offered between heists: pick one, it lasts the run. */
export const UPGRADES = [
  { id: 'soft-boots', name: 'Soft Boots', blurb: 'Sneak 25% faster. Your steps make 30% less noise.', icon: '🥾' },
  { id: 'smoke', name: 'Smoke Pellet', blurb: 'Carry one more smoke pellet, up to 3. Press E to vanish.', icon: '💨' },
  { id: 'cloak', name: 'Shadow Cloak', blurb: 'Guards spot you 25% slower in bright light.', icon: '🧥' },
  { id: 'swift', name: 'Swift Step', blurb: 'Move 12% faster in every stance.', icon: '👟' },
  { id: 'keen-eye', name: 'Keen Eye', blurb: 'See guard vision through walls and their patrol routes.', icon: '👁️' },
  { id: 'greased-palm', name: 'Greased Palm', blurb: 'Every loot piece is worth 15% more.', icon: '🪙' },
];

/** Permanent hideout upgrades, bought with banked loot between runs. */
export const HIDEOUT = [
  { id: 'lockpicks', name: 'Spare Smoke', cost: 400, blurb: 'Start every run with +1 smoke pellet.' },
  { id: 'soles', name: 'Silent Soles', cost: 700, blurb: 'Start every run with Soft Boots.' },
  { id: 'insider', name: 'Insider Map', cost: 900, blurb: 'Start every run with Keen Eye.' },
];

export const PALETTE = {
  backdrop: '#0b0d12',
  floorLight: '#232838',
  floorDark: '#191d2a',
  floorShadow: '#0b0e15',
  rug: '#3a2b3d',
  wall: '#4a4238',
  wallTop: '#6b5f4d',
  wallTrim: '#c9a227',
  bush: '#1e4d2e',
  bushEdge: '#2f7a44',
  exit: '#2fd67a',
  exitGlow: '#7dffb0',
  loot: '#ffd34d',
  lootGem: '#7fe7ff',
  player: '#39d0c4',
  playerDark: '#1d7a72',
  guard: '#e5534b',
  guardWarden: '#b04df0',
  coneCalm: 'rgba(255, 214, 90, 0.30)',
  coneSuspicious: 'rgba(255, 176, 32, 0.42)',
  coneAlert: 'rgba(255, 64, 64, 0.48)',
  smoke: 'rgba(200, 205, 215, 0.55)',
  panel: '#171b26',
  panelEdge: '#2c3347',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#e8b93c',
  danger: '#ff5d5d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score, banked loot and hideout purchases are kept (this browser only). */
export const SAVE_KEY = 'shadowline.save.v1';
