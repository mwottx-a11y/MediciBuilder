// Procedural low-poly models. Every building is merged into one vertex-coloured geometry.
import * as THREE from 'three';
import { mulberry } from './game.js';

const unit = g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; };

function prismGeo() {
  // unit gable prism: base 1×1 at y=0, ridge along X at y=1
  const v = [
    -.5, 0, .5,  .5, 0, .5,  .5, 1, 0,   -.5, 0, .5,  .5, 1, 0,  -.5, 1, 0,     // front slope
    .5, 0, -.5,  -.5, 0, -.5, -.5, 1, 0,  .5, 0, -.5,  -.5, 1, 0,  .5, 1, 0,    // back slope
    -.5, 0, -.5, -.5, 0, .5, -.5, 1, 0,                                          // left gable
    .5, 0, .5,   .5, 0, -.5,  .5, 1, 0,                                          // right gable
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const GEO = {
  box: unit(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  hip: unit(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0)),
  gable: prismGeo(),
  cyl8: unit(new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0)),
  cyl16: unit(new THREE.CylinderGeometry(0.5, 0.5, 1, 16).translate(0, 0.5, 0)),
  cone8: unit(new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0)),
  cone6: unit(new THREE.ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0)),
  oct: unit(new THREE.ConeGeometry(0.5, 1, 8).rotateY(Math.PI / 8).translate(0, 0.5, 0)),
  dome: unit(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
  ball: unit(new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.5, 0)),
  ball1: unit(new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.5, 0)),
};

