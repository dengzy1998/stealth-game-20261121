// SHADOWLINE screenshot staging: an autopilot that plays the game like a
// careful thief, and the scene staging that turns a played heist into the
// four screenshots. Everything here is pure simulation — no DOM, no
// canvas — so the test harness can run the same staging headlessly.

import { GUARD, VIEW } from './config.js';
import { LEVELS } from './levels.js';
import { createRandom } from './random.js';
import { circleClear } from './player.js';
import { findTilePath } from './vision.js';
import {
  chooseGadget,
  createRun,
  createWorld,
  finishHeist,
  stepWorld,
  upgradeChoices,
} from './world.js';
import {
  conePolygon,
  hasLineOfSight,
  inCone,
  inDark,
  isWallAt,
  polygonArea,
} from './vision.js';

const DT = 1 / 60;
const NO_INPUT = { x: 0, y: 0, sneak: false, sprint: false, smoke: false };

// ---------------------------------------------------------------- autopilot

// Where the autopilot is heading: the nearest loot, the target, or the exit.
function goalTarget(world, goal) {
  const p = world.player;
  if (goal.kind === 'loot' || goal.kind === 'lootN') {
    if (goal.kind === 'lootN' && world.lootCollected >= goal.n) {
      // Enough loot: go for the target, then the exit.
    } else {
      let best = null;
      let bestDist = Infinity;
      for (const item of world.loot) {
        if (item.taken) continue;
        const d = Math.hypot(item.x - p.x, item.y - p.y);
        if (d < bestDist) {
          bestDist = d;
          best = item;
        }
      }
      if (best) return best;
    }
  }
  if (goal.kind === 'target' || goal.kind === 'loot' || goal.kind === 'lootN') {
    if (!world.targetTaken) return world.target;
  }
  return world.exit;
}

function nearestGuard(world) {
  const p = world.player;
  let best = null;
  let bestDist = Infinity;
  for (const guard of world.guards) {
    const d = Math.hypot(guard.x - p.x, guard.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = guard;
    }
  }
  return { guard: best, dist: bestDist };
}

// Flee from a guard: sample 16 directions and score each by how far Wren
// can run before a wall (walls counted 12 px fat) plus how directly away
// it points. A straight line into a wall pins Wren while the guard
// closes in; this does not. When every away direction is a wall, fall
// back to the longest run in any direction — never press into a corner
// while a way out along the wall exists.
export function fleeInput(world, guard) {
  const p = world.player;
  const ax = p.x - guard.x;
  const ay = p.y - guard.y;
  const alen = Math.hypot(ax, ay) || 1;
  const awayX = ax / alen;
  const awayY = ay / alen;
  const clearRun = (dx, dy) => {
    let run = 0;
    for (let d = 10; d <= 300; d += 10) {
      const cx = p.x + dx * d;
      const cy = p.y + dy * d;
      if (
        isWallAt(world, cx + 12, cy) ||
        isWallAt(world, cx - 12, cy) ||
        isWallAt(world, cx, cy + 12) ||
        isWallAt(world, cx, cy - 12)
      ) {
        break;
      }
      run = d;
    }
    return run;
  };
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const dot = dx * awayX + dy * awayY;
    const run = clearRun(dx, dy);
    // Away from the guard matters most (worth 150); the clear run is
    // the tiebreaker, so a long corridor toward the guard never beats a
    // shorter run away from it — a near-tie there makes Wren jitter in
    // place while the guard walks up to her. But a direction she cannot
    // move in at all (run under 30 px — a wall right behind her) is
    // worthless no matter how well it points away: pressing into a wall
    // while the guard walks up is how she gets cornered and caught.
    const score =
      run * 0.5 + dot * 150 - (dot < 0 ? 60 : 0) - (run < 30 ? 300 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { x: dx, y: dy };
    }
  }
  if (!best) return { x: awayX, y: awayY, sneak: false, sprint: true, smoke: false };
  return { x: best.x, y: best.y, sneak: false, sprint: true, smoke: false };
}

