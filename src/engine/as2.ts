// API global do AS2 usada pelo código portado. Ver docs/PORTING_CONTRACT.md.
import { player, resolvePath, MovieClip, DisplayObject, TextField, BitmapData, ColorMatrixFilter, DropShadowFilter, GlowFilter } from './core';

export { BitmapData, ColorMatrixFilter, DropShadowFilter, GlowFilter };

export const _global: any = {};
// live binding: atualizado quando o Player cria a raiz
export let _root: any = undefined;
export function setRoot(r: any) { _root = r; }

export function random(n: any) { n = Number(n); return n > 0 ? Math.floor(Math.random() * n) : 0; }
export function int(x: any) { const n = Number(x); return isFinite(n) ? Math.trunc(n) : 0; }
export function getTimer() { return Math.floor(performance.now() - player().startTime); }

export function setIntervalAS(a: any, b: any, c?: any): number {
  if (typeof a === 'function') return window.setInterval(() => player().run(() => a()), Number(b));
  const obj = a, name = String(b);
  return window.setInterval(() => player().run(() => { if (typeof obj?.[name] === 'function') obj[name](); }), Number(c));
}
export function clearIntervalAS(id: any) { if (id !== undefined) window.clearInterval(id); }
export function setTimeoutAS(fn: any, ms: any) { return window.setTimeout(() => player().run(() => fn()), Number(ms)); }

export function getURL(url: string, target = '_blank') { window.open(url, target); }
export function updateAfterEvent() { /* sem efeito: o render é contínuo */ }
export function stopAllSounds() { player().audio.stopAll(); }

/** chaves na ordem de enumeração do AVM1 (inversa à de criação; arrays: índice maior -> menor) */
export function forIn(obj: any): string[] {
  if (obj == null || typeof obj !== 'object' && typeof obj !== 'function') return [];
  return Object.keys(obj).filter(k => obj[k] !== undefined || Array.isArray(obj)).reverse();
}

export function evalPath(scope: any, path: any) { return typeof path === 'string' ? resolvePath(scope, path) : undefined; }
export function isMovieClip(v: any) { return v instanceof MovieClip; }
export function typeOfAS(v: any): string {
  if (v instanceof MovieClip) return 'movieclip';
  if (v === null) return 'null';
  return typeof v === 'object' && v instanceof DisplayObject ? 'object' : typeof v;
}

export const Stage = { width: 640, height: 480 };
export const Selection = { setFocus(t: any) { if (t instanceof TextField) player().focusField(t); } };

export class Sound {
  private id: number | undefined;
  getVolume: () => number;
  setVolume: (v: any) => void;
  constructor(public target?: any) {
    this.getVolume = () => player().audio.volumes[this.group()];
    this.setVolume = (v: any) => player().audio.setVolume(this.group(), Math.max(0, Math.min(100, Number(v) || 0)));
  }
  private group() { return this.target instanceof DisplayObject ? player().soundGroup(this.target) : 'sfx'; }
  attachSound(name: string) { this.id = player().data.exports[name]; }
  start() { if (this.id !== undefined) player().audio.startSound(this.id, this.group()); }
  stop() { if (this.id !== undefined) player().audio.startSound(this.id, this.group(), true); }
}

// ------------------------------------------------------------ SharedObject -> localStorage

function serialize(v: any, stack: Set<any>): any {
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (v instanceof DisplayObject) return undefined;
  if (stack.has(v)) return undefined;
  stack.add(v);
  let out: any;
  if (Array.isArray(v)) out = v.map(x => { const s = serialize(x, stack); return s === undefined ? null : s; });
  else {
    out = {};
    for (const k of Object.keys(v)) { const s = serialize(v[k], stack); if (s !== undefined) out[k] = s; }
  }
  stack.delete(v);
  return out;
}

const SO_PREFIX = 'evolution.so:';
const sos = new Map<string, SO>();
class SO {
  data: any;
  constructor(public name: string) {
    let d: any = {};
    try { d = JSON.parse(localStorage.getItem(SO_PREFIX + name) || '{}') || {}; } catch { d = {}; }
    this.data = d;
  }
  flush() {
    try {
      const s = serialize(this.data, new Set());
      if (s && Object.keys(s).length) localStorage.setItem(SO_PREFIX + this.name, JSON.stringify(s));
      else localStorage.removeItem(SO_PREFIX + this.name);
    } catch { /* storage cheio/bloqueado */ }
    return true;
  }
  clear() {
    for (const k of Object.keys(this.data)) delete this.data[k];
    try { localStorage.removeItem(SO_PREFIX + this.name); } catch { /* */ }
  }
  getSize() {
    const s = serialize(this.data, new Set());
    return s && Object.keys(s).length ? JSON.stringify(s).length : 0;
  }
}
export const SharedObject = {
  getLocal(name: string, _path?: string) {
    name = String(name);
    let so = sos.get(name);
    if (!so) { so = new SO(name); sos.set(name, so); }
    return so;
  },
  flushAll() { for (const so of sos.values()) so.flush(); },
};
// o Flash grava ao sair
addEventListener('pagehide', () => SharedObject.flushAll());
document.addEventListener('visibilitychange', () => { if (document.hidden) SharedObject.flushAll(); });
setInterval(() => SharedObject.flushAll(), 10000);

// ------------------------------------------------------------ flash.geom

export class ColorTransform {
  redMultiplier = 1; greenMultiplier = 1; blueMultiplier = 1; alphaMultiplier = 1;
  redOffset = 0; greenOffset = 0; blueOffset = 0; alphaOffset = 0;
  constructor(rm = 1, gm = 1, bm = 1, am = 1, ro = 0, go = 0, bo = 0, ao = 0) {
    Object.assign(this, { redMultiplier: rm, greenMultiplier: gm, blueMultiplier: bm, alphaMultiplier: am, redOffset: ro, greenOffset: go, blueOffset: bo, alphaOffset: ao });
  }
  get rgb() { return (this.redOffset << 16) | (this.greenOffset << 8) | this.blueOffset; }
  set rgb(v: number) {
    this.redMultiplier = this.greenMultiplier = this.blueMultiplier = 0;
    this.redOffset = (v >> 16) & 255; this.greenOffset = (v >> 8) & 255; this.blueOffset = v & 255;
  }
}
export class Transform {
  constructor(public mc: DisplayObject) {}
  get colorTransform() {
    const c = this.mc.cx || [1, 1, 1, 1, 0, 0, 0, 0];
    return new ColorTransform(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]);
  }
  set colorTransform(t: ColorTransform) {
    this.mc.cx = [t.redMultiplier, t.greenMultiplier, t.blueMultiplier, t.alphaMultiplier, t.redOffset, t.greenOffset, t.blueOffset, t.alphaOffset];
  }
}
