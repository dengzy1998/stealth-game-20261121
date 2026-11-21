// SHADOWLINE guard AI: patrol, suspicion, investigation, chase, search
// and return. A guard is a little state machine with eyes: suspicion
// climbs while Wren is in the cone, drains while she is not, and the
// state follows the suspicion.

import { GUARD, WARDEN } from './config.js';
import {
  angleDiff,
  detectRateFor,
  findTilePath,
  inBush,
  inCone,
} from './vision.js';
import { moveToward } from './player.js';
import { emitRing } from './noise.js';

// The speed table for a guard or warden, merged from the base guard
// numbers. A warden without its own investigate speed would move at
// undefined px/s the moment it got curious — NaN, and the guard would
// vanish from the floor. Every state has a real number here.
export function guardStats(warden) {
  if (warden) {
    return {
      patrolSpeed: WARDEN.patrolSpeed,
      investigateSpeed: WARDEN.investigateSpeed,
      chaseSpeed: WARDEN.chaseSpeed,
      catchDistance: WARDEN.catchDistance,
      viewRange: WARDEN.viewRange,
      halfAngle: WARDEN.halfAngle,
      detectRate: WARDEN.detectRate,
    };
  }
  return {
    patrolSpeed: GUARD.patrolSpeed,
    investigateSpeed: GUARD.investigateSpeed,
    chaseSpeed: GUARD.chaseSpeed,
    catchDistance: GUARD.catchDistance,
    viewRange: GUARD.viewRange,
    halfAngle: GUARD.halfAngle,
    detectRate: GUARD.detectRate,
  };
}

// Build one guard from a level's patrol definition. Starts at its first
// waypoint, facing the second.
export function makeGuard(def) {
  const stats = guardStats(def.warden);
  const first = def.waypoints[0];
  const second = def.waypoints[1] || first;
  return {
    x: first.x,
    y: first.y,
    dir: Math.atan2(second.y - first.y, second.x - first.x),
    radius: 12,
    warden: def.warden,
    waypoints: def.waypoints,
    waypointIndex: 1,
    state: 'patrol',
    suspicion: 0,
    lastSeenX: first.x,
    lastSeenY: first.y,
    seenTimer: 0,
    waitTimer: 0,
    stateTimer: 0,
    stepTimer: 0,
    alerted: false,
    // The tile path the guard is walking along on patrol, and how far
    // along it it is. A straight line between two waypoints can clip a
    // wall; a tile path never does.
    path: [],
    pathIndex: 0,
    ...stats,
  };
}

// Can this guard see Wren right now? A guard never sees through a bush
// Wren is crouched in unless it is nearly on top of her.
export function guardSeesPlayer(world, guard, player) {
  if (!inCone(world, guard, player.x, player.y)) return false;
  if (inBush(world, player.x, player.y)) {
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (dist > 55) return false;
  }
  return true;
}

