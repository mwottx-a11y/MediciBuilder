// DOM user interface: HUD, build drawer, inspector, tech tree, commissions, modals, effects.
import { RES, RES_KEYS, BUILDINGS, BUILDING_LIST, CATEGORIES, TECHS, TECH_LIST, BRANCHES, ERAS, LANDMARKS } from './data.js';
import { fmt, levelProd, levelPeople } from './game.js';

const $ = s => document.querySelector(s);
const pct = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export function costHTML(cost, game) {
  const parts = Object.entries(cost).map(([r, v]) => `<span class="${game && game.s.res[r] < v ? 'no' : ''}">${RES[r].icon}${fmt(v)}</span>`);
  return parts.join('') || '<span>free</span>';
}
const gainsHTML = g => Object.entries(g).filter(([, v]) => v).map(([r, v]) =>
  `<span>${r === 'prestige' ? '⭐' : RES[r].icon} ${v > 0 ? '+' : ''}${fmt(v)}</span>`).join('');

export class UI {
  constructor(game, world, thumbs, app) {
    this.g = game; this.w = world; this.thumbs = thumbs; this.app = app;
    this.cat = 'housing';
    this.seen = new Set(); // building types the player has seen unlocked (for NEW tags)
    try { JSON.parse(localStorage.getItem('medici-seen') || '[]').forEach(t => this.seen.add(t)); } catch (e) { /* storage unavailable */ }
    if (!this.seen.size) BUILDING_LIST.forEach(b => !b.tech && this.seen.add(b.id));
    this.buildHUD();
    this.bindStatic();
  }

  // ── HUD ──
  buildHUD() {
    const box = $('#res');
    this.chips = {};
    for (const r of RES_KEYS) {
      const c = document.createElement('button');
      c.className = 'chip';
      c.innerHTML = `<span class="ic">${RES[r].icon}</span><span class="v"><span class="n">0</span><small></small></span>`;
      c.onclick = () => this.toast(`<b>${RES[r].name}</b><br>${this.resHelp(r)}`);
      box.appendChild(c);
      this.chips[r] = { el: c, n: c.querySelector('.n'), rate: c.querySelector('small'), last: 0 };
    }
  }
  resHelp(r) {
    return {
      florins: 'Gold coin. Taxes from homes plus markets, banks and trade.',
      food: 'Feeds citizens. Without grain they leave the city.',
      stone: 'Quarried at a Cava. Needed for nearly every building.',
      wool: 'From sheep pastures. Lanifici weave it into cloth.',
      cloth: 'Florence\'s great export. Sold through a Fondaco, needed for luxuries.',
      faith: 'Chapels and churches. Enough faith keeps citizens happy.',
      art: 'Every point of Art also adds ⭐ Prestige, which moves you into the next era.',
      ideas: 'Ingegno: spend it on research in the Libro dell\'Ingegno.',
    }[r];
  }
  resVisible(r) {
    if (['florins', 'food', 'stone', 'ideas'].includes(r)) return true;
    const g = this.g;
    if (g.s.res[r] >= 1 || Math.abs(g.rates?.[r] ?? 0) > 0.001) return true;
    return BUILDING_LIST.some(b => !b.hidden && g.isUnlocked(b.id) && (b.prod[r] || b.cons[r]) && b.tech);
  }