// One autopilot decision: follow a tile path toward the goal (a straight
// line at the goal walks into walls and wedges), steering around cones.
// 60 px lookahead, cone danger worth 400, guards within 180 px push Wren
// away, and when every way scores below -200 she waits for the patrol to
// pass. A curious or angry guard means run, not loot — and a chasing
// guard close behind means throw smoke and run.
//
// options.cautious is the ghost-run mode: wider berth around guards,
// no sprinting, longer waits. The cover autopilot stays bold so it
// collects loot; the win shot needs to finish unseen, which is worth
// the extra patience.
export function autopilotInput(world, goal, options = {}) {
  const p = world.player;
  const cautious = !!options.cautious;
  const { guard: near, dist: nearDist } = nearestGuard(world);

  // A curious or angry guard means run, not loot.
  if (
    near &&
    (near.state === 'suspicious' || near.state === 'alert' || near.state === 'search')
  ) {
    const flee = fleeInput(world, near);
    const smoke = near.state === 'alert' && nearDist < 200 && p.smokeLeft > 0;
    return { ...flee, smoke };
  }

  // If a patrolling guard's cone is on Wren right now, slip out of it
  // quietly — standing in the light while a patrol sweeps past is how a
  // ghost run gets spotted. This also covers waiting: a wait that lets a
  // cone drift onto her ends here, not in an alert. If the guard is
  // close enough to spot her at point-blank range, sprint clear.
  const spotter = world.guards.find((g) => inCone(world, g, p.x, p.y));
  if (spotter) {
    const away = fleeInput(world, spotter);
    return { x: away.x, y: away.y, sneak: true, sprint: false, smoke: false };
  }

  const target = goalTarget(world, goal);
  if (!target) return { ...NO_INPUT };
  // Steer along the tile path to the goal, not straight at it: the floor
  // is full of walls, and a straight line wedges Wren in a corner.
  let steer = target;
  const path = findTilePath(world, p.x, p.y, target.x, target.y);
  if (path && path.length > 0) {
    let i = 0;
    while (i < path.length && Math.hypot(path[i].x - p.x, path[i].y - p.y) < 24) i++;
    if (i < path.length) steer = path[i];
  }
  // Patience: a patrolling guard standing on the next path node — or a
  // guard whose cone covers it — means wait for the patrol to pass.
  // Probing into a cone to reach a goal on the far side is how a ghost
  // run gets spotted: each brief dip adds suspicion faster than it
  // decays, and the guard alerts after a few crossings. Wait only while
  // no guard is close to Wren herself — a wait that lets a guard walk
  // up behind her is worse than moving, so a close guard means back
  // quietly away instead.
  const blocker = world.guards.find(
    (g) =>
      Math.hypot(g.x - steer.x, g.y - steer.y) < (cautious ? 200 : 120) ||
      inCone(world, g, steer.x, steer.y),
  );
  if (blocker) {
    const close = world.guards.find(
      (g) => Math.hypot(g.x - p.x, g.y - p.y) < (cautious ? 200 : 130),
    );
    if (close) {
      const away = fleeInput(world, close);
      return { x: away.x, y: away.y, sneak: true, sprint: false, smoke: false };
    }
    return { ...NO_INPUT };
  }
  const tx = steer.x - p.x;
  const ty = steer.y - p.y;
  const tlen = Math.hypot(tx, ty) || 1;
  const dirX = tx / tlen;
  const dirY = ty / tlen;

  let best = null;
  let bestScore = -Infinity;
  // Close to the goal, commit: the last stretch is worth a dash.
  const progressWeight = tlen < 100 ? 250 : 100;
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const cx = p.x + dx * 60;
    const cy = p.y + dy * 60;
    let score = (dx * dirX + dy * dirY) * progressWeight;
    // Walls: Wren's whole body has to fit at the lookahead point and at
    // the midpoint — a point check alone lets her aim through a wall
    // corner she can never actually pass.
    if (
      !circleClear(world, cx, cy, p.radius) ||
      !circleClear(world, p.x + dx * 30, p.y + dy * 30, p.radius)
    ) {
      score -= 500;
    }
    // Cone danger: standing where a guard can see her is worth -400.
    for (const guard of world.guards) {
      if (inCone(world, guard, cx, cy)) score -= 400;
    }
    // Guard proximity: closer than 180 px pushes her away, but not so
    // hard that she can never slip past a patrolling guard to a loot
    // spot on its route — the cone is the real danger, not the distance.
    // Very close is different: under 80 px she backs off hard, because a
    // guard that close spots her at point-blank range. Cautious mode
    // widens the berth: a ghost run cannot afford a close encounter.
    for (const guard of world.guards) {
      const d = Math.hypot(guard.x - cx, guard.y - cy);
      if (cautious) {
        if (d < 220) score -= (220 - d) * 2.0;
        if (d < 100) score -= (100 - d) * 5;
      } else {
        if (d < 180) score -= (180 - d) * 1.0;
        if (d < 80) score -= (80 - d) * 3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = { x: dx, y: dy };
    }
  }
  // Every way is terrible: wait where she is.
  if (!best || bestScore < -200) return { ...NO_INPUT };

  const coneDanger = world.guards.some((g) => inCone(world, g, p.x, p.y));
  const sprint = !cautious && nearDist > 380 && !coneDanger;
  const sneak = coneDanger || nearDist < 260;
  return {
    x: best.x,
    y: best.y,
    sneak: !sprint && sneak,
    sprint,
    smoke: false,
  };
}

