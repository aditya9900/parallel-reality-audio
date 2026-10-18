// Spatial audio engine (Web Audio API).
// The listener stands on a grid cell. Every sound has a grid position and a radius.
// Volume falls off with distance, sound pans left/right by direction, and distant sounds
// get duller (low-pass), so walking across the grid crossfades smoothly between areas.
import { SOUNDS } from './story.js';
import { soundFile, voiceFile } from './compiler.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// How loud a source is (0..1, before its own gain) for a listener at pos.
export function attenuation(src, pos) {
  if (!src.pos) return 1;
  const d = Math.hypot(src.pos[0] - pos[0], src.pos[1] - pos[1]);
  const a = clamp(1 - d / src.radius, 0, 1);
  const shaped = a * a * (3 - 2 * a); // smoothstep: gentle edges, full in the middle
  return Math.max(shaped, src.minGain ?? 0);
}

function pan(src, pos) {
  if (!src.pos) return 0;
  return clamp((src.pos[0] - pos[0]) / 2, -1, 1) * 0.85;
}

export class SpatialEngine {
  constructor() {
    this.ctx = null;
    this.available = new Set();
    this.buffers = new Map();
    this.loops = []; // spatial looping sources for the current room
    this.voices = new Set(); // dialogue lines currently playing
    this.listener = [0, 0];
    this.target = [0, 0];
    this.roomToken = 0;
    this.ambienceOn = true;
  }

  async init() {
    try {
      const res = await fetch('audio/manifest.json', { cache: 'no-store' });
      if (res.ok) (await res.json()).files.forEach((f) => this.available.add(f));
    } catch {}
  }

  get unlocked() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // Must be called from a tap/click (browser autoplay rules).
  async unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.ctx.onstatechange = () => this.onstate?.();
      const comp = this.ctx.createDynamicsCompressor();
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.connect(comp);
      this.ambGroup = this.ctx.createGain();
      this.ambGroup.gain.value = this.ambienceOn ? 1 : 0;
      this.ambGroup.connect(this.master);
      this.voiceGroup = this.ctx.createGain();
      this.voiceGroup.connect(this.master);
      this.tick();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  hasFile(f) {
    return this.available.has(f);
  }