export const C = {
  walls: ['#ead6aa', '#e3c48f', '#d9b07a', '#f0e3c6', '#dca37a', '#e8cba0', '#d2a577', '#e6d2b5', '#cf9c6a'],
  roof: ['#b5532f', '#a94a2a', '#c0633c', '#b85f3a'],
  stone: '#bdb3a4', stoneD: '#9a8f80', serena: '#8a8f92', marble: '#f3efe6', green: '#3e6a55', pink: '#d8a39d',
  wood: '#7a5233', woodD: '#4f3522', win: '#3d2f28', door: '#5a3a24', gold: '#e6b83a',
  grass: '#8fb45a', grassD: '#6f9a45', leaf: '#4f7f3a', cypress: '#2f5a34', soil: '#8a6a45', field: '#dcc26a',
  water: '#5aa0bc', white: '#f6f2ea', red: '#b8382f', blue: '#3c6fb0', yellow: '#e2b33c', cobble: '#8e8070', pave: '#cbbca6',
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _n = new THREE.Matrix3(), _c = new THREE.Color();

export class Builder {
  constructor() { this.parts = []; }
  add(key, color, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
    this.parts.push({ g: GEO[key], color, x, y, z, sx, sy, sz, ry, rx, rz });
    return this;
  }
  box(x, y, z, w, h, d, c, ry = 0) { return this.add('box', c, x, y, z, w, h, d, ry); }
  hip(x, y, z, w, h, d, c, ry = 0) { return this.add('hip', c, x, y, z, w, h, d, ry); }
  gable(x, y, z, w, h, d, c, ry = 0) { return this.add('gable', c, x, y, z, w, h, d, ry); }
  cyl(x, y, z, r, h, c, seg = 8) { return this.add(seg > 8 ? 'cyl16' : 'cyl8', c, x, y, z, r * 2, h, r * 2); }
  cone(x, y, z, r, h, c, seg = 8) { return this.add(seg === 6 ? 'cone6' : 'cone8', c, x, y, z, r * 2, h, r * 2); }
  dome(x, y, z, r, c, hs = 1) { return this.add('dome', c, x, y, z, r * 2, r * 2 * hs, r * 2); }
  ball(x, y, z, r, c, smooth = false) { return this.add(smooth ? 'ball1' : 'ball', c, x, y - r, z, r * 2, r * 2, r * 2); }

  build() {
    let count = 0;
    for (const p of this.parts) count += p.g.attributes.position.count;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
    let o = 0;
    for (const p of this.parts) {
      _e.set(p.rx, p.ry, p.rz);
      _q.setFromEuler(_e);
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(p.sx, p.sy, p.sz));
      _n.getNormalMatrix(_m);
      _c.set(p.color);
      const P = p.g.attributes.position, Nn = p.g.attributes.normal;
      for (let i = 0; i < P.count; i++, o++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(_m);
        pos[o * 3] = _v.x; pos[o * 3 + 1] = _v.y; pos[o * 3 + 2] = _v.z;
        _v.fromBufferAttribute(Nn, i).applyMatrix3(_n).normalize();
        nor[o * 3] = _v.x; nor[o * 3 + 1] = _v.y; nor[o * 3 + 2] = _v.z;
        col[o * 3] = _c.r; col[o * 3 + 1] = _c.g; col[o * 3 + 2] = _c.b;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const pick = (r, a) => a[Math.floor(r() * a.length)];

// ── shared fragments ──
function windows(b, w, d, floors, fh, y0, perSide, c = C.win, skipGround = false) {
  for (let f = skipGround ? 1 : 0; f < floors; f++) {
    const y = y0 + f * fh + fh * 0.32;
    for (let i = 0; i < perSide; i++) {
      const t = ((i + 0.5) / perSide - 0.5);
      b.box(t * w * 0.8, y, d / 2, 0.08, fh * 0.42, 0.03, c);
      b.box(t * w * 0.8, y, -d / 2, 0.08, fh * 0.42, 0.03, c);
      b.box(w / 2, y, t * d * 0.8, 0.03, fh * 0.42, 0.08, c);
      b.box(-w / 2, y, t * d * 0.8, 0.03, fh * 0.42, 0.08, c);
    }
  }
}

function house(b, x, z, w, d, floors, wall, roof, r, fh = 0.26) {
  const h = floors * fh;
  b.box(x, 0, z, w, h, d, wall);
  b.box(x, 0, z, w + 0.02, 0.06, d + 0.02, C.stoneD);
  const sub = new Builder();
  windows(sub, w, d, floors, fh, 0, Math.max(1, Math.round(w / 0.3)), C.win, true);
  for (const p of sub.parts) { p.x += x; p.z += z; b.parts.push(p); }
  b.box(x, 0, z + d / 2, 0.14, 0.2, 0.03, C.door);
  b.box(x, h, z, w + 0.08, 0.04, d + 0.08, C.stone);
  b.hip(x, h + 0.04, z, w + 0.1, 0.16 + r() * 0.08, d + 0.1, roof);
  return h;
}

function crenels(b, cx, y, cz, w, d, size, c) {
  const n = Math.max(2, Math.round(w / (size * 2)));
  const m = Math.max(2, Math.round(d / (size * 2)));
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (i + 0.5) * w / n;
    b.box(x, y, cz - d / 2 + size / 2, size, size * 1.2, size, c);
    b.box(x, y, cz + d / 2 - size / 2, size, size * 1.2, size, c);
  }
  for (let i = 0; i < m; i++) {
    const z = cz - d / 2 + (i + 0.5) * d / m;
    b.box(cx - w / 2 + size / 2, y, z, size, size * 1.2, size, c);
    b.box(cx + w / 2 - size / 2, y, z, size, size * 1.2, size, c);
  }
}

function cypress(b, x, z, h = 0.9, c = C.cypress) {
  b.box(x, 0, z, 0.05, 0.12, 0.05, C.woodD);
  b.cone(x, 0.08, z, 0.11, h * 0.7, c, 6);
  b.cone(x, 0.08 + h * 0.35, z, 0.08, h * 0.55, c, 6);
}

function tree(b, x, z, s = 1, c = C.leaf) {
  b.box(x, 0, z, 0.06 * s, 0.25 * s, 0.06 * s, C.woodD);
  b.ball(x, 0.2 * s + 0.2 * s, z, 0.2 * s, c);
}

function stripes(b, x, y0, z, w, h, d, n, c1, c2) {
  for (let i = 0; i < n; i++) b.box(x, y0 + i * h / n, z, w, h / n, d, i % 2 ? c2 : c1);
}

function columns(b, x0, x1, z, n, h, r, c) {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (n - 1);
    b.cyl(x, 0, z, r, h, c);
  }
}

function awning(b, x, y, z, w, c) {
  b.box(x, y, z, w, 0.03, 0.18, c, 0);
  b.box(x, y - 0.06, z + 0.09, w, 0.06, 0.02, C.white);
}

function plinth(b, s, c = C.pave, h = 0.03) { b.box(0, 0, 0, s - 0.04, h, s - 0.04, c); }

// ── Models ── each fn(b, r, level) builds around origin; footprint = size×size
export const MODELS = {
  strada(b) { b.box(0, 0, 0, 1, 0.035, 1, C.cobble); b.box(0, 0.035, 0, 0.92, 0.005, 0.92, '#a89c8d'); },
  piazza(b, r) {
    b.box(0, 0, 0, 1, 0.04, 1, C.pave);
    b.box(0, 0.04, 0, 0.5, 0.004, 0.5, '#d8cbb5');
    if (r() < 0.3) { b.box(0.3, 0.04, 0.3, 0.1, 0.12, 0.1, C.stone); }
  },
  ponte(b) {
    b.box(0, -0.4, 0, 1.02, 0.5, 0.86, C.stone);
    b.box(0, 0.08, 0, 1.02, 0.03, 0.8, C.cobble);
    b.box(0, 0.08, 0.41, 1.02, 0.1, 0.06, C.stoneD);
    b.box(0, 0.08, -0.41, 1.02, 0.1, 0.06, C.stoneD);
    b.box(0, -0.4, 0, 0.3, 0.46, 0.9, C.stoneD);
  },

  casa(b, r, L) {
    const w = 0.66 + r() * 0.14, d = 0.66 + r() * 0.1;
    const fl = 2 + (L - 1) + (r() < 0.35 ? 1 : 0);
    const h = house(b, 0, 0, w, d, fl, pick(r, C.walls), pick(r, C.roof), r);
    if (r() < 0.3) { // altana roof loggia
      b.box(w * 0.2, h + 0.1, 0, 0.25, 0.16, 0.25, C.wood);
      b.hip(w * 0.2, h + 0.26, 0, 0.3, 0.08, 0.3, pick(r, C.roof));
    }
    if (r() < 0.4) b.box(0.2, 0.02, d / 2 + 0.08, 0.16, 0.18, 0.12, C.leaf);
  },
  casaTorre(b, r, L) {
    const h = 1.2 + 0.3 * (L - 1) + r() * 0.2;
    const c = pick(r, [C.stone, '#c8b48f', '#b9a07a']);
    b.box(-0.1, 0, -0.1, 0.5, h, 0.5, c);
    const sub = new Builder();
    windows(sub, 0.5, 0.5, Math.floor(h / 0.3), 0.3, 0, 1, C.win, true);
    for (const p of sub.parts) { p.x -= 0.1; p.z -= 0.1; b.parts.push(p); }
    b.box(-0.1, h, -0.1, 0.58, 0.05, 0.58, C.stoneD);
    b.hip(-0.1, h + 0.05, -0.1, 0.6, 0.15, 0.6, pick(r, C.roof));
    b.box(-0.1, h * 0.65, 0.2, 0.4, 0.08, 0.1, C.wood); // wooden sporto
    house(b, 0.22, 0.22, 0.4, 0.4, 2, pick(r, C.walls), pick(r, C.roof), r);
  },
  palazzo(b, r, L) {
    const fl = 3 + (L - 1), fh = 0.32, h = fl * fh;
    const c = pick(r, ['#e2cfa5', '#d8b68a', '#ead8b5']);
    b.box(0, 0, 0, 1.8, h, 1.8, c);
    b.box(0, 0, 0, 1.82, fh, 1.82, C.stoneD);
    const sub = new Builder();
    windows(sub, 1.8, 1.8, fl, fh, 0, 5, C.win, true);
    b.parts.push(...sub.parts);
    b.box(0, 0, 0.91, 0.25, 0.26, 0.03, C.door);
    b.box(0, h, 0, 1.96, 0.08, 1.96, C.stone);
    b.hip(0, h + 0.08, 0, 1.96, 0.25, 1.96, pick(r, C.roof));
    b.box(0, h + 0.08, 0, 0.8, 0.27, 0.8, C.grass); // courtyard garden peeking
    b.ball(0.85, 0.72, 0.85, 0.08, C.red); b.ball(-0.85, 0.72, 0.85, 0.08, C.red);
  },

  podere(b, r) {
    b.box(0, 0, 0, 1.94, 0.03, 1.94, C.soil);
    for (let i = 0; i < 6; i++) b.box(-0.3 + i * 0.22 - 0.3, 0.03, 0.2, 0.17, 0.07, 1.3, i % 2 ? C.field : '#c9b05a');
    house(b, 0.55, -0.6, 0.6, 0.45, 2, pick(r, C.walls), pick(r, C.roof), r);
    b.cone(-0.6, 0, -0.6, 0.16, 0.28, '#d9b45b');
    b.cone(-0.25, 0, -0.65, 0.13, 0.22, '#d9b45b');
    for (let i = 0; i < 4; i++) cypress(b, 0.9, 0.9 - i * 0.28, 0.6);
  },
  granaio(b, r) {
    b.box(0, 0, 0, 0.8, 0.45, 0.6, C.stone);
    b.gable(0, 0.45, 0, 0.86, 0.25, 0.66, pick(r, C.roof));
    b.box(0, 0, 0.3, 0.26, 0.3, 0.03, C.wood);
    for (let i = 0; i < 3; i++) b.ball(-0.3 + i * 0.12, 0.08, 0.4, 0.06, '#d9c08a');
  },
  vigna(b, r) {
    b.box(0, 0, 0, 1.94, 0.03, 1.94, '#9a7a50');
    for (let i = 0; i < 7; i++) {
      b.box(-0.85 + i * 0.22, 0.03, 0.25, 0.08, 0.16, 1.3, '#5f8f3a');
      for (let j = 0; j < 4; j++) b.ball(-0.85 + i * 0.22 + 0.04, 0.17, -0.25 + j * 0.33, 0.03, '#5b2a5a');
    }
    house(b, -0.5, -0.65, 0.7, 0.4, 2, pick(r, C.walls), pick(r, C.roof), r);
    b.box(0.2, 0, -0.65, 0.25, 0.8, 0.25, C.walls[0]);
    b.hip(0.2, 0.8, -0.65, 0.3, 0.12, 0.3, C.roof[0]);
    cypress(b, 0.75, -0.7, 0.8);
  },
  pascolo(b, r) {
    b.box(0, 0, 0, 1.94, 0.03, 1.94, '#9cc266');
    for (let i = 0; i <= 6; i++) {
      const t = -0.92 + i * 0.307;
      for (const [x, z] of [[t, -0.92], [t, 0.92], [-0.92, t], [0.92, t]]) b.box(x, 0, z, 0.04, 0.16, 0.04, C.wood);
    }
    b.box(0, 0.1, -0.92, 1.84, 0.02, 0.02, C.wood); b.box(0, 0.1, 0.92, 1.84, 0.02, 0.02, C.wood);
    b.box(-0.92, 0.1, 0, 0.02, 0.02, 1.84, C.wood); b.box(0.92, 0.1, 0, 0.02, 0.02, 1.84, C.wood);
    for (let i = 0; i < 6; i++) {
      const x = -0.6 + r() * 1.2, z = -0.4 + r() * 1.0, a = r() * 6;
      b.box(x, 0.06, z, 0.2, 0.12, 0.13, C.white, a);
      b.box(x + Math.cos(a) * 0.12, 0.1, z - Math.sin(a) * 0.12, 0.07, 0.07, 0.07, '#333', a);
    }
    b.box(-0.6, 0, -0.6, 0.35, 0.25, 0.3, C.stone);
    b.gable(-0.6, 0.25, -0.6, 0.4, 0.15, 0.36, C.roof[1]);
    tree(b, 0.6, -0.6, 1.2);
  },
  cava(b, r) {
    b.box(0, 0, 0, 0.96, 0.03, 0.96, '#a59e94');
    for (let i = 0; i < 7; i++) {
      const s = 0.15 + r() * 0.2;
      b.box(-0.35 + r() * 0.7, 0, -0.35 + r() * 0.3, s, s * (0.6 + r()), s, pick(r, ['#c2bab0', '#a8a196', '#8f8a84', C.serena]), r());
    }
    for (let i = 0; i < 4; i++) b.box(-0.25 + i * 0.16, 0, 0.32, 0.13, 0.1, 0.13, '#d8d0c4');
    b.box(0.3, 0, 0.2, 0.04, 0.65, 0.04, C.wood);
    b.box(0.15, 0.6, 0.2, 0.4, 0.04, 0.04, C.wood);
    b.box(0, 0.42, 0.2, 0.01, 0.18, 0.01, '#333');
  },
  lanificio(b, r, L) {
    const fl = 2 + (L - 1);
    house(b, -0.08, -0.1, 0.75, 0.55, fl, pick(r, C.walls), pick(r, C.roof), r);
    b.box(0.32, 0, -0.25, 0.12, 0.25 * fl + 0.35, 0.12, C.stoneD);
    b.box(-0.3, 0, 0.38, 0.03, 0.4, 0.03, C.wood); b.box(0.35, 0, 0.38, 0.03, 0.4, 0.03, C.wood);
    b.box(0.03, 0.38, 0.38, 0.68, 0.02, 0.02, C.wood);
    [C.red, C.blue, C.yellow, '#3f7f4f'].forEach((c, i) => b.box(-0.2 + i * 0.15, 0.14, 0.38, 0.11, 0.24, 0.01, c));
  },
  tintoria(b, r) {
    b.box(-0.2, 0, -0.2, 0.55, 0.4, 0.5, pick(r, C.walls));
    b.gable(-0.2, 0.4, -0.2, 0.6, 0.18, 0.56, pick(r, C.roof));
    [[0.25, 0.2, C.red], [0.25, -0.2, C.blue], [-0.15, 0.28, C.yellow]].forEach(([x, z, c]) => {
      b.cyl(x, 0, z, 0.14, 0.18, C.wood, 12); b.cyl(x, 0.18, z, 0.12, 0.01, c, 12);
    });
  },
  mulino(b, r) {
    house(b, -0.12, 0, 0.6, 0.6, 2, pick(r, C.walls), pick(r, C.roof), r);
    b.add('cyl16', C.wood, 0.3, 0.32, 0, 0.62, 0.1, 0.62, 0, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) b.add('box', C.woodD, 0.36, 0.32, 0, 0.03, 0.6, 0.05, 0, i * Math.PI / 4, 0);
  },
  setificio(b, r, L) {
    const fl = 2 + (L - 1);
    const h = house(b, -0.12, -0.1, 0.66, 0.6, fl, pick(r, C.walls), pick(r, C.roof), r);
    columns(b, -0.4, 0.16, 0.22, 4, 0.22, 0.025, C.stone);
    tree(b, 0.34, 0.3, 1.1, '#5d8a3a');
  },

  mercato(b, r) {
    plinth(b, 1, C.pave);
    const stalls = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
    stalls.forEach(([x, z], i) => {
      b.box(x, 0.03, z, 0.32, 0.14, 0.2, C.wood);
      const c = [C.red, C.blue, C.yellow, '#3f7f4f'][(i + Math.floor(r() * 4)) % 4];
      b.box(x - 0.15, 0.03, z - 0.1, 0.02, 0.32, 0.02, C.woodD);
      b.box(x + 0.15, 0.03, z - 0.1, 0.02, 0.32, 0.02, C.woodD);
      b.add('box', c, x, 0.33, z, 0.36, 0.025, 0.3, 0, 0.25, 0);
      for (let k = 0; k < 3; k++) b.ball(x - 0.1 + k * 0.1, 0.2, z + 0.04, 0.035, pick(r, ['#e0a030', '#b8382f', '#7aa64b', '#e8d080']));
    });
  },
  cambio(b, r, L) {
    const h = house(b, 0, -0.05, 0.62, 0.62, 2 + L, pick(r, ['#e6d2a8', '#dcbf90']), pick(r, C.roof), r, 0.24);
    awning(b, 0, 0.32, 0.3, 0.6, C.gold);
    b.box(0, 0, 0.38, 0.4, 0.14, 0.12, C.wood);
    b.ball(0.05, 0.17, 0.38, 0.03, C.gold); b.ball(-0.08, 0.17, 0.38, 0.03, C.gold);
  },
  banca(b, r, L) {
    const fl = 3 + (L - 1), fh = 0.27, h = fl * fh;
    b.box(0, 0, 0, 0.84, h, 0.84, '#d4be96');
    b.box(0, 0, 0, 0.86, fh, 0.86, '#9e8a6e');
    const sub = new Builder(); windows(sub, 0.84, 0.84, fl, fh, 0, 3, C.win, true); b.parts.push(...sub.parts);
    b.box(0, 0, 0.43, 0.2, 0.2, 0.03, C.door);
    b.box(0, h, 0, 0.96, 0.07, 0.96, C.stone);
    b.hip(0, h + 0.07, 0, 0.94, 0.16, 0.94, pick(r, C.roof));
    b.box(0.28, fh + 0.02, 0.435, 0.16, 0.18, 0.02, C.gold);
    for (let i = 0; i < 3; i++) b.ball(0.24 + i * 0.04, fh + 0.06 + (i % 2) * 0.05, 0.45, 0.02, C.red);
  },
  fondaco(b, r) {
    b.box(0, 0, -0.1, 0.9, 0.5, 0.65, C.stone);
    b.gable(0, 0.5, -0.1, 0.96, 0.22, 0.72, pick(r, C.roof));
    b.box(-0.2, 0, 0.23, 0.22, 0.32, 0.03, C.wood); b.box(0.2, 0, 0.23, 0.22, 0.32, 0.03, C.wood);
    for (let i = 0; i < 3; i++) b.box(-0.35 + i * 0.15, 0, 0.38, 0.12, 0.12, 0.12, C.wood, r());
    b.cyl(0.3, 0, 0.38, 0.06, 0.14, C.woodD); b.cyl(0.4, 0, 0.36, 0.06, 0.14, C.woodD);
    b.box(-0.35, 0.12, 0.38, 0.11, 0.1, 0.11, '#c0504d');
  },
  zecca(b, r, L) {
    const h = 0.8 + 0.2 * (L - 1);
    b.box(0, 0, 0, 0.85, h, 0.85, '#b8a27e');
    crenels(b, 0, h, 0, 0.85, 0.85, 0.09, '#b8a27e');
    b.box(0.25, h, -0.25, 0.15, 0.4, 0.15, C.stoneD);
    b.cyl(0, h * 0.6, 0.44, 0.13, 0.03, C.gold, 12);
    b.add('cyl16', C.gold, 0, h * 0.6, 0.44, 0.24, 0.24, 0.03, 0, Math.PI / 2, 0);
    b.box(0, 0, 0.43, 0.2, 0.25, 0.03, C.door);
  },

  cappella(b, r) {
    const c = pick(r, [C.white, '#efe2c6', '#e8d6b0']);
    b.box(0, 0, 0.05, 0.46, 0.42, 0.7, c);
    b.gable(0, 0.42, 0.05, 0.5, 0.2, 0.74, pick(r, C.roof), Math.PI / 2);
    b.box(0, 0, 0.405, 0.12, 0.2, 0.02, C.door);
    b.add('cyl16', '#7da6c8', 0, 0.3, 0.41, 0.12, 0.12, 0.02, 0, Math.PI / 2, 0);
    b.box(0.3, 0, -0.25, 0.18, 0.75, 0.18, c);
    b.box(0.3, 0.55, -0.15, 0.08, 0.1, 0.01, C.win);
    b.hip(0.3, 0.75, -0.25, 0.22, 0.2, 0.22, C.roof[0]);
  },
  convento(b, r) {
    const c = pick(r, [C.white, '#efe2c6']);
    for (const [x, z, w, d] of [[0, -0.7, 1.8, 0.4], [0, 0.7, 1.8, 0.4], [-0.7, 0, 0.4, 1.0], [0.7, 0, 0.4, 1.0]]) {
      b.box(x, 0, z, w, 0.35, d, c);
      b.hip(x, 0.35, z, w + 0.06, 0.15, d + 0.06, C.roof[0]);
    }
    b.box(0, 0, 0, 1.0, 0.03, 1.0, C.grass);
    b.cyl(0, 0.03, 0, 0.08, 0.1, C.stone);
    for (const [x, z] of [[-0.3, -0.3], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3]]) b.ball(x, 0.15, z, 0.07, C.leaf);
    b.box(-0.3, 0, -0.75, 0.8, 0.7, 0.45, c);
    b.gable(-0.3, 0.7, -0.75, 0.84, 0.22, 0.5, C.roof[1]);
    b.box(0.55, 0, -0.75, 0.2, 1.05, 0.2, c);
    b.hip(0.55, 1.05, -0.75, 0.24, 0.25, 0.24, C.roof[0]);
  },
  chiesa(b, r) {
    const c = C.white;
    b.box(0, 0, 0.1, 0.8, 0.85, 1.55, c);
    b.gable(0, 0.85, 0.1, 0.86, 0.3, 1.6, C.roof[0], Math.PI / 2);
    b.box(-0.55, 0, 0.1, 0.32, 0.5, 1.4, c); b.box(0.55, 0, 0.1, 0.32, 0.5, 1.4, c);
    b.add('box', C.roof[2], -0.55, 0.5, 0.1, 0.36, 0.06, 1.44, 0, 0, 0.3);
    b.add('box', C.roof[2], 0.55, 0.5, 0.1, 0.36, 0.06, 1.44, 0, 0, -0.3);
    // façade with marble inlay
    b.box(0, 0, 0.88, 1.44, 0.9, 0.03, C.marble);
    for (let i = 0; i < 4; i++) b.box(-0.54 + i * 0.36, 0, 0.9, 0.05, 0.9, 0.02, C.green);
    b.box(0, 0.45, 0.9, 1.44, 0.04, 0.02, C.green);
    b.add('gable', C.marble, 0, 0.9, 0.88, 0.86, 0.3, 0.04, 0);
    b.add('cyl16', '#7da6c8', 0, 0.62, 0.91, 0.24, 0.24, 0.02, 0, Math.PI / 2, 0);
    b.box(0, 0, 0.9, 0.18, 0.32, 0.02, C.door);
    b.box(0.72, 0, -0.65, 0.3, 1.6, 0.3, '#efe4cc');
    b.box(0.72, 1.25, -0.5, 0.12, 0.2, 0.01, C.win);
    b.cone(0.72, 1.6, -0.65, 0.2, 0.4, C.roof[0], 6);
  },

  scuola(b, r, L) {
    house(b, 0, 0, 0.75, 0.6, 2 + (L - 1), pick(r, C.walls), pick(r, C.roof), r);
    const h = (2 + (L - 1)) * 0.26;
    b.box(-0.2, h + 0.1, 0, 0.12, 0.22, 0.12, C.stone);
    b.hip(-0.2, h + 0.32, 0, 0.16, 0.1, 0.16, C.roof[0]);
    b.box(0.25, 0, 0.36, 0.25, 0.08, 0.1, C.wood);
  },
  bottega(b, r, L) {
    const h = house(b, 0, -0.1, 0.72, 0.6, 2 + (L - 1), pick(r, C.walls), pick(r, C.roof), r);
    b.box(0, 0, 0.205, 0.36, 0.26, 0.02, C.woodD);
    awning(b, 0, 0.32, 0.27, 0.66, pick(r, [C.red, C.blue, '#3f7f4f']));
    b.box(-0.28, 0, 0.36, 0.02, 0.32, 0.02, C.wood);
    b.add('box', '#f2e6c8', -0.28, 0.14, 0.34, 0.2, 0.16, 0.02, 0, -0.2, 0);
    b.box(0.25, 0, 0.36, 0.12, 0.22, 0.12, C.marble);
  },
  biblioteca(b, r, L) {
    const fh = 0.36, fl = 2 + (L - 1);
    b.box(0, 0, 0, 0.86, fh * fl, 0.6, '#ede2c8');
    for (let f = 0; f < fl; f++) for (let i = 0; i < 4; i++) {
      b.box(-0.3 + i * 0.2, f * fh + 0.1, 0.3, 0.09, 0.2, 0.02, C.win);
      b.box(-0.3 + i * 0.2, f * fh + 0.1, -0.3, 0.09, 0.2, 0.02, C.win);
    }
    b.box(0, fh * fl, 0, 0.92, 0.05, 0.66, C.serena);
    b.gable(0, fh * fl + 0.05, 0, 0.92, 0.22, 0.66, C.roof[1]);
    b.add('gable', C.marble, 0, fh * fl + 0.05, 0.33, 0.6, 0.2, 0.02);
    columns(b, -0.36, 0.36, 0.36, 5, fh, 0.025, C.serena);
    b.box(0, fh, 0.36, 0.8, 0.04, 0.1, C.serena);
  },
  accademia(b, r) {
    b.box(0, 0, -0.35, 1.6, 0.75, 0.8, '#ead9b5');
    crenels(b, 0, 0.75, -0.35, 1.6, 0.8, 0.08, '#ead9b5');
    b.box(0, 0.75, -0.35, 1.4, 0.04, 0.6, C.roof[0]);
    const sub = new Builder(); windows(sub, 1.6, 0.8, 2, 0.35, 0, 5, C.win, true);
    for (const p of sub.parts) { p.z -= 0.35; b.parts.push(p); }
    columns(b, -0.6, 0.6, 0.1, 6, 0.35, 0.03, C.serena);
    b.box(0, 0.35, 0.05, 1.3, 0.05, 0.12, C.serena);
    b.box(0, 0, 0.55, 1.8, 0.03, 0.75, C.grass);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) b.box(x, 0.03, 0.6, 0.25, 0.1, 0.25, '#4f7f3a');
    cypress(b, -0.85, 0.85); cypress(b, 0.85, 0.85);
  },
  stamperia(b, r, L) {
    house(b, -0.1, -0.1, 0.7, 0.6, 2 + (L - 1), pick(r, C.walls), pick(r, C.roof), r);
    b.box(0.3, 0, 0.32, 0.03, 0.3, 0.03, C.wood); b.box(-0.35, 0, 0.32, 0.03, 0.3, 0.03, C.wood);
    b.box(-0.02, 0.27, 0.32, 0.66, 0.015, 0.015, C.woodD);
    for (let i = 0; i < 5; i++) b.box(-0.27 + i * 0.12, 0.15, 0.32, 0.09, 0.12, 0.005, C.white);
  },
  ospedale(b, r) {
    b.box(0, 0, -0.2, 1.8, 0.95, 1.0, C.white);
    b.hip(0, 0.95, -0.2, 1.86, 0.25, 1.06, C.roof[0]);
    b.box(0, 0, 0.5, 1.8, 0.04, 0.45, C.serena);
    columns(b, -0.82, 0.82, 0.68, 9, 0.42, 0.025, C.serena);
    b.box(0, 0.42, 0.5, 1.8, 0.06, 0.42, C.white);
    b.add('box', C.roof[1], 0, 0.48, 0.5, 1.8, 0.03, 0.44, 0, -0.25, 0);
    for (let i = 0; i < 8; i++) b.add('cyl16', '#4f7fc4', -0.72 + i * 0.205, 0.37, 0.72, 0.07, 0.07, 0.015, 0, Math.PI / 2, 0);
    for (let i = 0; i < 8; i++) b.box(-0.72 + i * 0.205, 0.62, 0.3, 0.06, 0.14, 0.02, C.win);
  },

  cipresso(b, r) {
    const n = r() < 0.5 ? 1 : 2;
    if (n === 1) cypress(b, 0, 0, 0.9 + r() * 0.4);
    else { cypress(b, -0.18, -0.1, 0.8 + r() * 0.3); cypress(b, 0.18, 0.12, 0.9 + r() * 0.3); }
    b.box(0, 0, 0, 0.9, 0.02, 0.9, C.grassD);
  },
  giardino(b, r) {
    b.box(0, 0, 0, 0.98, 0.03, 0.98, '#d9ccae');
    const hedge = '#4a7a3a';
    b.box(0, 0.03, -0.4, 0.84, 0.1, 0.08, hedge); b.box(0, 0.03, 0.4, 0.84, 0.1, 0.08, hedge);
    b.box(-0.4, 0.03, 0, 0.08, 0.1, 0.84, hedge); b.box(0.4, 0.03, 0, 0.08, 0.1, 0.84, hedge);
    b.box(0, 0.03, 0, 0.3, 0.1, 0.3, hedge);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.ball(x, 0.1, z, 0.06, pick(r, ['#d8485a', '#f2c84b', '#e88ab0', '#f6f2ea']));
    b.ball(0, 0.25, 0, 0.09, '#3f6a32');
  },
  fontana(b) {
    b.box(0, 0, 0, 0.98, 0.03, 0.98, C.pave);
    b.add('cyl8', C.stone, 0, 0.03, 0, 0.78, 0.14, 0.78);
    b.add('cyl8', C.water, 0, 0.03, 0, 0.68, 0.13, 0.68);
    b.cyl(0, 0.03, 0, 0.06, 0.4, C.marble);
    b.cyl(0, 0.35, 0, 0.16, 0.04, C.stone);
    b.cyl(0, 0.39, 0, 0.13, 0.01, C.water);
    b.cyl(0, 0.39, 0, 0.035, 0.16, C.marble);
    b.ball(0, 0.6, 0, 0.05, C.marble);
  },
  statua(b, r) {
    b.box(0, 0, 0, 0.98, 0.03, 0.98, C.pave);
    b.box(0, 0.03, 0, 0.32, 0.32, 0.32, C.serena);
    b.box(0, 0.35, 0, 0.36, 0.04, 0.36, C.stone);
    b.box(-0.04, 0.39, 0, 0.05, 0.22, 0.06, C.marble); b.box(0.04, 0.39, 0, 0.05, 0.22, 0.06, C.marble);
    b.add('box', C.marble, 0, 0.6, 0, 0.16, 0.22, 0.09, 0, 0, 0.05);
    b.add('box', C.marble, 0.11, 0.62, 0, 0.04, 0.18, 0.04, 0, 0, 0.2);
    b.ball(0.01, 0.9, 0, 0.055, C.marble, true);
  },
  loggia(b) {
    b.box(0, 0, 0, 1.94, 0.1, 1.5, C.serena);
    b.box(0, 0.1, -0.65, 1.9, 0.9, 0.2, C.stone);
    for (const x of [-0.92, -0.31, 0.31, 0.92]) b.box(x, 0.1, 0.65, 0.16, 0.9, 0.2, C.stone);
    for (const x of [-0.92, -0.31, 0.31, 0.92]) b.box(x, 0.1, 0, 0.12, 0.9, 0.12, C.stone);
    b.box(0, 0.85, 0.65, 1.94, 0.15, 0.2, C.stone);
    b.box(0, 1.0, 0, 1.96, 0.08, 1.5, C.stoneD);
    for (let i = 0; i < 8; i++) b.box(-0.84 + i * 0.24, 1.08, 0.7, 0.05, 0.1, 0.05, C.stone);
    b.box(0, 1.08, 0, 1.9, 0.02, 1.4, C.roof[0]);
    for (const x of [-0.6, 0, 0.6]) {
      b.box(x, 0.1, -0.2, 0.18, 0.18, 0.18, C.serena);
      b.add('box', C.marble, x, 0.28, -0.2, 0.1, 0.3, 0.08, 0, 0, 0.1);
      b.ball(x, 0.65, -0.2, 0.05, C.marble, true);
    }
  },

  // ── Wonders ──
  palazzoVecchio(b) {
    const c = '#c9ad7d', cd = '#b0956a';
    b.box(0, 0, 0, 1.7, 1.2, 1.6, c);
    b.box(0, 0, 0, 1.72, 0.3, 1.62, cd);
    const sub = new Builder(); windows(sub, 1.7, 1.6, 3, 0.36, 0.1, 4, C.win, true); b.parts.push(...sub.parts);
    b.box(0, 1.2, 0, 1.86, 0.18, 1.76, cd);
    crenels(b, 0, 1.38, 0, 1.86, 1.76, 0.09, c);
    b.box(0, 1.38, 0, 1.6, 0.04, 1.5, C.roof[0]);
    // Torre di Arnolfo
    b.box(0.15, 1.38, 0.55, 0.32, 1.1, 0.32, c);
    b.box(0.15, 2.45, 0.55, 0.44, 0.22, 0.44, cd);
    crenels(b, 0.15, 2.67, 0.55, 0.44, 0.44, 0.07, c);
    b.box(0.07, 2.67, 0.47, 0.06, 0.32, 0.06, c); b.box(0.23, 2.67, 0.63, 0.06, 0.32, 0.06, c);
    b.box(0.07, 2.67, 0.63, 0.06, 0.32, 0.06, c); b.box(0.23, 2.67, 0.47, 0.06, 0.32, 0.06, c);
    b.hip(0.15, 2.99, 0.55, 0.22, 0.2, 0.22, C.roof[0]);
    b.cyl(0.15, 3.19, 0.55, 0.012, 0.15, '#333');
    b.box(0, 0, 0.81, 0.24, 0.3, 0.03, C.door);
    b.box(-0.55, 0, 0.95, 0.18, 0.5, 0.18, C.marble); // Michelangelo's David!
  },
  orsanmichele(b) {
    const c = '#c9b38c';
    b.box(0, 0, 0, 1.45, 1.6, 1.45, c);
    for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
      b.box(-0.45 + i * 0.45, 0.15, s * 0.73, 0.22, 0.45, 0.03, C.marble);
      b.box(-0.45 + i * 0.45, 0.2, s * 0.745, 0.12, 0.3, 0.02, '#3a3a40');
      b.box(s * 0.73, 0.15, -0.45 + i * 0.45, 0.03, 0.45, 0.22, C.marble);
      b.box(s * 0.745, 0.2, -0.45 + i * 0.45, 0.02, 0.3, 0.12, '#3a3a40');
      b.box(-0.45 + i * 0.45, 0.95, s * 0.73, 0.14, 0.3, 0.02, C.win);
    }
    b.box(0, 1.6, 0, 1.55, 0.08, 1.55, C.stoneD);
    b.hip(0, 1.68, 0, 1.5, 0.15, 1.5, C.roof[0]);
  },
  santaCroce(b) {
    b.box(0, 0, 0, 0.8, 1.0, 1.7, '#e9dec8');
    b.gable(0, 1.0, 0, 0.86, 0.32, 1.74, C.roof[0], Math.PI / 2);
    b.box(-0.55, 0, 0.05, 0.3, 0.55, 1.5, '#e9dec8'); b.box(0.55, 0, 0.05, 0.3, 0.55, 1.5, '#e9dec8');
    b.add('box', C.roof[2], -0.55, 0.55, 0.05, 0.34, 0.06, 1.54, 0, 0, 0.3);
    b.add('box', C.roof[2], 0.55, 0.55, 0.05, 0.34, 0.06, 1.54, 0, 0, -0.3);
    b.box(0, 0, 0.88, 1.5, 1.05, 0.05, C.marble);
    for (let i = 0; i < 5; i++) b.box(-0.6 + i * 0.3, 0, 0.91, 0.04, 1.05, 0.02, C.green);
    b.box(0, 0.55, 0.91, 1.5, 0.04, 0.02, C.green);
    b.add('gable', C.marble, 0, 1.05, 0.88, 0.9, 0.36, 0.05);
    b.add('cyl16', '#7da6c8', 0, 0.75, 0.92, 0.3, 0.3, 0.02, 0, Math.PI / 2, 0);
    b.box(0, 0, 0.92, 0.22, 0.38, 0.02, C.door);
    b.ball(0, 1.6, 0.9, 0.12, C.gold);
    b.box(-0.75, 0, -0.75, 0.3, 1.9, 0.3, '#e9dec8');
    b.cone(-0.75, 1.9, -0.75, 0.21, 0.5, C.serena, 8);
  },
  battistero(b) {
    b.box(0, 0, 0, 1.9, 0.06, 1.9, C.pave);
    b.add('cyl8', C.marble, 0, 0.06, 0, 1.55, 0.95, 1.55, Math.PI / 8);
    for (const y of [0.1, 0.45, 0.85]) b.add('cyl8', C.green, 0, y, 0, 1.57, 0.05, 1.57, Math.PI / 8);
    b.add('cyl8', C.marble, 0, 1.0, 0, 1.4, 0.2, 1.4, Math.PI / 8);
    b.add('oct', C.white, 0, 1.2, 0, 1.45, 0.4, 1.45);
    b.add('cyl8', C.marble, 0, 1.55, 0, 0.25, 0.2, 0.25, Math.PI / 8);
    b.cone(0, 1.75, 0, 0.14, 0.2, C.marble);
    b.ball(0, 2.0, 0, 0.04, C.gold);
    b.box(0, 0.06, 0.74, 0.3, 0.45, 0.06, C.gold);
    b.box(-0.74, 0.06, 0, 0.06, 0.45, 0.3, C.gold);
  },
  campanile(b) {
    b.box(0, 0, 0, 0.98, 0.04, 0.98, C.pave);
    const w = 0.52, H = 3.2;
    const bands = [C.marble, C.pink, C.marble, C.green];
    for (let i = 0; i < 16; i++) b.box(0, i * H / 16, 0, w, H / 16, w, bands[i % 4]);
    for (const y of [1.4, 2.0, 2.6]) for (const s of [1, -1]) {
      b.box(0, y, s * w / 2, 0.14, 0.4, 0.02, C.win);
      b.box(s * w / 2, y, 0, 0.02, 0.4, 0.14, C.win);
    }
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.box(x * w / 2, 0, z * w / 2, 0.06, H, 0.06, C.marble);
    b.box(0, H, 0, w + 0.1, 0.08, w + 0.1, C.marble);
    b.box(0, H + 0.08, 0, w, 0.04, w, C.roof[0]);
  },
  pontevecchio(b) {
    b.box(0, -0.4, 0, 1.02, 0.5, 0.9, C.stone);
    b.box(0, 0.08, 0, 1.02, 0.03, 0.3, C.cobble);
    const cs = ['#e2a24f', '#d9c08a', '#c8754a', '#e8c070', '#d79a5c', '#e6cc8f'];
    for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
      const h = 0.28 + (i % 2) * 0.1;
      b.box(-0.33 + i * 0.33, 0.08, s * 0.32, 0.3, h, 0.3, cs[(i * 2 + (s > 0 ? 1 : 0)) % cs.length]);
      b.box(-0.33 + i * 0.33, 0.08 + h, s * 0.32, 0.32, 0.04, 0.32, C.roof[i % 3]);
      b.box(-0.33 + i * 0.33, -0.05, s * 0.46, 0.04, 0.14, 0.04, C.wood);
    }
    b.box(0, 0.48, -0.32, 1.02, 0.14, 0.18, '#e2c08a');
    b.box(0, 0.62, -0.32, 1.02, 0.03, 0.2, C.roof[0]);
  },
  palazzoMedici(b) {
    const fh = 0.42;
    b.box(0, 0, 0, 1.85, fh, 1.85, '#9c8668');
    b.box(0, fh, 0, 1.82, fh, 1.82, '#c5ad84');
    b.box(0, fh * 2, 0, 1.8, fh, 1.8, '#d9c39a');
    for (let f = 0; f < 3; f++) for (let i = 0; i < 5; i++) for (const s of [1, -1]) {
      const y = f * fh + 0.12;
      b.box(-0.68 + i * 0.34, y, s * 0.925, 0.12, 0.2, 0.03, f === 0 ? '#5a4a3a' : C.win);
      b.box(s * 0.925, y, -0.68 + i * 0.34, 0.03, 0.2, 0.12, f === 0 ? '#5a4a3a' : C.win);
    }
    b.box(0, fh * 3, 0, 2.02, 0.12, 2.02, C.stone);
    b.hip(0, fh * 3 + 0.12, 0, 1.95, 0.25, 1.95, C.roof[0]);
    b.box(0, 0, 0.93, 0.3, 0.32, 0.04, C.door);
    b.box(0.7, fh * 1.05, 0.93, 0.26, 0.3, 0.03, C.gold);
    for (const [x, y] of [[0.63, 0.06], [0.7, 0.06], [0.77, 0.06], [0.66, 0.14], [0.74, 0.14], [0.7, 0.22]]) b.ball(x, fh * 1.05 + y + 0.03, 0.95, 0.025, C.red);
  },
  uffizi(b) {
    const c = '#e6dac0';
    for (const x of [-0.65, 0.65]) {
      b.box(x, 0, 0.05, 0.6, 1.0, 1.75, c);
      b.hip(x, 1.0, 0.05, 0.64, 0.18, 1.8, C.roof[0]);
      for (let i = 0; i < 6; i++) {
        b.cyl(x + (x < 0 ? 0.32 : -0.32), 0, -0.75 + i * 0.3, 0.025, 0.32, C.serena);
        b.box(x + (x < 0 ? 0.31 : -0.31), 0.5, -0.75 + i * 0.3, 0.02, 0.16, 0.09, C.win);
        b.box(x + (x < 0 ? 0.31 : -0.31), 0.78, -0.75 + i * 0.3, 0.02, 0.1, 0.09, C.win);
      }
    }
    b.box(0, 0, -0.75, 0.7, 1.0, 0.4, c);
    b.hip(0, 1.0, -0.75, 0.74, 0.18, 0.44, C.roof[0]);
    b.box(0, 0, 0.05, 0.7, 0.02, 1.7, C.pave);
    for (let i = 0; i < 4; i++) { b.box(-0.2 + (i % 2) * 0.4, 0.02, -0.4 + Math.floor(i / 2) * 0.6, 0.08, 0.08, 0.08, C.serena); b.ball(-0.2 + (i % 2) * 0.4, 0.22, -0.4 + Math.floor(i / 2) * 0.6, 0.05, C.marble); }
  },
  duomo(b) {
    const M = C.marble, G = C.green, P = C.pink, R = C.roof[0];
    b.box(0, 0, 0, 2.95, 0.04, 2.95, C.pave);
    // nave
    b.box(0, 0, 0.55, 1.0, 1.15, 1.8, M);
    for (const s of [1, -1]) {
      b.box(s * 0.502, 0, 0.55, 0.02, 1.15, 1.8, M);
      for (let i = 0; i < 5; i++) b.box(s * 0.51, 0, -0.2 + i * 0.37, 0.02, 1.15, 0.05, G);
      b.box(s * 0.51, 0.55, 0.55, 0.02, 0.04, 1.8, G);
      b.box(s * 0.51, 0.15, 0.55, 0.02, 0.15, 1.8, P);
    }
    b.gable(0, 1.15, 0.55, 1.04, 0.32, 1.84, R, Math.PI / 2);
    // façade
    b.box(0, 0, 1.45, 1.4, 1.4, 0.06, M);
    for (let i = 0; i < 5; i++) b.box(-0.56 + i * 0.28, 0, 1.49, 0.04, 1.4, 0.02, G);
    b.box(0, 0.7, 1.49, 1.4, 0.05, 0.02, P);
    b.add('cyl16', '#7da6c8', 0, 0.95, 1.49, 0.28, 0.28, 0.02, 0, Math.PI / 2, 0);
    b.add('gable', M, 0, 1.4, 1.45, 0.9, 0.3, 0.06);
    b.box(0, 0, 1.49, 0.24, 0.42, 0.02, C.gold);
    // crossing: tribunes and drum
    for (const [x, z] of [[0.85, -0.55], [-0.85, -0.55], [0, -1.25]]) {
      b.add('cyl8', M, x, 0, z, 0.75, 0.75, 0.75, Math.PI / 8);
      b.dome(x, 0.75, z, 0.38, R, 0.8);
    }
    b.add('cyl8', M, 0, 0, -0.55, 1.35, 1.4, 1.35, Math.PI / 8);
    b.add('cyl8', G, 0, 1.15, -0.55, 1.37, 0.06, 1.37, Math.PI / 8);
    b.add('cyl8', M, 0, 1.4, -0.55, 1.25, 0.32, 1.25, Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8;
      b.add('cyl16', '#5a6a80', Math.sin(a) * 0.63, 1.5, -0.55 + Math.cos(a) * 0.63, 0.12, 0.12, 0.02, a, Math.PI / 2, 0);
    }
    // Brunelleschi's dome (pointed, 8 white ribs)
    b.add('dome', R, 0, 1.72, -0.55, 1.22, 1.45, 1.22);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      for (let k = 0; k < 6; k++) {
        const t = k / 6, phi = t * Math.PI / 2;
        const rr = 0.61 * Math.cos(phi), y = 1.72 + 0.725 * Math.sin(phi);
        b.add('box', M, Math.sin(a) * rr, y, -0.55 + Math.cos(a) * rr, 0.045, 0.15, 0.045, a, -phi, 0);
      }
    }
    b.add('cyl8', M, 0, 2.42, -0.55, 0.2, 0.22, 0.2);
    b.cone(0, 2.64, -0.55, 0.09, 0.22, M, 8);
    b.ball(0, 2.92, -0.55, 0.045, C.gold, true);
    // Giotto's campanile at the corner
    for (let i = 0; i < 12; i++) b.box(1.15, i * 0.2, 1.15, 0.4, 0.2, 0.4, [M, P, M, G][i % 4]);
    b.box(1.15, 2.4, 1.15, 0.46, 0.06, 0.46, M);
  },
  palazzoPitti(b) {
    b.box(0, 0, 0, 2.95, 0.03, 2.95, C.grass);
    const c = '#c8ae84';
    b.box(0, 0, -0.95, 2.8, 0.85, 0.9, c);
    b.box(0, 0.85, -0.95, 1.6, 0.35, 0.8, c);
    for (let f = 0; f < 2; f++) for (let i = 0; i < 11; i++) b.box(-1.25 + i * 0.25, f * 0.4 + 0.12, -0.49, 0.12, 0.2, 0.03, C.win);
    for (let i = 0; i < 6; i++) b.box(-0.65 + i * 0.26, 0.95, -0.54, 0.1, 0.16, 0.03, C.win);
    b.box(0, 0.85, -0.95, 2.86, 0.05, 0.96, C.stoneD);
    b.box(0, 1.2, -0.95, 1.66, 0.05, 0.86, C.stoneD);
    b.box(0, 0, -0.49, 0.3, 0.32, 0.03, C.door);
    for (const x of [-1.15, 1.15]) { b.box(x, 0, 0.1, 0.5, 0.6, 1.2, c); b.hip(x, 0.6, 0.1, 0.54, 0.12, 1.24, C.roof[0]); }
    b.box(0, 0.03, 0.5, 1.6, 0.02, 1.7, '#d9ccae');
    for (const [x, z] of [[-0.45, 0.1], [0.45, 0.1], [-0.45, 0.85], [0.45, 0.85]]) b.box(x, 0.05, z, 0.5, 0.1, 0.5, '#4a7a3a');
    b.add('cyl8', C.stone, 0, 0.05, 0.5, 0.4, 0.1, 0.4); b.add('cyl8', C.water, 0, 0.06, 0.5, 0.32, 0.1, 0.32);
    b.cyl(0, 0.05, 0.5, 0.04, 0.35, C.marble);
    for (let i = 0; i < 6; i++) cypress(b, -1.3 + i * 0.52, 1.35, 0.8);
  },
  leonardo(b, r) {
    house(b, -0.1, 0.05, 0.6, 0.6, 2, '#e3c48f', C.roof[0], r);
    b.box(0.3, 0, -0.25, 0.25, 1.0, 0.25, '#d9b07a');
    b.box(0.3, 1.0, -0.25, 0.32, 0.03, 0.32, C.wood);
    b.box(0.3, 1.03, -0.25, 0.04, 0.12, 0.04, C.woodD);
    b.add('box', '#d8c8a0', 0.12, 1.15, -0.25, 0.42, 0.01, 0.12, 0, 0, 0.25);
    b.add('box', '#d8c8a0', 0.48, 1.15, -0.25, 0.42, 0.01, 0.12, 0, 0, -0.25);
    b.cone(-0.3, 0.05, 0.4, 0.14, 0.12, '#c0a070');
    b.box(-0.3, 0, 0.4, 0.02, 0.18, 0.02, C.woodD);
    b.cyl(0.3, 0, 0.35, 0.12, 0.05, C.wood);
    b.add('cyl16', C.wood, 0.3, 0.05, 0.35, 0.25, 0.04, 0.25, 0, Math.PI / 2, 0);
  },
};

