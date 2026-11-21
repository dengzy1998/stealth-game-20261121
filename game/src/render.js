// SHADOWLINE rendering: the night floor, the cones, the HUD and every
// screen. All art is drawn in code — no image files, no fonts to fetch.
// drawWorld draws the floor and everything on it; the screens draw
// themselves on top.

import { ALARM, PALETTE, SCORE, SMOKE, VIEW } from './config.js';
import { conePolygon, inBush, inDark } from './vision.js';
import { alarmWord, formatTime, visibilityOf } from './world.js';
import { guardMark } from './guards.js';

const T = VIEW.tile;

// ---------------------------------------------------------------- floor

function drawFloor(ctx, world) {
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      const ch = world.tiles[y][x];
      const px = x * T;
      const py = y * T;
      if (ch === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(px, py, T, 5);
        ctx.fillStyle = PALETTE.wallEdge;
        ctx.fillRect(px, py + T - 2, T, 2);
        continue;
      }
      // A quiet checkerboard so the eye can read distance at a glance.
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorDark : PALETTE.floorLight;
      ctx.fillRect(px, py, T, T);
      if (ch === 'd') {
        ctx.fillStyle = PALETTE.floorShadow;
        ctx.fillRect(px, py, T, T);
      } else if (ch === 'r') {
        ctx.fillStyle = PALETTE.rug;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(px + 3, py + 3, T - 6, T - 6);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = PALETTE.rugEdge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 3.5, py + 3.5, T - 7, T - 7);
      } else if (ch === 'B') {
        ctx.fillStyle = PALETTE.bush;
        ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
        ctx.strokeStyle = PALETTE.bushEdge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 2.5, py + 2.5, T - 5, T - 5);
        ctx.fillStyle = PALETTE.bushEdge;
        ctx.beginPath();
        ctx.arc(px + 12, py + 13, 4, 0, Math.PI * 2);
        ctx.arc(px + 27, py + 26, 4, 0, Math.PI * 2);
        ctx.arc(px + 28, py + 11, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------- pieces

function drawLoot(ctx, world, showLabels) {
  for (const item of world.loot) {
    if (item.taken) continue;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = PALETTE.goldDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
    if (showLabels) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`$${item.value}`, item.x, item.y - 14);
    }
  }
  const target = world.target;
  if (!target.taken) {
    const pulse = 1 + Math.sin(world.time * 3) * 0.12;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.sapphire;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#dff4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.restore();
    if (showLabels) {
      ctx.fillStyle = PALETTE.sapphire;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`TARGET $${target.value}`, target.x, target.y - 18);
    }
  }
}

