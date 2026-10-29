// Game state and simulation. No rendering code here.
import { RES_KEYS, BUILDINGS, BUILDING_LIST, TECHS, TECH_LIST, ERAS, ECON, PATRONS, LANDMARKS, RES } from './data.js';

export const N = 40;                 // map is N×N tiles
const SAVE_KEY = 'medici-builder-save-v1';
const MAX_LEVEL = 3;

export function riverCenter(x) {
  return 23 + 2.4 * Math.sin(x * 0.16 + 0.6) + 1.1 * Math.sin(x * 0.41 + 2.0);
}
export const RIVER_HALF = 1.6;

export const levelProd = l => 1 + 0.6 * (l - 1);
export const levelPeople = l => 1 + 0.5 * (l - 1);

function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function fmt(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(0) + 'k';
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  if (a >= 100 || Number.isInteger(n)) return Math.floor(n).toString();
  return n.toFixed(a >= 10 ? 0 : 1);
}

export class Game {
  constructor() {
    this.listeners = {};
    this.water = new Uint8Array(N * N);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      if (Math.abs(z + 0.5 - riverCenter(x + 0.5)) < RIVER_HALF) this.water[z * N + x] = 1;
    }
    this.newGame();
  }

  on(ev, fn) { (this.listeners[ev] ??= []).push(fn); }
  emit(ev, ...a) { for (const fn of this.listeners[ev] ?? []) fn(...a); }

  newGame() {
    this.s = {
      res: { florins: 180, food: 60, stone: 25, wool: 0, cloth: 0, faith: 0, art: 0, ideas: 0 },
      pop: 0, prestige: 0, era: 1, techs: [], buildings: [], nextUid: 1,
      quests: [], tutorial: 0, stats: { built: 0, collected: 0, questsDone: 0 },
      time: Date.now(), won: false,
    };
    this.reindex();
    this.place('palazzoVecchio', 19, 12, 0, true);
    for (let x = 17; x <= 22; x++) this.place('piazza', x, 14, 0, true);
    this.fillQuests();
  }

  reindex() {
    this.grid = new Int32Array(N * N);
    this.byUid = new Map();
    for (const b of this.s.buildings) {
      this.byUid.set(b.uid, b);
      this.forFoot(b, (x, z) => { this.grid[z * N + x] = b.uid; });
    }
    this.techSet = new Set(this.s.techs);
    this.recompute();
  }

  forFoot(b, fn) {
    const s = BUILDINGS[b.type].size;
    for (let z = b.z; z < b.z + s; z++) for (let x = b.x; x < b.x + s; x++) fn(x, z);
  }

  // ── Queries ──
  isUnlocked(type) {
    const d = BUILDINGS[type];
    return !d.tech || this.techSet.has(d.tech);
  }
  count(type) { let c = 0; for (const b of this.s.buildings) if (b.type === type) c++; return c; }
  at(x, z) { if (x < 0 || z < 0 || x >= N || z >= N) return null; const u = this.grid[z * N + x]; return u ? this.byUid.get(u) : null; }
  isWater(x, z) { return x >= 0 && z >= 0 && x < N && z < N && this.water[z * N + x] === 1; }

  costOf(type, level = 1) {
    const d = BUILDINGS[type];
    const out = {};
    // new building: grows with how many you own; upgrade to level 2: ×1.5, level 3: ×3 of base
    const k = level === 1 ? Math.pow(d.growth, this.count(type)) : 1.5 * (level - 1);
    for (const r in d.cost) out[r] = Math.ceil(d.cost[r] * k * (1 + (this.costMult[r] ?? 0)));
    return out;
  }
  canAfford(cost) { for (const r in cost) if (this.s.res[r] < cost[r]) return false; return true; }
  pay(cost) { for (const r in cost) this.s.res[r] -= cost[r]; }

  canPlace(type, x0, z0) {
    const d = BUILDINGS[type];
    if (!this.isUnlocked(type)) return { ok: false, reason: 'Not yet researched' };
    if (d.unique && this.count(type) > 0) return { ok: false, reason: 'Already built' };
    let nearWater = false;
    for (let z = z0; z < z0 + d.size; z++) for (let x = x0; x < x0 + d.size; x++) {
      if (x < 0 || z < 0 || x >= N || z >= N) return { ok: false, reason: 'Outside the walls' };
      if (this.grid[z * N + x]) return { ok: false, reason: 'Occupied' };
      const w = this.water[z * N + x];
      if (d.onWater && !w) return { ok: false, reason: 'Must be built on the Arno' };
      if (!d.onWater && w) return { ok: false, reason: 'Cannot build on water' };
    }
    if (d.nearWater) {
      for (let i = -1; i <= d.size && !nearWater; i++) {
        if (this.isWater(x0 + i, z0 - 1) || this.isWater(x0 + i, z0 + d.size) ||
            this.isWater(x0 - 1, z0 + i) || this.isWater(x0 + d.size, z0 + i)) nearWater = true;
      }
      if (!nearWater) return { ok: false, reason: 'Must touch the river' };
    }
    if (!this.canAfford(this.costOf(type))) return { ok: false, reason: 'Not enough resources', poor: true };
    return { ok: true };
  }

  // ── Actions ──
  place(type, x0, z0, rot = 0, free = false) {
    let paid = {};
    if (!free) {
      const c = this.canPlace(type, x0, z0);
      if (!c.ok) return null;
      paid = this.costOf(type);
      this.pay(paid);
    }
    const d = BUILDINGS[type];
    const b = { uid: this.s.nextUid++, type, x: x0, z: z0, level: 1, rot, paid, bt: 0, bnext: 20 + Math.random() * 20, ready: 0, v: Math.floor(Math.random() * 4) };
    this.s.buildings.push(b);
    this.byUid.set(b.uid, b);
    this.forFoot(b, (x, z) => { this.grid[z * N + x] = b.uid; });
    if (d.prestige && !free) this.addPrestige(d.prestige);
    if (!free) this.s.stats.built++;
    this.recompute();
    this.emit('build', b);
    if (d.unique && !free) this.emit('wonder', b);
    this.checkWin();
    return b;
  }

  remove(uid) {
    const b = this.byUid.get(uid);
    if (!b || b.type === 'palazzoVecchio') return null;
    const refund = {};
    const c = b.paid ?? this.costOf(b.type);
    for (const r in c) refund[r] = Math.floor(c[r] * 0.5);
    for (const r in refund) this.s.res[r] += refund[r];
    this.forFoot(b, (x, z) => { this.grid[z * N + x] = 0; });
    this.s.buildings.splice(this.s.buildings.indexOf(b), 1);
    this.byUid.delete(uid);
    this.recompute();
    this.emit('remove', b);
    return refund;
  }

  canUpgrade(b) {
    const d = BUILDINGS[b.type];
    return !d.unique && !d.paint && d.cat !== 'decor' && b.level < MAX_LEVEL && Object.keys(d.cost).length > 0;
  }
  upgrade(uid) {
    const b = this.byUid.get(uid);
    if (!b || !this.canUpgrade(b)) return false;
    const cost = this.costOf(b.type, b.level + 1);
    if (!this.canAfford(cost)) return false;
    this.pay(cost);
    b.level++;
    this.addPrestige(5 * b.level);
    this.recompute();
    this.emit('upgrade', b);
    return true;
  }

  techState(id) {
    const t = TECHS[id];
    if (this.techSet.has(id)) return 'done';
    if (t.era > this.s.era) return 'era';
    if (!t.req.every(r => this.techSet.has(r))) return 'locked';
    return this.canAfford(t.cost) ? 'ready' : 'poor';
  }
  research(id) {
    const st = this.techState(id);
    if (st !== 'ready') return false;
    const t = TECHS[id];
    this.pay(t.cost);
    this.s.techs.push(id);
    this.techSet.add(id);
    this.addPrestige(10 * t.tier);
    this.recompute();
    this.emit('tech', t);
    return true;
  }

  // ── Mecenatismo (repeatable research once the tree is complete) ──
  patronageCost() {
    const n = this.s.patronage ?? 0;
    return { ideas: Math.round(5000 * 1.5 ** n), florins: Math.round(25000 * 1.5 ** n) };
  }
  patronageState() {
    if (this.s.techs.length < TECH_LIST.length) return 'locked';
    return this.canAfford(this.patronageCost()) ? 'ready' : 'poor';
  }
  buyPatronage() {
    if (this.patronageState() !== 'ready') return false;
    this.pay(this.patronageCost());
    this.s.patronage = (this.s.patronage ?? 0) + 1;
    this.addPrestige(250 * this.s.patronage);
    this.recompute();
    this.emit('tech', { name: `Mecenatismo ${this.s.patronage}`, unlock: [] });
    return true;
  }

  addPrestige(n) { this.s.prestige += n; }

  // ── Derived state ──
  recompute() {
    const s = this.s;
    // global multipliers from techs and wonders
    this.gmult = {}; this.costMult = {}; this.bmult = {}; this.techHappy = 0;
    for (const r of RES_KEYS) this.gmult[r] = 1;
    for (const id of s.techs) {
      const t = TECHS[id];
      for (const r in t.mult) this.gmult[r] += t.mult[r];
      for (const r in t.costMult) this.costMult[r] = (this.costMult[r] ?? 0) + t.costMult[r];
      for (const k in t.bmult) this.bmult[k] = (this.bmult[k] ?? 0) + t.bmult[k];
      this.techHappy += t.happy;
    }
    // Mecenatismo: endless patronage research, +5% to every resource per level
    for (const r of RES_KEYS) this.gmult[r] += 0.05 * (s.patronage ?? 0);
    // beauty field
    const beauty = this.beauty = new Float32Array(N * N);
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      if (d.global) for (const r in d.global) this.gmult[r] += d.global[r];
      if (!d.beauty) continue;
      const R = d.beautyR;
      for (let z = Math.max(0, b.z - R); z < Math.min(N, b.z + d.size + R); z++)
        for (let x = Math.max(0, b.x - R); x < Math.min(N, b.x + d.size + R); x++) beauty[z * N + x] += d.beauty;
    }
    // per building multiplier
    this.cap = 0; this.jobs = 0; this.buildHappy = 0; this.housingW = 0; this.housingBeauty = 0;
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      const { m, bonus, beauty: bv } = this.bonusFor(b);
      b.bonus = bonus;
      if (d.housing) {
        b.beauty = bv;
        const h = d.housing * levelPeople(b.level);
        this.cap += h; this.housingW += h * m; this.housingBeauty += bv * h;
      }
      b.mult = m;
      this.jobs += d.workers * levelPeople(b.level);
      this.buildHappy += d.happy;
    }
    this.avgBeauty = this.cap ? this.housingBeauty / this.cap : 0;
    this.roads = s.buildings.filter(b => BUILDINGS[b.type].road);
    this.updateHappiness();
  }

  // multiplier and its breakdown for a building (real or hypothetical)
  bonusFor(b) {
    const d = BUILDINGS[b.type];
    const bonus = [];
    let m = 1 + (this.bmult[b.type] ?? 0);
    if (this.bmult[b.type]) bonus.push(['Research', this.bmult[b.type]]);
    if (!d.road && d.cat !== 'decor' && this.touchesRoad(b)) { m += 0.1; bonus.push(['Street', 0.1]); }
    for (const o of this.s.buildings) {
      if (o === b) continue;
      const od = BUILDINGS[o.type];
      for (const bo of od.boosts) {
        if (bo.targets.includes(b.type) && this.dist(b, o) <= bo.radius) { m += bo.mult; bonus.push([od.name, bo.mult]); }
      }
    }
    let bv = 0;
    if (d.housing) {
      let n = 0;
      this.forFoot(b, (x, z) => { bv += this.beauty[z * N + x]; n++; });
      bv /= n;
      const bm = Math.max(-0.3, Math.min(0.6, bv * 0.05));
      if (bm) { m += bm; bonus.push(['Beauty', bm]); }
    }
    return { m: Math.max(0.1, m), bonus, beauty: bv };
  }

  dist(a, b) {
    // Chebyshev distance between footprints
    const sa = BUILDINGS[a.type].size, sb = BUILDINGS[b.type].size;
    const dx = Math.max(0, b.x - (a.x + sa - 1), a.x - (b.x + sb - 1));
    const dz = Math.max(0, b.z - (a.z + sa - 1), a.z - (b.z + sb - 1));
    return Math.max(dx, dz);
  }

  touchesRoad(b) {
    const s = BUILDINGS[b.type].size;
    for (let i = 0; i < s; i++) {
      for (const [x, z] of [[b.x + i, b.z - 1], [b.x + i, b.z + s], [b.x - 1, b.z + i], [b.x + s, b.z + i]]) {
        const o = this.at(x, z);
        if (o && BUILDINGS[o.type].road) return true;
      }
    }
    return false;
  }

  updateHappiness() {
    const s = this.s;
    const parts = [['Base', 45]];
    const need = Math.max(1, s.pop) * ECON.faithPerCitizen;
    const cov = Math.min(1, (this.faithRate ?? 0) / need);
    parts.push(['Faith', Math.round(25 * cov)]);
    parts.push(['Beauty', Math.round(Math.max(-15, Math.min(20, this.avgBeauty * 3)))]);
    const bh = Math.min(30, this.buildHappy + this.techHappy);
    if (bh) parts.push(['Wonders & civic', bh]);
    if (this.starving) parts.push(['Hunger', -30]);
    const crowd = Math.round(Math.min(35, Math.max(0, (s.pop - 150) / 35)));
    if (crowd) parts.push(['Crowding', -crowd]);
    this.happyParts = parts;
    this.happiness = Math.max(0, Math.min(100, parts.reduce((a, p) => a + p[1], 0)));
  }

  // Theoretical output of one building per second (for UI and bubbles)
  outputOf(b) {
    const d = BUILDINGS[b.type];
    const out = {};
    const lf = levelProd(b.level);
    for (const r in d.prod) out[r] = d.prod[r] * lf * b.mult * this.gmult[r];
    if (d.housing) {
      const share = this.cap ? this.s.pop / this.cap : 0;
      out.florins = (out.florins ?? 0) + d.housing * levelPeople(b.level) * share * this.taxRate() * b.mult * this.gmult.florins;
    }
    return out;
  }
  taxRate() { return ECON.taxPerCitizen * (0.4 + this.happiness / 100); }

  // ── Simulation ──
  tick(dt) {
    const s = this.s, res = s.res;
    const staffing = this.jobs > 0 ? Math.min(1, s.pop / this.jobs) : 1;
    this.staffing = staffing;
    const flow = this.flow ??= Object.fromEntries(RES_KEYS.map(r => [r, 0]));
    let faith = 0;
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      const lf = levelProd(b.level);
      let eff = d.workers ? staffing : 1;
      for (const r in d.cons) {
        const need = d.cons[r] * lf * dt * eff;
        if (need > 0 && res[r] < need) eff *= res[r] / need;
      }
      for (const r in d.cons) {
        const c = d.cons[r] * lf * dt * eff;
        res[r] -= c; flow[r] -= c;
      }
      for (const r in d.prod) {
        const p = d.prod[r] * lf * eff * b.mult * this.gmult[r] * dt;
        res[r] += p; flow[r] += p;
        if (r === 'art') s.prestige += p;
        if (r === 'faith') faith += p / dt;
      }
      b.eff = eff;
      // collectible bubbles
      if (!b.ready && (Object.keys(d.prod).length || d.housing)) {
        b.bt += dt;
        if (b.bt >= b.bnext) {
          b.bt = 0; b.bnext = 25 + Math.random() * 25;
          b.ready = Math.random() < 0.05 ? 2 : 1;
          this.emit('bubble', b);
        }
      }
    }
    this.faithRate = this.faithRate === undefined ? faith : this.faithRate * 0.9 + faith * 0.1;

    // taxes
    if (this.cap > 0) {
      const tax = this.housingW * (s.pop / this.cap) * this.taxRate() * this.gmult.florins * dt;
      res.florins += tax; flow.florins += tax;
    }
    // food
    const eat = s.pop * ECON.foodPerCitizen * dt;
    if (res.food >= eat) { res.food -= eat; flow.food -= eat; this.starving = false; }
    else { flow.food -= res.food; res.food = 0; this.starving = s.pop > 0; }
    // population
    if (this.starving) s.pop = Math.max(0, s.pop - Math.max(0.2, s.pop * 0.02) * dt);
    else if (this.happiness < 30) s.pop = Math.max(Math.min(s.pop, this.cap * 0.6), s.pop - 0.2 * dt);
    else if (s.pop < this.cap) s.pop = Math.min(this.cap, s.pop + (0.4 + (this.cap - s.pop) * 0.04) * dt);
    if (s.pop > this.cap) s.pop = Math.max(this.cap, s.pop - 1 * dt);
    this.updateHappiness();

    // rates & periodic checks
    this.rateT = (this.rateT ?? 0) + dt;
    if (this.rateT >= 1) {
      this.rates = {};
      for (const r of RES_KEYS) { this.rates[r] = flow[r] / this.rateT; flow[r] = 0; }
      this.rateT = 0;
      this.checkEra();
      this.checkQuests();
    }
  }

  checkEra() {
    const next = ERAS[this.s.era + 1];
    if (next && this.s.prestige >= next.prestige && this.s.pop >= next.pop) {
      this.s.era++;
      const reward = { florins: 300 * this.s.era ** 2, ideas: 40 * this.s.era ** 2 };
      for (const r in reward) this.s.res[r] += reward[r];
      this.emit('era', next, reward);
    }
  }

  checkWin() {
    if (this.s.won) return;
    if (LANDMARKS.every(id => this.count(id) > 0)) { this.s.won = true; this.emit('win'); }
  }

  // ── Bubbles ──
  collect(uid) {
    const b = this.byUid.get(uid);
    if (!b || !b.ready) return null;
    const out = this.outputOf(b);
    const k = ECON.bubbleSeconds * (b.ready === 2 ? 6 : 1) * Math.max(0.5, b.eff ?? 1);
    const reward = {};
    for (const r in out) if (out[r] > 0) reward[r] = Math.max(1, Math.round(out[r] * k));
    if (!Object.keys(reward).length) reward.florins = 2;
    if (b.ready === 2) reward.ideas = (reward.ideas ?? 0) + Math.max(5, Math.round((this.rates?.ideas ?? 1) * 30));
    for (const r in reward) {
      this.s.res[r] += reward[r];
      if (r === 'art') this.s.prestige += reward[r];
    }
    const gold = b.ready === 2;
    b.ready = 0; b.bt = 0;
    this.s.stats.collected++;
    this.emit('collect', b, reward, gold);
    return reward;
  }

  // ── Commissions ──
  questValue(q) {
    const s = this.s;
    switch (q.kind) {
      case 'build': return this.count(q.type) - q.base;
      case 'pop': return s.pop;
      case 'tech': return s.techs.length - q.base;
      case 'have': return s.res[q.res];
      case 'prestige': return s.prestige;
      case 'happy': return this.happiness;
      case 'collect': return s.stats.collected - q.base;
      case 'upgrade': return s.buildings.reduce((a, b) => a + b.level - 1, 0) - q.base;
    }
    return 0;
  }

  questText(q) {
    switch (q.kind) {
      case 'build': return `Build ${q.target > 1 ? q.target + ' × ' : 'a '}${BUILDINGS[q.type].name}`;
      case 'pop': return `Grow to ${q.target} citizens`;
      case 'tech': return q.target > 1 ? `Research ${q.target} technologies` : 'Research a technology';
      case 'have': return `Stockpile ${fmt(q.target)} ${RES[q.res].icon} ${RES[q.res].name}`;
      case 'prestige': return `Reach ${fmt(q.target)} ⭐ Prestige`;
      case 'happy': return `Reach ${q.target}% happiness`;
      case 'collect': return `Collect ${q.target} bonuses from buildings`;
      case 'upgrade': return `Upgrade buildings ${q.target} times`;
    }
  }

  makeReward(mult = 1) {
    const r = this.rates ?? {};
    const era = this.s.era;
    return {
      florins: Math.round(Math.max(60 * era, (r.florins ?? 0) * 70) * mult / 5) * 5,
      ideas: Math.round(Math.max(8 * era, (r.ideas ?? 0) * 50) * mult),
    };
  }

  tutorialQuests() {
    return [
      { kind: 'build', type: 'casa', target: 3, patron: 'The Priori', flavor: 'Florentines need roofs over their heads.' },
      { kind: 'build', type: 'podere', target: 1, patron: 'The Contadini', flavor: 'Hungry citizens leave. Plant some grain.' },
      { kind: 'build', type: 'scuola', target: 1, patron: 'The Signoria', flavor: 'Ingegno powers research. Open an abacus school.' },
      { kind: 'build', type: 'strada', target: 6, patron: 'The Signoria', flavor: 'Buildings next to streets work 10% better.' },
      { kind: 'collect', target: 3, patron: 'Giovanni de\' Medici', flavor: 'Tap the bubbles that pop up over your buildings.' },
      { kind: 'tech', target: 1, patron: 'Brunelleschi', flavor: 'Open the Research book and study something new.' },
      { kind: 'build', type: 'mercato', target: 1, patron: 'Cosimo de\' Medici', flavor: 'Markets make nearby homes pay more tax.' },
      { kind: 'pop', target: 40, patron: 'The Priori', flavor: 'A great city needs people.' },
    ];
  }

  newQuest() {
    const s = this.s;
    const tut = this.tutorialQuests();
    let q;
    if (s.tutorial < tut.length) {
      q = { ...tut[s.tutorial++] };
    } else {
      const avail = BUILDING_LIST.filter(d => !d.hidden && this.isUnlocked(d.id) && !(d.unique && this.count(d.id)) && !s.quests.some(o => o.type === d.id));
      const wonders = avail.filter(d => d.unique);
      const roll = Math.random();
      if (wonders.length && roll < 0.25) {
        const d = wonders[Math.floor(Math.random() * wonders.length)];
        q = { kind: 'build', type: d.id, target: 1, mult: 4 };
      } else if (roll < 0.62) {
        const pool = avail.filter(d => !d.unique && d.cat !== 'civic');
        // favour recently unlocked buildings
        const weighted = pool.flatMap(d => (d.tech ? Array(1 + TECHS[d.tech].tier) : [0]).fill(d));
        const d = weighted[Math.floor(Math.random() * weighted.length)];
        const cheap = (d.cost.florins ?? 0) < 100;
        q = { kind: 'build', type: d.id, target: cheap ? 2 + Math.floor(Math.random() * 3) : 1, mult: cheap ? 1 : 1.5 };
      } else if (roll < 0.70) {
        q = { kind: 'pop', target: Math.ceil((s.pop + 20 + 15 * s.era) / 10) * 10 };
      } else if (roll < 0.78) {
        const untaken = TECH_LIST.filter(t => !this.techSet.has(t.id) && t.era <= s.era);
        if (!untaken.length) return this.newQuestFallback();
        q = { kind: 'tech', target: 1, mult: 1.2 };
      } else if (roll < 0.86) {
        const opts = Object.keys(s.res).filter(r => (this.rates?.[r] ?? 0) > 0.05);
        if (!opts.length) return this.newQuestFallback();
        const r = opts[Math.floor(Math.random() * opts.length)];
        const t = s.res[r] + Math.max(30, (this.rates[r] ?? 0) * 150);
        q = { kind: 'have', res: r, target: niceRound(t) };
      } else if (roll < 0.92) {
        q = { kind: 'happy', target: Math.min(95, Math.max(60, Math.round(this.happiness / 5) * 5 + 10)) };
      } else if (roll < 0.96) {
        q = { kind: 'upgrade', target: 2, mult: 1.2 };
      } else {
        q = { kind: 'collect', target: 8 };
      }
    }
    q.id = Math.random().toString(36).slice(2, 8);
    q.base = q.kind === 'build' ? this.count(q.type) : q.kind === 'tech' ? s.techs.length : q.kind === 'collect' ? s.stats.collected
      : q.kind === 'upgrade' ? s.buildings.reduce((a, b) => a + b.level - 1, 0) : 0;
    q.patron ??= q.type ? PATRONS[BUILDINGS[q.type].cat] : q.kind === 'tech' ? 'Marsilio Ficino' : q.kind === 'happy' ? 'Lorenzo il Magnifico' : 'The Signoria';
    q.reward = this.makeReward(q.mult ?? 1);
    if (q.kind === 'build' && BUILDINGS[q.type].unique) q.reward.art = 50 * s.era;
    return q;
  }
  newQuestFallback() {
    const q = { kind: 'collect', target: 5, id: Math.random().toString(36).slice(2, 8), base: this.s.stats.collected, patron: 'Giovanni de\' Medici' };
    q.reward = this.makeReward(1);
    return q;
  }

  fillQuests() {
    while (this.s.quests.length < 3) this.s.quests.push(this.newQuest());
  }

  checkQuests() {
    let n = 0;
    for (const q of this.s.quests) {
      const done = this.questValue(q) >= q.target;
      if (done && !q.done) { q.done = true; this.emit('questReady', q); }
      if (q.done) n++;
    }
    this.readyQuests = n;
  }

  claim(id) {
    const i = this.s.quests.findIndex(q => q.id === id);
    if (i < 0) return null;
    const q = this.s.quests[i];
    if (!q.done && this.questValue(q) < q.target) return null;
    for (const r in q.reward) { this.s.res[r] += q.reward[r]; if (r === 'art') this.s.prestige += q.reward[r]; }
    this.addPrestige(10 * this.s.era);
    this.s.stats.questsDone++;
    this.s.quests.splice(i, 1, this.newQuest());
    this.checkQuests();
    this.emit('claim', q);
    return q.reward;
  }

  // ── Persistence ──
  save() {
    this.s.time = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { /* storage unavailable */ }
  }

  load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      s.buildings = s.buildings.filter(b => BUILDINGS[b.type]);
      s.techs = s.techs.filter(t => TECHS[t]);
      this.s = s;
      this.reindex();
      this.fillQuests();
      return this.offline((Date.now() - s.time) / 1000);
    } catch (e) {
      console.warn('Save corrupt, starting fresh', e);
      this.newGame();
      return null;
    }
  }

  // simulate time away (capped at 8h) and report gains
  offline(sec) {
    if (!(sec > 30)) return null;
    sec = Math.min(sec, 8 * 3600);
    const before = { ...this.s.res, prestige: this.s.prestige, pop: this.s.pop };
    const steps = Math.min(2000, Math.ceil(sec / 2));
    const dt = sec / steps;
    const emit = this.emit;
    this.emit = () => {};           // silence events while fast-forwarding
    for (let i = 0; i < steps; i++) this.tick(dt);
    this.emit = emit;
    const gains = {};
    for (const r of RES_KEYS) { const g = this.s.res[r] - before[r]; if (Math.abs(g) >= 1) gains[r] = g; }
    gains.prestige = this.s.prestige - before.prestige;
    return { sec, gains };
  }

  // adopt a save from elsewhere (cloud backup); takes effect on next load
  importSave(json) {
    try {
      const s = JSON.parse(json);
      if (!Array.isArray(s.buildings) || !s.res) return false;
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch (e) { return false; }
  }

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
    this.newGame();
  }
}

function niceRound(v) {
  const p = Math.pow(10, Math.max(1, Math.floor(Math.log10(v)) - 1));
  return Math.ceil(v / p) * p;
}

export { mulberry };
