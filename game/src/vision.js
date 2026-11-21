// SHADOWLINE vision: line of sight, vision cones, and the two kinds of
// floor that change what a guard can see — bushes that hide Wren and
// shadows that slow a guard's eyes.

import { DETECT, VIEW } from './config.js';
import { isWallTile } from './levels.js';

// The tile character at a pixel position, or '#' outside the floor.
export function tileAt(world, x, y) {
  const tx = Math.floor(x / VIEW.tile);
  const ty = Math.floor(y / VIEW.tile);
  if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return '#';
  return world.tiles[ty][tx];
}

export function isWallAt(world, x, y) {
  return isWallTile(tileAt(world, x, y));
}

export function inBush(world, x, y) {
  return tileAt(world, x, y) === 'B';
}

export function inDark(world, x, y) {
  return tileAt(world, x, y) === 'd';
}

// Is a point inside any smoke cloud?
export function inSmoke(world, x, y) {
  for (const cloud of world.smoke) {
    const dx = x - cloud.x;
    const dy = y - cloud.y;
    if (dx * dx + dy * dy < cloud.radius * cloud.radius) return true;
  }
  return false;
}

// True when nothing blocks the straight line between two points: no wall
// and no smoke cloud in the way. Sampled every 6 px so a thin wall can
// never be stepped over.
export function hasLineOfSight(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    if (isWallAt(world, x, y)) return false;
    if (inSmoke(world, x, y)) return false;
  }
  return true;
}

// Smallest absolute difference between two angles, in radians.
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Is the player inside this guard's vision cone, with a clear line of
// sight? Range, angle and walls all have to agree.
export function inCone(world, guard, px, py) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > guard.viewRange) return false;
  if (dist > 1 && angleDiff(Math.atan2(dy, dx), guard.dir) > guard.halfAngle) {
    return false;
  }
  return hasLineOfSight(world, guard.x, guard.y, px, py);
}

// How fast this guard's suspicion climbs while Wren is visible, per
// second. Closer is faster; shadow and sneaking slow it; sprinting and
// bright light speed it up; a guard that can barely see her at all
// barely suspects her.
export function detectRateFor(world, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  let rate = guard.detectRate;
  rate *= 1 / (1 + Math.max(0, dist - 80) / 80);
  if (inDark(world, player.x, player.y)) rate *= DETECT.shadow;
  else rate *= DETECT.light;
  if (player.stance === 'sneak') rate *= DETECT.sneak;
  if (player.stance === 'sprint') rate *= DETECT.sprint;
  if (inBush(world, player.x, player.y)) {
    rate *= dist < DETECT.bushReveal ? 1 : DETECT.bush;
  }
  if (world.alarm >= 60) rate *= 1.25;
  // The Shadow Cloak gadget: every guard notices Wren slower.
  if (world.modifiers && world.modifiers.detect) rate *= world.modifiers.detect;
  return rate;
}

// The guard's cone as a polygon, raycast-clipped by walls and smoke, for
// rendering and for measuring how open a cone is. 23 rays across the arc.
export function conePolygon(world, guard) {
  const rays = 23;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i < rays; i++) {
    const t = rays === 1 ? 0 : i / (rays - 1);
    const angle = guard.dir - guard.halfAngle + t * guard.halfAngle * 2;
    const hit = castRay(world, guard.x, guard.y, angle, guard.viewRange);
    points.push(hit);
  }
  return points;
}

// March a ray from a point until it hits a wall, a smoke cloud, or the
// range limit. Returns the stopping point.
export function castRay(world, x, y, angle, range) {
  const step = 6;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let px = x;
  let py = y;
  for (let d = step; d <= range; d += step) {
    px = x + cos * d;
    py = y + sin * d;
    if (isWallAt(world, px, py) || inSmoke(world, px, py)) {
      return { x: px, y: py };
    }
  }
  return { x: x + cos * range, y: y + sin * range };
}

// A walkable path across the floor, by Dijkstra over open tiles (four
// directions only, so a straight line between two path nodes never clips
// a wall). Returns tile-centre points from the start tile to the target
// tile, start excluded — or null when there is no route. The cost of a
// tile is not just 1: tiles near a guard, and tiles inside a guard's
// cone, cost more, so the route bends around patrols instead of walking
// up to a guard on the shortest line. The cone test here is angle-only
// (no line of sight): it is a routing heuristic, not a vision test, and
// it has to stay cheap because the autopilot re-plans every step.
export function findTilePath(world, sx, sy, tx, ty) {
  const startX = Math.floor(sx / VIEW.tile);
  const startY = Math.floor(sy / VIEW.tile);
  const goalX = Math.floor(tx / VIEW.tile);
  const goalY = Math.floor(ty / VIEW.tile);
  if (startX === goalX && startY === goalY) return [{ x: tx, y: ty }];
  const key = (x, y) => `${x},${y}`;
  const tileCost = (x, y) => {
    const cx = x * VIEW.tile + VIEW.tile / 2;
    const cy = y * VIEW.tile + VIEW.tile / 2;
    let cost = 1;
    for (const guard of world.guards) {
      const dx = cx - guard.x;
      const dy = cy - guard.y;
      const d = Math.hypot(dx, dy);
      if (d < 220) cost += (220 - d) * 0.03;
      if (d < guard.viewRange) {
        const ang = Math.atan2(dy, dx);
        if (Math.abs(angleDiff(ang, guard.dir)) < guard.halfAngle) cost += 6;
      }
    }
    return cost;
  };
  const dist = new Map();
  const prev = new Map();
  const open = [[0, startX, startY]];
  dist.set(key(startX, startY), 0);
  prev.set(key(startX, startY), null);
  while (open.length > 0) {
    let bestI = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i][0] < open[bestI][0]) bestI = i;
    }
    const [d, x, y] = open.splice(bestI, 1)[0];
    if (d > dist.get(key(x, y))) continue;
    if (x === goalX && y === goalY) {
      const nodes = [];
      let cur = [x, y];
      while (cur) {
        nodes.push(cur);
        cur = prev.get(key(cur[0], cur[1]));
      }
      nodes.reverse();
      nodes.shift();
      return nodes.map(([nx, ny]) => ({
        x: nx * VIEW.tile + VIEW.tile / 2,
        y: ny * VIEW.tile + VIEW.tile / 2,
        tx: nx,
        ty: ny,
      }));
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= world.cols || ny >= world.rows) continue;
      if (isWallTile(world.tiles[ny][nx])) continue;
      const nd = d + tileCost(nx, ny);
      if (nd < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), nd);
        prev.set(key(nx, ny), [x, y]);
        open.push([nd, nx, ny]);
      }
    }
  }
  return null;
}
export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
