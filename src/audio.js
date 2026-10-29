// Tiny WebAudio sound effects — no assets needed.
let ctx = null;
let enabled = true;
try { enabled = localStorage.getItem('medici-sound') !== 'off'; } catch (e) { /* storage unavailable */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slide = 0 } = {}) {
  const c = ac(); if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  get enabled() { return enabled; },
  toggle() {
    enabled = !enabled;
    try { localStorage.setItem('medici-sound', enabled ? 'on' : 'off'); } catch (e) { /* storage unavailable */ }
    return enabled;
  },
  unlock() { ac(); },
  place() { tone(180, 0.12, { type: 'triangle', vol: 0.2, slide: 0.6 }); tone(520, 0.08, { type: 'square', vol: 0.03, delay: 0.03 }); },
  paint() { tone(300 + Math.random() * 60, 0.05, { type: 'triangle', vol: 0.06 }); },
  coin() { tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.18, { type: 'square', vol: 0.05, delay: 0.07 }); },
  gold() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
  error() { tone(140, 0.18, { type: 'sawtooth', vol: 0.05 }); },
  tap() { tone(660, 0.04, { type: 'sine', vol: 0.05 }); },
  research() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.07, delay: i * 0.09 })); },
  claim() { [659, 784, 988].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.04, delay: i * 0.08 })); },
  demolish() { tone(120, 0.25, { type: 'sawtooth', vol: 0.08, slide: 0.5 }); },
  fanfare() {
    const seq = [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.75], [659, 1.0], [784, 1.15], [1047, 1.4]];
    seq.forEach(([f, d]) => { tone(f, 0.35, { type: 'square', vol: 0.05, delay: d }); tone(f / 2, 0.35, { type: 'triangle', vol: 0.07, delay: d }); });
  },
};
