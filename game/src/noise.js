// SHADOWLINE noise: pulses that travel across the floor and draw guards
// to investigate, plus the fading rings the renderer draws for footsteps
// and sprinting.

// A noise pulse at a point with a radius. Guards that hear it walk over
// to look at where it came from.
export function emitNoise(world, x, y, radius) {
  world.noise.push({ x, y, radius, life: 0.9, maxLife: 0.9, heard: false });
}

// A footstep ring, purely visual: it fades out where the step landed.
export function emitRing(world, x, y, radius, strong) {
  world.rings.push({ x, y, radius, life: 0.7, maxLife: 0.7, strong: !!strong });
}

// One fixed step of the noise system: age the pulses and rings, and let
// any guard that can hear a fresh pulse go and look at it.
export function updateNoise(world, dt) {
  for (const pulse of world.noise) pulse.life -= dt;
  world.noise = world.noise.filter((p) => p.life > 0);
  for (const ring of world.rings) ring.life -= dt;
  world.rings = world.rings.filter((r) => r.life > 0);

  for (const pulse of world.noise) {
    if (pulse.heard) continue;
    pulse.heard = true;
    for (const guard of world.guards) {
      if (guard.state === 'alert') continue;
      const dist = Math.hypot(guard.x - pulse.x, guard.y - pulse.y);
      if (dist < 220) {
        guard.lastSeenX = pulse.x;
        guard.lastSeenY = pulse.y;
        if (guard.state === 'patrol' || guard.state === 'return') {
          guard.state = 'suspicious';
          guard.stateTimer = 0;
          guard.suspicion = Math.max(guard.suspicion, 30);
        }
      }
    }
  }
}