  update() {
    const g = this.g, s = g.s;
    for (const r of RES_KEYS) {
      const c = this.chips[r];
      const vis = this.resVisible(r);
      c.el.hidden = !vis;
      if (!vis) continue;
      const v = s.res[r];
      c.n.textContent = fmt(v);
      const rate = g.rates?.[r] ?? 0;
      c.rate.textContent = Math.abs(rate) < 0.05 ? '' : `${rate > 0 ? '+' : ''}${fmt(rate)}/s`;
      c.rate.className = rate < 0 ? 'neg' : '';
      if (v > c.last + Math.max(5, c.last * 0.05) && c.bumped) { c.el.classList.remove('pulse'); void c.el.offsetWidth; c.el.classList.add('pulse'); }
      c.last = v; c.bumped = true;
    }
    const pop = $('#pop');
    pop.textContent = `👥 ${Math.floor(s.pop)}/${Math.floor(g.cap)}`;
    pop.classList.toggle('warn', !!g.starving);
    const h = Math.round(g.happiness);
    const happy = $('#happy');
    happy.textContent = `${h >= 70 ? '😊' : h >= 45 ? '🙂' : h >= 30 ? '😐' : '😠'} ${h}%`;
    happy.classList.toggle('warn', h < 30);
    const era = ERAS[s.era], next = ERAS[s.era + 1];
    $('#era-name').textContent = `${ROMAN[s.era]} · ${era.name}`;
    if (next) {
      const p = Math.min(1, s.prestige / next.prestige), q = next.pop ? Math.min(1, s.pop / next.pop) : 1;
      $('#era-bar').style.width = `${Math.min(p, q) * 100}%`;
      $('#era-txt').textContent = `⭐${fmt(s.prestige)}/${fmt(next.prestige)}`;
    } else {
      $('#era-bar').style.width = '100%';
      $('#era-txt').textContent = `⭐${fmt(s.prestige)}`;
    }
    // badges
    const ready = TECH_LIST.filter(t => g.techState(t.id) === 'ready').length + (g.patronageState() === 'ready' ? 1 : 0);
    const tb = $('#tech-badge'); tb.hidden = !ready; tb.textContent = ready;
    const qb = $('#quest-badge'); qb.hidden = !g.readyQuests; qb.textContent = g.readyQuests;

    if (!$('#drawer').hidden) this.refreshCards();
    if (!$('#inspect').hidden && this.inspected) this.refreshInspect();
    if (!$('#quests').hidden) this.renderQuests();
    if (!$('#techtree').hidden) { this.refreshTech(); }
    if (!$('#placing').hidden) this.refreshPlacing();
  }

