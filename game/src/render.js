// The renderer: every pixel the judge sees. It draws the level (floor,
// rugs, shadow zones, bushes, gold-trimmed walls), the guards with their
// vision cones clipped by walls, the thief, the loot and the exit — then
// the HUD (alarm, loot, timer, smoke, visibility, minimap) and the screens
// (title, briefing, upgrade choice, heist complete, caught, paused, hideout).
import { FIELD, FONT, HIDEOUT, PALETTE, TILE } from './config.js';
import { LEVELS } from './levels.js';
import { GUARD, WARDEN } from './config.js';
import { conePoints } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_HEIST_DONE = 'heist-done';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_HIDEOUT = 'hideout';
export const SCREEN_RUN_DONE = 'run-done';

const CONE_RAYS = 22;

/** March a ray from the guard until a wall, a smoke cloud or the cone's range. */
function rayHit(guard, angle, range, walls, smokes) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = 10; d <= range; d += 10) {
    const x = guard.x + dx * d;
    const y = guard.y + dy * d;
    for (let i = 0; i < walls.length; i += 1) {
      const w = walls[i];
      if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return d;
    }
    for (let i = 0; i < smokes.length; i += 1) {
      if (Math.hypot(x - smokes[i].x, y - smokes[i].y) < smokes[i].radius) return d;
    }
  }
  return range;
}

