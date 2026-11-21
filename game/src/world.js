// The world: one heist at a time. It owns the player, the guards, the
// loot, the alarm, the smoke and the score, and steps them all forward in
// fixed 1/60 s slices. It also owns the run: the heist list, the upgrades
// picked between heists, the banked loot and the hideout save.
import { ALARM, SCORE, SMOKE, STEP } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { createGuard, stepGuard } from './guards.js';
import { createPlayer, stepPlayer, useSmoke } from './player.js';
import { makeNoise, stepNoise } from './noise.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_TARGET = 2;
export const EVENT_ALERT = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_HEIST_DONE = 16;
export const EVENT_SMOKE = 32;

export function createWorld(random) {
  const world = {
    random,
    levelIndex: 0,
    level: null,
    guards: [],
    loot: [],
    player: null,
    smokes: [],
    pulses: [],
    guardSteps: [],
    alarm: 0,
    time: 0,
    score: 0,
    lootValue: 0,
    lootTaken: 0,
    targetTaken: false,
    spotted: false,
    banked: 0,
    upgrades: new Set(),
    heistScores: [],
    over: false,
    won: false,
    save: loadSave(),
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  const parsed = parseLevel(LEVELS[index]);
  world.levelIndex = index;
  world.level = parsed;
  world.guards = LEVELS[index].guards.map((g, i) => createGuard(g, i));
  world.loot = LEVELS[index].loot.map((l) => ({
    x: l.col * 40 + 20,
    y: l.row * 40 + 20,
    kind: l.kind,
    value: l.value,
    taken: false,
  }));
  world.player = createPlayer(parsed.playerStart);
  world.player.smoke = SMOKE.startCount + (world.upgrades.has('smoke') ? 1 : 0) + (world.save.hideout.includes('lockpicks') ? 1 : 0);
  world.smokes = [];
  world.pulses = [];
  world.guardSteps = [];
  world.alarm = 0;
  world.time = 0;
  world.lootValue = 0;
  world.lootTaken = 0;
  world.targetTaken = false;
  world.spotted = false;
  world.over = false;
  world.won = false;
}

export function resetRun(world) {
  world.upgrades = new Set();
  if (world.save.hideout.includes('soles')) world.upgrades.add('soft-boots');
  if (world.save.hideout.includes('insider')) world.upgrades.add('keen-eye');
  world.banked = 0;
  world.heistScores = [];
  loadLevel(world, 0);
}

/** Start the next heist after an upgrade pick, or finish the run after the last one. */
export function nextHeist(world) {
  if (world.levelIndex + 1 >= LEVELS.length) return false;
  loadLevel(world, world.levelIndex + 1);
  return true;
}

export function lootValueOf(world, base) {
  return Math.round(base * (world.upgrades.has('greased-palm') ? 1.15 : 1));
}

/** Step the world one fixed slice. `input` is {up,down,left,right,sneak,sprint,useSmoke}. */
export function stepWorld(world, input, dt = STEP) {
  if (world.over) return EVENT_NONE;
  let events = EVENT_NONE;
  world.time += dt;

  // Player.
  const moved = stepPlayer(world.player, input, dt, world.level, world.upgrades);
  world.playerStepped = moved.stepped;
  if (moved.stepped && moved.noise > 0) {
    const pulse = makeNoise(world.player.x, world.player.y, moved.noise);
    if (pulse) world.pulses.push(pulse);
  }
  if (input.useSmoke) {
    if (useSmoke(world.player, world.smokes)) events |= EVENT_SMOKE;
    input.useSmoke = false;
  }

  // Smoke ages out.
  for (let i = world.smokes.length - 1; i >= 0; i -= 1) {
    world.smokes[i].life -= dt;
    if (world.smokes[i].life <= 0) world.smokes.splice(i, 1);
  }
  stepNoise(world.pulses, world.guards, dt);

  // Guards.
  world.guardSteps = [];
  let anyAlert = false;
  for (const guard of world.guards) {
    const result = stepGuard(guard, dt, world);
    if (result === 'caught') events |= EVENT_CAUGHT;
    if (result === 'alerted') {
      events |= EVENT_ALERT;
      world.alarm = Math.min(100, world.alarm + ALARM.onAlert);
      world.spotted = true;
    }
    if (guard.state === 'alert') anyAlert = true;
  }
  if (anyAlert) world.alarm = Math.min(100, world.alarm + ALARM.chasePerSecond * dt);
  else world.alarm = Math.max(0, world.alarm - ALARM.decayPerSecond * dt);

  // Loot pickup: stand close and the piece is yours.
  for (const piece of world.loot) {
    if (!piece.taken && Math.hypot(piece.x - world.player.x, piece.y - world.player.y) < 30) {
      piece.taken = true;
      world.lootTaken += 1;
      world.lootValue += lootValueOf(world, piece.value);
      events |= EVENT_PICKUP;
    }
  }

  // The heist target: the big prize, glowing at the far end of the map.
  const target = world.level.target;
  if (!world.targetTaken && Math.hypot(target.x - world.player.x, target.y - world.player.y) < 32) {
    world.targetTaken = true;
    world.lootValue += lootValueOf(world, 400);
    events |= EVENT_TARGET;
  }

  if (events & EVENT_CAUGHT) {
    world.over = true;
    world.won = false;
    return events;
  }

  // Exit: only opens once the target is taken.
  const exit = world.level.exit;
  if (world.targetTaken && Math.hypot(exit.x - world.player.x, exit.y - world.player.y) < 34) {
    world.over = true;
    world.won = true;
    const timeBonus = Math.max(0, Math.round((LEVELS[world.levelIndex].par - world.time) * SCORE.timeBonusPerSecond));
    const ghost = world.spotted ? 0 : SCORE.ghostBonus;
    const sweep = world.lootTaken === world.loot.length ? SCORE.cleanSweepBonus : 0;
    const heistScore = world.lootValue + timeBonus + ghost + sweep;
    world.heistScores.push({ level: LEVELS[world.levelIndex].name, loot: world.lootValue, timeBonus, ghost, sweep, total: heistScore });
    world.score += heistScore;
    world.banked += world.lootValue;
    world.save.banked = world.banked;
    world.save.best = Math.max(world.save.best, world.score);
    saveSave(world.save);
    events |= EVENT_HEIST_DONE;
  }
  return events;
}

/** The run's score so far, for the HUD. */
export function currentScore(world) {
  return world.score + world.lootValue;
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem('shadowline.save.v1');
    if (!raw) return { best: 0, banked: 0, hideout: [] };
    const parsed = JSON.parse(raw);
    return { best: parsed.best || 0, banked: parsed.banked || 0, hideout: Array.isArray(parsed.hideout) ? parsed.hideout : [] };
  } catch {
    return { best: 0, banked: 0, hideout: [] };
  }
}

export function saveSave(save) {
  try {
    window.localStorage.setItem('shadowline.save.v1', JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): the run still works, it just does not persist.
  }
}