// One fixed step of one guard. Returns nothing; mutates the guard and,
// through the world, the alarm and the caught flag.
export function updateGuard(world, guard, player, dt) {
  const sees = guardSeesPlayer(world, guard, player);
  if (sees) {
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
    guard.seenTimer = 0;
    const rate = detectRateFor(world, guard, player);
    guard.suspicion = Math.min(100, guard.suspicion + rate * dt);
  } else {
    guard.seenTimer += dt;
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
  }

  const wasAlert = guard.state === 'alert';
  if (guard.suspicion >= GUARD.alertAt && guard.state !== 'alert') {
    guard.state = 'alert';
    guard.stateTimer = 0;
    if (!guard.alerted) {
      guard.alerted = true;
      world.alarm = Math.min(100, world.alarm + 20);
      world.everSpotted = true;
      world.onAlert();
    }
  } else if (
    guard.suspicion >= GUARD.suspiciousAt &&
    guard.state !== 'alert' &&
    guard.state !== 'suspicious'
  ) {
    guard.state = 'suspicious';
    guard.stateTimer = 0;
  } else if (
    guard.state === 'alert' &&
    guard.seenTimer > GUARD.chaseMemory &&
    guard.suspicion < GUARD.alertAt
  ) {
    guard.state = 'search';
    guard.stateTimer = 0;
  } else if (guard.state === 'suspicious' && guard.suspicion < GUARD.suspiciousAt) {
    guard.state = 'return';
    guard.stateTimer = 0;
  } else if (guard.state === 'search' && guard.stateTimer > GUARD.lookAround) {
    guard.state = 'return';
    guard.stateTimer = 0;
  } else if (guard.state === 'return' && guard.stateTimer > 1.2) {
    guard.state = 'patrol';
    guard.stateTimer = 0;
    guard.alerted = false;
  }
  if (!wasAlert && guard.state === 'alert') {
    guard.stateTimer = 0;
  }
  guard.stateTimer += dt;

  // Move according to state. On patrol (and on the way back) the guard
  // follows a tile path to its waypoint, so it walks the corridors
  // instead of cutting through walls. Chasing and investigating go
  // straight at the last-seen spot, sliding along walls on the way.
  const stepGuard = (tx, ty, speed) => {
    const beforeX = guard.x;
    const beforeY = guard.y;
    const left = moveToward(world, guard, tx, ty, speed, dt);
    const moved = Math.hypot(guard.x - beforeX, guard.y - beforeY);
    if (moved > 0.5) {
      guard.dir = Math.atan2(guard.y - beforeY, guard.x - beforeX);
      guard.stepTimer -= dt;
      if (guard.stepTimer <= 0) {
        guard.stepTimer = guard.state === 'alert' ? 0.28 : 0.45;
        emitRing(world, guard.x, guard.y, guard.state === 'alert' ? 26 : 18, guard.warden);
        const pan = Math.max(-1, Math.min(1, (guard.x - player.x) / 400));
        world.onStep(pan);
      }
    }
    return left;
  };

  if (guard.state === 'patrol' && guard.waitTimer > 0) {
    // Waiting at a waypoint: a slow sweep of the room.
    guard.waitTimer -= dt;
    guard.dir += Math.sin(world.time * 1.4 + guard.waypointIndex) * 0.2 * dt;
  } else if (guard.state === 'patrol' || guard.state === 'return') {
    const wp = guard.waypoints[guard.waypointIndex];
    if (!guard.path || guard.pathTarget !== guard.waypointIndex) {
      guard.path = findTilePath(world, guard.x, guard.y, wp.x, wp.y) || [];
      guard.pathTarget = guard.waypointIndex;
      guard.pathIndex = 0;
    }
    const node = guard.path[guard.pathIndex];
    if (node) {
      const left = stepGuard(node.x, node.y, guard.patrolSpeed);
      if (left < 4) guard.pathIndex++;
    } else if (guard.path.length === 0) {
      // No tile path (the waypoint is not on the floor graph from here):
      // walk straight at it and let the wall sliding sort it out.
      const left = stepGuard(wp.x, wp.y, guard.patrolSpeed);
      if (left < 6) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.path = null;
        if (guard.state === 'patrol') guard.waitTimer = 1.4;
        else {
          guard.state = 'patrol';
          guard.stateTimer = 0;
        }
      }
    } else {
      // Arrived at the waypoint: next one, after a look around.
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.path = [];
      guard.pathIndex = 0;
      if (guard.state === 'patrol') guard.waitTimer = 1.4;
      else {
        guard.state = 'patrol';
        guard.stateTimer = 0;
      }
    }
  } else if (guard.state === 'suspicious' || guard.state === 'search') {
    const left = stepGuard(guard.lastSeenX, guard.lastSeenY, guard.investigateSpeed);
    if (left < 6) {
      // Arrived at the last-seen spot: stand and sweep the room.
      guard.dir += 0.9 * dt;
    }
  } else if (guard.state === 'alert') {
    stepGuard(guard.lastSeenX, guard.lastSeenY, guard.chaseSpeed);
  }

  // Catch: only a guard that has actually spotted Wren can catch her.
  // A patrolling guard that merely bumps into her gets a shock instead:
  // at point-blank range the guard spots her instantly and gives chase.
  const pdx = player.x - guard.x;
  const pdy = player.y - guard.y;
  const pdist = Math.hypot(pdx, pdy);
  if (pdist < 45 && !inBush(world, player.x, player.y) && guard.state !== 'alert') {
    guard.suspicion = 100;
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
  }
  if (
    guard.state === 'alert' &&
    pdist < guard.catchDistance &&
    !inBush(world, player.x, player.y)
  ) {
    world.over = 'caught';
    world.caughtBy = guard.warden ? 'warden' : 'guard';
  }
}

// The mark drawn above a guard's head: '?' while curious, '!' while alert.
export function guardMark(guard) {
  if (guard.state === 'alert') return '!';
  if (guard.state === 'suspicious' || guard.state === 'search') return '?';
  return '';
}
