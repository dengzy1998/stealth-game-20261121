// SHADOWLINE input: the keyboard, read fresh every frame. Movement keys
// give a direction vector; action keys are edge-triggered, so holding E
// throws one smoke pellet, not a whole cloud of them.

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyC: 'sneak',
  ControlLeft: 'sneak',
  ControlRight: 'sneak',
};

export function createInput() {
  return {
    keys: new Set(),
    pressed: new Set(),
    // The last movement direction, for menus that need it.
    lastDir: { x: 0, y: 0 },
  };
}

// Attach listeners to the window. Returns a detach function.
export function attachInput(input, onFirstGesture) {
  let gestured = false;
  const down = (event) => {
    if (!gestured && onFirstGesture) {
      gestured = true;
      onFirstGesture();
    }
    const action = KEYMAP[event.code] || event.code;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
        event.code,
      )
    ) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(action);
    input.keys.add(action);
  };
  const up = (event) => {
    const action = KEYMAP[event.code] || event.code;
    input.keys.delete(action);
  };
  const blur = () => {
    input.keys.clear();
    input.pressed.clear();
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}

// The movement vector for this frame, normalised, plus the stance and
// action edges. Call once per fixed step, then clearEdges.
export function readGameInput(input) {
  let x = 0;
  let y = 0;
  if (input.keys.has('left')) x -= 1;
  if (input.keys.has('right')) x += 1;
  if (input.keys.has('up')) y -= 1;
  if (input.keys.has('down')) y += 1;
  if (x !== 0 || y !== 0) {
    const len = Math.hypot(x, y);
    input.lastDir = { x: x / len, y: y / len };
  }
  return {
    x,
    y,
    sneak: input.keys.has('sneak'),
    sprint: input.keys.has('sprint'),
    smoke: input.pressed.has('KeyE'),
    confirm: input.pressed.has('Space') || input.pressed.has('Enter'),
    pause: input.pressed.has('KeyP') || input.pressed.has('Escape'),
    mute: input.pressed.has('KeyM'),
    hideout: input.pressed.has('KeyH'),
    restart: input.pressed.has('KeyR'),
    choice:
      input.pressed.has('Digit1')
        ? 0
        : input.pressed.has('Digit2')
          ? 1
          : input.pressed.has('Digit3')
            ? 2
            : -1,
  };
}

// Clear the edge-triggered keys after they have been read.
export function clearEdges(input) {
  input.pressed.clear();
}

// True when the key was pressed since the last clearEdges.
export function wasPressed(input, code) {
  return input.pressed.has(code);
}
