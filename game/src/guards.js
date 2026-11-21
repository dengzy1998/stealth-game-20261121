// Guard AI: patrol, suspicion, investigation, chase, search, return.
// A guard's suspicion of the player rises while the player is visible in
// its cone (faster up close, in light, and when the player runs; slower in
// shadow, while sneaking, and through distance) and drains when unseen.
// At the suspicious threshold the guard walks to the last seen spot; at
// full suspicion it raises the alarm and chases. A chase that loses the
// player turns into a search, then the guard goes back to its patrol.
import { ALARM, DETECT, GUARD, WARDEN } from './config.js';
import { hasLineOfSight, inBush, inCone, inDark } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

export function createGuard(def, index) {
  const first = def.waypoints[0];
  return {
    index,
    warden: Boolean(def.warden),
    waypoints: def.waypoints.map(([col, row]) => ({ x: col * 40 + 20, y: row * 40 + 20 })),
    pause: def.pause,
    x: first[0] * 40 + 20,
    y: first[1] * 40 + 20,
    angle: 0,
    waypointIndex: 1,
    waitTimer: 0,
    state: GUARD_PATROL,
    suspicion: 0,
    lastSeen: null,
    lookTimer: 0,
    chaseTimer: 0,
    searchPoint: null,
    speed: 0,
    stepTimer: 0,
    heardNoise: null,
  };
}

function guardSpeed(guard, alarmHot) {
  const base = guard.warden ? WARDEN : GUARD;
  if (guard.state === GUARD_ALERT) return base.chaseSpeed;
  if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH) return base.investigateSpeed;
  return base.patrolSpeed * (alarmHot ? 1.25 : 1);
}

/** Move toward (tx,ty) at `speed`, sliding along walls; returns true on arrival. */
export function moveToward(guard, tx, ty, speed, dt, walls) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  guard.angle = Math.atan2(dy, dx);
  if (!hitsWall(nx, guard.y, GUARD.radius, walls)) guard.x = nx;
  if (!hitsWall(guard.x, ny, GUARD.radius, walls)) guard.y = ny;
  return Math.hypot(tx - guard.x, ty - guard.y) < 3;
}

function hitsWall(x, y, radius, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    if (Math.hypot(x - cx, y - cy) < radius) return true;
  }
  return false;
}

/**
 * One guard's step. `player` carries x, y, stance ('walk' | 'sneak' | 'sprint')
 * and hidden (in a bush while sneaking). Returns 'caught' when this guard
 * touches the player, 'alerted' the moment it first goes alert, else null.
 */
