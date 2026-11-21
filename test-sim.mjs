// Headless smoke test for the SHADOWLINE simulation (no DOM, no canvas):
// stages every screenshot scene, steps the world, and checks the invariants
// (no NaN, no exceptions, player and guards stay inside the field, loot and
// heist completion behave). Run: node test-sim.mjs
globalThis.window = {
  localStorage: { getItem: () => null, setItem: () => {} },
  devicePixelRatio: 1,
  addEventListener: () => {},
};

import { createRandom } from './game/src/random.js';
import { createWorld, stepWorld, loadLevel } from './game/src/world.js';
import { stageShot } from './game/src/shots.js';
import { FIELD, STEP } from './game/src/config.js';

let failures = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!cond) failures += 1;
}

function sane(world, label) {
  const p = world.player;
  const bad = [p.x, p.y, world.alarm, world.time].some((v) => !Number.isFinite(v));
  check(`${label}: numbers finite`, !bad);
  check(`${label}: player in field`, p.x >= 0 && p.x <= FIELD.width && p.y >= 0 && p.y <= FIELD.height, `(${p.x.toFixed(0)},${p.y.toFixed(0)})`);
  for (const g of world.guards) {
    if (!Number.isFinite(g.x) || !Number.isFinite(g.y) || g.x < 0 || g.x > FIELD.width || g.y < 0 || g.y > FIELD.height) {
      check(`${label}: guard ${g.index} in field`, false, `(${g.x},${g.y})`);
    }
    if (g.suspicion < 0 || g.suspicion > 100) check(`${label}: guard suspicion in range`, false, String(g.suspicion));
  }
}

for (const scene of ['title', 'briefing', 'play', 'play2', 'play3', 'upgrade', 'win', 'caught', 'hideout', 'run']) {
  const world = createWorld(createRandom(1));
  try {
    const staged = stageShot(scene, world);
    sane(world, scene);
    console.log(`  ${scene}: screen=${staged.screen} loot=$${world.lootValue} taken=${world.lootTaken} target=${world.targetTaken} over=${world.over} won=${world.won} alarm=${world.alarm.toFixed(0)} score=${world.score}`);
  } catch (err) {
    check(`${scene}: stages without throwing`, false, String(err && err.stack || err));
  }
}

// Free play: 90 seconds of random input on level 0 — the game must not crash,
// and the alarm must be able to rise and fall.
{
  const world = createWorld(createRandom(7));
  const rng = createRandom(99);
  let maxAlarm = 0;
  let sawSuspicion = false;
  for (let i = 0; i < 90 / STEP; i += 1) {
    const input = {
      up: rng.next() < 0.3, down: rng.next() < 0.3, left: rng.next() < 0.3, right: rng.next() < 0.3,
      sneak: rng.next() < 0.4, sprint: rng.next() < 0.2, useSmoke: false,
    };
    stepWorld(world, input);
    maxAlarm = Math.max(maxAlarm, world.alarm);
    if (world.guards.some((g) => g.suspicion > 20)) sawSuspicion = true;
    if (world.over) break;
  }
  sane(world, 'freeplay');
  console.log(`  freeplay: maxAlarm=${maxAlarm.toFixed(0)} sawSuspicion=${sawSuspicion} over=${world.over} time=${world.time.toFixed(1)}s loot=$${world.lootValue}`);
}

// A guard that watches a sprinting player in the open must spot them.
// Keep the player dead ahead of the guard's cone while it patrols.
{
  const world = createWorld(createRandom(1));
  loadLevel(world, 0);
  const guard = world.guards[0];
  for (let i = 0; i < 8 / STEP; i += 1) {
    world.player.x = guard.x + Math.cos(guard.angle) * 120;
    world.player.y = guard.y + Math.sin(guard.angle) * 120;
    stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
    if (guard.state === 'alert') break;
  }
  check('guard spots an exposed player and goes alert', guard.state === 'alert', `state=${guard.state} suspicion=${guard.suspicion.toFixed(0)}`);
}

// A sneaking player in a bush must stay unseen even inside a cone.
{
  const world = createWorld(createRandom(1));
  loadLevel(world, 0);
  const guard = world.guards[0];
  const bush = world.level.bushes[0];
  world.player.x = bush.x + 20;
  world.player.y = bush.y + 20;
  guard.x = world.player.x + 100;
  guard.y = world.player.y;
  guard.angle = Math.PI;
  for (let i = 0; i < 3 / STEP; i += 1) {
    stepWorld(world, { up: false, down: false, left: false, right: false, sneak: true, sprint: false, useSmoke: false });
  }
  check('hidden player in a bush stays unseen', guard.suspicion < 55, `suspicion=${guard.suspicion.toFixed(0)} state=${guard.state}`);
}

console.log(failures === 0 ? 'SIM_OK' : `SIM_FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
