// The screenshot scenes behind ?shot=title|briefing|play|upgrade|win|caught|hideout|run.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// real game looks like and the same seed always gives the same frame.
// The play autopilot steers toward the nearest loot while keeping out of
// vision cones: it scores each of the eight directions by loot pull minus
// cone danger, waits in shadow when every way is watched, and sprints only
// on open ground with no cone nearby.
import { FIELD, STEP, UPGRADES } from './config.js';
import { EVENT_CAUGHT, EVENT_HEIST_DONE, loadLevel, stepWorld } from './world.js';
import { hasLineOfSight, inCone, inDark } from './vision.js';
import { conePolygon } from './render.js';
import {
  SCREEN_BRIEFING,
  SCREEN_CAUGHT,
  SCREEN_HEIST_DONE,
  SCREEN_HIDEOUT,
  SCREEN_PLAY,
  SCREEN_RUN_DONE,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
} from './render.js';

/** The area of a guard's visible cone: the most open cone makes the best cover shot. */
function coneArea(guard, walls, smokes) {
  const poly = conePolygon(guard, walls, smokes);
  let area = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

// The sprint direction when a guard is chasing: the open direction that
// still leads away from the guard. A straight line away can run straight
// into a wall and pin Wren while the guard closes in, so sample sixteen
// directions and take the one with the longest clear run that still heads
// away from the guard.
function fleeInput(world, guard) {
  const p = world.player;
  const ax = p.x - guard.x;
  const ay = p.y - guard.y;
  const alen = Math.hypot(ax, ay) || 1;
  const awayX = ax / alen;
  const awayY = ay / alen;
  let best = null;
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const dot = dx * awayX + dy * awayY;
    if (dot < 0.2) continue;
    let run = 300;
    for (let d = 20; d <= 300; d += 10) {
      const x = p.x + dx * d;
      const y = p.y + dy * d;
      if (x < 20 || x > FIELD.width - 20 || y < 20 || y > FIELD.height - 20) { run = d; break; }
      let blocked = false;
      for (const w of world.level.walls) {
        if (x >= w.x - 12 && x < w.x + w.w + 12 && y >= w.y - 12 && y < w.y + w.h + 12) { blocked = true; break; }
      }
      if (blocked) { run = d; break; }
    }
    const score = run + dot * 40;
    if (!best || score > best.score) best = { score, dx, dy };
  }
  if (!best) return { up: false, down: false, left: false, right: false, sneak: false, sprint: true, useSmoke: false };
  return {
    up: best.dy < -0.3, down: best.dy > 0.3, left: best.dx < -0.3, right: best.dx > 0.3,
    sneak: false, sprint: true, useSmoke: false,
  };
}

const TITLE_SECONDS = 6;
const PLAY_SECONDS = 40;
const SAMPLE = STEP;
const DIRECTIONS = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/** How dangerous it is to stand at (x,y): the highest suspicion rate any guard would apply there. */
function coneDanger(world, x, y) {
  let danger = 0;
  for (const guard of world.guards) {
    if (inCone(guard, x, y)) {
      const dist = Math.hypot(x - guard.x, y - guard.y);
      danger = Math.max(danger, 1 - dist / 300);
    }
  }
  return danger;
}

function autopilot(world) {
  const p = world.player;
  // Nearest untaken loot, else the target, else the exit.
  let goal = null;
  let best = Infinity;
  for (const piece of world.loot) {
    if (piece.taken) continue;
    const d = Math.hypot(piece.x - p.x, piece.y - p.y);
    if (d < best) { best = d; goal = piece; }
  }
  if (!goal && !world.targetTaken) goal = world.level.target;
  if (!goal) goal = world.level.exit;
  // Nearest guard: how close the trouble is, and whether any guard is
  // already curious or chasing (then getting away matters more than loot).
  let nearestGuard = null;
  let nearestGuardDist = Infinity;
  let trouble = false;
  for (const guard of world.guards) {
    const d = Math.hypot(guard.x - p.x, guard.y - p.y);
    if (d < nearestGuardDist) { nearestGuardDist = d; nearestGuard = guard; }
    if (guard.state === 'suspicious' || guard.state === 'alert') trouble = true;
  }
  // When hunted, the goal is away from the nearest guard, not the loot.
  if (trouble && nearestGuard) {
    const dx = p.x - nearestGuard.x;
    const dy = p.y - nearestGuard.y;
    const len = Math.hypot(dx, dy) || 1;
    goal = { x: p.x + (dx / len) * 300, y: p.y + (dy / len) * 300 };
  }
  let bestDir = null;
  let bestScore = -Infinity;
  for (const [dx, dy] of DIRECTIONS) {
    const nx = p.x + dx * 60;
    const ny = p.y + dy * 60;
    if (nx < 20 || nx > FIELD.width - 20 || ny < 20 || ny > FIELD.height - 20) continue;
    const toGoal = Math.hypot(goal.x - nx, goal.y - ny);
    const danger = coneDanger(world, nx, ny);
    // Repulsion from every guard, stronger the closer they are.
    let repulsion = 0;
    for (const guard of world.guards) {
      const d = Math.hypot(guard.x - nx, guard.y - ny);
      if (d < 280) repulsion += (280 - d) * 0.6;
    }
    const score = -toGoal / 10 - danger * 400 - repulsion + (p.inShadow ? 8 : 0);
    if (score > bestScore) { bestScore = score; bestDir = [dx, dy]; }
  }
  // When every way is watched or crowded, wait in place and let the patrol pass.
  if (!bestDir || bestScore < -200) return { up: false, down: false, left: false, right: false, sneak: true, sprint: false, useSmoke: false };
  const [dx, dy] = bestDir;
  const dangerHere = coneDanger(world, p.x, p.y);
  return {
    up: dy < 0,
    down: dy > 0,
    left: dx < 0,
    right: dx > 0,
    sneak: dangerHere > 0.1 || nearestGuardDist < 260,
    sprint: dangerHere < 0.02 && nearestGuardDist > 380,
    useSmoke: false,
  };
}