export function stepGuard(guard, dt, world) {
  const { player, level, smokes, alarm } = world;
  const base = guard.warden ? WARDEN : GUARD;
  const alarmHot = alarm >= ALARM.hotAt;
  let event = null;

  // --- Seeing: is the player in the cone, with a clear line, right now? ---
  const hidden = player.hidden;
  const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
  let seen = false;
  let rate = 0;
  if (!hidden || dist < GUARD.hiddenSpotRange) {
    if (inCone(guard, player.x, player.y) && hasLineOfSight(guard.x, guard.y, player.x, player.y, level.walls, smokes)) {
      seen = true;
      rate = base.detectRate;
      rate *= 1 / (1 + Math.max(0, dist - DETECT.falloffRange) / DETECT.falloffRange);
      if (inDark(player.x, player.y, level.dark)) rate *= DETECT.inShadow;
      if (player.stance === 'sneak') rate *= DETECT.sneaking;
      else if (player.stance === 'sprint') rate *= DETECT.sprinting;
      if (world.upgrades.has('cloak')) rate *= 0.75;
    }
  }

  if (seen) {
    guard.suspicion = Math.min(GUARD.alertAt, guard.suspicion + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.chaseTimer = GUARD.chaseMemory;
    if (guard.suspicion >= GUARD.alertAt && guard.state !== GUARD_ALERT) {
      guard.state = GUARD_ALERT;
      event = 'alerted';
    } else if (guard.suspicion >= GUARD.suspiciousAt && guard.state === GUARD_PATROL) {
      guard.state = GUARD_SUSPICIOUS;
    }
  } else {
    const decay = GUARD.suspicionDecay * (alarmHot ? 0.6 : 1) * (guard.state === GUARD_ALERT ? 0.35 : 1);
    guard.suspicion = Math.max(0, guard.suspicion - decay * dt);
    if (guard.state === GUARD_ALERT) {
      guard.chaseTimer -= dt;
      if (guard.chaseTimer <= 0) {
        guard.state = GUARD_SEARCH;
        guard.searchPoint = guard.lastSeen ? { ...guard.lastSeen } : { x: guard.x, y: guard.y };
        guard.lookTimer = GUARD.lookAroundTime;
      }
    }
    if (guard.state === GUARD_SUSPICIOUS && guard.suspicion < GUARD.suspiciousAt * 0.5) {
      guard.state = GUARD_RETURN;
    }
  }

  // --- Hearing: a noise pulse the guard can hear pulls it to investigate. ---
  if (guard.heardNoise && guard.state === GUARD_PATROL) {
    guard.state = GUARD_SUSPICIOUS;
    guard.lastSeen = { ...guard.heardNoise };
    guard.heardNoise = null;
  }

  // --- Moving, by state. ---
  const speed = guardSpeed(guard, alarmHot);
  guard.speed = speed;
  if (guard.state === GUARD_PATROL) {
    const target = guard.waypoints[guard.waypointIndex];
    if (guard.waitTimer > 0) {
      guard.waitTimer -= dt;
      guard.angle += dt * 0.6; // glance around while waiting
    } else if (moveToward(guard, target.x, target.y, speed, dt, level.walls)) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.waitTimer = guard.pause;
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    const spot = guard.lastSeen || guard.waypoints[guard.waypointIndex];
    if (moveToward(guard, spot.x, spot.y, speed, dt, level.walls)) {
      guard.lookTimer -= dt;
      guard.angle += dt * 1.4; // scan the area
      if (guard.lookTimer <= 0) {
        guard.state = GUARD_RETURN;
        guard.lookTimer = GUARD.lookAroundTime;
      }
    } else {
      guard.lookTimer = GUARD.lookAroundTime;
    }
  } else if (guard.state === GUARD_ALERT) {
    const spot = guard.lastSeen || { x: player.x, y: player.y };
    moveToward(guard, spot.x, spot.y, speed, dt, level.walls);
  } else if (guard.state === GUARD_SEARCH) {
    if (moveToward(guard, guard.searchPoint.x, guard.searchPoint.y, speed, dt, level.walls)) {
      guard.lookTimer -= dt;
      guard.angle += dt * 1.8;
      if (guard.lookTimer <= 0) guard.state = GUARD_RETURN;
    }
  } else if (guard.state === GUARD_RETURN) {
    // Walk back to the nearest patrol waypoint, then resume the loop.
    let nearest = guard.waypoints[0];
    let best = Infinity;
    for (const w of guard.waypoints) {
      const d = Math.hypot(w.x - guard.x, w.y - guard.y);
      if (d < best) { best = d; nearest = w; }
    }
    if (moveToward(guard, nearest.x, nearest.y, speed, dt, level.walls)) {
      guard.waypointIndex = guard.waypoints.indexOf(nearest);
      guard.state = GUARD_PATROL;
    }
  }

  // --- Footsteps: a soft tick the player can hear, faster when the guard hurries. ---
  guard.stepTimer -= dt;
  if (guard.stepTimer <= 0 && guard.speed > 0) {
    guard.stepTimer = guard.state === GUARD_ALERT ? 0.3 : 0.55;
    world.guardSteps.push({ x: guard.x, y: guard.y, warden: guard.warden, alert: guard.state === GUARD_ALERT });
  }

  // --- Caught: a guard that reaches the player ends the heist. ---
  if (Math.hypot(player.x - guard.x, player.y - guard.y) < base.catchDistance) return 'caught';
  return event;
}

/** A guard's alertness as 0..1 for the HUD and the cone colour. */
export function guardAlertness(guard) {
  return guard.suspicion / GUARD.alertAt;
}