// Generic house used for anything without a model
function fallback(b, r) { house(b, 0, 0, 0.7, 0.7, 2, pick(r, C.walls), pick(r, C.roof), r); }

const cache = new Map();
export function getModel(type, variant = 0, level = 1) {
  const key = `${type}:${variant}:${level}`;
  let g = cache.get(key);
  if (!g) {
    const b = new Builder();
    const seed = [...type].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) + variant * 1013;
    (MODELS[type] ?? fallback)(b, mulberry(seed), level);
    g = b.build();
    cache.set(key, g);
  }
  return g;
}

// tiny wanderer figure, boat and wild trees for scenery
export function personGeo() {
  const b = new Builder();
  b.cone(0, 0, 0, 0.045, 0.12, '#ffffff', 6);
  b.ball(0, 0.15, 0, 0.03, '#f0c8a0');
  return b.build();
}
export function boatGeo() {
  const b = new Builder();
  b.box(0, 0, 0, 0.7, 0.08, 0.22, C.wood);
  b.box(0, 0.08, 0, 0.5, 0.04, 0.16, C.woodD);
  b.box(0.1, 0.08, 0, 0.03, 0.5, 0.03, C.woodD);
  b.add('box', C.white, 0.1, 0.25, 0.02, 0.32, 0.28, 0.01, 0, 0, 0);
  return b.build();
}
export function wildTreeGeo(kind) {
  const b = new Builder();
  if (kind === 0) cypress(b, 0, 0, 1.1);
  else if (kind === 1) { b.box(0, 0, 0, 0.08, 0.3, 0.08, C.woodD); b.ball(0, 0.55, 0, 0.32, '#7d9a5a'); }
  else { b.box(0, 0, 0, 0.1, 0.35, 0.1, C.woodD); b.ball(0, 0.62, 0, 0.36, '#5b8a3e'); }
  return b.build();
}
export function wallGeo(segments) {
  const b = new Builder();
  for (const s of segments) {
    b.box(s.x, 0, s.z, s.w, 0.7, s.d, '#b9a582');
    const n = Math.round(Math.max(s.w, s.d) / 0.35);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      b.box(s.x + (s.w > s.d ? t * s.w : 0), 0.7, s.z + (s.w > s.d ? 0 : t * s.d), s.w > s.d ? 0.16 : s.w, 0.14, s.w > s.d ? s.d : 0.16, '#b9a582');
    }
    if (s.tower) {
      b.box(s.tx, 0, s.tz, 0.8, 1.3, 0.8, '#b09a76');
      crenels(b, s.tx, 1.3, s.tz, 0.8, 0.8, 0.12, '#b09a76');
    }
  }
  return b.build();
}
