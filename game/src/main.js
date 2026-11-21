// SHADOWLINE boot: the game loop, the screens, and the screenshot mode.
// With ?shot= in the URL the game stages one scene, draws one frame and
// stops, so the screenshot harness captures exactly that frame.

import { VIEW, GADGETS, HIDEOUT } from './config.js';
import { LEVELS, countForces } from './levels.js';
import {
  buyHideout,
  chooseGadget,
  createRun,
  createWorld,
  loadSave,
  stepWorld,
  storeSave,
  upgradeChoices,
} from './world.js';
import {
  attachInput,
  clearEdges,
  createInput,
  readGameInput,
} from './input.js';
import {
  drawBriefing,
  drawCaught,
  drawComplete,
  drawFinal,
  drawHideout,
  drawPaused,
  drawTitle,
  drawUpgrade,
  drawWorld,
} from './render.js';
import { sceneFor } from './shots.js';
import {
  ensureAudio,
  isMuted,
  playAlert,
  playCaught,
  playClick,
  playPickup,
  playSmoke,
  playStep,
  playWin,
  setMuted,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

// ---------------------------------------------------------------- shot mode

if (shot) {
  const scene = sceneFor(window.location.search);
  const world = scene.world;
  wireAudio(world);
  if (scene.screen === 'title') {
    drawTitle(ctx, world, countForces());
  } else if (scene.screen === 'upgrade') {
    drawUpgrade(ctx, world, scene.choices, scene.selected);
  } else if (scene.screen === 'complete') {
    drawComplete(ctx, world);
  } else {
    drawWorld(ctx, world, true);
  }
  window.__game = world;
  window.__shotReady = true;
} else {
  startGame();
}

// ---------------------------------------------------------------- live game

function startGame() {
  const save = loadSave(window.localStorage);
  const run = createRun(save);
  const input = createInput();
  attachInput(input, () => ensureAudio());

  const state = {
    screen: 'title',
    run,
    world: null,
    choices: [],
    selected: 1,
    hideoutSelected: 0,
    returnTo: 'title',
  };

  // The title plays over a live heist: Wren hides in a bush while the
  // guards patrol behind the menu.
  state.world = createWorld(0, run, 1);
  hidePlayerInBush(state.world);
  wireAudio(state.world);

  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (VIEW.width / rect.width);
    const y = (event.clientY - rect.top) * (VIEW.height / rect.height);
    handleClick(state, x, y);
  });

  let last = performance.now();
  let acc = 0;
  const DT = 1 / 60;

  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += elapsed;
    while (acc >= DT) {
      acc -= DT;
      tick(state, input, DT);
    }
    render(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__game = state;
}

function hidePlayerInBush(world) {
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      if (world.tiles[y][x] === 'B') {
        world.player.x = x * VIEW.tile + VIEW.tile / 2;
        world.player.y = y * VIEW.tile + VIEW.tile / 2;
        return;
      }
    }
  }
}

function wireAudio(world) {
  world.onAlert = () => playAlert();
  world.onPickup = () => playPickup();
  world.onSmoke = () => playSmoke();
  world.onCaught = () => playCaught();
  world.onWin = () => playWin();
  world.onStep = (pan) => playStep(pan);
  world.onNoise = () => playStep(0);
}

function newHeist(state, levelIndex) {
  const world = createWorld(levelIndex, state.run, 1 + levelIndex * 101);
  wireAudio(world);
  state.world = world;
  state.screen = 'briefing';
}