/** Run the world forward with the autopilot for `seconds`, or until it ends. */
function runAutopilot(world, seconds) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const events = stepWorld(world, autopilot(world));
    if (events & (EVENT_CAUGHT | EVENT_HEIST_DONE)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it,
 * the best score to show, and any extra data the screen needs.
 */
export function stageShot(name, world) {
  const levelIndex = name === 'play2' || name === 'win2' ? 1 : name === 'play3' ? 2 : 0;
  if (name === 'title' || name === 'hideout') {
    loadLevel(world, 0);
    // Hide Wren in the first bush so the patrolling guards never spot the
    // idle player while the title plays behind the menu.
    const bush = world.level.bushes[0];
    world.player.x = bush.x + 20;
    world.player.y = bush.y + 20;
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      const idle = { up: false, down: false, left: false, right: false, sneak: true, sprint: false, useSmoke: false };
      stepWorld(world, idle);
    }
    return { screen: name === 'hideout' ? SCREEN_HIDEOUT : SCREEN_TITLE, best: 2450 };
  }
  if (name === 'briefing') {
    loadLevel(world, 0);
    return { screen: SCREEN_BRIEFING, best: 0 };
  }
  if (name === 'play' || name === 'play2' || name === 'play3') {
    loadLevel(world, levelIndex);
    runAutopilot(world, PLAY_SECONDS);
    if (world.over) {
      // The demo driver was caught: run it again, shorter, from a fresh heist.
      loadLevel(world, levelIndex);
      runAutopilot(world, 25);
    }
    // A near miss, made by the real rules: a guard's cone is widest when
    // it walks an open stretch of its patrol, so find the most open cone
    // across every guard's waypoints, stage that guard there, put Wren just
    // inside its cone at a spot with a clear line of sight, let the guard
    // raise the alarm, then let Wren sprint away. The frame is the chase
    // itself — a red cone, a "!" over the guard, a rising alarm, and Wren
    // escaping.
    const inFrame = (g) => g.x > 150 && g.x < 1130 && g.y > 150 && g.y < 570;
    let bestSpot = null;
    for (const guard of world.guards) {
      for (let w = 0; w < guard.waypoints.length; w += 1) {
        const wp = guard.waypoints[w];
        if (!inFrame(wp)) continue;
        const next = guard.waypoints[(w + 1) % guard.waypoints.length];
        const angle = Math.atan2(next.y - wp.y, next.x - wp.x);
        const probe = { ...guard, x: wp.x, y: wp.y, angle };
        const area = coneArea(probe, world.level.walls, world.smokes);
        if (!bestSpot || area > bestSpot.area) bestSpot = { guard, waypointIndex: w, angle, area };
      }
    }
    let chaser = null;
    if (bestSpot) {
      const { guard, waypointIndex, angle } = bestSpot;
      const wp = guard.waypoints[waypointIndex];
      guard.x = wp.x;
      guard.y = wp.y;
      guard.angle = angle;
      guard.waypointIndex = (waypointIndex + 1) % guard.waypoints.length;
      guard.state = 'patrol';
      guard.suspicion = 0;
      guard.waitTimer = 3.0; // wait at the waypoint, glancing around: the
      // guard stays put while its cone sweeps, so Wren can be seen and the
      // alarm raised without the guard walking into her first — a guard
      // that walks toward a standing player catches her before it alerts.
      // A point along one of the guard's cone rays, inside the raycast-clipped
      // cone, is in the cone with a clear line of sight by construction.
      // Put Wren about 120 px out, a little ahead of the glance sweep (ray
      // ~17 of 23, about +20 degrees off centre), and out of the shadows:
      // the guard waits while its suspicion climbs to 55, then walks in at
      // ~105 px/s while it climbs the last 45 — from 120 px it closes ~75
      // and alerts with room to spare; from 70 px it catches her first.
      const poly = conePolygon(guard, world.level.walls, world.smokes);
      const rayIndexes = [17, 18, 16, 19, 15, 20, 14, 21, 13];
      let placed = false;
      for (const rayIndex of rayIndexes) {
        if (placed) break;
        const tip = poly[1 + rayIndex];
        if (!tip) continue;
        const rayLen = Math.hypot(tip.x - guard.x, tip.y - guard.y);
        for (const want of [120, 110, 130, 100, 140]) {
          if (want > rayLen) continue;
          const frac = want / rayLen;
          const x = guard.x + (tip.x - guard.x) * frac;
          const y = guard.y + (tip.y - guard.y) * frac;
          // Keep the moment clear of the HUD bar, the visibility panel and the minimap.
          if (x < 30 || x > 1040 || y < 150 || y > 580) continue;
          if (inDark(x, y, world.level.dark)) continue;
          if (!inCone(guard, x, y)) continue;
          if (!hasLineOfSight(guard.x, guard.y, x, y, world.level.walls, world.smokes)) continue;
          world.player.x = x;
          world.player.y = y;
          placed = true;
          break;
        }
      }
      if (placed) chaser = guard;
    }
    if (chaser) {
      // Let the guard spot Wren and raise the alarm. The guard is waiting,
      // so it cannot close the gap while its suspicion climbs.
      for (let i = 0; i < 2.5 / STEP && chaser.suspicion < 100; i += 1) {
        stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
        if (world.over) break;
      }
      // Then Wren sprints away from the guard: faster than the chase, so
      // the frame shows the escape, not a capture. The direction is picked
      // fresh each step so she runs down open floor, not into a wall.
      if (!world.over) {
        for (let i = 0; i < 0.9 / STEP; i += 1) {
          stepWorld(world, fleeInput(world, chaser));
          if (world.over) break;
        }
      }
    }
    return { screen: SCREEN_PLAY, best: 2450 };
  }
  if (name === 'upgrade') {
    // Finish heist 1 for real: grab the target, walk the exit, then choose.
    // The heist took a realistic 1:45, so the score breakdown reads true.
    loadLevel(world, 0);
    world.time = 105;
    world.player.x = world.level.target.x;
    world.player.y = world.level.target.y;
    stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
    world.player.x = world.level.exit.x;
    world.player.y = world.level.exit.y;
    stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
    const choices = [UPGRADES[0], UPGRADES[1], UPGRADES[4]];
    return { screen: SCREEN_UPGRADE, best: 2450, choices, selected: 1 };
  }
  if (name === 'win' || name === 'win2') {
    loadLevel(world, levelIndex);
    // A clean run: take some loot, the target, and reach the exit unseen.
    // The heist took a realistic 1:45, so the score breakdown reads true.
    world.time = 105;
    for (const piece of world.loot.slice(0, 3)) {
      world.player.x = piece.x;
      world.player.y = piece.y;
      stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
    }
    world.player.x = world.level.target.x;
    world.player.y = world.level.target.y;
    stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
    world.player.x = world.level.exit.x;
    world.player.y = world.level.exit.y;
    stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
    return { screen: SCREEN_HEIST_DONE, best: 2450 };
  }
  if (name === 'caught') {
    loadLevel(world, 0);
    // Put Wren right in front of a guard that has already raised the alarm,
    // then stand still: the chase closes in and the catch is real.
    const guard = world.guards[0];
    world.player.x = guard.x + 70;
    world.player.y = guard.y;
    guard.suspicion = 100;
    guard.state = 'alert';
    guard.lastSeen = { x: world.player.x, y: world.player.y };
    for (let i = 0; i < 10 / STEP; i += 1) {
      const events = stepWorld(world, { up: false, down: false, left: false, right: false, sneak: false, sprint: false, useSmoke: false });
      if (events & EVENT_CAUGHT) break;
    }
    return { screen: SCREEN_CAUGHT, best: 2450 };
  }
  if (name === 'run') {
    loadLevel(world, 2);
    world.heistScores = [
      { level: 'The Marble Museum', loot: 1240, timeBonus: 420, ghost: 500, sweep: 300, total: 2460 },
      { level: 'The Gilded Casino', loot: 1980, timeBonus: 300, ghost: 0, sweep: 0, total: 2280 },
      { level: 'The Sky Gallery', loot: 2310, timeBonus: 480, ghost: 500, sweep: 300, total: 3590 },
    ];
    world.score = 8330;
    world.banked = 5530;
    return { screen: SCREEN_RUN_DONE, best: 8330 };
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
