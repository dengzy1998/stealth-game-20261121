// SHADOWLINE world: the fixed-step simulation, heist flow, scoring,
// gadgets, the hideout, and the save file. This module never touches the
// DOM or the canvas, so the same code runs in the browser and in the
// headless test harness.

import {
  ALARM,
  GADGETS,
  HIDEOUT,
  SAVE_KEY,
  SCORE,
  SMOKE,
  VIEW,
} from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { createRandom, shuffled } from './random.js';
import { makeGuard, updateGuard } from './guards.js';
import { makePlayer, updatePlayer } from './player.js';
import { updateNoise } from './noise.js';
import { inBush, inDark } from './vision.js';

// A run spans all three heists: the gadgets Wren has picked up, the
// permanent hideout gear, the banked loot and the running score.
export function createRun(save) {
  return {
    levelIndex: 0,
    gadgets: [],
    hideout: (save && save.hideout) || [],
    banked: (save && save.banked) || 0,
    runScore: 0,
    best: (save && save.best) || 0,
    heistScores: [],
  };
}

// The gameplay modifiers a run's gadgets and hideout gear add up to.
export function runModifiers(run) {
  const m = {
    speed: 1,
    sneakSpeed: 1,
    detect: 1,
    sprintNoise: 1,
    extraSmoke: 0,
    showSuspicion: false,
    loot: 1,
  };
  for (const id of run.gadgets) {
    const g = GADGETS.find((x) => x.id === id);
    if (g) Object.assign(m, mergeApply(m, g.apply));
  }
  if (run.hideout.includes('spare-smoke')) m.extraSmoke += 1;
  if (run.hideout.includes('silent-soles')) m.sneakSpeed *= 1.15;
  return m;
}

