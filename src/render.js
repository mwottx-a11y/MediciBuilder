// three.js world: terrain, buildings, ghost, bubbles, citizens, boats, camera.
import * as THREE from 'three';
import { N, riverCenter, RIVER_HALF } from './game.js';
import { BUILDINGS, RES } from './data.js';
import { getModel, personGeo, boatGeo, wildTreeGeo, wallGeo } from './models.js';

const M = 40;          // countryside margin around the city
const WATER_Y = -0.2;
const BED_Y = -0.5;

function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class World {
  constructor(canvas, game) {
    this.game = game;
    this.mobile = matchMedia('(pointer: coarse)').matches;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.mobile ? 1.75 : 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#c4dcea');
    scene.fog = new THREE.Fog('#d6e2e2', 50, 120);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
    this.cam = { tx: 20, tz: 14, dist: 23, yaw: 0.5 };

    scene.add(new THREE.HemisphereLight('#fff4dc', '#6c7d52', 1.5));
    const sun = this.sun = new THREE.DirectionalLight('#ffe6c0', 2.6);
    sun.position.set(N / 2 - 16, 30, N / 2 + 14);
    sun.target.position.set(N / 2, 0, N / 2);
    sun.castShadow = true;
    const sm = this.mobile ? 1536 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.meshes = new Map();
    this.bubbles = new Map();
    this.anims = [];
    this.time = 0;
    this.shadowDirty = true;

    this.buildTerrain();
    this.buildWater();
    this.buildScenery();
    this.buildOverlays();
    this.buildLife();

    for (const b of game.s.buildings) this.addBuilding(b, false);
  }

  // ── terrain ──
  heightAt(x, z) {
    const g = this.game;
    if (x >= 0 && x <= N && z >= 0 && z <= N) {
      let land = false, any = false;
      for (const [tx, tz] of [[x - 1, z - 1], [x, z - 1], [x - 1, z], [x, z]]) {
        if (tx < 0 || tz < 0 || tx >= N || tz >= N) continue;
        any = true;
        if (!g.water[tz * N + tx]) land = true;
      }
      return !any || land ? 0 : BED_Y;
    }
    const d = Math.abs(z - riverCenter(x));
    if (d < RIVER_HALF - 0.1) return BED_Y;
    const out = Math.max(-x, x - N, -z, z - N, 0);
    const hill = Math.max(0, out - 2.5) * (0.16 + 0.22 * vnoise(x * 0.08, z * 0.08)) * smooth(RIVER_HALF + 0.5, RIVER_HALF + 7, d);
    const bank = d < RIVER_HALF + 0.4 ? BED_Y * (1 - (d - RIVER_HALF + 0.1) / 0.5) : 0;
    return Math.min(9, hill + vnoise(x * 0.5, z * 0.5) * 0.2 * smooth(0, 3, out)) + bank;
  }

  buildTerrain() {
    const S = N + 2 * M, V = S + 1;
    const pos = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3);
    const c = new THREE.Color();
    const fields = ['#9cbc62', '#b6b86c', '#c8b673', '#88aa56', '#a5aa5c', '#93b05d', '#bfae6a'];
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const x = i - M, z = j - M, k = j * V + i;
      const h = this.heightAt(x, z);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const out = Math.max(-x, x - N, -z, z - N, 0);
      const d = Math.abs(z - riverCenter(x));
      if (h < -0.05) c.set('#7c8f6e');
      else if (d < RIVER_HALF + 0.9 && out <= 0 && h === 0 && this.nearWaterVertex(x, z)) c.set('#c2b59a');
      else if (out > 1.5) {
        c.set(fields[Math.floor(hash(Math.floor(x / 5), Math.floor(z / 5)) * fields.length)]);
        c.offsetHSL(0, 0, (vnoise(x * 0.7, z * 0.7) - 0.5) * 0.06 + h * 0.012);
      } else {
        c.set('#9dbc63').offsetHSL(0, 0, (hash(x, z) - 0.5) * 0.035);
      }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    const idx = [];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const a = j * V + i, b = a + 1, cc = a + V, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = this.terrain = new THREE.Mesh(g, this.mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }
  nearWaterVertex(x, z) {
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) if (this.game.isWater(x + dx, z + dz)) return true;
    return false;
  }

  buildWater() {
    const S = N + 2 * M;
    const g = new THREE.PlaneGeometry(S, 14, 160, 28).rotateX(-Math.PI / 2);
    // bend the strip along the river
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + N / 2;
      p.setX(i, x);
      p.setZ(i, p.getZ(i) + riverCenter(x));
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ color: '#4f9cbc', transparent: true, opacity: 0.88, flatShading: true });
    this.waterUniforms = { uTime: { value: 0 } };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.waterUniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 wp = modelMatrix * vec4(position, 1.0);
         transformed.y += sin(wp.x * 1.7 + uTime * 1.3) * 0.035 + cos(wp.z * 2.3 + wp.x * 0.6 + uTime * 1.7) * 0.03;`);
    };
    const w = this.water = new THREE.Mesh(g, mat);
    w.position.y = WATER_Y;
    w.receiveShadow = true;
    this.scene.add(w);
  }

  buildScenery() {
    // city walls with towers, broken where the Arno passes
    const segs = [];
    const step = 4;
    const L = -0.7, R = N + 0.7;
    for (let t = -0.7; t < N + 0.7; t += step) {
      const len = Math.min(step, N + 0.7 - t), mid = t + len / 2;
      segs.push({ x: mid, z: L, w: len, d: 0.35, tower: true, tx: t, tz: L });
      segs.push({ x: mid, z: R, w: len, d: 0.35, tower: true, tx: t, tz: R });
      for (const X of [L, R]) {
        const rc = riverCenter(X);
        if (Math.abs(mid - rc) < RIVER_HALF + len / 2 + 0.3) continue;
        segs.push({ x: X, z: mid, w: 0.35, d: len, tower: true, tx: X, tz: t });
      }
    }
    const walls = new THREE.Mesh(wallGeo(segs), this.mat);
    walls.castShadow = true; walls.receiveShadow = true;
    this.scene.add(walls);

    // countryside trees
    const geos = [0, 1, 2].map(k => wildTreeGeo(k));
    const lists = [[], [], []];
    let seed = 1;
    for (let i = 0; i < 4000 && lists.flat().length < 1100; i++) {
      const x = -M + hash(i, 1.3) * (N + 2 * M), z = -M + hash(i, 7.7) * (N + 2 * M);
      const out = Math.max(-x, x - N, -z, z - N, 0);
      if (out < 1.8) continue;
      if (Math.abs(z - riverCenter(x)) < RIVER_HALF + 0.8) continue;
      const dens = vnoise(x * 0.15, z * 0.15);
      if (hash(i, 3.1) > dens * 1.1) continue;
      const kind = hash(i, 9.9) < 0.45 ? 0 : hash(i, 5.5) < 0.6 ? 1 : 2;
      lists[kind].push([x, this.heightAt(x, z), z, 0.7 + hash(i, 4.4) * 0.7, seed++]);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    lists.forEach((list, k) => {
      const im = new THREE.InstancedMesh(geos[k], this.mat, list.length);
      list.forEach(([x, y, z, s, sd], i) => {
        q.setFromAxisAngle(up, sd);
        m4.compose(new THREE.Vector3(x, y - 0.05, z), q, new THREE.Vector3(s, s, s));
        im.setMatrixAt(i, m4);
      });
      im.castShadow = k !== 0 || true;
      this.scene.add(im);
    });
  }

  buildOverlays() {
    // grid
    const pts = [];
    for (let i = 0; i <= N; i++) { pts.push(i, 0.02, 0, i, 0.02, N, 0, 0.02, i, N, 0.02, i); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: '#fff8e0', transparent: true, opacity: 0.22, depthWrite: false }));
    this.grid.visible = false;
    this.scene.add(this.grid);

    // beauty heat map
    this.heatData = new Uint8Array(N * N * 4);
    this.heatTex = new THREE.DataTexture(this.heatData, N, N);
    this.heatTex.magFilter = THREE.NearestFilter;
    this.heatTex.needsUpdate = true;
    const hm = new THREE.Mesh(new THREE.PlaneGeometry(N, N).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.heatTex, transparent: true, depthWrite: false }));
    // DataTexture row 0 is v=0 (bottom); plane's v=0 sits at +z after rotation
    hm.position.set(N / 2, 0.03, N / 2);
    hm.renderOrder = 2;
    hm.visible = false;
    this.heat = hm;
    this.scene.add(hm);

    // ghost
    this.ghostMats = {
      ok: new THREE.MeshLambertMaterial({ color: '#9cff9c', transparent: true, opacity: 0.65, depthWrite: false, emissive: '#1a5a1a' }),
      bad: new THREE.MeshLambertMaterial({ color: '#ff8a7a', transparent: true, opacity: 0.6, depthWrite: false, emissive: '#5a1a1a' }),
    };
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMats.ok);
    this.ghost.renderOrder = 3;
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.radius = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.18, depthWrite: false }));
    this.radius.position.y = 0.04;
    this.radius.visible = false;
    this.scene.add(this.radius);
    // selection
    const sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
      new THREE.LineBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.9, depthTest: false }));
    sel.visible = false; sel.renderOrder = 5;
    this.sel = sel;
    this.scene.add(sel);
  }

  showHeat(on) {
    this.heat.visible = on;
    if (!on) return;
    const g = this.game, d = this.heatData;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const v = g.beauty[z * N + x];
      const k = ((N - 1 - z) * N + x) * 4;
      if (v > 0) { d[k] = 120; d[k + 1] = 230; d[k + 2] = 90; d[k + 3] = Math.min(150, 25 + v * 22); }
      else if (v < 0) { d[k] = 240; d[k + 1] = 80; d[k + 2] = 60; d[k + 3] = Math.min(160, 40 - v * 30); }
      else d[k + 3] = 0;
    }
    this.heatTex.needsUpdate = true;
  }

  // ── buildings ──
  addBuilding(b, animate = true) {
    const d = BUILDINGS[b.type];
    const geo = getModel(b.type, b.v, b.level);
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.position.set(b.x + d.size / 2, 0, b.z + d.size / 2);
    mesh.rotation.y = (b.rot ?? 0) * Math.PI / 2;
    mesh.castShadow = !d.road || b.type === 'ponte' || b.type === 'pontevecchio';
    mesh.receiveShadow = true;
    mesh.userData.uid = b.uid;
    geo.computeBoundingBox();
    mesh.userData.top = geo.boundingBox.max.y;
    this.scene.add(mesh);
    this.meshes.set(b.uid, mesh);
    if (animate) {
      mesh.scale.setScalar(0.01);
      this.anims.push({ mesh, t: 0, dur: 0.45 });
      this.puff(mesh.position, d.size);
    }
    this.shadowDirty = true;
    if (d.road) this.roadsChanged = true;
    if (b.ready) this.showBubble(b);
  }
  removeBuilding(b) {
    const m = this.meshes.get(b.uid);
    if (m) { this.scene.remove(m); this.meshes.delete(b.uid); }
    this.hideBubble(b.uid);
    this.shadowDirty = true;
    if (BUILDINGS[b.type].road) this.roadsChanged = true;
    this.puff(new THREE.Vector3(b.x + BUILDINGS[b.type].size / 2, 0, b.z + BUILDINGS[b.type].size / 2), BUILDINGS[b.type].size, '#a89c8d');
  }
  refreshBuilding(b) {
    const m = this.meshes.get(b.uid);
    if (!m) return;
    m.geometry = getModel(b.type, b.v, b.level);
    m.geometry.computeBoundingBox();
    m.userData.top = m.geometry.boundingBox.max.y;
    m.scale.setScalar(0.7);
    this.anims.push({ mesh: m, t: 0, dur: 0.4, from: 0.7 });
    this.puff(m.position, BUILDINGS[b.type].size, '#ffe9a0');
    this.shadowDirty = true;
  }

  puff(p, size, color = '#d8ccb4') {
    const n = 6 + size * 4;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.puffGeo ??= new THREE.IcosahedronGeometry(0.12, 0),
        new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85 }));
      const a = Math.random() * Math.PI * 2, r = size * 0.45;
      s.position.set(p.x + Math.cos(a) * r, 0.1, p.z + Math.sin(a) * r);
      this.scene.add(s);
      this.anims.push({ puff: s, t: 0, dur: 0.7 + Math.random() * 0.3, vx: Math.cos(a) * 0.8, vz: Math.sin(a) * 0.8 });
    }
  }

  // ── ghost & selection ──
  setGhost(type, x0, z0, rot, ok) {
    if (!type) { this.ghost.visible = false; this.radius.visible = false; return; }
    const d = BUILDINGS[type];
    this.ghost.geometry = getModel(type, 0, 1);
    this.ghost.material = ok ? this.ghostMats.ok : this.ghostMats.bad;
    this.ghost.position.set(x0 + d.size / 2, 0.01, z0 + d.size / 2);
    this.ghost.rotation.y = rot * Math.PI / 2;
    this.ghost.visible = true;
    const R = Math.max(d.beautyR, ...d.boosts.map(b => b.radius), 0);
    if (R > 0) {
      this.radius.visible = true;
      this.radius.position.x = x0 + d.size / 2; this.radius.position.z = z0 + d.size / 2;
      this.radius.scale.set(d.size + 2 * R, 1, d.size + 2 * R);
      this.radius.material.color.set(d.beauty < 0 ? '#ff9a8a' : '#fff3b0');
    } else this.radius.visible = false;
  }
  select(b) {
    if (!b) { this.sel.visible = false; return; }
    const d = BUILDINGS[b.type];
    const m = this.meshes.get(b.uid);
    this.sel.visible = true;
    this.sel.position.set(b.x + d.size / 2, 0, b.z + d.size / 2);
    this.sel.scale.set(d.size, Math.max(0.1, m?.userData.top ?? 1), d.size);
  }

  // ── bubbles ──
  bubbleTex(key) {
    this.texCache ??= {};
    if (this.texCache[key]) return this.texCache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    const gold = key === 'gold';
    x.beginPath(); x.arc(64, 60, 50, 0, Math.PI * 2);
    x.fillStyle = gold ? '#ffd23f' : '#fffaf0'; x.fill();
    x.lineWidth = 7; x.strokeStyle = gold ? '#b8860b' : '#8a5a2b'; x.stroke();
    x.beginPath(); x.moveTo(52, 106); x.lineTo(64, 124); x.lineTo(76, 106); x.fillStyle = gold ? '#b8860b' : '#8a5a2b'; x.fill();
    x.font = '56px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(gold ? '⭐' : RES[key]?.icon ?? '🪙', 64, 64);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return (this.texCache[key] = t);
  }
  showBubble(b) {
    if (this.bubbles.has(b.uid)) this.hideBubble(b.uid);
    const d = BUILDINGS[b.type];
    const key = b.ready === 2 ? 'gold' : Object.keys(d.prod)[0] ?? 'florins';
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex(key), depthTest: false, transparent: true }));
    sp.renderOrder = 10;
    const m = this.meshes.get(b.uid);
    sp.userData = { uid: b.uid, base: (m?.userData.top ?? 1) + 0.45, born: this.time, x: b.x + d.size / 2, z: b.z + d.size / 2 };
    sp.position.set(sp.userData.x, sp.userData.base, sp.userData.z);
    this.scene.add(sp);
    this.bubbles.set(b.uid, sp);
  }
  hideBubble(uid) {
    const sp = this.bubbles.get(uid);
    if (sp) { this.scene.remove(sp); sp.material.dispose(); this.bubbles.delete(uid); }
  }
  pickBubble(px, py, radius = 34) {
    let best = null, bd = radius * radius;
    for (const [uid, sp] of this.bubbles) {
      const s = this.project(sp.position);
      if (!s) continue;
      const dd = (s.x - px) ** 2 + (s.y - py) ** 2;
      if (dd < bd) { bd = dd; best = uid; }
    }
    return best;
  }

  // ── life: citizens & boats ──
  buildLife() {
    const MAX = 220;
    this.people = new THREE.InstancedMesh(personGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), MAX);
    this.people.count = 0;
    this.people.frustumCulled = false;
    this.people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const pal = ['#b8382f', '#3c6fb0', '#e2b33c', '#3f7f4f', '#6b3f7f', '#f1ece0', '#8a5a2b', '#2e2e3a', '#d86f3f'];
    const c = new THREE.Color();
    for (let i = 0; i < MAX; i++) this.people.setColorAt(i, c.set(pal[i % pal.length]));
    this.scene.add(this.people);
    this.walkers = [];

    this.boats = [];
    const bg = boatGeo();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(bg, this.mat);
      this.scene.add(m);
      this.boats.push({ m, x: -M + i * (N + 2 * M) / 4, dir: i % 2 ? 1 : -1, sp: 0.5 + Math.random() * 0.5, lane: (i % 2 ? 0.5 : -0.5) });
    }
  }

  syncWalkers() {
    const g = this.game;
    const roads = g.roads;
    this.roadSet = new Set(roads.flatMap(b => { const s = BUILDINGS[b.type].size; const a = []; for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) a.push((b.z + j) * N + b.x + i); return a; }));
    this.walkers = this.walkers.filter(w => this.roadSet.has(w.tz * N + w.tx));
    const target = Math.min(220, Math.floor(this.roadSet.size * 1.5), Math.floor(g.s.pop / 3));
    const tiles = [...this.roadSet];
    while (this.walkers.length < target && tiles.length) {
      const k = tiles[Math.floor(Math.random() * tiles.length)];
      const x = k % N, z = Math.floor(k / N);
      this.walkers.push({ x: x + 0.5, z: z + 0.5, tx: x, tz: z, px: x, pz: z, ox: (Math.random() - 0.5) * 0.5, oz: (Math.random() - 0.5) * 0.5, sp: 0.35 + Math.random() * 0.35, ph: Math.random() * 6 });
    }
    if (this.walkers.length > target) this.walkers.length = target;
  }

  updateLife(dt) {
    if (this.roadsChanged || (this.lifeT = (this.lifeT ?? 0) + dt) > 3) { this.syncWalkers(); this.roadsChanged = false; this.lifeT = 0; }
    const m4 = this.m4 ??= new THREE.Matrix4(), q = this.q4 ??= new THREE.Quaternion(), v = this.v4 ??= new THREE.Vector3(), sc = this.s4 ??= new THREE.Vector3(1.35, 1.35, 1.35);
    const up = new THREE.Vector3(0, 1, 0);
    this.walkers.forEach((w, i) => {
      const gx = w.tx + 0.5 + w.ox, gz = w.tz + 0.5 + w.oz;
      const dx = gx - w.x, dz = gz - w.z, dist = Math.hypot(dx, dz);
      if (dist < 0.05) {
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [w.tx + a, w.tz + b])
          .filter(([x, z]) => x >= 0 && z >= 0 && x < N && z < N && this.roadSet.has(z * N + x));
        let opts = nb.filter(([x, z]) => x !== w.px || z !== w.pz);
        if (!opts.length) opts = nb;
        if (opts.length) {
          const [nx, nz] = opts[Math.floor(Math.random() * opts.length)];
          w.px = w.tx; w.pz = w.tz; w.tx = nx; w.tz = nz;
        }
        w.ang = w.ang ?? 0;
      } else {
        const st = Math.min(dist, w.sp * dt);
        w.x += dx / dist * st; w.z += dz / dist * st;
        w.ang = Math.atan2(dx, dz);
      }
      const onBridge = this.game.isWater(Math.floor(w.x), Math.floor(w.z));
      q.setFromAxisAngle(up, w.ang ?? 0);
      v.set(w.x, (onBridge ? 0.11 : 0.04) + Math.abs(Math.sin(this.time * 8 + w.ph)) * 0.015, w.z);
      m4.compose(v, q, sc);
      this.people.setMatrixAt(i, m4);
    });
    this.people.count = this.walkers.length;
    this.people.instanceMatrix.needsUpdate = true;

    for (const b of this.boats) {
      b.x += b.dir * b.sp * dt;
      if (b.x > N + M) b.x = -M; if (b.x < -M) b.x = N + M;
      const z = riverCenter(b.x) + b.lane;
      const slope = riverCenter(b.x + 0.1) - riverCenter(b.x - 0.1);
      b.m.position.set(b.x, WATER_Y - 0.02 + Math.sin(this.time * 2 + b.x) * 0.02, z);
      b.m.rotation.y = -Math.atan2(slope, 0.2) + (b.dir < 0 ? Math.PI : 0);
    }
  }

  // ── camera & picking ──
  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }
  updateCamera() {
    const c = this.cam;
    c.dist = Math.max(6, Math.min(48, c.dist));
    c.tx = Math.max(-2, Math.min(N + 2, c.tx));
    c.tz = Math.max(-2, Math.min(N + 2, c.tz));
    const pitch = 0.6 + 0.42 * smooth(6, 48, c.dist);
    this.camera.position.set(c.tx + Math.sin(c.yaw) * Math.cos(pitch) * c.dist, Math.sin(pitch) * c.dist, c.tz + Math.cos(c.yaw) * Math.cos(pitch) * c.dist);
    this.camera.lookAt(c.tx, 0, c.tz);
  }
  ground(px, py) {
    const ndc = new THREE.Vector2(px / this.w * 2 - 1, -(py / this.h) * 2 + 1);
    const rc = this.rc ??= new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    const t = -rc.ray.origin.y / rc.ray.direction.y;
    if (!(t > 0)) return null;
    return rc.ray.origin.clone().addScaledVector(rc.ray.direction, t);
  }
  pickBuilding(px, py) {
    const ndc = new THREE.Vector2(px / this.w * 2 - 1, -(py / this.h) * 2 + 1);
    const rc = this.rc ??= new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    const hits = rc.intersectObjects([...this.meshes.values()], false);
    for (const h of hits) {
      const b = this.game.byUid.get(h.object.userData.uid);
      if (b && !BUILDINGS[b.type].road) return b;
    }
    const p = this.ground(px, py);
    return p ? this.game.at(Math.floor(p.x), Math.floor(p.z)) : null;
  }
  project(v) {
    const p = (this.pv ??= new THREE.Vector3()).copy(v).project(this.camera);
    if (p.z > 1) return null;
    return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h };
  }
  focus(b) {
    const d = BUILDINGS[b.type];
    this.cam.tx = b.x + d.size / 2; this.cam.tz = b.z + d.size / 2;
  }

  frame(dt) {
    this.time += dt;
    this.waterUniforms.uTime.value = this.time;
    // animations
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      if (a.mesh) {
        const from = a.from ?? 0.01;
        const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // ease-out-back
        a.mesh.scale.setScalar(from + (1 - from) * e);
        this.shadowDirty = true;
      } else if (a.puff) {
        a.puff.position.x += a.vx * dt * (1 - k); a.puff.position.z += a.vz * dt * (1 - k);
        a.puff.position.y += dt * 0.6;
        a.puff.scale.setScalar(1 + k * 1.5);
        a.puff.material.opacity = 0.85 * (1 - k);
      }
      if (k >= 1) {
        if (a.mesh) a.mesh.scale.setScalar(1);
        if (a.puff) { this.scene.remove(a.puff); a.puff.material.dispose(); }
        this.anims.splice(i, 1);
      }
    }
    for (const sp of this.bubbles.values()) {
      const u = sp.userData;
      const age = Math.min(1, (this.time - u.born) / 0.3);
      sp.position.y = u.base + Math.sin(this.time * 3 + u.uid) * 0.08;
      const s = (0.5 + this.cam.dist * 0.022) * age;
      sp.scale.set(s, s, s);
    }
    this.updateLife(dt);
    this.updateCamera();
    if (this.shadowDirty) { this.renderer.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    this.renderer.render(this.scene, this.camera);
  }
}

// Render small portraits of each building for the build menu.
export function renderThumbs(types) {
  const size = 128;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff4dc', '#6c7d52', 1.6));
  const sun = new THREE.DirectionalLight('#ffe6c0', 2.6); sun.position.set(-3, 6, 4); scene.add(sun);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const out = {};
  for (const t of types) {
    const g = getModel(t, 0, 1);
    const mesh = new THREE.Mesh(g, mat);
    scene.add(mesh);
    g.computeBoundingSphere();
    const bs = g.boundingSphere;
    const d = bs.radius / Math.sin(15 * Math.PI / 180) * 0.92;
    cam.position.set(bs.center.x + d * 0.55, bs.center.y + d * 0.55, bs.center.z + d * 0.63);
    cam.lookAt(bs.center);
    r.render(scene, cam);
    out[t] = r.domElement.toDataURL();
    scene.remove(mesh);
  }
  r.dispose();
  r.forceContextLoss?.();
  return out;
}
