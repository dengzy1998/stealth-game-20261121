// SHADOWLINE player: Wren. Three stances — walk, sneak, sprint — each
// with its own speed and noise, plus smoke pellets and wall collision.

import { PLAYER, SMOKE, VIEW } from './config.js';
import { isWallAt } from './vision.js';
import { emitNoise } from './noise.js';

// Build Wren at a tile position, facing up the room.
export function makePlayer(x, y, modifiers) {
  return {
    x,
    y,
    dir: -Math.PI / 2,
    stance: 'walk',
    radius: PLAYER.radius,
    smokeLeft: SMOKE.startCount + (modifiers.extraSmoke || 0),
    smokeTimer: 0,
    sprintNoiseTimer: 0,
    moving: false,
    modifiers,
  };
}

// Speed for the current stance, with the Swift Step gadget applied.
export function playerSpeed(player) {
  const mult = player.modifiers.speed || 1;
  if (player.stance === 'sneak') return 95 * mult * (player.modifiers.sneakSpeed || 1);
  if (player.stance === 'sprint') return 265 * mult;
  return 165 * mult;
}

// One fixed step. `input` is {x, y, sneak, sprint, smoke} with x/y a
// unit-ish movement vector. Returns true when a smoke pellet was thrown.
export function updatePlayer(world, player, input, dt) {
  player.stance = input.sprint ? 'sprint' : input.sneak ? 'sneak' : 'walk';
  const speed = playerSpeed(player);
  const len = Math.hypot(input.x, input.y);
  player.moving = len > 0.05;
  if (player.moving) {
    const nx = input.x / (len || 1);
    const ny = input.y / (len || 1);
    player.dir = Math.atan2(ny, nx);
    moveWithWalls(world, player, nx * speed * dt, ny * speed * dt);
  }

  // Sprinting rings out: a noise pulse every third of a second.
  if (player.stance === 'sprint' && player.moving) {
    player.sprintNoiseTimer -= dt;
    if (player.sprintNoiseTimer <= 0) {
      player.sprintNoiseTimer = 0.35;
      const radius = 170 * (player.modifiers.sprintNoise || 1);
      emitNoise(world, player.x, player.y, radius);
      world.onNoise(player.x, player.y, radius);
    }
  }

  if (player.smokeTimer > 0) player.smokeTimer -= dt;

  // Smoke pellet: E throws one at Wren's feet if any are left.
  if (input.smoke && player.smokeLeft > 0 && player.smokeTimer <= 0) {
    player.smokeLeft--;
    player.smokeTimer = 0.4;
    world.smoke.push({
      x: player.x,
      y: player.y,
      radius: SMOKE.radius,
      life: SMOKE.duration,
      maxLife: SMOKE.duration,
    });
    world.onSmoke();
    return true;
  }
  return false;
}

// True when a circle of radius r can sit at (x, y) without overlapping a
// wall tile: the distance from the centre to the nearest point of every
// wall tile it overlaps must clear the radius.
export function circleClear(world, x, y, r) {
  const x0 = Math.floor((x - r) / VIEW.tile);
  const x1 = Math.floor((x + r) / VIEW.tile);
  const y0 = Math.floor((y - r) / VIEW.tile);
  const y1 = Math.floor((y + r) / VIEW.tile);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= world.cols || ty >= world.rows) return false;
      if (world.tiles[ty][tx] !== '#') continue;
      const cx = Math.max(tx * VIEW.tile, Math.min(x, tx * VIEW.tile + VIEW.tile));
      const cy = Math.max(ty * VIEW.tile, Math.min(y, ty * VIEW.tile + VIEW.tile));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return false;
    }
  }
  return true;
}

// Move a circle through the walls, one axis at a time, so Wren slides
// along a wall instead of sticking to it. A blocked step tries a small
// perpendicular nudge first, so a circle rounds a corner instead of
// wedging on it.
export function moveWithWalls(world, entity, dx, dy) {
  const r = entity.radius;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      if (circleClear(world, entity.x + sx, entity.y, r)) {
        entity.x += sx;
      } else {
        // Blocked sideways: try sliding up or down around the corner.
        for (const n of [3, -3]) {
          if (circleClear(world, entity.x + sx, entity.y + n, r)) {
            entity.y += n;
            entity.x += sx;
            break;
          }
        }
      }
    }
    if (sy !== 0) {
      if (circleClear(world, entity.x, entity.y + sy, r)) {
        entity.y += sy;
      } else {
        for (const n of [3, -3]) {
          if (circleClear(world, entity.x + n, entity.y + sy, r)) {
            entity.x += n;
            entity.y += sy;
            break;
          }
        }
      }
    }
  }
  entity.x = Math.max(r + 2, Math.min(VIEW.width - r - 2, entity.x));
  entity.y = Math.max(r + 2, Math.min(VIEW.height - r - 2, entity.y));
}

// Move an entity toward a point at a speed, through the walls. Returns
// the distance left to the point afterwards.
export function moveToward(world, entity, tx, ty, speed, dt) {
  const dx = tx - entity.x;
  const dy = ty - entity.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return dist;
  const step = Math.min(dist, speed * dt);
  moveWithWalls(world, entity, (dx / dist) * step, (dy / dist) * step);
  return Math.hypot(tx - entity.x, ty - entity.y);
}
