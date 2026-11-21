// Noise: every footstep the player makes while sprinting (and, faintly,
// while walking) is a pulse guards can hear. A guard inside the pulse's
// reach walks over to investigate the spot it came from.
import { NOISE } from './config.js';

/** A fresh noise pulse at (x,y) with the given radius, or null when silent. */
export function makeNoise(x, y, radius) {
  if (radius <= 0) return null;
  return { x, y, radius, life: NOISE.pulseLife, maxLife: NOISE.pulseLife };
}

/** Age the pulses and wake any guard close enough to hear one. */
export function stepNoise(pulses, guards, dt) {
  for (let i = pulses.length - 1; i >= 0; i -= 1) {
    const p = pulses[i];
    p.life -= dt;
    if (p.life <= 0) {
      pulses.splice(i, 1);
      continue;
    }
    for (const guard of guards) {
      if (guard.state !== 'patrol') continue;
      const dist = Math.hypot(guard.x - p.x, guard.y - p.y);
      if (dist < p.radius + NOISE.hearBonus) guard.heardNoise = { x: p.x, y: p.y };
    }
  }
}
