// The player: Wren, the thief. Walk, sneak or sprint; sprinting is fast
// and loud, sneaking is slow and quiet and lets bushes hide you. Smoke
// pellets (E) drop a cloud no guard can see through.
import { FIELD, PLAYER, SMOKE } from './config.js';
import { inBush, inDark } from './vision.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    angle: 0,
    stance: 'walk', // 'walk' | 'sneak' | 'sprint'
    hidden: false,
    inShadow: false,
    stepTimer: 0,
    smoke: SMOKE.startCount,
    moving: false,
  };
}

/** Move the player by the input direction, sliding along walls and the field edge. */
export function stepPlayer(player, input, dt, level, upgrades) {
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  player.moving = dx !== 0 || dy !== 0;
  player.stance = input.sneak ? 'sneak' : input.sprint ? 'sprint' : 'walk';
  let speed = player.stance === 'sneak' ? PLAYER.sneakSpeed : player.stance === 'sprint' ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (upgrades.has('soft-boots') && player.stance === 'sneak') speed *= 1.25;
  if (upgrades.has('swift')) speed *= 1.12;
  if (!player.moving) {
    player.stepTimer = 0;
    return { noise: 0, stepped: false };
  }
  const len = Math.hypot(dx, dy);
  const nx = player.x + (dx / len) * speed * dt;
  const ny = player.y + (dy / len) * speed * dt;
  player.angle = Math.atan2(dy, dx);
  if (!playerHitsWall(nx, player.y, level.walls)) player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, nx));
  if (!playerHitsWall(player.x, ny, level.walls)) player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, ny));

  // Footstep timing: sprinting steps faster and louder.
  const interval = player.stance === 'sprint' ? PLAYER.stepIntervalSprint : PLAYER.stepIntervalWalk;
  player.stepTimer -= dt;
  let stepped = false;
  if (player.stepTimer <= 0) {
    player.stepTimer = interval;
    stepped = true;
  }
  let noise = player.stance === 'sprint' ? PLAYER.noiseSprint : player.stance === 'sneak' ? PLAYER.noiseSneak : PLAYER.noiseWalk;
  if (upgrades.has('soft-boots')) noise *= 0.7;
  player.hidden = player.stance === 'sneak' && inBush(player.x, player.y, level.bushes);
  player.inShadow = inDark(player.x, player.y, level.dark);
  return { noise, stepped };
}

function playerHitsWall(x, y, walls) {
  const r = PLAYER.radius;
  for (let i = 0; i < walls.length; i += 1) {
    const w = walls[i];
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    if (Math.hypot(x - cx, y - cy) < r) return true;
  }
  return false;
}

/** Drop a smoke pellet at the player's feet; returns false when none are left. */
export function useSmoke(player, smokes) {
  if (player.smoke <= 0) return false;
  player.smoke -= 1;
  smokes.push({ x: player.x, y: player.y, radius: SMOKE.radius, life: SMOKE.life, maxLife: SMOKE.life });
  return true;
}
