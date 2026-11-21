// Sound, all synthesised in code — no audio files. Footsteps are short
// filtered noise ticks (softer when sneaking, louder when sprinting);
// guards' steps are lower ticks panned toward where the guard is; pickups
// chime, alarms sting, and a low drone hums under the title screen.
export function createAudio() {
  const audio = {
    context: null,
    master: null,
    muted: false,
    droneNodes: null,
    ensure() {
      if (audio.context) {
        if (audio.context.state === 'suspended') audio.context.resume().catch(() => {});
        return;
      }
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        audio.context = new Ctor();
        audio.master = audio.context.createGain();
        audio.master.gain.value = 0.5;
        audio.master.connect(audio.context.destination);
      } catch {
        audio.context = null;
      }
    },
    setMuted(muted) {
      audio.muted = muted;
      if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
    },
    tick(freq, duration, volume, type = 'sine') {
      if (!audio.context || audio.muted) return;
      const now = audio.context.currentTime;
      const osc = audio.context.createOscillator();
      const gain = audio.context.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain).connect(audio.master);
      osc.start(now);
      osc.stop(now + duration);
    },
    noiseTick(volume, pan, lowpass = 900) {
      if (!audio.context || audio.muted) return;
      const now = audio.context.currentTime;
      const length = Math.floor(audio.context.sampleRate * 0.07);
      const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = audio.context.createBufferSource();
      source.buffer = buffer;
      const filter = audio.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = audio.context.createGain();
      gain.gain.value = volume;
      const panner = audio.context.createStereoPanner ? audio.context.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        source.connect(filter).connect(gain).connect(panner).connect(audio.master);
      } else {
        source.connect(filter).connect(gain).connect(audio.master);
      }
      source.start(now);
    },
    /** The player's own step: pan 0 (centred), volume by stance. */
    footstep(stance) {
      if (stance === 'sneak') audio.noiseTick(0.05, 0, 500);
      else if (stance === 'sprint') audio.noiseTick(0.22, 0, 1100);
      else audio.noiseTick(0.11, 0, 800);
    },
    /** A guard's step, panned toward the guard's screen position. */
    guardStep(pan, alert) {
      audio.noiseTick(alert ? 0.16 : 0.08, pan, alert ? 700 : 420);
    },
    pickup() {
      audio.tick(880, 0.12, 0.16);
      setTimeout(() => audio.tick(1318, 0.18, 0.14), 70);
    },
    target() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => audio.tick(f, 0.22, 0.15), i * 90));
    },
    alert() {
      audio.tick(196, 0.25, 0.22, 'sawtooth');
      setTimeout(() => audio.tick(147, 0.35, 0.22, 'sawtooth'), 160);
    },
    caught() {
      [330, 262, 196, 131].forEach((f, i) => setTimeout(() => audio.tick(f, 0.3, 0.2, 'triangle'), i * 130));
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => audio.tick(f, 0.3, 0.14), i * 100));
    },
    click() {
      audio.tick(660, 0.06, 0.1);
    },
    startDrone() {
      if (!audio.context || audio.muted || audio.droneNodes) return;
      const osc = audio.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const osc2 = audio.context.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 55.7;
      const gain = audio.context.createGain();
      gain.gain.value = 0.05;
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(audio.master);
      osc.start();
      osc2.start();
      audio.droneNodes = { osc, osc2, gain };
    },
    stopDrone() {
      if (!audio.droneNodes) return;
      try {
        audio.droneNodes.osc.stop();
        audio.droneNodes.osc2.stop();
      } catch { /* already stopped */ }
      audio.droneNodes = null;
    },
  };
  return audio;
}
