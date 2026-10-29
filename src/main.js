// Entry point: wires game, world, UI and input together.
import { Game, N, fmt } from './game.js';
import { BUILDINGS, BUILDING_LIST, RES, ERAS, TECHS, LANDMARKS } from './data.js';
import { World, renderThumbs } from './render.js';
import { UI } from './ui.js';
import { sfx } from './audio.js';

const canvas = document.getElementById('c');
const game = new Game();
const away = game.load();
const firstRun = game.s.stats.built === 0 && game.s.techs.length === 0;
const world = new World(canvas, game);
const thumbs = renderThumbs(BUILDING_LIST.map(b => b.id));

const app = {
  sfx,
  mode: 'view',          // view | place | demolish
  placing: null,
  rot: 0,
  selected: null,
  preview: null,

  tool(t) {
    sfx.unlock(); sfx.tap();
    if (t === 'build') {
      if (this.mode === 'place') { this.stopPlacing(); ui.openDrawer(); }
      else if (!document.getElementById('drawer').hidden) { ui.closeSheets(); ui.setTool(null); return; }
      else { this.setMode('view'); this.deselect(); ui.openDrawer(); }
      ui.setTool('build');
    } else if (t === 'tech') { this.setMode('view'); ui.openTech(); }
    else if (t === 'quests') { this.setMode('view'); ui.openQuests(); }
    else if (t === 'demolish') {
      if (this.mode === 'demolish') { this.setMode('view'); return; }
      this.setMode('demolish');
      ui.toast('🔨 Tap a building to demolish it (50% refund). Tap 🔨 again to stop.');
    } else if (t === 'menu') this.menu();
  },
  setMode(m) {
    if (this.mode === 'place' && m !== 'place') { world.setGhost(null); ui.hidePlacing(); this.placing = null; }
    this.mode = m;
    world.grid.visible = m === 'place' || m === 'demolish';
    world.showHeat(m === 'place' && this.heatFor(this.placing));
    ui.setTool(m === 'demolish' ? 'demolish' : m === 'place' ? 'build' : null);
    if (m !== 'view') this.deselect();
  },
  heatFor(type) {
    const d = type && BUILDINGS[type];
    return !!d && (d.housing > 0 || d.beauty !== 0);
  },
  startPlacing(type) {
    this.deselect();
    this.placing = type;
    this.mode = 'place';
    this.preview = null;
    world.grid.visible = true;
    world.showHeat(this.heatFor(type));
    ui.setTool('build');
    ui.showPlacing(type);
    // show a ghost in the middle of the screen so the player sees what they're placing
    this.ghostAt(world.w / 2, world.h * 0.45);
  },
  stopPlacing() { this.setMode('view'); },
  rotate() { this.rot = (this.rot + 1) % 4; sfx.tap(); if (this.lastGhost) this.ghostAt(...this.lastGhost); },

  footprintAt(px, py) {
    const p = world.ground(px, py);
    if (!p) return null;
    const s = BUILDINGS[this.placing].size;
    return [Math.round(p.x - s / 2), Math.round(p.z - s / 2)];
  },
  autoRot(type, x, z) {
    const d = BUILDINGS[type];
    if (d.size !== 1 || d.road) return this.rot;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // rot 0 faces +z
    for (let k = 0; k < 4; k++) {
      const r = (this.rot + k) % 4;
      const o = game.at(x + dirs[r][0], z + dirs[r][1]);
      if (o && BUILDINGS[o.type].road) return r;
    }
    return this.rot;
  },
  ghostAt(px, py) {
    if (!this.placing) return;
    const f = this.footprintAt(px, py);
    if (!f) return;
    this.lastGhost = [px, py];
    const [x, z] = f;
    const chk = game.canPlace(this.placing, x, z);
    world.setGhost(this.placing, x, z, this.autoRot(this.placing, x, z), chk.ok || chk.poor);
    // bonus preview
    if (chk.ok || chk.poor) {
      const { m, bonus } = game.bonusFor({ type: this.placing, x, z, level: 1 });
      const d = BUILDINGS[this.placing];
      const parts = bonus.map(([n, v]) => `${n} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
      this.preview = (chk.poor ? '<span style="color:#b3261e">Not enough resources</span> · ' : '') +
        (d.paint || d.cat === 'decor' ? (d.beauty ? `+${d.beauty} beauty around it` : ui.placingHint)
          : parts.length ? `<b style="color:${m >= 1 ? '#4f7f3a' : '#b3261e'}">Output ${m >= 1 ? '+' : ''}${Math.round((m - 1) * 100)}%</b>: ${parts.join(', ')}` : 'No bonuses here. Try near a street or a booster.');
    } else this.preview = `<span style="color:#b3261e">${chk.reason}</span>`;
    ui.refreshPlacing();
  },
  tryPlace(x, z, quiet = false) {
    const type = this.placing;
    const chk = game.canPlace(type, x, z);
    if (!chk.ok) {
      if (!quiet) {
        sfx.error();
        if (chk.poor) {
          const c = game.costOf(type);
          const miss = Object.keys(c).filter(r => game.s.res[r] < c[r]).map(r => `${RES[r].icon} ${fmt(c[r] - game.s.res[r])} more ${RES[r].name}`);
          ui.toast(`Need ${miss.join(', ')}`);
        } else ui.toast(chk.reason);
      }
      return null;
    }
    const cost = game.costOf(type);
    const b = game.place(type, x, z, this.autoRot(type, x, z));
    if (!b) return null;
    const d = BUILDINGS[type];
    const s = world.project({ x: x + d.size / 2, y: 0.6, z: z + d.size / 2 });
    if (d.paint) sfx.paint();
    else {
      sfx.place();
      if (s) {
        ui.floatText(s.x, s.y, Object.entries(cost).map(([r, v]) => `−${fmt(v)}${RES[r].icon}`).join(' '), 'bad');
        if (b.mult > 1.001) setTimeout(() => ui.floatText(s.x, s.y - 26, `+${Math.round((b.mult - 1) * 100)}% bonus!`, 'big'), 250);
      }
    }
    if (d.unique) this.setMode('view');
    return b;
  },

  select(b) {
    this.selected = b;
    world.select(b);
    ui.showInspect(b);
    sfx.tap();
  },
  deselect() {
    this.selected = null;
    world.select(null);
    if (ui) { document.getElementById('inspect').hidden = true; ui.inspected = null; }
  },
  upgrade(b) {
    if (game.upgrade(b.uid)) {
      sfx.place(); sfx.claim();
      const s = world.project({ x: b.x + BUILDINGS[b.type].size / 2, y: 1, z: b.z + BUILDINGS[b.type].size / 2 });
      if (s) ui.floatText(s.x, s.y, `★ Level ${b.level}!`, 'big');
      ui.showInspect(b);
    } else sfx.error();
  },
  demolish(b, confirmed = false) {
    const d = BUILDINGS[b.type];
    if (b.type === 'palazzoVecchio') { ui.toast('The Signoria cannot be demolished!'); sfx.error(); return; }
    if (!confirmed && (d.unique || (d.cost.florins ?? 0) >= 300 || b.level > 1)) {
      ui.modal({
        title: `Demolish ${d.name}?`, big: '🔨', body: '<p>You will get back half of its base cost.</p>',
        buttons: [{ label: 'Keep it', cls: 'alt' }, { label: 'Demolish', fn: () => this.demolish(b, true) }],
      });
      return;
    }
    const s = world.project({ x: b.x + d.size / 2, y: 0.5, z: b.z + d.size / 2 });
    const refund = game.remove(b.uid);
    if (!refund) return;
    sfx.demolish();
    if (s) ui.floatText(s.x, s.y, Object.entries(refund).filter(([, v]) => v).map(([r, v]) => `+${fmt(v)}${RES[r].icon}`).join(' ') || 'Cleared');
    this.deselect();
  },
  collect(uid) {
    const b = game.byUid.get(uid);
    if (!b) return;
    const d = BUILDINGS[b.type];
    const p = world.bubbles.get(uid)?.position ?? { x: b.x + d.size / 2, y: 1, z: b.z + d.size / 2 };
    const s = world.project(p);
    const reward = game.collect(uid);
    if (!reward || !s) return;
    const txt = Object.entries(reward).map(([r, v]) => `+${fmt(v)}${RES[r].icon}`).join(' ');
    ui.floatText(s.x, s.y, txt, this.lastGold ? 'big' : '');
    for (const r in reward) ui.flyTo(s.x, s.y, r, this.lastGold ? 6 : 3);
  },
  research(id) {
    if (game.research(id)) ui.openTech();
    else sfx.error();
  },
  claim(id, e) {
    const reward = game.claim(id);
    if (!reward) return;
    sfx.claim();
    const r = e?.target?.getBoundingClientRect?.();
    const x = r ? r.left + r.width / 2 : world.w / 2, y = r ? r.top : world.h / 2;
    ui.floatText(x, y, Object.entries(reward).map(([k, v]) => `+${fmt(v)}${RES[k].icon}`).join(' '), 'big');
    for (const k in reward) ui.flyTo(x, y, k, 5);
    ui.renderQuests(true);
  },
  camButton(k) {
    sfx.tap();
    if (k === 'left') world.cam.yaw -= Math.PI / 4;
    else if (k === 'right') world.cam.yaw += Math.PI / 4;
    else { world.cam.tx = 20; world.cam.tz = 14; world.cam.dist = 23; }
  },
  menu() {
    const s = game.s;
    ui.modal({
      title: 'Medici Builder', sub: 'Florence, Anno Domini 1350 –', big: '⚜️',
      body: `<div class="opt">Sound <button class="btn alt" id="m-sound" style="flex:0 0 90px">${sfx.enabled ? 'On' : 'Off'}</button></div>
        <div class="opt">Shadows <button class="btn alt" id="m-shadow" style="flex:0 0 90px">${world.renderer.shadowMap.enabled ? 'On' : 'Off'}</button></div>
        <div class="opt">How to play <button class="btn alt" id="m-help" style="flex:0 0 90px">Read</button></div>
        <p style="font-size:14px">Buildings: ${s.buildings.length} · Research: ${s.techs.length}/${Object.keys(TECHS).length} · Wonders: ${LANDMARKS.filter(id => game.count(id)).length}/${LANDMARKS.length} · Commissions: ${s.stats.questsDone}</p>
        <div class="opt">Start over <button class="btn" id="m-reset" style="flex:0 0 90px">Reset</button></div>`,
      buttons: [{ label: 'Close' }],
    });
    document.getElementById('m-sound').onclick = e => { e.target.textContent = sfx.toggle() ? 'On' : 'Off'; };
    document.getElementById('m-shadow').onclick = e => {
      const r = world.renderer;
      r.shadowMap.enabled = !r.shadowMap.enabled;
      world.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
      world.shadowDirty = true;
      e.target.textContent = r.shadowMap.enabled ? 'On' : 'Off';
    };
    document.getElementById('m-help').onclick = () => help();
    document.getElementById('m-reset').onclick = () => ui.modal({
      title: 'Start over?', big: '⚠️', body: '<p>Your Florence will be lost for ever.</p>',
      buttons: [{ label: 'Cancel', cls: 'alt' }, { label: 'Reset', fn: () => { game.reset(); location.reload(); } }],
    });
  },
};

const ui = new UI(game, world, thumbs, app);

function help() {
  ui.modal({
    title: 'How to Play', big: '📜',
    body: `<ul>
      <li><b>Build</b> homes 🏠 for citizens. They pay taxes 🪙 and work in your buildings.</li>
      <li>Feed them with farms 🌾. Keep them happy with faith 🕊️ and beauty 🌷.</li>
      <li><b>Placement matters.</b> Streets give +10%. Markets, granaries, banks and dye-works boost their neighbours. Industry is ugly, gardens are lovely.</li>
      <li><b>Tap bubbles</b> over buildings to collect bonuses. Gold ⭐ bubbles are rare and pay big.</li>
      <li><b>Research</b> 📜 with Ingegno 💡 to unlock 30+ buildings and wonders.</li>
      <li>Earn <b>Prestige ⭐</b> through Art 🎨 and wonders to advance through four eras.</li>
      <li>Fulfil <b>Patrons'</b> commissions 📋 for rewards. Build all 10 wonders to crown Florence.</li>
      <li>Drag to pan, pinch to zoom, twist to rotate. Upgrade buildings to ★★★ by tapping them.</li></ul>`,
  });
}

// ── game events → presentation ──
game.on('build', b => { world.addBuilding(b); if (world.heat.visible) world.showHeat(true); });
game.on('remove', b => { world.removeBuilding(b); if (world.heat.visible) world.showHeat(true); });
game.on('upgrade', b => world.refreshBuilding(b));
game.on('bubble', b => world.showBubble(b));
game.on('collect', (b, reward, gold) => { app.lastGold = gold; world.hideBubble(b.uid); gold ? sfx.gold() : sfx.coin(); });
game.on('tech', t => {
  sfx.research();
  const names = t.unlock.map(u => BUILDINGS[u].name);
  ui.toast(`📜 <b>${t.name}</b> researched!${names.length ? `<br>New: ${names.join(', ')}` : ''}`);
});
game.on('questReady', q => { sfx.claim(); ui.toast(`📋 Commission complete: <b>${game.questText(q)}</b>. Claim it in Patrons!`); });
game.on('era', (era, reward) => {
  sfx.fanfare();
  ui.notify({
    title: era.name, sub: `Era ${['', 'I', 'II', 'III', 'IV'][era.n]} · ${era.sub}`, big: '🎺',
    body: `<p>${era.text}</p><p><b>New research is available.</b></p>`, gains: reward, buttons: [{ label: 'Avanti!' }],
  });
});
game.on('wonder', b => {
  const d = BUILDINGS[b.type];
  setTimeout(() => {
    sfx.fanfare();
    world.focus(b);
    ui.notify({ title: d.name, sub: 'A wonder rises over Florence', big: '🏛️', body: `<p>${d.desc}</p>`, gains: { prestige: d.prestige } });
  }, 500);
});
game.on('win', () => setTimeout(() => ui.notify({
  title: 'Gloria di Firenze!', sub: 'All ten wonders stand', big: '👑',
  body: '<p>Your Florence outshines Rome, Venice and Paris together. The Renaissance bears your name.</p><p><i>Keep building. The city is yours to perfect.</i></p>',
}), 2500));

// ── input ──
const ptrs = new Map();
let gest = null;
const DRAG = 9;

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  sfx.unlock();
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) {
    gest = { kind: e.button === 2 ? 'rotate' : e.button === 1 ? 'pan' : 'pending', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), tiles: new Set() };
    if (app.mode === 'place' && gest.kind === 'pending') app.ghostAt(e.clientX, e.clientY);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    gest = { kind: 'multi', d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
});
canvas.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) {
    if (e.pointerType === 'mouse' && app.mode === 'place') app.ghostAt(e.clientX, e.clientY);
    return;
  }
  const p = ptrs.get(e.pointerId);
  p.x = e.clientX; p.y = e.clientY;
  if (!gest) return;
  if (gest.kind === 'multi' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (gest.d > 0) world.cam.dist *= gest.d / Math.max(1, d);
    let da = ang - gest.a;
    if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    world.cam.yaw += da;
    pan(gest.mx, gest.my, mx, my);
    Object.assign(gest, { d, a: ang, mx, my });
    return;
  }
  if (gest.kind === 'pending' && Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > DRAG) {
    gest.kind = app.mode === 'place' && BUILDINGS[app.placing].paint ? 'paint' : 'pan';
    if (gest.kind === 'paint') paintLine(gest.sx, gest.sy, gest.sx, gest.sy);
    else if (app.mode === 'place') world.setGhost(null);
  }
  if (gest.kind === 'pan') pan(gest.lx, gest.ly, e.clientX, e.clientY);
  else if (gest.kind === 'rotate') { world.cam.yaw -= (e.clientX - gest.lx) * 0.008; }
  else if (gest.kind === 'paint') { paintLine(gest.lx, gest.ly, e.clientX, e.clientY); app.ghostAt(e.clientX, e.clientY); }
  gest.lx = e.clientX; gest.ly = e.clientY;
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gest?.kind === 'pending' && e.type === 'pointerup' && performance.now() - gest.t < 700) tap(e.clientX, e.clientY);
  if (ptrs.size === 1) {
    const [p] = [...ptrs.values()];
    gest = { kind: 'pan', sx: p.x, sy: p.y, lx: p.x, ly: p.y, t: 0 };
  } else if (!ptrs.size) {
    if (gest?.kind === 'paint') game.save();
    gest = null;
  }
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); world.cam.dist *= 1 + Math.sign(e.deltaY) * Math.min(0.15, Math.abs(e.deltaY) * 0.0012); }, { passive: false });

function pan(x0, y0, x1, y1) {
  world.updateCamera();
  const a = world.ground(x0, y0), b = world.ground(x1, y1);
  if (!a || !b) return;
  world.cam.tx += a.x - b.x; world.cam.tz += a.z - b.z;
  world.updateCamera();
}

function paintLine(x0, y0, x1, y1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 0; i <= steps; i++) {
    const f = app.footprintAt(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
    if (!f) continue;
    const k = f[1] * N + f[0];
    if (gest.tiles.has(k)) continue;
    gest.tiles.add(k);
    app.tryPlace(f[0], f[1], true);
  }
}

function tap(x, y) {
  if (ui.modalOpen) return;
  if (app.mode === 'place') {
    const f = app.footprintAt(x, y);
    if (f) { app.tryPlace(f[0], f[1]); app.ghostAt(x, y); }
    return;
  }
  const bub = world.pickBubble(x, y);
  if (bub && app.mode === 'view') { app.collect(bub); return; }
  const b = world.pickBuilding(x, y);
  if (app.mode === 'demolish') { if (b) app.demolish(b); return; }
  if (b) {
    if (b.ready) app.collect(b.uid);
    else app.select(b);
  } else {
    app.deselect();
    if (!document.getElementById('drawer').hidden) { ui.closeSheets(); ui.setTool(null); }
  }
}

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const c = world.cam, s = 0.8;
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
  switch (e.key.toLowerCase()) {
    case 'w': case 'arrowup': c.tx += fx * s; c.tz += fz * s; break;
    case 's': case 'arrowdown': c.tx -= fx * s; c.tz -= fz * s; break;
    case 'a': case 'arrowleft': c.tx += fz * s; c.tz -= fx * s; break;
    case 'd': case 'arrowright': c.tx -= fz * s; c.tz += fx * s; break;
    case 'q': c.yaw -= 0.15; break;
    case 'e': c.yaw += 0.15; break;
    case 'r': if (app.mode === 'place') app.rotate(); break;
    case 'escape': app.setMode('view'); app.deselect(); ui.closeSheets(); break;
  }
});

// ── resize & loop ──
function resize() { world.resize(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);
resize();

let last = performance.now(), acc = 0, uiT = 0, saveT = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= 0.1) { game.tick(0.1); acc -= 0.1; }
  uiT += dt;
  if (uiT > 0.25) { ui.update(); uiT = 0; }
  saveT += dt;
  if (saveT > 15) { game.save(); saveT = 0; }
  world.frame(dt);
  requestAnimationFrame(loop);
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { game.save(); hiddenAt = Date.now(); }
  else if (hiddenAt) {
    const r = game.offline((Date.now() - hiddenAt) / 1000);
    hiddenAt = 0;
    if (r) showAway(r);
    for (const b of game.s.buildings) if (b.ready && !world.bubbles.has(b.uid)) world.showBubble(b);
  }
});
window.addEventListener('pagehide', () => game.save());

function showAway(r) {
  const h = Math.floor(r.sec / 3600), m = Math.floor(r.sec % 3600 / 60);
  ui.notify({
    title: 'Bentornato!', sub: `You were away ${h ? h + 'h ' : ''}${m}m`, big: '🌅',
    body: '<p>While you were gone, Florence kept working:</p>', gains: r.gains, buttons: [{ label: 'Splendid' }],
  });
}

game.checkQuests();
ui.update();
world.cam.tx = 20; world.cam.tz = 15;
requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });
setTimeout(() => document.getElementById('loading').classList.add('gone'), 150);

if (firstRun) {
  ui.modal({
    title: 'Benvenuto, Gonfaloniere', sub: 'Florence, 1350', big: '⚜️',
    body: `<p>The Black Death has passed. Florence is a small town of merchants around the Palazzo della Signoria.</p>
      <p>Make it the jewel of the Renaissance. Build homes and farms, please your patrons, research the arts and sciences, and raise the Duomo itself.</p>
      <p><i>Open 📋 Patrons for your first commissions.</i></p>`,
    buttons: [{ label: 'How to play', cls: 'alt', fn: help }, { label: 'Begin!', fn: () => ui.openQuests() }],
  });
} else if (away) showAway(away);

// debugging handle
window.medici = { game, world, ui, app };