  bindStatic() {
    document.querySelectorAll('#bar button').forEach(b => b.onclick = () => this.app.tool(b.dataset.tool));
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $('#' + b.dataset.close).hidden = true; this.app.sfx.tap(); });
    $('#pl-x').onclick = () => this.app.stopPlacing();
    $('#pl-rot').onclick = () => this.app.rotate();
    document.querySelectorAll('#cam-ctl button').forEach(b => b.onclick = () => this.app.camButton(b.dataset.cam));
    $('#pop').onclick = () => this.popInfo();
    $('#happy').onclick = () => this.happyInfo();
    $('#era').onclick = () => this.eraInfo();
  }

  setTool(t) { document.querySelectorAll('#bar button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); }

  // ── build drawer ──
  openDrawer() {
    this.closeSheets();
    $('#drawer').hidden = false;
    this.renderTabs();
    this.renderCards();
  }
  closeSheets() {
    $('#drawer').hidden = true; $('#inspect').hidden = true; this.inspected = null;
  }
  renderTabs() {
    const tabs = $('#tabs');
    tabs.innerHTML = '';
    for (const c of CATEGORIES) {
      const list = BUILDING_LIST.filter(b => b.cat === c.id && !b.hidden);
      if (!list.length) continue;
      const fresh = list.some(b => this.g.isUnlocked(b.id) && !this.seen.has(b.id));
      const btn = document.createElement('button');
      btn.className = c.id === this.cat ? 'on' : '';
      btn.innerHTML = `${c.icon} ${c.name}${fresh ? '<i class="dot"></i>' : ''}`;
      btn.onclick = () => { this.cat = c.id; this.app.sfx.tap(); this.renderTabs(); this.renderCards(); };
      tabs.appendChild(btn);
    }
  }
  renderCards() {
    const box = $('#cards');
    box.innerHTML = '';
    box.scrollLeft = 0;
    this.cardEls = [];
    const g = this.g;
    for (const d of BUILDING_LIST.filter(b => b.cat === this.cat && !b.hidden)) {
      const card = document.createElement('button');
      card.className = 'card-b';
      card.innerHTML = `<img src="${this.thumbs[d.id]}" alt=""><b>${d.name}</b><div class="cost"></div>`;
      card.onclick = () => {
        if (!g.isUnlocked(d.id)) {
          this.app.sfx.error();
          this.toast(`🔒 <b>${d.name}</b> needs <i>${TECHS[d.tech].name}</i>. Look in 📜 Research.`);
          return;
        }
        if (d.unique && g.count(d.id)) { this.toast(`<b>${d.name}</b> is already built.`); return; }
        this.seen.add(d.id);
        try { localStorage.setItem('medici-seen', JSON.stringify([...this.seen])); } catch (e) { /* storage unavailable */ }
        this.app.startPlacing(d.id);
      };
      box.appendChild(card);
      this.cardEls.push([card, d]);
    }
    this.refreshCards();
  }
  refreshCards() {
    const g = this.g;
    for (const [card, d] of this.cardEls ?? []) {
      const unlocked = g.isUnlocked(d.id);
      const built = d.unique && g.count(d.id) > 0;
      card.classList.toggle('locked', !unlocked);
      card.classList.toggle('done', built);
      card.classList.toggle('new', unlocked && !this.seen.has(d.id));
      const html = !unlocked ? `<span class="lockt">${TECHS[d.tech].name}</span>` : built ? '<span>✓ Built</span>' : costHTML(g.costOf(d.id), g);
      const cost = card.querySelector('.cost');
      if (cost.innerHTML !== html) cost.innerHTML = html;
    }
  }

  // ── placing bar ──
  showPlacing(type) {
    this.closeSheets();
    const d = BUILDINGS[type];
    $('#placing').hidden = false;
    $('#pl-img').src = this.thumbs[type];
    $('#pl-name').textContent = d.name;
    this.placingHint = d.paint ? 'Tap or drag to paint. Two fingers to move the map.' : 'Tap the map to build.';
    this.refreshPlacing();
  }
  refreshPlacing() {
    const type = this.app.placing;
    if (!type) return;
    const html = costHTML(this.g.costOf(type), this.g);
    if ($('#pl-cost').innerHTML !== html) $('#pl-cost').innerHTML = html;
    $('#pl-hint').innerHTML = this.app.preview ?? this.placingHint;
  }
  hidePlacing() { $('#placing').hidden = true; }

  // ── inspector ──
  showInspect(b) {
    this.closeSheets();
    this.inspected = b;
    const d = BUILDINGS[b.type], g = this.g;
    const el = $('#inspect');
    el.hidden = false;
    const maxL = g.canUpgrade(b) ? 3 : 1;
    const stars = maxL > 1 ? '★'.repeat(b.level) + '☆'.repeat(maxL - b.level) : '';
    el.innerHTML = `<h3><img src="${this.thumbs[b.type]}" alt="">${d.name}<span class="lv">${stars}</span></h3>
      <p>${d.desc}</p><div class="live"></div><div class="btns"></div>`;
    const btns = el.querySelector('.btns');
    if (g.canUpgrade(b)) {
      const up = document.createElement('button');
      up.className = 'btn gold up';
      up.onclick = () => this.app.upgrade(b);
      btns.appendChild(up);
    }
    if (b.type !== 'palazzoVecchio') {
      const del = document.createElement('button');
      del.className = 'btn alt';
      del.innerHTML = `Demolish<small>refund 50%</small>`;
      del.onclick = () => this.app.demolish(b);
      btns.appendChild(del);
    }
    const close = document.createElement('button');
    close.className = 'btn alt';
    close.textContent = 'Close';
    close.style.flex = '0 0 70px';
    close.onclick = () => this.app.deselect();
    btns.appendChild(close);
    this.refreshInspect();
  }
  refreshInspect() {
    const b = this.inspected, g = this.g;
    if (!g.byUid.has(b.uid)) { this.app.deselect(); return; }
    const d = BUILDINGS[b.type];
    const eff = b.eff ?? 1;
    const out = g.outputOf(b);
    const lf = levelProd(b.level);
    const stats = [];
    for (const r in out) if (out[r] > 0.0005) stats.push(`<span>${RES[r].icon} +${fmt(out[r] * (r in d.prod ? eff : 1))}/s</span>`);
    for (const r in d.cons) stats.push(`<span class="neg">${RES[r].icon} −${fmt(d.cons[r] * lf * eff)}/s</span>`);
    if (d.housing) stats.push(`<span>👥 ${Math.floor(d.housing * levelPeople(b.level) * (g.cap ? g.s.pop / g.cap : 0))}/${d.housing * levelPeople(b.level)} residents</span>`);
    if (d.workers) stats.push(`<span>⚒️ ${Math.round(d.workers * levelPeople(b.level))} workers</span>`);
    if (d.beauty) stats.push(`<span class="${d.beauty < 0 ? 'neg' : ''}">🌷 ${d.beauty > 0 ? '+' : ''}${d.beauty} beauty (${d.beautyR} tiles)</span>`);
    if (d.happy) stats.push(`<span>😊 +${d.happy} happiness</span>`);
    if (d.global) for (const r in d.global) stats.push(`<span>${RES[r].icon} all +${Math.round(d.global[r] * 100)}%</span>`);
    let warn = '';
    if (eff < 0.98 && (d.workers || Object.keys(d.cons).length)) {
      const missing = Object.keys(d.cons).filter(r => g.s.res[r] < 1);
      warn = missing.length ? `Short of ${missing.map(r => RES[r].icon + ' ' + RES[r].name).join(', ')}. Working at ${Math.round(eff * 100)}%.`
        : `Not enough workers. Working at ${Math.round(eff * 100)}%. Build more homes.`;
    }
    const bon = (b.bonus ?? []).map(([n, v]) => `<span class="${v < 0 ? 'neg' : ''}">${n} ${pct(v)}</span>`).join('');
    const boosts = d.boosts.map(bo => `Boosts ${bo.targets.map(t => BUILDINGS[t].name).join(', ')} within ${bo.radius} by ${pct(bo.mult)}`).join('<br>');
    const html = `<div class="stats">${stats.join('')}</div>
      ${warn ? `<div class="warn-line">⚠️ ${warn}</div>` : ''}
      ${bon ? `<div class="bonus">Bonuses: ${bon}</div>` : ''}
      ${boosts ? `<div class="bonus"><i>${boosts}</i></div>` : ''}
      ${d.housing ? `<div class="bonus">Local beauty: ${fmt(b.beauty ?? 0)}. Place gardens, cypresses and fountains nearby for higher taxes.</div>` : ''}`;
    const live = $('#inspect .live');
    if (live.innerHTML !== html) live.innerHTML = html;
    const up = $('#inspect .up');
    if (up) {
      if (b.level >= 3) { up.disabled = true; up.innerHTML = 'Max level'; }
      else {
        const cost = g.costOf(b.type, b.level + 1);
        const h = `Upgrade ★${b.level + 1}<small class="cost">${costHTML(cost, g)}</small>`;
        if (up.innerHTML !== h) up.innerHTML = h;
        up.disabled = !g.canAfford(cost);
      }
    }
  }

  // ── tech tree ──
  openTech() {
    this.closeSheets();
    $('#techtree').hidden = false;
    const grid = $('#tt-grid');
    const CW = 158, RH = 80, X0 = 30, Y0 = 34;
    grid.querySelectorAll('.node,.tt-era,.tt-branch').forEach(n => n.remove());
    grid.style.width = `${X0 + 6 * CW + 10}px`;
    grid.style.height = `${Y0 + BRANCHES.length * RH + 10}px`;
    const eras = [[1, 1, 2], [2, 3, 4], [3, 5, 5], [4, 6, 6]];
    for (const [e, a, z] of eras) {
      const h = document.createElement('div');
      h.className = 'tt-era' + (e > this.g.s.era ? ' lock' : '');
      h.style.left = `${X0 + (a - 1) * CW}px`; h.style.width = `${(z - a + 1) * CW - 14}px`;
      h.textContent = `${e > this.g.s.era ? '🔒 ' : ''}Era ${ROMAN[e]} · ${ERAS[e].name}`;
      grid.appendChild(h);
    }
    BRANCHES.forEach((br, i) => {
      const l = document.createElement('div');
      l.className = 'tt-branch';
      l.style.top = `${Y0 + i * RH}px`; l.style.height = '66px';
      l.textContent = br.name;
      l.style.color = br.color;
      grid.appendChild(l);
    });
    this.nodeEls = {};
    for (const t of TECH_LIST) {
      const bi = BRANCHES.findIndex(b => b.id === t.branch);
      const n = document.createElement('button');
      n.className = 'node';
      n.style.left = `${X0 + (t.tier - 1) * CW}px`;
      n.style.top = `${Y0 + bi * RH}px`;
      n.style.borderLeft = `5px solid ${BRANCHES[bi].color}`;
      n.innerHTML = `<b>${t.name}</b><small></small><span class="ic">${t.unlock.length ? '🏛️' : '✨'}</span>`;
      n.onclick = () => { this.techSel = t.id; this.app.sfx.tap(); this.refreshTech(true); };
      grid.appendChild(n);
      this.nodeEls[t.id] = n;
      t._x = X0 + (t.tier - 1) * CW; t._y = Y0 + bi * RH;
    }
    // Mecenatismo: endless node after the last tier
    const mn = document.createElement('button');
    mn.className = 'node';
    mn.style.left = `${X0 + 6 * CW}px`;
    mn.style.top = `${Y0 + 2.5 * RH}px`;
    mn.style.borderLeft = '5px solid #c9a14a';
    mn.innerHTML = '<b>Mecenatismo ∞</b><small></small><span class="ic">👑</span>';
    mn.onclick = () => { this.techSel = 'mecenatismo'; this.app.sfx.tap(); this.refreshTech(true); };
    grid.appendChild(mn);
    this.nodeEls.mecenatismo = mn;
    grid.style.width = `${X0 + 7 * CW + 10}px`;
    // lines
    const svg = $('#tt-lines');
    svg.setAttribute('width', grid.style.width); svg.setAttribute('height', grid.style.height);
    let paths = '';
    for (const t of TECH_LIST) for (const r of t.req) {
      const a = TECHS[r];
      const x1 = a._x + 140, y1 = a._y + 33, x2 = t._x, y2 = t._y + 33;
      const done = this.g.techSet.has(r);
      paths += `<path d="M${x1} ${y1} C${x1 + 12} ${y1}, ${x2 - 12} ${y2}, ${x2} ${y2}" fill="none" stroke="${done ? '#c9a14a' : '#bba67a'}" stroke-width="${done ? 3 : 2}" ${done ? '' : 'stroke-dasharray="4 4"'} />`;
    }
    svg.innerHTML = paths;
    if (this.techSel !== 'mecenatismo' && (!this.techSel || this.g.techSet.has(this.techSel))) {
      this.techSel = (TECH_LIST.find(t => this.g.techState(t.id) === 'ready') ?? TECH_LIST.find(t => ['poor'].includes(this.g.techState(t.id))) ?? TECH_LIST[0]).id;
    }
    this.refreshTech(true);
    // scroll selected into view
    const t = TECHS[this.techSel];
    if (t) $('#tt-scroll').scrollLeft = Math.max(0, t._x - 40);
  }
  refreshTech(full = false) {
    const g = this.g;
    $('#tt-ideas').innerHTML = `💡 ${fmt(g.s.res.ideas)} · 🪙 ${fmt(g.s.res.florins)}`;
    for (const t of TECH_LIST) {
      const n = this.nodeEls[t.id];
      const st = g.techState(t.id);
      n.className = `node ${st}${t.id === this.techSel ? ' sel' : ''}`;
      const sm = st === 'done' ? '✓ Researched' : st === 'era' ? `🔒 Era ${ROMAN[t.era]}` : `💡${fmt(t.cost.ideas)} 🪙${fmt(t.cost.florins)}`;
      const s = n.querySelector('small');
      if (s.textContent !== sm) s.textContent = sm;
    }
    // endless patronage node
    const mn = this.nodeEls.mecenatismo, ms = g.patronageState(), mc = g.patronageCost();
    mn.className = `node ${ms}${this.techSel === 'mecenatismo' ? ' sel' : ''}`;
    mn.querySelector('small').textContent = ms === 'locked' ? `🔒 Finish the tree` : `Lv ${g.s.patronage ?? 0} · 💡${fmt(mc.ideas)}`;
    if (this.techSel === 'mecenatismo') return this.patronageDetail(full);
    const t = TECHS[this.techSel];
    const st = g.techState(t.id);
    const det = $('#tt-detail');
    const key = `${t.id}:${st}:${st === 'poor' ? Math.floor(g.s.res.ideas) + ':' + Math.floor(g.s.res.florins) : ''}`;
    if (!full && det.dataset.key === key) return;
    det.dataset.key = key;
    const effects = [];
    for (const r in t.mult) effects.push(`${RES[r].icon} ${RES[r].name} +${Math.round(t.mult[r] * 100)}%`);
    for (const k in t.bmult) effects.push(`${BUILDINGS[k].name} +${Math.round(t.bmult[k] * 100)}%`);
    for (const r in t.costMult) effects.push(`${RES[r].icon} costs ${Math.round(t.costMult[r] * 100)}%`);
    if (t.happy) effects.push(`😊 +${t.happy} happiness`);
    const reqs = t.req.map(r => `<span style="color:${g.techSet.has(r) ? '#4f7f3a' : '#b3261e'}">${g.techSet.has(r) ? '✓' : '✗'} ${TECHS[r].name}</span>`).join(', ');
    let btn;
    if (st === 'done') btn = `<button class="btn" disabled>Researched ✓</button>`;
    else if (st === 'era') btn = `<button class="btn" disabled>Reach Era ${ROMAN[t.era]} (${ERAS[t.era].name}) first</button>`;
    else if (st === 'locked') btn = `<button class="btn" disabled>Research the prerequisites first</button>`;
    else btn = `<button class="btn gold" id="do-research" ${st === 'poor' ? 'disabled' : ''}>Research<small class="cost">${costHTML(t.cost, g)}</small></button>`;
    det.innerHTML = `<h3>${t.name}</h3><p>${t.desc}</p>
      ${t.unlock.length ? `<div class="unlocks">${t.unlock.map(u => `<span><img src="${this.thumbs[u]}" alt="">${BUILDINGS[u].name}</span>`).join('')}</div>` : ''}
      ${effects.length ? `<p><b>${effects.join(' · ')}</b></p>` : ''}
      ${reqs ? `<p style="font-size:13px">Requires: ${reqs}</p>` : ''}
      <div class="btns">${btn}</div>`;
    const rb = $('#do-research');
    if (rb) rb.onclick = () => this.app.research(t.id);
  }

  patronageDetail(full) {
    const g = this.g, st = g.patronageState(), c = g.patronageCost(), det = $('#tt-detail');
    const key = `mec:${st}:${g.s.patronage}:${st === 'poor' ? Math.floor(g.s.res.ideas) : ''}`;
    if (!full && det.dataset.key === key) return;
    det.dataset.key = key;
    det.innerHTML = `<h3>Mecenatismo · Level ${g.s.patronage ?? 0}</h3>
      <p>Become the patron of every artist, scholar and engineer in Europe. Each level adds <b>+5% to all production</b> and a burst of Prestige. Has no limit.</p>
      <div class="btns">${st === 'locked' ? '<button class="btn" disabled>Research all 36 technologies first</button>'
        : `<button class="btn gold" id="do-research" ${st === 'poor' ? 'disabled' : ''}>Sponsor<small class="cost">${costHTML(c, g)}</small></button>`}</div>`;
    const rb = $('#do-research');
    if (rb) rb.onclick = () => { if (g.buyPatronage()) this.refreshTech(true); else this.app.sfx.error(); };
  }

  // ── commissions ──
  openQuests() {
    this.closeSheets();
    $('#quests').hidden = false;
    this.renderQuests(true);
  }
  renderQuests(force = false) {
    const g = this.g;
    const key = g.s.quests.map(q => q.id + ':' + Math.floor(Math.min(q.target, g.questValue(q)))).join('|');
    if (!force && key === this.qKey) return;
    this.qKey = key;
    const list = $('#q-list');
    list.innerHTML = g.s.quests.map(q => {
      const v = Math.max(0, Math.min(q.target, g.questValue(q)));
      const done = v >= q.target;
      return `<div class="quest ${done ? 'done' : ''}">
        <div class="who">✉️ From ${q.patron}</div>
        <h4>${g.questText(q)}</h4>
        ${q.flavor ? `<p>${q.flavor}</p>` : ''}
        <div class="prog"><i style="width:${(v / q.target) * 100}%"></i></div>
        <div class="row"><span class="rw">Reward: ${Object.entries(q.reward).map(([r, n]) => `${RES[r].icon}${fmt(n)}`).join(' ')}</span>
          <span>${fmt(v)}/${fmt(q.target)}</span>
          ${done ? `<button class="btn gold" data-claim="${q.id}">Claim</button>` : this.goButton(q)}</div>
      </div>`;
    }).join('') + `<div class="q-stats">Commissions fulfilled: ${g.s.stats.questsDone}. Patrons keep sending new ones.</div>`;
    list.querySelectorAll('[data-claim]').forEach(b => b.onclick = e => this.app.claim(b.dataset.claim, e));
    list.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
      const [k, v] = b.dataset.go.split(':');
      $('#quests').hidden = true;
      if (k === 'build') this.app.startPlacing(v);
      else if (k === 'tech') this.app.tool('tech');
      else if (k === 'cat') { this.cat = v; this.app.tool('build'); }
    });
  }

  goButton(q) {
    const g = this.g;
    let go = null;
    if (q.kind === 'build' && g.isUnlocked(q.type) && !(BUILDINGS[q.type].unique && g.count(q.type))) go = `build:${q.type}`;
    else if (q.kind === 'tech') go = 'tech:';
    else if (q.kind === 'pop') go = 'cat:housing';
    else if (q.kind === 'happy') go = 'cat:decor';
    else if (q.kind === 'have') go = { food: 'cat:food', florins: 'cat:commerce', faith: 'cat:faith', ideas: 'cat:culture', art: 'cat:culture' }[q.res] ?? 'cat:industry';
    return go ? `<button class="btn alt" data-go="${go}">Go</button>` : '';
  }

  // ── info popups ──
  popInfo() {
    const g = this.g;
    this.modal({
      title: 'Population', big: '👥',
      body: `<p><b>${Math.floor(g.s.pop)}</b> citizens, housing for <b>${Math.floor(g.cap)}</b>.</p>
        <p>Jobs: <b>${Math.round(g.jobs)}</b>. Staffing: <b>${Math.round((g.staffing ?? 1) * 100)}%</b>.</p>
        <p>Each citizen eats ${RES.food.icon}0.04/s and pays ${RES.florins.icon}${g.taxRate().toFixed(3)}/s in tax.</p>
        ${g.starving ? '<p class="warn-line">⚠️ Famine! Citizens are leaving. Build a Podere.</p>' : ''}
        <p><i>The city grows when there's housing, grain and happiness above 30%.</i></p>`,
    });
  }
  happyInfo() {
    const g = this.g;
    this.modal({
      title: 'Happiness', big: '😊',
      body: `<ul>${g.happyParts.map(([n, v]) => `<li>${n}: <b>${v > 0 ? '+' : ''}${v}</b></li>`).join('')}</ul>
        <p>Happier citizens pay more tax (${Math.round((0.4 + g.happiness / 100) * 100)}% rate now).</p>
        <p><i>Faith covers ${Math.round(Math.min(1, (g.faithRate ?? 0) / Math.max(0.01, g.s.pop * 0.01)) * 100)}% of the city's needs. Beauty around homes and civic wonders help too.</i></p>`,
    });
  }
  eraInfo() {
    const g = this.g, s = g.s, next = ERAS[s.era + 1];
    this.modal({
      title: `Era ${ROMAN[s.era]}: ${ERAS[s.era].name}`, sub: ERAS[s.era].sub, big: '⭐',
      body: next ? `<p>Next: <b>${next.name}</b></p>
        <div class="gains"><span>⭐ ${fmt(s.prestige)} / ${fmt(next.prestige)} Prestige</span><span>👥 ${Math.floor(s.pop)} / ${next.pop} citizens</span></div>
        <p><i>Prestige comes from Art 🎨, wonders, research, upgrades and commissions. Each era unlocks deeper research.</i></p>`
        : `<p>You have reached the summit of the Renaissance.</p><p>Wonders built: ${LANDMARKS.filter(id => g.count(id)).length} / ${LANDMARKS.length}</p>`,
    });
  }

  // ── modal, toast, fx ──
  modal({ title = '', sub = '', big = '', body = '', gains = null, buttons = [{ label: 'Avanti!' }] }) {
    const m = $('#modal'), card = m.querySelector('.card');
    card.innerHTML = `${big ? `<div class="big">${big}</div>` : ''}<h2>${title}</h2>${sub ? `<h3>${sub}</h3>` : ''}${body}
      ${gains ? `<div class="gains">${gainsHTML(gains)}</div>` : ''}<div class="btns"></div>`;
    const bb = card.querySelector('.btns');
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = `btn ${b.cls ?? 'gold'}`;
      el.innerHTML = b.label;
      el.onclick = () => { m.hidden = true; this.app.sfx.tap(); b.fn?.(); this.nextQueued(); };
      bb.appendChild(el);
    });
    m.hidden = false;
    m.onclick = e => { if (e.target === m && buttons.length === 1) { m.hidden = true; buttons[0].fn?.(); this.nextQueued(); } };
  }
  nextQueued() {
    if (this.modalOpen || !this.queue?.length) return;
    const next = this.queue.shift();
    setTimeout(() => this.modalOpen ? this.queue.unshift(next) : this.modal(next), 250);
  }
  get modalOpen() { return !$('#modal').hidden; }

  // queued popups for game events, so an era change and a wonder don't overwrite each other
  notify(opts) {
    (this.queue ??= []).push(opts);
    if (!this.modalOpen) this.modal(this.queue.shift());
  }

  toast(html) {
    const box = $('#toasts');
    while (box.children.length > 2) box.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }

  floatText(x, y, text, cls = '') {
    const e = document.createElement('div');
    e.className = 'ft ' + cls;
    e.textContent = text;
    e.style.left = x + 'px'; e.style.top = y + 'px';
    $('#fx').appendChild(e);
    setTimeout(() => e.remove(), 1400);
  }

  // resource icons fly into their HUD chip
  flyTo(x, y, r, n = 3) {
    const chip = this.chips[r]?.el;
    if (!chip || chip.hidden) return;
    const rect = chip.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const e = document.createElement('div');
      e.className = 'fly';
      e.textContent = RES[r].icon;
      e.style.left = (x - 11 + (Math.random() - 0.5) * 30) + 'px';
      e.style.top = (y - 11 + (Math.random() - 0.5) * 30) + 'px';
      $('#fx').appendChild(e);
      setTimeout(() => {
        e.style.transform = `translate(${rect.left + 8 - x}px, ${rect.top + 4 - y}px) scale(.6)`;
        e.style.opacity = '0.3';
      }, 30 + i * 70);
      setTimeout(() => e.remove(), 850 + i * 70);
    }
  }
}