// Drive the world with the autopilot for up to `seconds` of sim time, or
// until the heist ends. Returns how it ended.
export function runAutopilot(world, seconds, goal, options = {}) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (world.over) break;
    stepWorld(world, autopilotInput(world, goal, options), DT);
  }
  return { over: world.over, time: world.time, loot: world.lootValue };
}

// ---------------------------------------------------------------- staging

// Reset every guard to a calm patrol at its nearest waypoint.
function calmAllGuards(world) {
  for (const guard of world.guards) {
    let best = guard.waypoints[0];
    let bestDist = Infinity;
    for (const wp of guard.waypoints) {
      const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
      if (d < bestDist) {
        bestDist = d;
        best = wp;
      }
    }
    guard.x = best.x;
    guard.y = best.y;
    const next = guard.waypoints[(guard.waypoints.indexOf(best) + 1) % guard.waypoints.length];
    guard.dir = Math.atan2(next.y - best.y, next.x - best.x);
    guard.waypointIndex = (guard.waypoints.indexOf(best) + 1) % guard.waypoints.length;
    guard.state = 'patrol';
    guard.suspicion = 0;
    guard.seenTimer = 0;
    guard.waitTimer = 0;
    guard.stateTimer = 0;
    guard.alerted = false;
  }
  world.alarm = 0;
  world.everSpotted = false;
}

// The cover shot: a genuine alert the player escapes. The autopilot
// plays 40 s, then one guard is staged at its most open cone with Wren
// placed 120 px out along a cone ray. She stands still while suspicion
// climbs to 100, then sprints away for 0.9 s. The frame is taken with
// the guard alert, the alarm TENSE, and Wren still free.
export function stagePlay(levelIndex, run, seed) {
  // The autopilot plays 40 s; if it gets caught, reload and run 25 s
  // instead, with a fresh seed each try — the cover needs a free Wren.
  let world = null;
  const tries = [
    { seed, seconds: 40 },
    { seed: seed + 7, seconds: 25 },
    { seed: seed + 21, seconds: 25 },
  ];
  for (const attempt of tries) {
    world = createWorld(levelIndex, run, attempt.seed);
    runAutopilot(world, attempt.seconds, { kind: 'loot' });
    if (!world.over) break;
  }
  if (!world || world.over) {
    throw new Error('stagePlay: autopilot was caught on every try');
  }
  calmAllGuards(world);

  // Find the most open cone across every guard's waypoints: face each
  // guard toward its next waypoint and measure the raycast-clipped cone.
  // A cone only counts if Wren can actually be placed in it — along ray
  // 17 of 23, ~120 px out, in-frame, out of shadow, in-cone, with line
  // of sight — so the placement is tested for every candidate.
  function placementFor(guard, wx, wy, dir) {
    const rays = 23;
    const rayIndex = 17;
    const rayAngle =
      dir - guard.halfAngle + (rayIndex / (rays - 1)) * guard.halfAngle * 2;
    for (const dist of [120, 130, 110, 140, 100, 150]) {
      const px = wx + Math.cos(rayAngle) * dist;
      const py = wy + Math.sin(rayAngle) * dist;
      if (px < 30 || px > 1040 || py < 150 || py > 580) continue;
      if (inDark(world, px, py)) continue;
      const probe = { ...guard, x: wx, y: wy, dir };
      if (!inCone(world, probe, px, py)) continue;
      if (!hasLineOfSight(world, wx, wy, px, py)) continue;
      return { x: px, y: py };
    }
    return null;
  }
  let best = null;
  for (const guard of world.guards) {
    for (let w = 0; w < guard.waypoints.length; w++) {
      const wp = guard.waypoints[w];
      const next = guard.waypoints[(w + 1) % guard.waypoints.length];
      if (wp.x < 150 || wp.x > 1130 || wp.y < 150 || wp.y > 570) continue;
      const dir = Math.atan2(next.y - wp.y, next.x - wp.x);
      const probe = { ...guard, x: wp.x, y: wp.y, dir };
      const area = polygonArea(conePolygon(world, probe));
      const spot = placementFor(guard, wp.x, wp.y, dir);
      if (!spot) continue;
      if (!best || area > best.area) {
        best = { guard, wp, next, dir, area, spot };
      }
    }
  }
  if (!best) throw new Error('stagePlay: no in-frame cone found');
  const guard = best.guard;
  guard.x = best.wp.x;
  guard.y = best.wp.y;
  guard.dir = best.dir;
  guard.state = 'patrol';
  guard.suspicion = 0;
  guard.waitTimer = 3.0;
  guard.stateTimer = 0;
  guard.waypointIndex =
    (guard.waypoints.indexOf(best.wp) + 1) % guard.waypoints.length;

  // Place Wren ~120 px out along cone ray 17 of 23 (about 20 degrees off
  // centre), skipping shadowed spots, in-frame, in-cone, with line of
  // sight. From 70 px the guard catches her first; from 120 px she gets
  // away. The point is in the cone with LOS by construction; check both.
  world.player.x = best.spot.x;
  world.player.y = best.spot.y;
  world.player.dir = Math.atan2(guard.y - best.spot.y, guard.x - best.spot.x);

  // Stand still until the guard's suspicion hits 100 (cap 2.5 s). The
  // guard waits while suspicion climbs to 55, then walks in — from 120 px
  // it closes ~75 px and alerts with room to spare.
  let waited = 0;
  while (guard.suspicion < 100 && waited < 2.5 && !world.over) {
    stepWorld(world, NO_INPUT, DT);
    waited += DT;
  }

  // Flee 0.9 s: sprint away, direction picked fresh each step.
  let fled = 0;
  while (fled < 0.9 && !world.over) {
    stepWorld(world, fleeInput(world, guard), DT);
    fled += DT;
  }

  const alertGuards = world.guards.filter((g) => g.state === 'alert').length;
  return {
    world,
    summary: {
      over: world.over,
      alertGuards,
      alarm: Math.round(world.alarm),
      time: Math.round(world.time * 10) / 10,
      loot: world.lootValue,
      guardSuspicion: Math.round(guard.suspicion),
      playerSprinting: world.player.stance === 'sprint',
    },
  };
}

