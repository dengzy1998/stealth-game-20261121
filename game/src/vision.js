// Vision: what a guard can see. A point is seen when it is inside the
// guard's cone and no wall stands between the guard and the point. Smoke
// clouds block sight too. Bushes and dark floor do not block sight — they
// change how fast the guard believes what it sees (see guards.js).
import { GUARD, WARDEN } from './config.js';

/** True when the segment from (x0,y0) to (x1,y1) crosses no wall rect and no smoke cloud. */
export function hasLineOfSight(x0, y0, x1, y1, walls, smokes) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const x = x0 + (dx * i) / steps;
    const y = y0 + (dy * i) / steps;
    for (let w = 0; w < walls.length; w += 1) {
      const r = walls[w];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return false;
    }
    for (let s = 0; s < smokes.length; s += 1) {
      const c = smokes[s];
      if (Math.hypot(x - c.x, y - c.y) < c.radius) return false;
    }
  }
  return true;
}

/** True when (px,py) lies inside the guard's vision cone (range and angle). */
export function inCone(guard, px, py) {
  const range = guard.warden ? WARDEN.viewRange : GUARD.viewRange;
  const half = guard.warden ? WARDEN.viewHalfAngle : GUARD.viewHalfAngle;
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 4) return true;
  const angle = Math.atan2(dy, dx);
  let diff = angle - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= half;
}

/** The guard's cone corners, for drawing: near point, far-left, far-right. */
export function conePoints(guard) {
  const range = guard.warden ? WARDEN.viewRange : GUARD.viewRange;
  const half = guard.warden ? WARDEN.viewHalfAngle : GUARD.viewHalfAngle;
  return {
    x: guard.x,
    y: guard.y,
    left: { x: guard.x + Math.cos(guard.angle - half) * range, y: guard.y + Math.sin(guard.angle - half) * range },
    right: { x: guard.x + Math.cos(guard.angle + half) * range, y: guard.y + Math.sin(guard.angle + half) * range },
  };
}

/** True when (x,y) is on a dark floor tile: detection there is slower. */
export function inDark(x, y, darkTiles) {
  for (let i = 0; i < darkTiles.length; i += 1) {
    const t = darkTiles[i];
    if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) return true;
  }
  return false;
}

/** True when (x,y) is inside a bush: a sneaking player there is invisible. */
export function inBush(x, y, bushes) {
  for (let i = 0; i < bushes.length; i += 1) {
    const t = bushes[i];
    if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) return true;
  }
  return false;
}