function tick(state, input, dt) {
  const gameInput = readGameInput(input);
  const world = state.world;

  if (gameInput.mute) {
    setMuted(!isMuted());
  }

  if (state.screen === 'title') {
    // The heist idles behind the menu; Wren stays hidden in her bush.
    stepWorld(world, { x: 0, y: 0, sneak: false, sprint: false, smoke: false }, dt);
    if (gameInput.confirm) {
      playClick();
      newHeist(state, 0);
    } else if (gameInput.hideout) {
      state.returnTo = 'title';
      state.screen = 'hideout';
    }
  } else if (state.screen === 'briefing') {
    if (gameInput.confirm) {
      playClick();
      state.screen = 'play';
    }
  } else if (state.screen === 'play') {
    if (gameInput.pause) {
      state.screen = 'paused';
    } else if (gameInput.hideout) {
      state.returnTo = 'play';
      state.screen = 'hideout';
    } else if (gameInput.restart) {
      newHeist(state, state.run.levelIndex);
    } else {
      stepWorld(world, gameInput, dt);
      if (world.over === 'caught') {
        state.screen = 'caught';
      } else if (world.over === 'complete') {
        storeSave(window.localStorage, state.run);
        state.screen = 'complete';
      }
    }
  } else if (state.screen === 'complete') {
    if (gameInput.confirm) {
      playClick();
      if (state.run.levelIndex < LEVELS.length - 1) {
        state.choices = upgradeChoices(world);
        state.selected = 1;
        state.screen = 'upgrade';
      } else {
        state.screen = 'final';
      }
    }
  } else if (state.screen === 'upgrade') {
    if (gameInput.choice >= 0 && gameInput.choice < state.choices.length) {
      chooseGadget(world, state.choices[gameInput.choice].id);
      playClick();
      state.run.levelIndex++;
      newHeist(state, state.run.levelIndex);
    }
  } else if (state.screen === 'caught') {
    if (gameInput.restart) {
      newHeist(state, state.run.levelIndex);
    } else if (gameInput.hideout) {
      state.returnTo = 'caught';
      state.screen = 'hideout';
    }
  } else if (state.screen === 'paused') {
    if (gameInput.pause) {
      state.screen = 'play';
    } else if (gameInput.restart) {
      newHeist(state, state.run.levelIndex);
    } else if (gameInput.hideout) {
      state.returnTo = 'paused';
      state.screen = 'hideout';
    }
  } else if (state.screen === 'hideout') {
    if (gameInput.choice >= 0 && gameInput.choice < HIDEOUT.length) {
      if (buyHideout(state.run, HIDEOUT[gameInput.choice].id)) {
        playClick();
        storeSave(window.localStorage, state.run);
      }
    } else if (gameInput.confirm) {
      playClick();
      newHeist(state, state.run.levelIndex);
    } else if (gameInput.hideout) {
      state.screen = state.returnTo === 'play' ? 'paused' : state.returnTo;
      if (state.screen === 'caught') state.screen = 'caught';
      if (state.screen === 'title') {
        state.world = createWorld(0, state.run, 1);
        hidePlayerInBush(state.world);
        wireAudio(state.world);
      }
    }
  } else if (state.screen === 'final') {
    if (gameInput.restart) {
      const save = loadSave(window.localStorage);
      const run = createRun(save);
      state.run = run;
      state.world = createWorld(0, run, 1);
      hidePlayerInBush(state.world);
      wireAudio(state.world);
      state.screen = 'title';
    }
  }

  clearEdges(input);
}

function handleClick(state, x, y) {
  ensureAudio();
  if (state.screen === 'upgrade') {
    const cardW = 300;
    const gap = 30;
    const total = cardW * 3 + gap * 2;
    const startX = (VIEW.width - total) / 2;
    for (let i = 0; i < 3; i++) {
      const cx = startX + i * (cardW + gap);
      if (x >= cx && x <= cx + cardW && y >= 240 && y <= 460) {
        chooseGadget(state.world, state.choices[i].id);
        playClick();
        state.run.levelIndex++;
        newHeist(state, state.run.levelIndex);
        return;
      }
    }
  } else if (state.screen === 'hideout') {
    for (let i = 0; i < 3; i++) {
      const ry = 240 + i * 90;
      if (x >= 340 && x <= 940 && y >= ry && y <= ry + 70) {
        if (buyHideout(state.run, HIDEOUT[i].id)) {
          playClick();
          storeSave(window.localStorage, state.run);
        }
        return;
      }
    }
  } else if (state.screen === 'title') {
    state.screen = 'briefing';
    state.world = createWorld(0, state.run, 1);
    wireAudio(state.world);
  }
}

function render(state) {
  const world = state.world;
  if (state.screen === 'title') {
    drawTitle(ctx, world, countForces());
  } else if (state.screen === 'briefing') {
    drawWorld(ctx, world, true);
    drawBriefing(ctx, world);
  } else if (state.screen === 'play') {
    drawWorld(ctx, world, true);
  } else if (state.screen === 'paused') {
    drawWorld(ctx, world, true);
    drawPaused(ctx, world);
  } else if (state.screen === 'complete') {
    drawWorld(ctx, world, true);
    drawComplete(ctx, world);
  } else if (state.screen === 'upgrade') {
    drawWorld(ctx, world, true);
    drawUpgrade(ctx, world, state.choices, state.selected);
  } else if (state.screen === 'caught') {
    drawWorld(ctx, world, true);
    drawCaught(ctx, world);
  } else if (state.screen === 'hideout') {
    drawWorld(ctx, world, true);
    drawHideout(ctx, world, state.hideoutSelected);
  } else if (state.screen === 'final') {
    drawWorld(ctx, world, true);
    drawFinal(ctx, world);
  }
}