// The title shot: the heist plays quietly behind the menu, and Wren
// hides in a bush.
export function stageTitle(levelIndex, run, seed) {
  const world = createWorld(levelIndex, run, seed);
  let bush = null;
  for (let y = 0; y < world.rows && !bush; y++) {
    for (let x = 0; x < world.cols; x++) {
      if (world.tiles[y][x] === 'B') {
        bush = { x: x * VIEW.tile + VIEW.tile / 2, y: y * VIEW.tile + VIEW.tile / 2 };
        break;
      }
    }
  }
  if (bush) {
    world.player.x = bush.x;
    world.player.y = bush.y;
  }
  for (let i = 0; i < 6 * 60; i++) {
    stepWorld(world, NO_INPUT, DT);
    if (world.over) break;
  }
  world.screen = 'title';
  return { world, summary: { over: world.over, time: world.time } };
}

// The upgrade shot: finish heist 1 for real — grab the target, walk the
// exit — then show the upgrade choice with the middle card selected.
export function stageUpgrade(run, seed) {
  let world = null;
  let tries = 0;
  while (tries < 3) {
    world = createWorld(0, run, seed + tries);
    runAutopilot(world, 120, { kind: 'target' });
    if (world.over === 'complete') break;
    tries++;
  }
  if (!world || world.over !== 'complete') {
    throw new Error('stageUpgrade: autopilot could not finish heist 1');
  }
  world.time = 105;
  world.screen = 'upgrade';
  const choices = upgradeChoices(world);
  return { world, choices, selected: 1, summary: { score: world.run.runScore, time: world.time } };
}

// The win shot: take 3 loot, the target, reach the exit unseen.
// The ghost run uses cautious mode; if 3 loot cannot be taken unseen,
// fall back to 2, then 1 — a ghost finish matters more than the count,
// and each try is a genuinely different run (different loot target),
// not a re-roll of the same deterministic world.
export function stageWin(run, seed) {
  let world = null;
  const attempts = [
    { n: 3, cautious: true },
    { n: 2, cautious: true },
    { n: 1, cautious: true },
  ];
  for (const attempt of attempts) {
    world = createWorld(0, run, seed);
    runAutopilot(world, 150, { kind: 'lootN', n: attempt.n }, { cautious: attempt.cautious });
    if (world.over === 'complete' && !world.everSpotted) break;
  }
  if (!world || world.over !== 'complete') {
    throw new Error('stageWin: autopilot could not finish heist 1 unseen');
  }
  world.time = 105;
  world.screen = 'complete';
  return {
    world,
    summary: {
      score: world.breakdown ? world.breakdown.total : world.run.runScore,
      ghost: !world.everSpotted,
      loot: world.lootValue,
      time: world.time,
    },
  };
}

// Pick a scene from the URL query: ?shot=play|title|upgrade|win&seed=N.
// Returns the staged world and what screen to draw.
export function sceneFor(query) {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const shot = params.get('shot') || 'play';
  const seed = Number(params.get('seed') || '1');
  const run = createRun(null);
  if (shot === 'title') {
    const { world } = stageTitle(0, run, seed);
    return { world, screen: 'title' };
  }
  if (shot === 'upgrade') {
    const { world, choices, selected } = stageUpgrade(run, seed);
    return { world, screen: 'upgrade', choices, selected };
  }
  if (shot === 'win') {
    const { world } = stageWin(run, seed);
    return { world, screen: 'complete' };
  }
  const { world } = stagePlay(0, run, seed);
  return { world, screen: 'play' };
}