  setAmbience(on) {
    this.ambienceOn = on;
    if (this.ambGroup) this.ambGroup.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.15);
  }

  async buffer(file, fallback) {
    const key = this.hasFile(file) ? file : fallback ? `synth:${JSON.stringify(fallback)}` : null;
    if (!key) return null;
    if (this.buffers.has(key)) return this.buffers.get(key);
    let buf = null;
    try {
      if (key === file) {
        const res = await fetch(file);
        buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } else {
        buf = synth(this.ctx, fallback);
      }
    } catch (e) {
      console.warn('audio load failed', file, e);
    }
    this.buffers.set(key, buf);
    return buf;
  }

  // Builds: source -> [effect] -> lowpass -> gain -> panner -> group
  chain(src, group) {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = ctx.createStereoPanner();
    let head = filter;
    if (src.effect === 'radio') {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 1.2;
      bp.connect(filter);
      head = bp;
    }
    if (src.effect === 'echo') {
      const input = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.32;
      const fb = ctx.createGain();
      fb.gain.value = 0.45;
      input.connect(filter);
      input.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(filter);
      head = input;
    }
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(group);
    return { head, filter, gain, panner };
  }

  apply(node, immediate) {
    const pos = this.listener;
    const a = attenuation(node.src, pos);
    const t = this.ctx.currentTime;
    const tc = immediate ? 0.01 : 0.08;
    node.gain.gain.setTargetAtTime(a * (node.src.gain ?? 1), t, tc);
    node.panner.pan.setTargetAtTime(pan(node.src, pos), t, tc);
    const cutoff = node.src.pos ? 500 * Math.pow(36, Math.max(a, 0.05)) : 20000;
    node.filter.frequency.setTargetAtTime(cutoff, t, tc);
  }

  // Load the looping sounds for a room. bed = whole-room tone; sources = positioned sounds.
  async setRoom(scene, listenerPos) {
    const token = ++this.roomToken;
    this.stopDialogue();
    const old = this.loops;
    this.loops = [];
    if (this.ctx) {
      const t = this.ctx.currentTime;
      old.forEach((n) => {
        n.gain.gain.setTargetAtTime(0, t, 0.15);
        n.source.stop(t + 0.8);
      });
    }
    this.listener = [...listenerPos];
    this.target = [...listenerPos];
    if (!this.ctx || !scene.bed) return;

    const all = [{ ...scene.bed, pos: null, kind: 'bed' }, ...scene.sources];
    for (const src of all) {
      const isVoice = !!src.voice;
      const file = isVoice ? voiceFile(src.voice) : soundFile(src.sound);
      let buf = await this.buffer(file, isVoice ? null : SOUNDS[src.sound]?.fallback);
      if (token !== this.roomToken) return;
      if (!buf) continue;
      if (src.gapSec) buf = padded(this.ctx, buf, src.gapSec);
      const source = this.ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const node = { src, source, ...this.chain(src, isVoice ? this.voiceGroup : this.ambGroup) };
      source.connect(node.head);
      // random offset so repeated sounds (e.g. two paper rustles) don't phase
      source.start(0, Math.random() * buf.duration);
      this.apply(node, true);
      this.loops.push(node);
    }
  }

  moveTo(pos) {
    this.target = [...pos];
  }

  tick = () => {
    const [x, y] = this.listener;
    const [tx, ty] = this.target;
    if (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) {
      this.listener = [x + (tx - x) * 0.12, y + (ty - y) * 0.12];
      this.loops.forEach((n) => this.apply(n));
      this.voices.forEach((n) => this.apply(n));
    }
    requestAnimationFrame(this.tick);
  };

  // Play one dialogue line from a position. Resolves when it ends (or is stopped).
  // If no audio file exists yet, it "plays" silently for a reading-speed duration.
  playLine(line) {
    const ctx = this.ctx;
    let stopped = false;
    let node = null;
    let finish;
    const done = new Promise((r) => (finish = r));
    const src = { pos: line.pos, radius: 4.5, gain: 1, minGain: 0.18 };
    (async () => {
      const buf = await this.buffer(line.file, null);
      if (stopped) return;
      if (!buf) {
        const end = ctx.currentTime + Math.max(1.8, line.text.length * 0.06);
        const iv = setInterval(() => {
          if (stopped || ctx.currentTime >= end) {
            clearInterval(iv);
            finish();
          }
        }, 100);
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buf;
      node = { src, source, ...this.chain(src, this.voiceGroup) };
      source.connect(node.head);
      this.voices.add(node);
      this.apply(node, true);
      source.onended = () => {
        this.voices.delete(node);
        finish();
      };
      source.start();
    })();
    return {
      done,
      simulated: !this.hasFile(line.file),
      stop: () => {
        stopped = true;
        if (node) {
          try { node.source.stop(); } catch {}
          this.voices.delete(node);
        }
        finish();
      },
    };
  }

  stopDialogue() {
    this.voices.forEach((n) => {
      try { n.source.stop(); } catch {}
    });
    this.voices.clear();
  }

  async pause() {
    if (this.ctx?.state === 'running') await this.ctx.suspend();
  }
}

function padded(ctx, buf, gapSec) {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length + Math.floor(gapSec * buf.sampleRate), buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c), c);
  return out;
}

// Procedural placeholder sounds, so the grid is explorable before any audio is generated.
function synth(ctx, f) {
  const sr = ctx.sampleRate;
  const len = sr * 4;
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  if (f.type === 'noise') {
    // white noise through a simple resonant band filter
    const w = (2 * Math.PI * f.freq) / sr;
    const alpha = Math.sin(w) / (2 * (f.q || 0.7));
    const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w), a2 = 1 - alpha;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      d[i] = y * 0.6;
    }
  } else if (f.type === 'tick') {
    const every = Math.floor(sr / f.rate);
    for (let start = Math.floor(Math.random() * every); start < len; start += every + Math.floor((Math.random() - 0.5) * every * 0.15)) {
      for (let i = 0; i < sr * 0.03 && start + i < len; i++) {
        d[start + i] += Math.sin((2 * Math.PI * f.freq * i) / sr) * Math.exp(-i / (sr * 0.004)) * 0.8;
      }
    }
  } else if (f.type === 'hum') {
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      d[i] = (Math.sin(2 * Math.PI * f.freq * t) * 0.5 + Math.sin(4 * Math.PI * f.freq * t) * 0.2) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.25 * t)) * 0.5;
    }
  }
  return buf;
}