function mergeApply(m, apply) {
  const out = {};
  for (const [key, value] of Object.entries(apply)) {
    if (key === 'speed' || key === 'detect' || key === 'sprintNoise' || key === 'loot') {
      out[key] = (m[key] || 1) * value;
    } else if (key === 'extraSmoke') {
      out[key] = (m[key] || 0) + value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Build one heist's world: floor, loot, guards, Wren, and a clean slate
// of alarm, smoke and noise.
export function createWorld(levelIndex, run, seed) {
  const level = LEVELS[levelIndex];
  const parsed = parseLevel(level, VIEW.tile);
  const rng = createRandom(seed);
  const modifiers = runModifiers(run);
  const world = {
    levelIndex,
    level,
    tiles: parsed.tiles,
    cols: parsed.cols,
    rows: parsed.rows,
    loot: parsed.loot,
    target: parsed.target,
    exit: parsed.exit,
    guards: parsed.guards.map((g) => makeGuard(g)),
    player: makePlayer(parsed.playerStart.x, parsed.playerStart.y, modifiers),
    modifiers,
    rng,
    seed,
    time: 0,
    alarm: 0,
    lootCollected: 0,
    lootValue: 0,
    over: null,
    caughtBy: null,
    everSpotted: false,
    targetTaken: false,
    smoke: [],
    noise: [],
    rings: [],
    screen: 'play',
    run,
    // Audio hooks: main.js replaces these with real sounds; the test
    // harness leaves them as no-ops.
    onAlert: () => {},
    onNoise: () => {},
    onSmoke: () => {},
    onPickup: () => {},
    onCaught: () => {},
    onWin: () => {},
    onStep: () => {},
  };
  return world;
}

// Visibility, for the HUD eye: how exposed Wren is right now.
export function visibilityOf(world) {
  const p = world.player;
  if (inBush(world, p.x, p.y)) return { label: 'HIDDEN', level: 0 };
  if (inDark(world, p.x, p.y)) return { label: 'SHADOW', level: 1 };
  const seen = world.guards.some((g) => g.state === 'alert');
  if (seen) return { label: 'SEEN', level: 3 };
  const near = world.guards.some((g) => g.suspicion >= 55);
  if (near) return { label: 'SUSPECT', level: 2 };
  return { label: 'EXPOSED', level: 2 };
}

// The alarm's word: CALM, TENSE or ALARM.
export function alarmWord(alarm) {
  if (alarm >= ALARM.alarmAt) return 'ALARM';
  if (alarm >= ALARM.tenseAt) return 'TENSE';
  return 'CALM';
}

// One fixed simulation step (dt seconds, normally 1/60).
export function stepWorld(world, input, dt) {
  if (world.over) return;
  world.time += dt;

  // Alarm: climbs while any guard is in full chase, drains otherwise.
  const anyAlert = world.guards.some((g) => g.state === 'alert');
  if (anyAlert) {
    world.alarm = Math.min(100, world.alarm + ALARM.chasePerSecond * dt);
  } else {
    world.alarm = Math.max(0, world.alarm - ALARM.decayPerSecond * dt);
  }

  updatePlayer(world, world.player, input, dt);
  for (const guard of world.guards) {
    updateGuard(world, guard, world.player, dt);
    if (world.over) break;
  }
  if (world.over === 'caught') world.onCaught();
  updateNoise(world, dt);

  // Smoke clouds thin out.
  for (const cloud of world.smoke) cloud.life -= dt;
  world.smoke = world.smoke.filter((c) => c.life > 0);

  // Loot: walk over a painting or a gem to pocket it.
  const p = world.player;
  for (const item of world.loot) {
    if (item.taken) continue;
    const dx = item.x - p.x;
    const dy = item.y - p.y;
    if (dx * dx + dy * dy < 26 * 26) {
      item.taken = true;
      const value = Math.round(item.value * world.modifiers.loot);
      world.lootCollected++;
      world.lootValue += value;
      world.onPickup(value);
    }
  }

  // The target unlocks the exit. Walk into the exit circle to finish.
  const t = world.target;
  if (!t.taken) {
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    if (dx * dx + dy * dy < 26 * 26) {
      t.taken = true;
      world.targetTaken = true;
      world.onPickup(t.value);
    }
  }
  if (world.targetTaken) {
    const e = world.exit;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy < 24 * 24) {
      finishHeist(world);
    }
  }
}

// Finish a heist and score it. Loot plus a time bonus, a ghost bonus for
// never being spotted, and a clean-sweep bonus for taking everything.
export function finishHeist(world) {
  const timeBonus = Math.max(
    0,
    Math.round((SCORE.timeBase - world.time) * SCORE.timePerSecond),
  );
  const ghost = world.everSpotted ? 0 : SCORE.ghostBonus;
  const clean =
    world.lootCollected === world.loot.length ? SCORE.cleanSweepBonus : 0;
  const lootTotal =
    world.lootValue + (world.targetTaken ? world.target.value : 0);
  const total = lootTotal + timeBonus + ghost + clean;
  world.over = 'complete';
  world.breakdown = {
    loot: lootTotal,
    timeBonus,
    ghost,
    clean,
    total,
    time: world.time,
    lootCollected: world.lootCollected,
    lootTotal: world.loot.length,
  };
  world.run.heistScores.push(total);
  world.run.runScore += total;
  world.run.banked += lootTotal;
  world.onWin();
  return world.breakdown;
}

// Three upgrade choices for the gap between heists: gadgets Wren does
// not own yet, in seeded order.
export function upgradeChoices(world) {
  const owned = new Set(world.run.gadgets);
  const pool = shuffled(world.rng, GADGETS.filter((g) => !owned.has(g.id)));
  return pool.slice(0, 3);
}

// Take one gadget from the upgrade choice.
export function chooseGadget(world, gadgetId) {
  if (!world.run.gadgets.includes(gadgetId)) {
    world.run.gadgets.push(gadgetId);
  }
}

// Buy one hideout item with banked loot. Returns false when Wren cannot
// afford it or already owns it.
export function buyHideout(run, itemId) {
  const item = HIDEOUT.find((x) => x.id === itemId);
  if (!item) return false;
  if (run.hideout.includes(itemId)) return false;
  if (run.banked < item.cost) return false;
  run.banked -= item.cost;
  run.hideout.push(itemId);
  return true;
}

// The save file: banked loot, hideout gear and the best run score. The
// browser keeps it in localStorage; the test harness passes null.
export function loadSave(storage) {
  try {
    if (!storage) return null;
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null) return null;
    return save;
  } catch {
    return null;
  }
}

export function storeSave(storage, run) {
  try {
    if (!storage) return;
    if (run.runScore > run.best) run.best = run.runScore;
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        banked: run.banked,
        hideout: run.hideout,
        best: run.best,
      }),
    );
  } catch {
    // A save that cannot be written is a pity, not a crash.
  }
}

// Format seconds as m:ss for the HUD timer.
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
