// Keyboard and mouse input: WASD or arrows to move, Shift to sprint,
// C or Ctrl to sneak, Space to start/confirm, E for a smoke pellet,
// P or Escape to pause, M to mute. Clicking also confirms on menus.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let clicked = false;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyE') actions |= ACTION_SMOKE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown() {
    clicked = true;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** The held movement keys, as a direction object the world steps with. */
    direction() {
      return {
        up: keys.has('KeyW') || keys.has('ArrowUp'),
        down: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        sneak: keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight'),
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        useSmoke: false,
      };
    },
    /** One-shot actions since the last call (confirm, pause, smoke, mute, click). */
    takeActions() {
      const out = actions | (clicked ? ACTION_CONFIRM : 0);
      actions = 0;
      clicked = false;
      return out;
    },
  };
}
