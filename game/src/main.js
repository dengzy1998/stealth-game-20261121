// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between screens: title,
// briefing, play, paused, upgrade choice, heist complete, caught, hideout
// and the final run score.
//
// ?seed=N fixes the heist. ?shot=title|briefing|play|upgrade|win|caught|
// hideout|run (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { STEP, UPGRADES, HIDEOUT } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_ALERT,
  EVENT_CAUGHT,
  EVENT_HEIST_DONE,
  EVENT_PICKUP,
  EVENT_SMOKE,
  EVENT_TARGET,
  loadLevel,
  nextHeist,
  resetRun,
  saveSave,
  stepWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_SMOKE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_BRIEFING,
  SCREEN_CAUGHT,
  SCREEN_HEIST_DONE,
  SCREEN_HIDEOUT,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_RUN_DONE,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, performance.now() / 1000, scene);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = world.save.best;
  let accumulator = 0;
  let last = performance.now();
  let upgradeChoices = [];
  let upgradeSelected = 0;
  let returnScreen = SCREEN_TITLE;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function pickUpgrades() {
    const pool = [...UPGRADES];
    upgradeChoices = [];
    while (upgradeChoices.length < 3 && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      upgradeChoices.push(pool.splice(index, 1)[0]);
    }
    upgradeSelected = 0;
  }

  function startHeist() {
    accumulator = 0;
    screen = SCREEN_BRIEFING;
    announce(`Heist ${world.levelIndex + 1}. Read the briefing, then press Space.`);
  }

  function beginPlay() {
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.stopDrone();
    announce('Playing. Take the target, then reach the exit unseen.');
  }

  function endHeist(won) {
    if (won) {
      audio.win();
      screen = SCREEN_HEIST_DONE;
      returnScreen = world.levelIndex + 1 >= 3 ? SCREEN_RUN_DONE : SCREEN_TITLE;
      announce(`Heist complete. Score ${world.score}.`);
    } else {
      audio.caught();
      screen = SCREEN_CAUGHT;
      announce('Caught. The heist is blown.');
    }
  }

  function applyUpgrade(index) {
    const upgrade = upgradeChoices[index];
    if (!upgrade) return;
    world.upgrades.add(upgrade.id);
    audio.click();
    if (!nextHeist(world)) {
      screen = SCREEN_RUN_DONE;
      announce(`All heists complete. Final score ${world.score}.`);
      return;
    }
    startHeist();
  }

  function openHideout(from) {
    returnScreen = from;
    screen = SCREEN_HIDEOUT;
    announce('Hideout. Spend banked loot on permanent gear.');
  }

  function buyHideout(index) {
    const item = HIDEOUT[index];
    if (!item || world.save.hideout.includes(item.id)) return;
    if (world.save.banked < item.cost) return;
    world.save.banked -= item.cost;
    world.save.hideout.push(item.id);
    world.banked = world.save.banked;
    saveSave(world.save);
    audio.click();
    announce(`${item.name} bought.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.ensure();
      audio.setMuted(!audio.muted);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.ensure();
        audio.click();
        resetRun(world);
        startHeist();
      }
      return;
    }
    if (screen === SCREEN_HIDEOUT) {
      if (actions & ACTION_CONFIRM) screen = returnScreen;
      return;
    }
    if (screen === SCREEN_BRIEFING) {
      if (actions & ACTION_CONFIRM) beginPlay();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_CONFIRM) applyUpgrade(upgradeSelected);
      return;
    }
    if (screen === SCREEN_HEIST_DONE) {
      if (actions & ACTION_CONFIRM) {
        if (returnScreen === SCREEN_RUN_DONE) screen = SCREEN_RUN_DONE;
        else {
          pickUpgrades();
          screen = SCREEN_UPGRADE;
        }
      }
      return;
    }
    if (screen === SCREEN_CAUGHT) {
      if (actions & ACTION_CONFIRM) {
        loadLevel(world, world.levelIndex);
        startHeist();
      }
      return;
    }
    if (screen === SCREEN_RUN_DONE) {
      if (actions & ACTION_CONFIRM) {
        resetRun(world);
        startHeist();
      }
    }
  }

  // Number keys pick upgrade cards and buy hideout gear; H opens the hideout; R restarts a heist.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyH' && (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_RUN_DONE)) {
      openHideout(screen);
    }
    if (screen === SCREEN_UPGRADE && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      applyUpgrade(Number(event.code.slice(-1)) - 1);
    }
    if (screen === SCREEN_HIDEOUT && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      buyHideout(Number(event.code.slice(-1)) - 1);
    }
    if (screen === SCREEN_PAUSED && event.code === 'KeyR') {
      loadLevel(world, world.levelIndex);
      beginPlay();
    }
  });

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const direction = input.direction();
    const actions = input.takeActions();
    if (actions & ACTION_SMOKE) direction.useSmoke = true;
    const events = stepWorld(world, direction);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_TARGET) audio.target();
    if (events & EVENT_ALERT) {
      audio.alert();
      announce('Spotted! A guard is chasing you.');
    }
    if (events & EVENT_SMOKE) audio.noiseTick(0.18, 0, 600);
    if (world.playerStepped) audio.footstep(world.player.stance);
    for (const step of world.guardSteps) {
      const pan = Math.max(-1, Math.min(1, (step.x - world.player.x) / 640));
      audio.guardStep(pan, step.alert);
    }
    if (events & EVENT_CAUGHT) endHeist(false);
    else if (events & EVENT_HEIST_DONE) endHeist(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The title's backdrop heist patrols on its own, Wren hidden in a bush.
      const idle = { up: false, down: false, left: false, right: false, sneak: true, sprint: false, useSmoke: false };
      while (accumulator >= STEP) {
        stepWorld(world, idle);
        accumulator -= STEP;
        if (world.over) loadLevel(world, 0);
      }
      audio.ensure();
      audio.startDrone();
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const extra = screen === SCREEN_UPGRADE ? { choices: upgradeChoices, selected: upgradeSelected } : {};
    renderer.draw(world, screen, best, now / 1000, extra);
    if (world.save.best > best) best = world.save.best;
  }

  // Keep Wren hidden in a bush while the title plays behind the menu.
  const bush = world.level.bushes[0];
  world.player.x = bush.x + 20;
  world.player.y = bush.y + 20;

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadowline. Three heists, thirteen guards, two wardens. Press Space to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
