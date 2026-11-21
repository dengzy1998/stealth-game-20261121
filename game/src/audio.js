// SHADOWLINE audio: every sound is synthesised in code with WebAudio —
// no audio files, no network. Footsteps tick left or right, coins blip,
// smoke whooshes, and an alert stings. Everything is guarded so the game
// runs silent when the browser has not given us an audio context yet.

let ctx = null;
let master = null;
let muted = false;

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = value ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

// Create the audio context on the first user gesture. Called from the
// key handler, never on page load, so autoplay rules never bite.
export function ensureAudio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// A short blip at a frequency, with a quick fade.
function blip(freq, duration, type, volume, when = 0) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// Filtered noise: the raw material of footsteps, smoke and alarms.
function noiseBurst(duration, filterFreq, volume, pan = 0, when = 0) {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  const panner =
    ctx.createStereoPanner !== undefined ? ctx.createStereoPanner() : null;
  source.connect(filter);
  filter.connect(gain);
  if (panner) {
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(master);
  } else {
    gain.connect(master);
  }
  source.start(t);
}

// A guard's footstep: a soft tick, panned by where the guard stands
// relative to Wren, so the ears know what the eyes have not seen yet.
export function playStep(pan) {
  noiseBurst(0.06, 900, 0.12, pan);
}

// A loot pickup: two bright notes, up.
export function playPickup() {
  blip(880, 0.09, 'sine', 0.2);
  blip(1318, 0.12, 'sine', 0.18, 0.07);
}

// A smoke pellet: a low whoosh.
export function playSmoke() {
  noiseBurst(0.5, 420, 0.25);
}

// A guard's suspicion turning to a full alert: a sharp two-note sting.
export function playAlert() {
  blip(220, 0.16, 'square', 0.16);
  blip(165, 0.3, 'square', 0.16, 0.12);
}

// Caught: a low falling note.
export function playCaught() {
  blip(330, 0.5, 'sawtooth', 0.18);
  blip(196, 0.7, 'sawtooth', 0.16, 0.15);
}

// A heist finished: a small rising arpeggio.
export function playWin() {
  blip(523, 0.12, 'sine', 0.2);
  blip(659, 0.12, 'sine', 0.2, 0.1);
  blip(784, 0.2, 'sine', 0.2, 0.2);
}

// A soft UI click for menus.
export function playClick() {
  blip(660, 0.05, 'sine', 0.12);
}