// The exit is drawn last, after the walls, so its label is never covered.
function drawExit(ctx, world) {
  const e = world.exit;
  const open = world.targetTaken;
  ctx.save();
  ctx.globalAlpha = open ? 0.95 : 0.45;
  ctx.strokeStyle = PALETTE.exit;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = open ? PALETTE.exit : PALETTE.textDim;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExitLabel(ctx, world) {
  const e = world.exit;
  ctx.fillStyle = world.targetTaken ? PALETTE.exit : PALETTE.textDim;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(world.targetTaken ? 'EXIT — GO!' : 'EXIT (locked)', e.x, e.y - 28);
}

function drawSmoke(ctx, world) {
  for (const cloud of world.smoke) {
    const alpha = Math.max(0, Math.min(0.75, (cloud.life / cloud.maxLife) * 0.75));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#9aa0b0';
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#c8ccd6';
    ctx.beginPath();
    ctx.arc(cloud.x - 22, cloud.y - 12, cloud.radius * 0.45, 0, Math.PI * 2);
    ctx.arc(cloud.x + 24, cloud.y + 14, cloud.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRings(ctx, world) {
  for (const pulse of world.noise) {
    const t = 1 - pulse.life / pulse.maxLife;
    ctx.save();
    ctx.globalAlpha = 0.8 * (1 - t);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, pulse.radius * t + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const ring of world.rings) {
    const t = 1 - ring.life / ring.maxLife;
    ctx.save();
    ctx.globalAlpha = (ring.strong ? 0.55 : 0.35) * (1 - t);
    ctx.strokeStyle = ring.strong ? PALETTE.danger : '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * (0.4 + t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function coneStyle(guard) {
  if (guard.state === 'alert') {
    return { fill: PALETTE.coneAlert, edge: PALETTE.coneAlertEdge };
  }
  if (guard.state === 'suspicious' || guard.state === 'search') {
    return { fill: PALETTE.coneSuspicious, edge: PALETTE.coneSuspiciousEdge };
  }
  return { fill: PALETTE.coneCalm, edge: PALETTE.coneCalmEdge };
}

function drawGuards(ctx, world, showSuspicion) {
  for (const guard of world.guards) {
    const style = coneStyle(guard);
    const poly = conePolygon(world, guard);
    ctx.save();
    ctx.fillStyle = style.fill;
    ctx.strokeStyle = style.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // The guard: a pale uniform, a dark outline, and a facing tick.
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.fillStyle = guard.warden ? PALETTE.warden : PALETTE.guard;
    ctx.strokeStyle = guard.warden ? PALETTE.wardenEdge : PALETTE.guardEdge;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, guard.warden ? 15 : 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(guard.dir);
    ctx.strokeStyle = '#1a1d26';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(guard.warden ? 20 : 18, 0);
    ctx.stroke();
    ctx.restore();

    // Suspicion bar above the head, only while the guard is wondering.
    if (guard.suspicion > 1) {
      const w = 30;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(guard.x - w / 2, guard.y - 26, w, 5);
      ctx.fillStyle =
        guard.suspicion >= 55 ? PALETTE.danger : PALETTE.gold;
      ctx.fillRect(guard.x - w / 2, guard.y - 26, w * (guard.suspicion / 100), 5);
    }
    if (showSuspicion && guard.suspicion > 1) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(guard.suspicion)), guard.x, guard.y - 30);
    }

    const mark = guardMark(guard);
    if (mark) {
      ctx.fillStyle = mark === '!' ? PALETTE.danger : PALETTE.gold;
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(mark, guard.x, guard.y - 32);
    }
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // A sprinting thief leans into the run; a sneaking one crouches low.
  const scale = p.stance === 'sneak' ? 0.85 : 1;
  ctx.scale(scale, scale);
  ctx.rotate(p.dir + Math.PI / 2);
  // Cloak: a dark triangle with a red scarf at the throat.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(11, 11);
  ctx.lineTo(-11, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4a5268';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.playerScarf;
  ctx.fillRect(-6, -4, 12, 4);
  // Hood.
  ctx.fillStyle = '#1a1d26';
  ctx.beginPath();
  ctx.arc(0, -3, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sprint noise rings around Wren's feet, so the loudness is visible.
  if (p.stance === 'sprint' && p.moving) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    const r = 18 + ((world.time * 40) % 14);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- HUD

export function drawHUD(ctx, world) {
  const w = VIEW.width;
  ctx.save();
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, w, 44);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Alarm meter.
  const word = alarmWord(world.alarm);
  ctx.fillStyle =
    word === 'ALARM' ? PALETTE.danger : word === 'TENSE' ? PALETTE.gold : PALETTE.ok;
  ctx.fillText(word, 16, 23);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(90, 15, 120, 12);
  ctx.fillStyle =
    word === 'ALARM' ? PALETTE.danger : word === 'TENSE' ? PALETTE.gold : PALETTE.ok;
  ctx.fillRect(90, 15, 120 * (world.alarm / 100), 12);

  // Loot, timer, score, best.
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`LOOT $${world.lootValue}`, 240, 23);
  ctx.fillText(`TIME ${formatTime(world.time)}`, 380, 23);
  ctx.fillText(`SCORE $${world.run.runScore}`, 490, 23);
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`BEST $${world.run.best}`, 620, 23);

  // Smoke pips.
  const p = world.player;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('SMOKE', 730, 23);
  for (let i = 0; i < SMOKE.maxCount; i++) {
    ctx.beginPath();
    ctx.arc(800 + i * 20, 22, 6, 0, Math.PI * 2);
    ctx.fillStyle = i < p.smokeLeft ? '#c8ccd6' : 'rgba(255,255,255,0.15)';
    ctx.fill();
  }

  // Visibility eye: what the floor thinks of Wren right now.
  const vis = visibilityOf(world);
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillStyle =
    vis.level === 0 ? PALETTE.ok : vis.level === 3 ? PALETTE.danger : PALETTE.gold;
  ctx.fillText(`EYE ${vis.label}`, 900, 23);

  // Heist name.
  ctx.fillStyle = PALETTE.textDim;
  ctx.textAlign = 'right';
  ctx.fillText(`${world.levelIndex + 1}/3 · ${world.level.name}`, w - 16, 23);
  ctx.restore();
}

// The minimap, bottom-right: walls, loot, guards, Wren and the exit.
export function drawMinimap(ctx, world) {
  const scale = 200 / VIEW.width;
  const mw = VIEW.width * scale;
  const mh = VIEW.height * scale;
  const ox = VIEW.width - mw - 14;
  const oy = VIEW.height - mh - 14;
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,10,0.78)';
  ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 4.5, oy - 4.5, mw + 9, mh + 9);
  for (let y = 0; y < world.rows; y++) {
    for (let x = 0; x < world.cols; x++) {
      if (world.tiles[y][x] === '#') {
        ctx.fillStyle = '#3a4156';
        ctx.fillRect(ox + x * T * scale, oy + y * T * scale, T * scale + 0.5, T * scale + 0.5);
      }
    }
  }
  for (const item of world.loot) {
    if (item.taken) continue;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(ox + item.x * scale - 1.5, oy + item.y * scale - 1.5, 3, 3);
  }
  for (const guard of world.guards) {
    ctx.fillStyle = guard.warden ? PALETTE.warden : PALETTE.danger;
    ctx.beginPath();
    ctx.arc(ox + guard.x * scale, oy + guard.y * scale, guard.warden ? 3.5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const e = world.exit;
  ctx.fillStyle = PALETTE.exit;
  ctx.beginPath();
  ctx.arc(ox + e.x * scale, oy + e.y * scale, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ox + world.player.x * scale, oy + world.player.y * scale, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The whole floor: tiles, loot, smoke, cones, guards, Wren, exit, rings.
// showLabels hides the gold "$150" texts when a menu sits on top.
export function drawWorld(ctx, world, showLabels = true) {
  drawFloor(ctx, world);
  drawLoot(ctx, world, showLabels);
  drawSmoke(ctx, world);
  drawGuards(ctx, world, world.modifiers && world.modifiers.showSuspicion);
  drawPlayer(ctx, world);
  drawExit(ctx, world);
  drawRings(ctx, world);
  drawExitLabel(ctx, world);
  drawHUD(ctx, world);
  drawMinimap(ctx, world);
}

// ---------------------------------------------------------------- screens

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(5,6,10,${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function centreText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW.width / 2, y);
}

export function drawTitle(ctx, world, counts) {
  drawWorld(ctx, world, false);
  dim(ctx, 0.8);
  centreText(ctx, 'SHADOWLINE', 190, 'bold 84px system-ui, sans-serif', PALETTE.text);
  centreText(
    ctx,
    '— A Thief in Three Heists —',
    250,
    'italic 24px system-ui, sans-serif',
    PALETTE.gold,
  );
  centreText(
    ctx,
    `${counts.heists} heists · ${counts.guards} guards · ${counts.wardens} elite wardens · ${counts.gadgets} gadgets · a hideout to grow`,
    300,
    '18px system-ui, sans-serif',
    PALETTE.textDim,
  );
  centreText(ctx, 'WASD move · Shift sprint · C sneak · E smoke · P pause · M mute', 380, '17px system-ui, sans-serif', PALETTE.text);
  centreText(ctx, 'Stay out of the cones. Take the target. Reach the exit unseen.', 410, '17px system-ui, sans-serif', PALETTE.text);
  centreText(ctx, 'Press SPACE to begin', 480, 'bold 22px system-ui, sans-serif', PALETTE.exit);
  centreText(ctx, `Best run: $${world.run.best}`, 530, '16px system-ui, sans-serif', PALETTE.textDim);
}

export function drawBriefing(ctx, world) {
  dim(ctx, 0.82);
  centreText(ctx, `HEIST ${world.levelIndex + 1} OF 3`, 200, 'bold 20px system-ui, sans-serif', PALETTE.gold);
  centreText(ctx, world.level.name, 260, 'bold 52px system-ui, sans-serif', PALETTE.text);
  centreText(ctx, world.level.subtitle, 320, '20px system-ui, sans-serif', PALETTE.textDim);
  const lootTotal = world.loot.reduce((n, i) => n + i.value, 0) + world.target.value;
  centreText(ctx, `Loot on the floor: $${lootTotal} · Guards: ${world.guards.length}${world.guards.some((g) => g.warden) ? ' (a warden walks here)' : ''}`, 370, '18px system-ui, sans-serif', PALETTE.text);
  centreText(ctx, 'Ghost bonus $500 if nobody ever spots you.', 400, '18px system-ui, sans-serif', PALETTE.text);
  centreText(ctx, 'Press SPACE to slip in', 480, 'bold 22px system-ui, sans-serif', PALETTE.exit);
}

export function drawUpgrade(ctx, world, choices, selected) {
  dim(ctx, 0.82);
  centreText(ctx, 'HEIST COMPLETE — PICK A GADGET', 150, 'bold 20px system-ui, sans-serif', PALETTE.gold);
  centreText(ctx, `Run score so far: $${world.run.runScore}`, 190, '20px system-ui, sans-serif', PALETTE.text);
  const cardW = 300;
  const gap = 30;
  const total = cardW * 3 + gap * 2;
  const startX = (VIEW.width - total) / 2;
  choices.forEach((gadget, i) => {
    const x = startX + i * (cardW + gap);
    const y = 240;
    const h = 220;
    ctx.save();
    ctx.fillStyle = i === selected ? 'rgba(242,193,78,0.16)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = i === selected ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = i === selected ? 3 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gadget.name, x + cardW / 2, y + 50);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '17px system-ui, sans-serif';
    wrapText(ctx, gadget.desc, x + cardW / 2, y + 100, cardW - 36, 24);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`Press ${i + 1}`, x + cardW / 2, y + h - 30);
    ctx.restore();
  });
  centreText(ctx, 'Keys 1 / 2 / 3 — or click a card', 520, '17px system-ui, sans-serif', PALETTE.textDim);
}

export function drawComplete(ctx, world) {
  const b = world.breakdown;
  dim(ctx, 0.82);
  centreText(ctx, 'HEIST COMPLETE', 170, 'bold 48px system-ui, sans-serif', PALETTE.exit);
  centreText(ctx, world.level.name, 220, '22px system-ui, sans-serif', PALETTE.textDim);
  const rows = [
    ['Loot', `$${b.loot}`],
    ['Time bonus', `+$${b.timeBonus}`],
    ['Ghost bonus', b.ghost ? `+$${b.ghost}` : '—'],
    ['Clean sweep', b.clean ? `+$${b.clean}` : '—'],
    ['Heist total', `$${b.total}`],
    ['Run score', `$${world.run.runScore}`],
  ];
  ctx.font = '20px system-ui, sans-serif';
  rows.forEach(([label, value], i) => {
    const y = 280 + i * 38;
    ctx.textAlign = 'right';
    ctx.fillStyle = i >= 4 ? PALETTE.gold : PALETTE.text;
    ctx.font = i >= 4 ? 'bold 20px system-ui, sans-serif' : '20px system-ui, sans-serif';
    ctx.fillText(label, VIEW.width / 2 - 20, y);
    ctx.textAlign = 'left';
    ctx.fillText(value, VIEW.width / 2 + 20, y);
  });
  centreText(
    ctx,
    world.levelIndex < 2 ? 'Press SPACE for the next heist' : 'Press SPACE to see your run',
    540,
    'bold 22px system-ui, sans-serif',
    PALETTE.exit,
  );
}

export function drawCaught(ctx, world) {
  dim(ctx, 0.78);
  centreText(ctx, 'CAUGHT', 240, 'bold 72px system-ui, sans-serif', PALETTE.danger);
  centreText(
    ctx,
    world.caughtBy === 'warden'
      ? 'A warden caught you in the open.'
      : 'A guard caught you in the open.',
    310,
    '22px system-ui, sans-serif',
    PALETTE.text,
  );
  centreText(ctx, `The run keeps $${world.run.banked} banked. The heist is lost.`, 350, '18px system-ui, sans-serif', PALETTE.textDim);
  centreText(ctx, 'R — retry this heist · H — back to the hideout', 430, 'bold 20px system-ui, sans-serif', PALETTE.exit);
}

export function drawPaused(ctx, world) {
  dim(ctx, 0.7);
  centreText(ctx, 'PAUSED', 300, 'bold 56px system-ui, sans-serif', PALETTE.text);
  centreText(ctx, 'P — resume · R — restart heist · H — hideout · M — mute', 370, '18px system-ui, sans-serif', PALETTE.textDim);
}

export function drawHideout(ctx, world, selected) {
  dim(ctx, 0.85);
  centreText(ctx, 'THE HIDEOUT', 140, 'bold 48px system-ui, sans-serif', PALETTE.text);
  centreText(ctx, `Banked loot: $${world.run.banked} · Best run: $${world.run.best}`, 185, '20px system-ui, sans-serif', PALETTE.gold);
  const items = [
    { id: 'spare-smoke', name: 'Spare Smoke', cost: 400, desc: 'Start every heist with +1 smoke pellet, forever.' },
    { id: 'silent-soles', name: 'Silent Soles', cost: 700, desc: 'Sneak 15% faster, forever.' },
    { id: 'insider-map', name: 'Insider Map', cost: 900, desc: 'The minimap shows guard patrol routes, forever.' },
  ];
  items.forEach((item, i) => {
    const y = 240 + i * 90;
    const owned = world.run.hideout.includes(item.id);
    const afford = world.run.banked >= item.cost;
    ctx.save();
    ctx.fillStyle = i === selected ? 'rgba(242,193,78,0.14)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = i === selected ? PALETTE.gold : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = i === selected ? 2.5 : 1;
    ctx.beginPath();
    ctx.roundRect(340, y, 600, 70, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, 360, y + 28);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(item.desc, 360, y + 52);
    ctx.textAlign = 'right';
    ctx.fillStyle = owned ? PALETTE.ok : afford ? PALETTE.gold : PALETTE.danger;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(owned ? 'OWNED' : `$${item.cost}`, 920, y + 38);
    ctx.restore();
  });
  centreText(ctx, 'Keys 1 / 2 / 3 to buy · SPACE to start the next heist · H to leave', 540, '17px system-ui, sans-serif', PALETTE.textDim);
}

export function drawFinal(ctx, world) {
  dim(ctx, 0.85);
  centreText(ctx, 'THE TAKE', 190, 'bold 64px system-ui, sans-serif', PALETTE.gold);
  centreText(ctx, 'Three heists, one thief, no alarms that stuck.', 250, '20px system-ui, sans-serif', PALETTE.textDim);
  world.run.heistScores.forEach((score, i) => {
    centreText(ctx, `${LEVELS_NAMES[i]} — $${score}`, 320 + i * 40, '22px system-ui, sans-serif', PALETTE.text);
  });
  centreText(ctx, `RUN SCORE: $${world.run.runScore}`, 480, 'bold 32px system-ui, sans-serif', PALETTE.exit);
  centreText(ctx, `Banked for the hideout: $${world.run.banked}`, 530, '18px system-ui, sans-serif', PALETTE.textDim);
  centreText(ctx, 'Press R to run it again', 590, '18px system-ui, sans-serif', PALETTE.textDim);
}

const LEVELS_NAMES = ['The Marble Museum', 'The Gilded Casino', 'The Sky Gallery'];

// Simple centred word-wrap for card descriptions.
function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => {
    ctx.fillText(l, cx, y + i * lineHeight);
  });
}