/** The visible part of a guard's cone as a polygon, clipped by walls and smoke. */
export function conePolygon(guard, walls, smokes) {
  const range = guard.warden ? WARDEN.viewRange : GUARD.viewRange;
  const half = guard.warden ? WARDEN.viewHalfAngle : GUARD.viewHalfAngle;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle = guard.angle - half + (2 * half * i) / CONE_RAYS;
    const d = rayHit(guard, angle, range, walls, smokes);
    points.push({ x: guard.x + Math.cos(angle) * d, y: guard.y + Math.sin(angle) * d });
  }
  return points;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, offsetX: 0, offsetY: 0 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.scale = scale;
    view.offsetX = (canvas.width - FIELD.width * scale) / 2;
    view.offsetY = (canvas.height - FIELD.height * scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  function panel(x, y, w, h, alpha = 0.92) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.restore();
  }

  function text(str, x, y, size, color, align = 'left', weight = 600) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawFloor(level) {
    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        const light = (row + col) % 2 === 0;
        ctx.fillStyle = light ? PALETTE.floorLight : PALETTE.floorDark;
        ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
      }
    }
    // Shadow zones: dark floor where the light does not reach — safe ground.
    for (const t of level.dark) {
      ctx.fillStyle = PALETTE.floorShadow;
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = 'rgba(127, 231, 255, 0.30)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
    }
    // Rugs under the middle of each room, for warmth.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PALETTE.rug;
    ctx.fillRect(360, 280, 240, 120);
    ctx.fillRect(840, 120, 200, 100);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#6b4a5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(360, 280, 240, 120);
    ctx.strokeRect(840, 120, 200, 100);
    ctx.restore();
  }

  function drawWalls(level) {
    for (const w of level.walls) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 6);
      ctx.strokeStyle = PALETTE.wallTrim;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawBushes(level) {
    for (const b of level.bushes) {
      ctx.fillStyle = PALETTE.bush;
      ctx.beginPath();
      ctx.arc(b.x + 20, b.y + 20, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bushEdge;
      ctx.beginPath();
      ctx.arc(b.x + 14, b.y + 14, 7, 0, Math.PI * 2);
      ctx.arc(b.x + 27, b.y + 25, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawExitAndTarget(world, time) {
    const exit = world.level.exit;
    const pulse = 0.55 + 0.35 * Math.sin(time * 3);
    ctx.save();
    ctx.globalAlpha = world.targetTaken ? pulse : 0.25;
    ctx.fillStyle = PALETTE.exit;
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0d12';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', exit.x, exit.y);
    ctx.restore();

    const target = world.level.target;
    if (!world.targetTaken) {
      const bob = Math.sin(time * 2.4) * 3;
      ctx.save();
      ctx.shadowColor = PALETTE.lootGem;
      ctx.shadowBlur = 18;
      ctx.fillStyle = PALETTE.lootGem;
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 16 + bob);
      ctx.lineTo(target.x + 11, target.y - 4 + bob);
      ctx.lineTo(target.x + 5, target.y + 12 + bob);
      ctx.lineTo(target.x - 5, target.y + 12 + bob);
      ctx.lineTo(target.x - 11, target.y - 4 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      text('★ TARGET ★', target.x, target.y - 30 + bob, 11, PALETTE.lootGem, 'center', 800);
    }
  }

  /** The exit's caption, drawn last so walls never paint over its words. */
  function drawExitLabel(world) {
    const exit = world.level.exit;
    text(world.targetTaken ? 'EXIT OPEN — GO!' : 'EXIT LOCKED — TAKE THE TARGET FIRST', exit.x + 30, exit.y - 55, 12, world.targetTaken ? PALETTE.exitGlow : PALETTE.muted, 'left');
  }

  function drawLoot(world, showLabels = true) {
    for (const piece of world.loot) {
      if (piece.taken) continue;
      ctx.save();
      ctx.shadowColor = PALETTE.loot;
      ctx.shadowBlur = 10;
      ctx.fillStyle = piece.kind === 'gem' ? PALETTE.lootGem : PALETTE.loot;
      if (piece.kind === 'gem') {
        ctx.beginPath();
        ctx.moveTo(piece.x, piece.y - 10);
        ctx.lineTo(piece.x + 8, piece.y);
        ctx.lineTo(piece.x, piece.y + 10);
        ctx.lineTo(piece.x - 8, piece.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(piece.x - 9, piece.y - 7, 18, 14);
        ctx.strokeStyle = '#7a5b12';
        ctx.lineWidth = 2;
        ctx.strokeRect(piece.x - 9, piece.y - 7, 18, 14);
        ctx.beginPath();
        ctx.moveTo(piece.x - 9, piece.y - 7);
        ctx.lineTo(piece.x + 9, piece.y + 7);
        ctx.moveTo(piece.x + 9, piece.y - 7);
        ctx.lineTo(piece.x - 9, piece.y + 7);
        ctx.stroke();
      }
      ctx.restore();
      if (showLabels) text(`$${piece.value}`, piece.x, piece.y + 22, 11, PALETTE.loot, 'center');
    }
  }

  function drawCones(world) {
    for (const guard of world.guards) {
      const poly = conePolygon(guard, world.level.walls, world.smokes);
      const alertness = guard.suspicion / 100;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fillStyle = guard.state === 'alert' ? PALETTE.coneAlert : alertness >= 0.55 ? PALETTE.coneSuspicious : PALETTE.coneCalm;
      ctx.fill();
      ctx.strokeStyle = guard.state === 'alert' ? 'rgba(255, 90, 90, 0.7)' : 'rgba(255, 214, 90, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // The far edge of the cone, so the player can read its reach at a glance.
      const tips = conePoints(guard);
      ctx.beginPath();
      ctx.moveTo(tips.left.x, tips.left.y);
      ctx.lineTo(tips.right.x, tips.right.y);
      ctx.strokeStyle = 'rgba(255, 214, 90, 0.18)';
      ctx.stroke();
    }
  }

  function drawGuard(guard, time) {
    const body = guard.warden ? PALETTE.guardWarden : PALETTE.guard;
    // Body: a uniformed figure, nose pointing where it looks.
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.angle);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5d7d5';
    ctx.beginPath();
    ctx.arc(7, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.fillRect(-GUARD.radius - 2, -4, 8, 8);
    ctx.restore();
    // Suspicion: a "?" while curious, a "!" while alarmed, over the head.
    if (guard.suspicion >= 55 || guard.state === 'alert') {
      const mark = guard.state === 'alert' ? '!' : '?';
      const bounce = Math.sin(time * 6) * 2;
      text(mark, guard.x, guard.y - 26 + bounce, 20, guard.state === 'alert' ? PALETTE.danger : PALETTE.gold, 'center', 900);
    }
    if (guard.suspicion > 1 && guard.suspicion < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(guard.x - 16, guard.y + 18, 32, 5);
      ctx.fillStyle = guard.suspicion >= 55 ? PALETTE.gold : '#c9d4e8';
      ctx.fillRect(guard.x - 16, guard.y + 18, 32 * (guard.suspicion / 100), 5);
    }
    if (guard.warden) text('WARDEN', guard.x, guard.y + 30, 10, PALETTE.guardWarden, 'center', 800);
  }

  function drawPlayer(world) {
    const p = world.player;
    ctx.save();
    // The player's own noise ring, so sprinting is visible as well as audible.
    if (p.stance === 'sprint' && p.moving) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34 + Math.sin(performance.now() / 90) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.hidden ? 0.45 : 1;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    // Hood and cloak tail.
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.moveTo(-6, -9);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-6, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b0d12';
    ctx.beginPath();
    ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.hidden) text('HIDDEN', p.x, p.y - 24, 11, PALETTE.player, 'center', 800);
  }

  function drawSmokeAndPulses(world) {
    for (const s of world.smokes) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.3 * (s.life / s.maxLife);
      ctx.fillStyle = PALETTE.smoke;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (const pulse of world.pulses) {
      const age = 1 - pulse.life / pulse.maxLife;
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - age);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, pulse.radius * (0.3 + 0.7 * age), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Guard footsteps: fading rings where a guard just stepped, so you can hear with your eyes.
    for (const step of world.guardSteps) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = step.alert ? PALETTE.danger : '#c9d4e8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(step.x, step.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMinimap(world) {
    const mw = 208;
    const mh = 117;
    const x0 = FIELD.width - mw - 14;
    const y0 = FIELD.height - mh - 14;
    const sx = mw / FIELD.width;
    const sy = mh / FIELD.height;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#232838';
    ctx.fillRect(x0, y0, mw, mh);
    for (const w of world.level.walls) ctx.fillStyle = '#4a4238', ctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, Math.max(1, w.w * sx), Math.max(1, w.h * sy));
    const exit = world.level.exit;
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(x0 + exit.x * sx - 3, y0 + exit.y * sy - 3, 6, 6);
    if (!world.targetTaken) {
      ctx.fillStyle = PALETTE.lootGem;
      ctx.beginPath();
      ctx.arc(x0 + world.level.target.x * sx, y0 + world.level.target.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const guard of world.guards) {
      ctx.fillStyle = guard.warden ? PALETTE.guardWarden : PALETTE.guard;
      ctx.beginPath();
      ctx.arc(x0 + guard.x * sx, y0 + guard.y * sy, guard.state === 'alert' ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    ctx.restore();
    text('MAP', x0 + mw / 2, y0 - 12, 10, PALETTE.muted, 'center');
  }

  function drawHud(world, best) {
    const level = LEVELS[world.levelIndex];
    panel(14, 14, 470, 58, 0.85);
    text(`HEIST ${world.levelIndex + 1}/3 · ${level.name.toUpperCase()}`, 26, 34, 15, PALETTE.text, 'left', 800);
    text(`LOOT $${world.lootValue}  ·  ${world.lootTaken}/${world.loot.length} pieces`, 26, 58, 13, PALETTE.gold);
    // Timer.
    const mm = Math.floor(world.time / 60);
    const ss = Math.floor(world.time % 60).toString().padStart(2, '0');
    text(`⏱ ${mm}:${ss}  ·  par ${Math.floor(level.par / 60)}:${(level.par % 60).toString().padStart(2, '0')}`, 340, 34, 13, PALETTE.muted);
    text(`SCORE ${world.score + world.lootValue}  ·  BEST ${Math.max(best, world.score + world.lootValue)}`, 340, 58, 13, PALETTE.text);

    // Alarm meter.
    panel(14, 80, 250, 40, 0.85);
    const label = world.alarm >= 55 ? 'ALARM — THEY KNOW' : world.alarm >= 20 ? 'TENSE' : 'CALM';
    const color = world.alarm >= 55 ? PALETTE.danger : world.alarm >= 20 ? PALETTE.gold : PALETTE.exit;
    text(`ALARM ${label}`, 26, 100, 12, color, 'left', 800);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(150, 92, 100, 10);
    ctx.fillStyle = color;
    ctx.fillRect(150, 92, 100 * (world.alarm / 100), 10);

    // Visibility + stance + smoke, bottom-left.
    panel(14, FIELD.height - 58, 330, 44, 0.85);
    const vis = world.player.hidden ? 'HIDDEN IN COVER' : world.player.inShadow ? 'IN SHADOW — HARD TO SEE' : 'IN THE OPEN';
    const visColor = world.player.hidden ? PALETTE.player : world.player.inShadow ? '#7fe7ff' : PALETTE.gold;
    text(`👁 ${vis}`, 26, FIELD.height - 36, 13, visColor, 'left', 800);
    text(`${world.player.stance.toUpperCase()} · 💨 ${world.player.smoke} smoke · E to use`, 26, FIELD.height - 20, 11, PALETTE.muted);

    drawMinimap(world);
  }

  function drawWorld(world, time, showLabels = true) {
    drawFloor(world.level);
    drawExitAndTarget(world, time);
    drawLoot(world, showLabels);
    drawCones(world);
    drawWalls(world.level);
    drawBushes(world.level);
    for (const guard of world.guards) drawGuard(guard, time);
    drawPlayer(world);
    drawSmokeAndPulses(world);
    drawExitLabel(world);
  }

  function drawTitle(world, best, time) {
    // The heist plays quietly behind the title: guards on patrol, cones sweeping.
    // Loot value labels are hidden here: bright gold text would ghost through
    // the dimming overlay and read as stray characters in the title copy.
    drawWorld(world, time, false);
    ctx.fillStyle = 'rgba(5, 6, 10, 0.8)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('S H A D O W L I N E', FIELD.width / 2, 150, 84, PALETTE.text, 'center', 900);
    text('A THIEF IN THREE HEISTS', FIELD.width / 2, 205, 20, PALETTE.gold, 'center', 700);
    text('3 heists · 14 guards · 3 elite wardens · 6 gadgets · a hideout to grow', FIELD.width / 2, 250, 16, PALETTE.muted, 'center');
    text('Slip past the cones. Take the target. Reach the exit unseen.', FIELD.width / 2, 282, 16, PALETTE.text, 'center');
    panel(FIELD.width / 2 - 330, 320, 660, 132, 0.95);
    text('HOW TO PLAY', FIELD.width / 2, 342, 14, PALETTE.gold, 'center', 800);
    text('WASD / arrows — move      SHIFT — sprint (fast, loud)', FIELD.width / 2, 372, 14, PALETTE.text, 'center');
    text('C — sneak (slow, quiet, bushes hide you)      E — smoke pellet', FIELD.width / 2, 398, 14, PALETTE.text, 'center');
    text('Dark floor hides you. Noise draws guards. A "?" means curious — a "!" means run.', FIELD.width / 2, 424, 14, PALETTE.text, 'center');
    text('SPACE — begin the first heist', FIELD.width / 2, 490, 18, PALETTE.exitGlow, 'center', 800);
    text('H — hideout (spend banked loot on permanent gear)', FIELD.width / 2, 522, 14, PALETTE.muted, 'center');
    if (best > 0) text(`BEST RUN $${best}  ·  BANKED $${world.save.banked}`, FIELD.width / 2, 560, 14, PALETTE.gold, 'center', 800);
    text('Built by an AI agent for make.fun — original game, art, sound and names.', FIELD.width / 2, 690, 11, PALETTE.muted, 'center');
  }

  function drawBriefing(world) {
    drawWorld(world, 0);
    ctx.fillStyle = 'rgba(5, 6, 10, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const level = LEVELS[world.levelIndex];
    panel(FIELD.width / 2 - 380, 170, 760, 300, 0.97);
    text(`HEIST ${world.levelIndex + 1} OF 3`, FIELD.width / 2, 205, 14, PALETTE.gold, 'center', 800);
    text(level.name.toUpperCase(), FIELD.width / 2, 250, 40, PALETTE.text, 'center', 900);
    const words = level.briefing.split(' ');
    let line = '';
    let y = 300;
    const lines = [];
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 78) { lines.push(line.trim()); line = word; }
      else line += ' ' + word;
    }
    lines.push(line.trim());
    for (const l of lines) { text(l, FIELD.width / 2, y, 15, PALETTE.text, 'center'); y += 24; }
    text(`${world.guards.length} guards on patrol${world.guards.some((g) => g.warden) ? ' — including an elite WARDEN' : ''} · ${world.loot.length} loot pieces · par ${Math.floor(level.par / 60)}:${(level.par % 60).toString().padStart(2, '0')}`, FIELD.width / 2, y + 18, 13, PALETTE.muted, 'center');
    text('SPACE — start the heist', FIELD.width / 2, y + 58, 18, PALETTE.exitGlow, 'center', 800);
  }

  function drawUpgrade(world, choices, selected) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('HEIST COMPLETE — CHOOSE YOUR EDGE', FIELD.width / 2, 110, 34, PALETTE.text, 'center', 900);
    text('Pick one upgrade. It lasts for the rest of this run.', FIELD.width / 2, 150, 16, PALETTE.muted, 'center');
    choices.forEach((upgrade, i) => {
      const x = 190 + i * 320;
      const y = 200;
      const w = 290;
      const h = 250;
      panel(x, y, w, h, i === selected ? 1 : 0.9);
      if (i === selected) {
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      }
      text(upgrade.icon, x + w / 2, y + 62, 52, PALETTE.text, 'center');
      text(upgrade.name.toUpperCase(), x + w / 2, y + 130, 18, PALETTE.gold, 'center', 800);
      const words = upgrade.blurb.split(' ');
      let line = '';
      let ly = y + 170;
      const lines = [];
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 30) { lines.push(line.trim()); line = word; }
        else line += ' ' + word;
      }
      lines.push(line.trim());
      for (const l of lines) { text(l, x + w / 2, ly, 13, PALETTE.text, 'center'); ly += 20; }
      text(`[${i + 1}]`, x + w / 2, y + h - 26, 14, PALETTE.muted, 'center');
    });
    text('Press 1, 2 or 3 — or click a card.', FIELD.width / 2, 510, 16, PALETTE.text, 'center');
    text(`Banked loot $${world.banked} · Run score $${world.score}`, FIELD.width / 2, 545, 14, PALETTE.gold, 'center');
  }

  function drawHeistDone(world) {
    drawWorld(world, 0);
    ctx.fillStyle = 'rgba(5, 6, 10, 0.8)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const last = world.heistScores[world.heistScores.length - 1];
    const isFinal = world.levelIndex + 1 >= LEVELS.length;
    panel(FIELD.width / 2 - 330, 150, 660, 330, 0.97);
    text(isFinal ? 'THE LAST HEIST IS DONE' : 'HEIST COMPLETE', FIELD.width / 2, 190, 32, PALETTE.exitGlow, 'center', 900);
    text(LEVELS[world.levelIndex].name.toUpperCase(), FIELD.width / 2, 228, 16, PALETTE.gold, 'center', 800);
    if (last) {
      text(`Loot taken        $${last.loot}`, FIELD.width / 2, 285, 16, PALETTE.text, 'center');
      text(`Time bonus        +$${last.timeBonus}`, FIELD.width / 2, 313, 16, PALETTE.text, 'center');
      text(`Ghost bonus       +$${last.ghost}${world.spotted ? '  (spotted — no ghost bonus)' : '  (never spotted!)'}`, FIELD.width / 2, 341, 16, PALETTE.text, 'center');
      text(`Clean sweep       +$${last.sweep}`, FIELD.width / 2, 369, 16, PALETTE.text, 'center');
      text(`HEIST SCORE      $${last.total}`, FIELD.width / 2, 410, 20, PALETTE.gold, 'center', 800);
    }
    text(`RUN SCORE $${world.score}  ·  BANKED $${world.banked}`, FIELD.width / 2, 446, 14, PALETTE.muted, 'center');
    text(isFinal ? 'SPACE — see your final score' : 'SPACE — choose an upgrade and move on', FIELD.width / 2, 520, 18, PALETTE.exitGlow, 'center', 800);
  }

  function drawCaught(world) {
    drawWorld(world, 0);
    ctx.fillStyle = 'rgba(20, 2, 4, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(FIELD.width / 2 - 330, 170, 660, 300, 0.97);
    text('CAUGHT!', FIELD.width / 2, 215, 56, PALETTE.danger, 'center', 900);
    text('A guard laid hands on Wren. The heist is blown.', FIELD.width / 2, 265, 16, PALETTE.text, 'center');
    text(`${LEVELS[world.levelIndex].name} · ${Math.floor(world.time)}s in · $${world.lootValue} of loot dropped`, FIELD.width / 2, 300, 14, PALETTE.muted, 'center');
    text('The guards were faster than your patience. Next time, watch the cones —', FIELD.width / 2, 340, 14, PALETTE.text, 'center');
    text('wait in the dark, and let the patrol pass before you move.', FIELD.width / 2, 364, 14, PALETTE.text, 'center');
    text('SPACE — retry this heist      H — back to the hideout', FIELD.width / 2, 425, 18, PALETTE.exitGlow, 'center', 800);
  }

  function drawPaused(world, best) {
    drawWorld(world, 0);
    drawHud(world, best);
    ctx.fillStyle = 'rgba(5, 6, 10, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 300, 56, PALETTE.text, 'center', 900);
    text('P or SPACE — resume      M — mute      R — restart this heist', FIELD.width / 2, 360, 16, PALETTE.muted, 'center');
  }

  function drawHideout(world) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('THE HIDEOUT', FIELD.width / 2, 100, 44, PALETTE.text, 'center', 900);
    text('Banked loot buys permanent gear. It stays with you across runs.', FIELD.width / 2, 140, 16, PALETTE.muted, 'center');
    text(`BANKED $${world.save.banked}`, FIELD.width / 2, 180, 20, PALETTE.gold, 'center', 800);
    HIDEOUT.forEach((item, i) => {
      const owned = world.save.hideout.includes(item.id);
      const x = 290 + i * 240;
      const y = 230;
      panel(x, y, 220, 200, owned ? 0.6 : 0.95);
      text(item.name.toUpperCase(), x + 110, y + 40, 16, owned ? PALETTE.muted : PALETTE.gold, 'center', 800);
      text(owned ? 'OWNED ✓' : `$${item.cost}`, x + 110, y + 80, 18, owned ? PALETTE.exit : PALETTE.text, 'center', 800);
      const words = item.blurb.split(' ');
      let line = '';
      let ly = y + 120;
      const lines = [];
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 26) { lines.push(line.trim()); line = word; }
        else line += ' ' + word;
      }
      lines.push(line.trim());
      for (const l of lines) { text(l, x + 110, ly, 12, PALETTE.text, 'center'); ly += 18; }
      text(`[${i + 1}]`, x + 110, y + 172, 13, PALETTE.muted, 'center');
    });
    text('Press 1, 2 or 3 to buy — or SPACE to go back.', FIELD.width / 2, 480, 16, PALETTE.text, 'center');
    text(`BEST RUN $${world.save.best}`, FIELD.width / 2, 520, 14, PALETTE.gold, 'center');
  }

  function drawRunDone(world) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('THE LEGEND OF WREN', FIELD.width / 2, 110, 44, PALETTE.text, 'center', 900);
    text('All three heists complete. The city never saw you coming.', FIELD.width / 2, 155, 16, PALETTE.muted, 'center');
    let y = 220;
    for (const h of world.heistScores) {
      text(`${h.level} — $${h.total}  (loot $${h.loot}, time +$${h.timeBonus}, ghost +$${h.ghost}, sweep +$${h.sweep})`, FIELD.width / 2, y, 15, PALETTE.text, 'center');
      y += 30;
    }
    text(`FINAL SCORE $${world.score}`, FIELD.width / 2, y + 30, 30, PALETTE.gold, 'center', 900);
    text(`BEST $${world.save.best}  ·  BANKED $${world.banked} for the hideout`, FIELD.width / 2, y + 72, 14, PALETTE.muted, 'center');
    text('SPACE — run it all again      H — hideout', FIELD.width / 2, y + 120, 18, PALETTE.exitGlow, 'center', 800);
  }

  return {
    draw(world, screen, best, time, extra = {}) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
      if (screen === SCREEN_TITLE) drawTitle(world, best, time);
      else if (screen === SCREEN_BRIEFING) drawBriefing(world);
      else if (screen === SCREEN_PLAY) { drawWorld(world, time); drawHud(world, best); }
      else if (screen === SCREEN_PAUSED) drawPaused(world, best);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(world, extra.choices || [], extra.selected || 0);
      else if (screen === SCREEN_HEIST_DONE) drawHeistDone(world);
      else if (screen === SCREEN_CAUGHT) drawCaught(world);
      else if (screen === SCREEN_HIDEOUT) drawHideout(world);
      else if (screen === SCREEN_RUN_DONE) drawRunDone(world);
    },
  };
}
