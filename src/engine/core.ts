// Mini-motor de display compatível com a API AS2 usada pelo jogo.
import {
  Mat, IDENT, mul, invert, apply, Rect, EMPTY, union, xformRect, rectEmpty, CMat, cxToMat, cmul,
  drawShape, drawShapeGrid, hitShape, addShapeToPath, ShapeDef, css, colorOf, setBitmapResolver,
} from './render';
import { Font, parseHtml, plainParas, layout, drawLines, drawRun, pickFont, measure, Line, TextStyle } from './text';
import { AudioEngine } from './audio';

export type FrameScripts = Record<number, Record<number, (mc: any) => void>>;
export type ClipActions = Record<string, Record<string, (this: any) => void>>;
export interface Registry { frameScripts: FrameScripts; clipActions: ClipActions; constructVars: Record<string, Record<string, any>> }

const TL_OFFSET = 16384; // depth AS2 = depth SWF - 16384

let P: Player; // singleton
export function player() { return P; }

/** Hook opcional de tradução, aplicado só na EXIBIÇÃO (a variável/`text` do jogo continua com o texto original). */
export interface TextHook {
  /** texto exibido de um TextField (src = texto lógico; html = é HTML simples) */
  field?(src: string, html: boolean): string;
  /** linhas que substituem um DefineText (texto estático), ou null para desenhar o original */
  staticText?(def: any): string[] | null;
}
let textHook: TextHook | null = null;
export function setTextHook(h: TextHook | null) { textHook = h; retranslate(); }
/** refaz o layout de todos os campos de texto (ex.: depois de trocar o idioma) */
export function retranslate() {
  const walk = (o: DisplayObject) => {
    if (o instanceof TextField) o.changed();
    else if (o instanceof MovieClip) for (const c of o.children) walk(c);
  };
  if (P?.root) walk(P.root);
}

// ------------------------------------------------------------ filtros (flash.filters)

export class ColorMatrixFilter { matrix: number[]; constructor(m?: number[]) { this.matrix = m ? m.slice() : [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]; } clone() { return new ColorMatrixFilter(this.matrix); } }
export class DropShadowFilter {
  distance = 4; angle = 45; color = 0; alpha = 1; blurX = 4; blurY = 4; strength = 1; quality = 1; inner = false; knockout = false; hideObject = false;
  constructor(distance?: number, angle?: number, color?: number, alpha?: number, blurX?: number, blurY?: number, strength?: number) {
    if (distance !== undefined) this.distance = distance;
    if (angle !== undefined) this.angle = angle;
    if (color !== undefined) this.color = color;
    if (alpha !== undefined) this.alpha = alpha;
    if (blurX !== undefined) this.blurX = blurX;
    if (blurY !== undefined) this.blurY = blurY;
    if (strength !== undefined) this.strength = strength;
  }
  clone() { return Object.assign(new DropShadowFilter(), this); }
}
export class GlowFilter {
  color = 0xff0000; alpha = 1; blurX = 6; blurY = 6; strength = 2; quality = 1; inner = false; knockout = false;
  constructor(color?: number, alpha?: number, blurX?: number, blurY?: number, strength?: number) {
    if (color !== undefined) this.color = color;
    if (alpha !== undefined) this.alpha = alpha;
    if (blurX !== undefined) this.blurX = blurX;
    if (blurY !== undefined) this.blurY = blurY;
    if (strength !== undefined) this.strength = strength;
  }
  clone() { return Object.assign(new GlowFilter(), this); }
}

function filtersFromSwf(list: any[]): any[] {
  return list.map(f => {
    const color = (f.c[0] << 16) | (f.c[1] << 8) | f.c[2];
    if (f.t === 'shadow') {
      const d = new DropShadowFilter(f.d, f.a * 180 / Math.PI, color, f.c[3] / 255, f.bx, f.by, f.s);
      d.inner = f.in;
      d.knockout = !!f.ko;
      return d;
    }
    const g = new GlowFilter(color, f.c[3] / 255, f.bx, f.by, f.s);
    g.inner = f.in;
    g.knockout = !!f.ko;
    return g;
  });
}

// ------------------------------------------------------------ definições de sprite

interface PState { c: number; m: Mat; cx: number[] | null; n?: string; cd?: number; f?: any[]; pf: number; key: string }

class SpriteDef {
  states: Map<number, PState>[] | null = null;
  constructor(public id: number, public frames: any[][], public labels: Record<string, number>, public count: number) {
    if (!this.count) this.count = Math.max(1, frames.length);
  }
  state(f: number): Map<number, PState> {
    if (!this.states) {
      this.states = [];
      let cur = new Map<number, PState>();
      for (let i = 0; i < this.count; i++) {
        cur = new Map(cur);
        for (const op of this.frames[i] || []) {
          if (op[0] === 'p') {
            const d = op[1], p = op[2];
            const old = cur.get(d);
            if (p.c !== undefined && (!p.mv || !old)) {
              cur.set(d, { c: p.c, m: p.m || IDENT, cx: p.cx || null, n: p.n, cd: p.cd, f: p.f, pf: i + 1, key: `${p.c}@${i + 1}` });
            } else if (old) {
              const ns: PState = { ...old };
              // move + character: troca o gráfico mantendo a instância (mesma key)
              if (p.c !== undefined && p.c !== old.c) ns.c = p.c;
              if (p.m) ns.m = p.m;
              if (p.cx) ns.cx = p.cx;
              if (p.n) ns.n = p.n;
              if (p.cd) ns.cd = p.cd;
              if (p.f) ns.f = p.f;
              cur.set(d, ns);
            }
          } else if (op[0] === 'r') cur.delete(op[1]);
        }
        this.states.push(cur);
      }
    }
    return this.states[Math.min(Math.max(f, 1), this.count) - 1];
  }
}

// ------------------------------------------------------------ display objects

const BUTTON_EVENTS = ['onPress', 'onRelease', 'onReleaseOutside', 'onRollOver', 'onRollOut', 'onDragOut', 'onDragOver'];
const CLIP_BUTTON_EVENTS = ['press', 'release', 'releaseOutside', 'rollOver', 'rollOut', 'dragOut', 'dragOver'];

export class DisplayObject {
  [k: string]: any;
  parent: MovieClip | null = null;
  depth = 0;
  name = '';
  m: Mat = [1, 0, 0, 1, 0, 0];
  cx: number[] | null = null;
  vis = true;
  flt: any[] = [];
  clipDepthSwf = 0;
  timeline = false;
  placeKey = '';
  locked = false;
  removed = false;
  maskObj: DisplayObject | null = null;
  isMaskRef = false;
  clipActs: Record<string, Function> | null = null;
  charId = -1;
  private dec: { sx: number; sy: number; rot: number } | null = null;

  setMatrix(m: Mat) { this.m = m.slice() as Mat; this.dec = null; }
  private decomp() {
    if (!this.dec) {
      const [a, b, c, d] = this.m;
      const sx = Math.hypot(a, b);
      let sy = Math.hypot(c, d);
      if (a * d - b * c < 0) sy = -sy;
      this.dec = { sx, sy, rot: Math.atan2(b, a) * 180 / Math.PI };
    }
    return this.dec;
  }
  private recompose() {
    const { sx, sy, rot } = this.dec!;
    const r = rot * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    this.m = [sx * cs, sx * sn, -sy * sn, sy * cs, this.m[4], this.m[5]];
    this.locked = true;
  }
  get _x(): any { return this.removed ? undefined : this.m[4]; }
  set _x(v: any) { v = Number(v); if (isNaN(v)) return; this.m = [...this.m.slice(0, 4), v, this.m[5]] as Mat; this.locked = true; }
  get _y(): any { return this.removed ? undefined : this.m[5]; }
  set _y(v: any) { v = Number(v); if (isNaN(v)) return; this.m = [...this.m.slice(0, 5), v] as Mat; this.locked = true; }
  get _xscale(): any { return this.removed ? undefined : this.decomp().sx * 100; }
  set _xscale(v: any) { v = Number(v); if (isNaN(v)) return; this.decomp().sx = v / 100; this.recompose(); }
  get _yscale(): any { return this.removed ? undefined : this.decomp().sy * 100; }
  set _yscale(v: any) { v = Number(v); if (isNaN(v)) return; this.decomp().sy = v / 100; this.recompose(); }
  get _rotation(): any { return this.removed ? undefined : this.decomp().rot; }
  set _rotation(v: any) {
    v = Number(v); if (isNaN(v)) return;
    v = ((v % 360) + 360) % 360; if (v > 180) v -= 360;
    this.decomp().rot = v; this.recompose();
  }
  get _alpha(): any { return this.removed ? undefined : (this.cx ? this.cx[3] : 1) * 100; }
  set _alpha(v: any) { v = Number(v); if (isNaN(v)) return; this.cx = this.cx ? this.cx.slice() : [1, 1, 1, 1, 0, 0, 0, 0]; this.cx[3] = v / 100; }
  get _visible(): any { return this.removed ? undefined : this.vis; }
  set _visible(v: any) { this.vis = !!v; }
  get _name() { return this.name; }
  set _name(v: string) {
    if (this.parent && this.parent[this.name] === this) delete this.parent[this.name];
    this.name = String(v);
    if (this.parent) this.parent[this.name] = this;
  }
  get _parent(): any { return this.parent ?? undefined; }
  get _target() { let s = ''; let o: DisplayObject | null = this; while (o && o.parent) { s = '/' + o.name + s; o = o.parent; } return s || '/'; }
  get _width(): any { if (this.removed) return undefined; const r = xformRect(this.m, this.localBounds()); return rectEmpty(r) ? 0 : r[2] - r[0]; }
  set _width(v: any) {
    v = Number(v); if (isNaN(v)) return;
    const b = this.localBounds(); const w = b[2] - b[0];
    if (rectEmpty(b) || w === 0) return;
    const d = this.decomp(); const rot = d.rot * Math.PI / 180;
    // largura com rotação: aproximação pela projeção
    const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
    const h = (b[3] - b[1]) * Math.abs(d.sy);
    d.sx = Math.max(0, (v - h * sn) / (w * cs || w)) * Math.sign(d.sx || 1);
    this.recompose();
  }
  get _height(): any { if (this.removed) return undefined; const r = xformRect(this.m, this.localBounds()); return rectEmpty(r) ? 0 : r[3] - r[1]; }
  set _height(v: any) {
    v = Number(v); if (isNaN(v)) return;
    const b = this.localBounds(); const h = b[3] - b[1];
    if (rectEmpty(b) || h === 0) return;
    const d = this.decomp(); const rot = d.rot * Math.PI / 180;
    const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
    const w = (b[2] - b[0]) * Math.abs(d.sx);
    d.sy = Math.max(0, (v - w * sn) / (h * cs || h)) * Math.sign(d.sy || 1);
    this.recompose();
  }
  get filters(): any[] { return this.flt.map(f => (f.clone ? f.clone() : f)); }
  set filters(v: any[]) { this.flt = (v || []).map(f => (f?.clone ? f.clone() : f)); }
  get _xmouse() { return this.globalToLocalXY(P.mouseX, P.mouseY)[0]; }
  get _ymouse() { return this.globalToLocalXY(P.mouseX, P.mouseY)[1]; }

  localBounds(): Rect { return EMPTY; }
  globalMatrix(): Mat {
    let m = this.m;
    for (let o = this.parent; o; o = o.parent) m = mul(o.m, m);
    return m;
  }
  globalToLocalXY(x: number, y: number) { return apply(invert(this.globalMatrix()), x, y); }
  localToGlobal(pt: any) { const g = apply(this.globalMatrix(), Number(pt.x), Number(pt.y)); pt.x = g[0]; pt.y = g[1]; }
  globalToLocal(pt: any) { const l = this.globalToLocalXY(Number(pt.x), Number(pt.y)); pt.x = l[0]; pt.y = l[1]; }
  getBounds(target?: any) {
    let m = this.globalMatrix();
    if (target && target instanceof DisplayObject) m = mul(invert(target.globalMatrix()), m);
    const r = xformRect(m, this.localBounds());
    return { xMin: r[0], yMin: r[1], xMax: r[2], yMax: r[3] };
  }
  hitTest(a: any, b?: any, shapeFlag?: any): boolean {
    if (this.removed) return false;
    if (a instanceof DisplayObject) {
      const r1 = xformRect(this.globalMatrix(), this.localBounds());
      const r2 = xformRect(a.globalMatrix(), a.localBounds());
      return !(r1[2] < r2[0] || r2[2] < r1[0] || r1[3] < r2[1] || r2[3] < r1[1]);
    }
    const x = Number(a), y = Number(b);
    if (shapeFlag) return P.hitTree(this, x, y, this.globalMatrix(), false);
    const r = xformRect(this.globalMatrix(), this.localBounds());
    return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  }
  getDepth() { return this.depth; }
  swapDepths(t: any) {
    const p = this.parent; if (!p) return;
    let d: number;
    if (t instanceof DisplayObject) { if (t.parent !== p) return; d = t.depth; }
    else d = Number(t);
    if (isNaN(d) || d < -16384 || d > 1048575) return;
    d = Math.floor(d);
    if (d === this.depth) return;
    const other = p.children.find(c => c.depth === d && c !== this);
    if (other) { other.depth = this.depth; other.timeline = false; }
    this.depth = d;
    this.timeline = false;
    p.sortChildren();
  }
  removeMovieClip() {
    if (this.parent && this.depth >= 0) this.parent.removeChild(this);
  }
  startDrag(lock?: any, l?: any, t?: any, r?: any, b?: any) { P.startDrag(this, !!lock, l, t, r, b); }
  stopDrag() { P.stopDrag(); }
  set cacheAsBitmap(_v: any) { /* sem efeito */ }
  get cacheAsBitmap() { return false; }
}

export class ShapeInst extends DisplayObject {
  constructor(public def: ShapeDef) { super(); }
  localBounds(): Rect { return this.def.bounds; }
}

export class StaticTextInst extends DisplayObject {
  constructor(public def: any) { super(); }
  localBounds(): Rect { return xformRect(this.def.m, this.def.bounds); }
}

export class BitmapInst extends DisplayObject {
  constructor(public bmp: BitmapData) { super(); }
  localBounds(): Rect { return [0, 0, this.bmp.width, this.bmp.height]; }
}

export class ButtonInst extends DisplayObject {
  state = 'u';
  kids: { s: string; obj: DisplayObject }[] = [];
  constructor(public def: any) {
    super();
    for (const r of def.recs) {
      const o = P.instantiate(r.c);
      if (!o) continue;
      o.setMatrix(r.m);
      o.cx = r.cx;
      o.parent = this as any;
      this.kids.push({ s: r.s, obj: o });
    }
  }
  localBounds(): Rect {
    let r = EMPTY;
    for (const k of this.kids) if (k.s.includes('u') || k.s.includes('h')) r = union(r, xformRect(k.obj.m, k.obj.localBounds()));
    return r;
  }
}

// ------------------------------------------------------------ TextField

export class TextField extends DisplayObject {
  rect: { x: number; y: number; w: number; h: number };
  font: Font | null = null;
  size = 12;
  color: number[] = [0, 0, 0, 255];
  align = 0;
  html: boolean;
  multiline: boolean;
  wordWrap: boolean;
  leading = 2;
  src = '';
  srcHtml = false;
  private varPath = '';
  private lastVar: any = undefined;
  private autoMode: 'none' | 'left' | 'center' | 'right' = 'none';
  border = false;
  borderColor = 0;
  background = false;
  backgroundColor = 0xffffff;
  selectable = false;
  type = 'dynamic';
  maxChars: number | null = null;
  restrict: string | null = null;
  password = false;
  onChanged: any = undefined;
  input: HTMLInputElement | null = null;
  private lines: Line[] | null = null;

  constructor(public def: any) {
    super();
    const b = def.bounds;
    this.rect = { x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] };
    if (def.font !== undefined) this.font = def.outlines ? P.fonts.get(def.font) ?? null : null;
    this.deviceFamily = def.font !== undefined ? (P.fonts.get(def.font)?.def.name || 'Arial') : 'Arial';
    this.size = def.size ?? 12;
    if (def.color) this.color = def.color;
    this.align = def.align ?? 0;
    this.html = def.html;
    this.multiline = def.multiline;
    this.wordWrap = def.wordWrap;
    this.leading = def.leading ?? 2;
    this.border = def.border;
    this.selectable = !def.noSelect;
    this.type = def.readOnly ? 'dynamic' : 'input';
    this.maxChars = def.maxLength ?? null;
    this.password = def.password;
    this.src = def.text || '';
    this.srcHtml = def.html;
    this.varPath = def.var || '';
    if (def.autoSize) this.autoMode = 'left';
  }
  replaceDef(def: any) {
    this.def = def;
    if (def.font !== undefined) { this.font = def.outlines ? P.fonts.get(def.font) ?? null : null; this.deviceFamily = P.fonts.get(def.font)?.def.name || 'Arial'; }
    if (def.size) this.size = def.size;
    if (def.color) this.color = def.color;
    this.lines = null;
  }
  private st: TextStyle | null = null;
  /** texto exibido: o do jogo passado pelo hook de tradução (se houver) */
  private shown(): string {
    const s = as2Digits(this.src);
    return textHook?.field && s ? textHook.field(s, this.srcHtml) : s;
  }
  style(): TextStyle { this.getLines(); return this.st!; }
  get text(): string {
    this.syncVar();
    if (!this.srcHtml) return this.src;
    return parseHtml(this.src, this.align).map(p => p.runs.map(r => r.text).join('')).join('\r');
  }
  set text(v: any) { this.src = v === undefined ? '' : String(v); this.srcHtml = false; this.changed(); this.pushVar(); }
  get htmlText(): string { return this.src; }
  set htmlText(v: any) { this.src = v === undefined ? '' : String(v); this.srcHtml = this.html; this.changed(); this.pushVar(); }
  get variable(): any { return this.varPath || null; }
  set variable(v: any) { this.varPath = v ? String(v) : ''; this.lastVar = undefined; this.bindVar(); }
  get autoSize(): any { return this.autoMode; }
  set autoSize(v: any) {
    const m = v === true ? 'left' : v === false || v === undefined || v === null ? 'none' : String(v);
    this.autoMode = (['left', 'center', 'right'].includes(m) ? m : 'none') as any;
    this.syncVar();
    this.changed();
  }
  get textColor() { return (this.color[0] << 16) | (this.color[1] << 8) | this.color[2]; }
  set textColor(v: number) { this.color = [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]; }
  get _width(): any { this.syncVar(); return this.removed ? undefined : this.rect.w * Math.abs(this.m[0] || 1); }
  set _width(v: any) { v = Number(v); if (!isNaN(v)) { this.rect.w = v; this.lines = null; } }
  get _height(): any { this.syncVar(); return this.removed ? undefined : this.rect.h * Math.abs(this.m[3] || 1); }
  set _height(v: any) { v = Number(v); if (!isNaN(v)) { this.rect.h = v; this.lines = null; } }
  get textWidth() { return Math.max(0, ...this.getLines().map(l => l.width)); }
  get textHeight() { return this.getLines().length * this.lineH(); }
  localBounds(): Rect { return [this.rect.x, this.rect.y, this.rect.x + this.rect.w, this.rect.y + this.rect.h]; }
  lineH() {
    const k = this.size / 1024;
    const f = this.font ?? P.fonts.get(this.def.font);
    const a = f ? (f.ascent + f.descent) * k : this.size * 1.15;
    return a + this.leading;
  }
  getLines(): Line[] {
    if (!this.lines) {
      const raw = this.shown();
      const paras = this.srcHtml ? parseHtml(raw, this.align) : plainParas(raw, this.align);
      // texto traduzido: fonte que cubra todos os glifos; senão o campo inteiro cai para CSS (sem misturar fontes na palavra)
      const font = raw === this.src ? this.font : pickFont(P.fonts, this.font, paras.map(p => p.runs.map(r => r.text).join('')).join(''));
      const fam = this.font && !font ? this.font.cssFamily : this.deviceFamily;
      this.st = { font, size: this.size, deviceFamily: fam, bold: false };
      const wrap = this.wordWrap && this.autoMode === 'none' ? this.rect.w - 4 : (this.wordWrap ? this.rect.w - 4 : null);
      let ls = layout(this.multiline ? paras : [{ runs: paras.flatMap((p, i) => i ? [{ text: ' ', color: null }, ...p.runs] : p.runs), align: paras[0]?.align ?? this.align }], this.st!, wrap);
      if (this.password) ls = ls.map(l => ({ ...l, runs: l.runs.map(r => ({ ...r, text: '*'.repeat(r.text.length) })) }));
      this.lines = ls;
    }
    return this.lines;
  }
  changed() {
    this.lines = null;
    if (this.autoMode !== 'none') {
      const ls = this.getLines();
      const w = Math.max(0, ...ls.map(l => l.width)) + 4;
      const h = ls.length * this.lineH() + 4 - this.leading;
      // no Flash o autoSize desloca o próprio campo (_x), não o retângulo interno
      // com wordWrap o Flash mantém a largura e só ajusta a altura
      if (!this.wordWrap) {
        const dx = this.autoMode === 'center' ? (this.rect.w - w) / 2 : this.autoMode === 'right' ? this.rect.w - w : 0;
        if (dx) this.m = [this.m[0], this.m[1], this.m[2], this.m[3], this.m[4] + dx * this.m[0], this.m[5] + dx * this.m[1]] as Mat;
        this.rect.w = w;
      }
      this.rect.h = Math.max(h, 0);
      this.lines = null;
    }
  }
  private $scope(): any { return this.parent; }
  bindVar() {
    if (!this.varPath || !this.parent) return;
    const v = resolvePath(this.$scope(), this.varPath);
    if (v === undefined) assignPath(this.$scope(), this.varPath, this.text);
    this.syncVar();
  }
  syncVar() {
    if (!this.varPath || !this.parent) return;
    const v = resolvePath(this.$scope(), this.varPath);
    if (v !== this.lastVar) {
      this.lastVar = v;
      if (v !== undefined) {
        this.src = typeof v === 'number' ? fmtNum(v) : String(v);
        this.srcHtml = this.html;
        this.changed();
      }
    }
  }
  pushVar() {
    if (!this.varPath || !this.parent) return;
    assignPath(this.$scope(), this.varPath, this.text);
    this.lastVar = this.text;
  }
  setInputValue(v: string) {
    if (this.input && this.input.value !== v) this.input.value = v; // mantém o <input> sobreposto igual ao texto
    this.src = v; this.srcHtml = false; this.changed(); this.pushVar();
    if (typeof this.onChanged === 'function') this.onChanged.call(this, this);
  }
}

export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // AS2 imprime até 15 dígitos significativos
  return String(parseFloat(n.toPrecision(15)));
}

// ------------------------------------------------------------ MovieClip

export class MovieClip extends DisplayObject {
  children: DisplayObject[] = [];
  cur = 1;
  playing = true;
  spriteId: number;
  enabled: any = true;
  useHandCursor: any = true;
  hitArea: any = undefined;
  private counter = 0;

  constructor(public def: SpriteDef | null, spriteId = -1) {
    super();
    this.spriteId = spriteId;
  }
  get _currentframe(): any { return this.removed ? undefined : this.cur; }
  /** _quality (global no Flash): o port renderiza sempre na qualidade máxima */
  get _quality() { return 'BEST'; }
  set _quality(_v: any) { /* ignorado */ }
  get _totalframes(): any { return this.removed ? undefined : this.def ? this.def.count : 1; }
  get _framesloaded() { return this._totalframes; }
  localBounds(): Rect {
    let r = EMPTY;
    for (const c of this.children) {
      if (c.isMaskRef) continue;
      r = union(r, xformRect(c.m, c.localBounds()));
    }
    return r;
  }
  sortChildren() { this.children.sort((a, b) => a.depth - b.depth); }
  addChild(o: DisplayObject, depth: number) {
    o.parent = this;
    o.depth = depth;
    const i = this.children.findIndex(c => c.depth > depth);
    if (i < 0) this.children.push(o); else this.children.splice(i, 0, o);
    if (o.name) this[o.name] = o;
  }
  removeChild(o: DisplayObject) {
    const i = this.children.indexOf(o);
    if (i >= 0) this.children.splice(i, 1);
    if (o.name && this[o.name] === o) delete this[o.name];
    markRemoved(o);
  }
  childAtDepth(d: number) { return this.children.find(c => c.depth === d); }
  nextInstanceName() { return 'instance' + (++P.instanceCounter); }

  // --- timeline
  private frameOf(f: any): number | null {
    if (f === undefined) f = 'undefined';
    if (typeof f === 'number') return Math.floor(f);
    const s = String(f);
    if (this.def && s in this.def.labels) return this.def.labels[s];
    const n = Number(s);
    if (s.trim() !== '' && !isNaN(n)) return Math.floor(n);
    return null;
  }
  play() { this.playing = true; }
  stop() { this.playing = false; }
  // nomes internos com $ para não colidir com variáveis de timeline do jogo (ex.: mBar.goto)
  gotoAndStop(f: any) { this.playing = false; this.$goto(f); }
  gotoAndPlay(f: any) { this.playing = true; this.$goto(f); }
  nextFrame() { this.playing = false; this.$goto(this.cur + 1); }
  prevFrame() { this.playing = false; this.$goto(this.cur - 1); }
  private $goto(f: any) {
    if (this.removed || !this.def) return;
    let n = this.frameOf(f);
    if (n === null) return;
    n = Math.min(Math.max(n, 1), this.def.count);
    if (n === this.cur) return;
    P.enterFrame(this, n);
  }

  // --- API dinâmica
  attachMovie(id: string, name: string, depth: number, init?: any) {
    const cid = P.data.exports[id];
    if (cid === undefined) return undefined;
    return this.attachSymbol(cid, name, depth, init);
  }
  /**
   * Extensão (não existe no AS2): instancia um sprite pelo id, mesmo sem linkage.
   * `init` é aplicado como um on(construct). Com `timeline`, o clip some quando a
   * timeline do pai mudar de frame (como um objeto colocado só neste frame).
   */
  attachSymbol(cid: number, name: string, depth: number, init?: any, timeline = false) {
    const def = P.spriteDef(cid);
    if (!def) return undefined;
    depth = Math.floor(Number(depth));
    const old = this.childAtDepth(depth);
    if (old) this.removeChild(old);
    const mc = new MovieClip(def, cid);
    mc.name = String(name);
    mc.charId = cid;
    if (timeline) { mc.timeline = true; mc.placeKey = 'dyn'; }
    this.addChild(mc, depth);
    if (init) for (const k of Object.keys(init)) mc[k] = init[k];
    P.initClip(mc);
    return mc;
  }
  createEmptyMovieClip(name: string, depth: number) {
    depth = Math.floor(Number(depth));
    const old = this.childAtDepth(depth);
    if (old) this.removeChild(old);
    const mc = new MovieClip(null);
    mc.name = String(name);
    this.addChild(mc, depth);
    return mc;
  }
  attachBitmap(bmp: BitmapData, depth: number) {
    const o = new BitmapInst(bmp);
    const old = this.childAtDepth(depth);
    if (old) this.removeChild(old);
    this.addChild(o, depth);
  }
  getNextHighestDepth() {
    let d = -1;
    for (const c of this.children) if (c.depth > d) d = c.depth;
    return d + 1;
  }
  getInstanceAtDepth(d: number) { return this.childAtDepth(d); }
  setMask(m: any) {
    if (this.maskObj) this.maskObj.isMaskRef = false;
    this.maskObj = m instanceof DisplayObject ? m : null;
    if (this.maskObj) this.maskObj.isMaskRef = true;
  }
  getBytesLoaded() { return 1; }
  getBytesTotal() { return 1; }
  isInteractive() {
    for (const e of BUTTON_EVENTS) if (typeof this[e] === 'function') return true;
    if (this.clipActs) for (const e of CLIP_BUTTON_EVENTS) if (this.clipActs[e]) return true;
    return false;
  }
}

/** AVM1: referência a clip removido é re-resolvida pelo caminho (pai vivo + mesmo nome) */
export function live(o: any): DisplayObject | null {
  if (!(o instanceof DisplayObject)) return null;
  if (!o.removed) return o;
  if (!o.parent || !o.name) return null;
  const p = live(o.parent);
  const r = p ? (p as any)[o.name] : null;
  return r instanceof DisplayObject && !r.removed ? r : null;
}

function markRemoved(o: DisplayObject) {
  o.removed = true;
  if (o instanceof TextField && o.input) { o.input.remove(); o.input = null; }
  if (P.drag?.mc === o) P.drag = null;
  if (o instanceof MovieClip) for (const c of o.children) markRemoved(c);
}

// ------------------------------------------------------------ caminhos (eval / variable)

const IDENT_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

export function resolvePath(scope: any, path: string): any {
  path = String(path).replace(/\//g, '.').replace(/:/g, '.');
  if (!IDENT_PATH.test(path)) return undefined;
  const parts = path.split('.');
  let o: any;
  const first = parts[0];
  if (first === '_root') o = P.root;
  else if (first === '_global') o = P.global;
  else if (first === 'this') o = scope;
  else if (first === '_parent') o = scope?._parent;
  else o = scope != null && scope[first] !== undefined ? scope[first] : P.global[first];
  for (let i = 1; i < parts.length && o != null; i++) o = o[parts[i]];
  return o;
}

export function assignPath(scope: any, path: string, value: any) {
  path = String(path).replace(/\//g, '.').replace(/:/g, '.');
  if (!IDENT_PATH.test(path)) return;
  const parts = path.split('.');
  const last = parts.pop()!;
  const target = parts.length ? resolvePath(scope, parts.join('.')) : scope;
  if (target != null) target[last] = value;
}

// ------------------------------------------------------------ BitmapData

export class BitmapData {
  canvas: HTMLCanvasElement;
  constructor(public width: number, public height: number, _transparent = true, fill = 0) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.ceil(width * P.dev);
    this.canvas.height = Math.ceil(height * P.dev);
    const c = this.canvas.getContext('2d')!;
    c.fillStyle = css([(fill >> 16) & 255, (fill >> 8) & 255, fill & 255, 255]);
    if (!_transparent) c.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(src: DisplayObject) {
    const c = this.canvas.getContext('2d')!;
    P.drawInto(c, src, { dev: P.dev, ox: 0, oy: 0 });
  }
  dispose() { this.canvas.width = this.canvas.height = 0; }
}

// ------------------------------------------------------------ Player

interface View { dev: number; ox: number; oy: number }

export class Player {
  global: any = {};
  root!: MovieClip;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hitCtx: CanvasRenderingContext2D;
  dev = 1;
  fonts = new Map<number, Font>();
  images = new Map<number, HTMLImageElement>();
  sprites = new Map<number, SpriteDef>();
  queue: (() => void)[] = [];
  draining = false;
  mouseX = 0;
  mouseY = 0;
  hover: DisplayObject | null = null;
  pressed: DisplayObject | null = null;
  drag: { mc: DisplayObject; lock: boolean; ox: number; oy: number; l?: number; t?: number; r?: number; b?: number } | null = null;
  instanceCounter = 0;
  audio: AudioEngine;
  startTime = performance.now();
  private pool: HTMLCanvasElement[] = [];
  private poolIdx = 0;
  private overlay: HTMLElement;
  onError: (e: unknown) => void = e => console.error(e);
  onRoot: (r: MovieClip) => void = () => {};

  constructor(public data: any, public reg: Registry, container: HTMLElement, public base: string) {
    P = this;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    container.appendChild(this.canvas);
    this.overlay = container;
    this.ctx = this.canvas.getContext('2d')!;
    this.hitCtx = document.createElement('canvas').getContext('2d')!;
    for (const [id, c] of Object.entries<any>(data.chars)) {
      if (c.type === 'font') this.fonts.set(+id, new Font(c));
      if (c.type === 'bitmap' && c.src) { const im = new Image(); im.src = base + c.src; this.images.set(+id, im); }
    }
    setBitmapResolver(id => this.images.get(id));
    this.audio = new AudioEngine(data, base);
    this.resize();
    addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  // --- definições
  spriteDef(id: number): SpriteDef | null {
    let d = this.sprites.get(id);
    if (!d) {
      const c = this.data.chars[id];
      if (!c || c.type !== 'sprite') return null;
      d = new SpriteDef(id, c.frames, c.labels, c.count);
      this.sprites.set(id, d);
    }
    return d;
  }
  instantiate(cid: number): DisplayObject | null {
    const c = this.data.chars[cid];
    if (!c) return null;
    switch (c.type) {
      case 'sprite': return new MovieClip(this.spriteDef(cid), cid);
      case 'shape': return new ShapeInst(c);
      case 'text': return new StaticTextInst(c);
      case 'edittext': return new TextField(c);
      case 'button': return new ButtonInst(c);
    }
    return null;
  }

  start() {
    const r = this.data.root;
    this.root = new MovieClip(new SpriteDef(0, r.frames, r.labels, r.frames.length), 0);
    this.root.name = '_root';
    this.onRoot(this.root);
    this.initClip(this.root);
    this.drain();
    let last = performance.now();
    let acc = 0;
    const step = 1000 / this.data.frameRate;
    const loop = (t: number) => {
      acc += Math.min(250, t - last);
      last = t;
      let n = 0;
      while (acc >= step && n < 4) { this.safe(() => this.tick()); acc -= step; n++; }
      if (n === 4) acc = 0;
      this.safe(() => this.render());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  safe(fn: () => void) { try { fn(); } catch (e) { this.onError(e); } }

  // --- fila de ações
  enqueue(fn: () => void) { this.queue.push(fn); }
  drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      let guard = 0;
      while (this.queue.length && guard++ < 100000) {
        const fn = this.queue.shift()!;
        try { fn(); } catch (e) { this.onError(e); }
      }
    } finally { this.draining = false; }
  }
  /** executa código "de fora" (timer, evento) e depois roda a fila */
  run(fn: () => void) { this.safe(fn); this.drain(); }

  // --- timeline
  initClip(mc: MovieClip) {
    if (mc.def) this.enterFrame(mc, 1, true);
  }
  enterFrame(mc: MovieClip, n: number, initial = false) {
    const def = mc.def!;
    mc.cur = n;
    const script = this.reg.frameScripts[mc.spriteId]?.[n];
    if (script) this.enqueue(() => { if (!mc.removed) script.call(mc, mc); });
    this.reconcile(mc, def.state(n));
    for (const op of def.frames[n - 1] || []) if (op[0] === 's') this.audio.startSound(op[1], this.soundGroup(mc), !!op[2]);
    void initial;
  }
  soundGroup(mc: DisplayObject): string {
    for (let o: DisplayObject | null = mc; o; o = o.parent) if (o.name === 'mMusic') return 'music';
    return 'sfx';
  }
  private reconcile(mc: MovieClip, target: Map<number, PState>) {
    for (const ch of [...mc.children]) {
      if (!ch.timeline || ch.depth >= 0) continue;
      const st = target.get(ch.depth + TL_OFFSET);
      if (!st || st.key !== ch.placeKey) { mc.removeChild(ch); continue; }
      if (st.c !== ch.charId) {
        const nd = this.data.chars[st.c];
        if (ch instanceof ShapeInst && nd?.type === 'shape') ch.def = nd;
        else if (ch instanceof StaticTextInst && nd?.type === 'text') ch.def = nd;
        else if (ch instanceof TextField && nd?.type === 'edittext') ch.replaceDef(nd);
        else { mc.removeChild(ch); continue; }
        ch.charId = st.c;
      }
      if (!ch.locked) { ch.setMatrix(st.m); ch.cx = st.cx ? st.cx.slice() : null; }
    }
    const depths = [...target.keys()].sort((a, b) => a - b);
    for (const d of depths) {
      const st = target.get(d)!;
      const asd = d - TL_OFFSET;
      const ex = mc.children.find(c => c.depth === asd && c.timeline && c.placeKey === st.key);
      if (ex) continue;
      const o = this.instantiate(st.c);
      if (!o) continue;
      o.charId = st.c;
      o.timeline = true;
      o.placeKey = st.key;
      o.setMatrix(st.m);
      o.cx = st.cx ? st.cx.slice() : null;
      if (st.cd) o.clipDepthSwf = st.cd;
      if (st.f) o.flt = filtersFromSwf(st.f);
      o.name = st.n ?? (o instanceof MovieClip ? mc.nextInstanceName() : '');
      mc.addChild(o, asd);
      const key = `${mc.spriteId}:${st.pf}:${d}`;
      const acts = this.reg.clipActions[key];
      if (acts) o.clipActs = acts;
      const cv = this.reg.constructVars[key];
      if (cv) for (const k of Object.keys(cv)) o[k] = cv[k];
      if (o instanceof TextField) o.bindVar();
      if (o instanceof MovieClip) {
        this.initClip(o);
        const load = acts?.load;
        if (load) this.enqueue(() => { if (!o.removed) load.call(o); });
      }
    }
  }

  tick() {
    const list: MovieClip[] = [];
    const walk = (mc: MovieClip) => { list.push(mc); for (const c of mc.children) if (c instanceof MovieClip) walk(c); };
    walk(this.root);
    for (const mc of list) {
      if (mc.removed || !mc.playing || !mc.def || mc.def.count <= 1) continue;
      const nx = mc.cur >= mc.def.count ? 1 : mc.cur + 1;
      this.enterFrame(mc, nx);
    }
    this.drain();
    for (const mc of list) {
      if (mc.removed) continue;
      if (typeof mc.onEnterFrame === 'function') this.safe(() => mc.onEnterFrame());
      const ef = mc.clipActs?.enterFrame;
      if (ef) this.safe(() => ef.call(mc));
      this.drain();
    }
    this.updateDrag();
  }

  // --- render
  resize() {
    const W = this.data.width, H = this.data.height;
    const vw = innerWidth, vh = innerHeight;
    const s = Math.min(vw / W, vh / H);
    const cssW = Math.floor(W * s), cssH = Math.floor(H * s);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.dev = s * (devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dev);
    this.canvas.height = Math.round(H * this.dev);
  }
  render() {
    const ctx = this.ctx;
    this.poolIdx = 0;
    // sincroniza variáveis de texto
    const sync = (o: DisplayObject) => {
      if (o instanceof TextField) o.syncVar();
      else if (o instanceof MovieClip) for (const c of o.children) sync(c);
    };
    sync(this.root);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawObj(ctx, this.root, IDENT, null, { dev: this.dev, ox: 0, oy: 0 });
    this.updateInputs();
  }
  drawInto(ctx: CanvasRenderingContext2D, o: DisplayObject, v: View) {
    this.drawObj(ctx, o, o.parent ? o.parent.globalMatrix() : IDENT, null, v);
  }
  private setT(ctx: CanvasRenderingContext2D, v: View, m: Mat) {
    ctx.setTransform(v.dev * m[0], v.dev * m[1], v.dev * m[2], v.dev * m[3], v.dev * m[4] - v.ox, v.dev * m[5] - v.oy);
  }
  colorMatOf(o: DisplayObject): CMat {
    let cm = cxToMat(o.cx);
    for (const f of o.flt) if (f instanceof ColorMatrixFilter) cm = cmul(f.matrix, cm);
    return cm;
  }
  drawObj(ctx: CanvasRenderingContext2D, o: DisplayObject, pm: Mat, pc: CMat, v: View, skipFx = false) {
    if (!o.vis || o.isMaskRef || o.removed) return;
    const m = mul(pm, o.m);
    const cm = cmul(pc, this.colorMatOf(o));
    if (cm && cm[18] === 0 && cm[19] <= 0 && cm[15] === 0 && cm[16] === 0 && cm[17] === 0) return; // alpha 0
    let masked = false;
    if (o.maskObj && !o.maskObj.removed) {
      const path = new Path2D();
      this.buildMaskPath(path, o.maskObj, o.maskObj.parent ? o.maskObj.parent.globalMatrix() : IDENT, v);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clip(path);
      masked = true;
    }
    const fx = skipFx ? [] : o.flt.filter(f => f instanceof DropShadowFilter || f instanceof GlowFilter);
    if (fx.length) this.drawFiltered(ctx, o, m, pm, pc, v, fx);
    else this.drawContent(ctx, o, m, cm, v);
    if (masked) ctx.restore();
  }
  private drawContent(ctx: CanvasRenderingContext2D, o: DisplayObject, m: Mat, cm: CMat, v: View) {
    if (o instanceof MovieClip) {
      const grid = this.data.chars[o.spriteId]?.grid;
      if (grid && o.children.every(c => c instanceof ShapeInst)) {
        const b = o.localBounds();
        for (const c of o.children) if (c.vis) drawShapeGrid(ctx, (c as ShapeInst).def, grid, b, cmul(cm, this.colorMatOf(c)), mul(m, c.m), v.dev, v.ox, v.oy);
        return;
      }
      const ch = o.children;
      for (let i = 0; i < ch.length; i++) {
        const c = ch[i];
        if (c.clipDepthSwf) {
          const path = new Path2D();
          this.buildMaskPath(path, c, m, v);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clip(path);
          let j = i + 1;
          while (j < ch.length && ch[j].depth + TL_OFFSET <= c.clipDepthSwf) { this.drawObj(ctx, ch[j], m, cm, v); j++; }
          ctx.restore();
          i = j - 1;
          continue;
        }
        this.drawObj(ctx, c, m, cm, v);
      }
    } else if (o instanceof ShapeInst) {
      this.setT(ctx, v, m);
      drawShape(ctx, o.def, cm, v.dev);
    } else if (o instanceof StaticTextInst) {
      const tm = mul(m, o.def.m);
      const alt = textHook?.staticText?.(o.def);
      if (alt) { this.drawStaticAlt(ctx, o.def, alt, tm, cm, v); return; }
      for (const r of o.def.recs) {
        const f = this.fonts.get(r.font);
        if (!f) continue;
        const k = r.h / 1024;
        ctx.fillStyle = css(colorOf(r.c, cm));
        let x = r.x;
        for (const [gi, adv] of r.g) {
          this.setT(ctx, v, mul(tm, [k, 0, 0, k, x, r.y]));
          ctx.fill(f.glyph(gi), 'nonzero');
          x += adv;
        }
      }
    } else if (o instanceof TextField) {
      this.drawText(ctx, o, m, cm, v);
    } else if (o instanceof ButtonInst) {
      for (const k of o.kids) if (k.s.includes(o.state)) this.drawObj(ctx, k.obj, m, cm, v);
    } else if (o instanceof BitmapInst) {
      this.setT(ctx, v, m);
      ctx.drawImage(o.bmp.canvas, 0, 0, o.bmp.width, o.bmp.height);
    }
  }
  /** DefineText com as linhas trocadas pelo hook: mantém posição/cor/tamanho de cada registro; uma linha centraliza, várias alinham como o original */
  private drawStaticAlt(ctx: CanvasRenderingContext2D, def: any, lines: string[], tm: Mat, cm: CMat, v: View) {
    const recs = def.recs as any[];
    if (!recs.length) return;
    const f0 = this.fonts.get(recs[0].font) ?? null;
    const w0 = (r: any) => r.g.reduce((a: number, g: any) => a + g[1], 0);
    const center = recs.length === 1 || recs.every(r => Math.abs(r.x + w0(r) / 2 - (recs[0].x + w0(recs[0]) / 2)) < 3);
    const cx = recs[0].x + w0(recs[0]) / 2;
    const step = recs.length > 1 ? recs[1].y - recs[0].y : recs[0].h * 1.15;
    this.setT(ctx, v, tm);
    lines.forEach((ln, i) => {
      const r = recs[Math.min(i, recs.length - 1)];
      const f = this.fonts.get(r.font) ?? f0;
      const font = pickFont(this.fonts, f, lines.join(''));
      const st: TextStyle = { font, size: r.h, deviceFamily: f?.cssFamily ?? 'Arial, sans-serif', bold: false };
      const x = center ? cx - measure(st, ln) / 2 : r.x;
      ctx.fillStyle = css(colorOf(r.c, cm));
      drawRun(ctx, ln, st, x, i < recs.length ? r.y : recs[recs.length - 1].y + (i - recs.length + 1) * step);
    });
  }
  /** MovieClip com DefineScalingGrid: desenha shapes filhas em 9-slice */
  private drawText(ctx: CanvasRenderingContext2D, t: TextField, m: Mat, cm: CMat, v: View) {
    const r = t.rect;
    this.setT(ctx, v, m);
    if (t.background) { ctx.fillStyle = css(colorOf(hex(t.backgroundColor), cm)); ctx.fillRect(r.x, r.y, r.w, r.h); }
    if (t.border) {
      ctx.strokeStyle = css(colorOf(hex(t.borderColor), cm));
      ctx.lineWidth = 1 / (Math.hypot(m[0], m[1]) * v.dev || 1);
      ctx.strokeRect(r.x + 0.5 / v.dev, r.y + 0.5 / v.dev, r.w, r.h);
    }
    if (t.input) return; // texto desenhado pelo <input> sobreposto
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    drawLines(ctx, t.getLines(), t.style(), r.x + 2 + (t.def.leftMargin || 0), r.y + 2, r.w - 4, t.lineH(), t.color, cm);
    ctx.restore();
  }
  /** canvas offscreen do pool, limpo e com estado de contexto padrão (o pool é reaproveitado entre frames) */
  private poolCanvas(w: number, h: number) {
    const cv = this.pool[this.poolIdx] ?? (this.pool[this.poolIdx] = document.createElement('canvas'));
    this.poolIdx++;
    if (cv.width < w || cv.height < h) { cv.width = Math.max(cv.width, w); cv.height = Math.max(cv.height, h); }
    const c = cv.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
    c.filter = 'none';
    c.clearRect(0, 0, cv.width, cv.height);
    return cv;
  }
  private drawFiltered(ctx: CanvasRenderingContext2D, o: DisplayObject, m: Mat, pm: Mat, pc: CMat, v: View, fx: any[]) {
    const b = xformRect(m, o.localBounds());
    if (rectEmpty(b)) return;
    let pad = 2;
    for (const f of fx) pad = Math.max(pad, Math.max(f.blurX, f.blurY) * 1.5 + (f.distance || 0) + 2);
    const x0 = Math.floor((b[0] - pad) * v.dev - v.ox), y0 = Math.floor((b[1] - pad) * v.dev - v.oy);
    const x1 = Math.ceil((b[2] + pad) * v.dev - v.ox), y1 = Math.ceil((b[3] + pad) * v.dev - v.oy);
    const w = Math.min(x1 - x0, 4096), h = Math.min(y1 - y0, 4096);
    if (w <= 0 || h <= 0) return;
    // cache: refaz o filtro só quando algo visual mudou na subárvore (sombras/blur custam caro por frame)
    const key = this.sigOf(o) + '#' + fxSig(fx) + '#' + m.map(n => n.toFixed(3)).join(',') + '#' + (pc ? pc.join(',') : '') + '#' + v.dev + ',' + v.ox + ',' + v.oy;
    const cache = (o as any).$fx as { key: string; cv: HTMLCanvasElement; x0: number; y0: number; w: number; h: number } | undefined;
    if (cache && cache.key === key) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(cache.cv, 0, 0, cache.w, cache.h, cache.x0, cache.y0, cache.w, cache.h);
      ctx.restore();
      return;
    }
    const cv = this.poolCanvas(w, h);
    const oc = cv.getContext('2d')!;
    const sub: View = { dev: v.dev, ox: v.ox + x0, oy: v.oy + y0 };
    this.drawObj(oc, o, pm, pc, sub, true);
    const FAR = 20000;
    const knockout = fx.some(f => f.knockout);
    // filtros internos (inner glow/shadow): cor fora da forma, desfocada, recortada pela forma
    const inner = fx.filter(f => f.inner);
    let src: HTMLCanvasElement = cv;
    if (inner.length) {
      const res = this.poolCanvas(w, h);
      const tmp = this.poolCanvas(w, h);
      const rc = res.getContext('2d')!, tc = tmp.getContext('2d')!;
      if (!knockout) rc.drawImage(cv, 0, 0, w, h, 0, 0, w, h);
      for (const f of inner) {
        const col = hex(f.color);
        tc.setTransform(1, 0, 0, 1, 0, 0);
        tc.globalCompositeOperation = 'source-over';
        tc.clearRect(0, 0, tmp.width, tmp.height);
        tc.fillStyle = css([col[0], col[1], col[2], 255]);
        tc.fillRect(0, 0, w, h);
        tc.globalCompositeOperation = 'destination-out';
        tc.drawImage(cv, 0, 0, w, h, 0, 0, w, h);
        // desfoca via sombra deslocada para dentro da área
        const blurred = this.poolCanvas(w, h);
        const bc = blurred.getContext('2d')!;
        bc.shadowColor = css([col[0], col[1], col[2], 255 * Math.min(1, f.alpha ?? 1)]);
        bc.shadowBlur = Math.max(f.blurX, f.blurY) * v.dev * 0.8;
        const ang = (f.angle ?? 0) * Math.PI / 180, dist = (f.distance ?? 0) * v.dev;
        bc.shadowOffsetX = FAR + Math.cos(ang) * dist;
        bc.shadowOffsetY = Math.sin(ang) * dist;
        bc.drawImage(tmp, 0, 0, w, h, -FAR, 0, w, h);
        bc.shadowColor = 'transparent';
        bc.globalCompositeOperation = 'destination-in';
        bc.drawImage(cv, 0, 0, w, h, 0, 0, w, h);
        bc.globalCompositeOperation = 'source-over';
        const passes = Math.max(1, Math.min(4, Math.round(f.strength ?? 1)));
        for (let i = 0; i < passes; i++) rc.drawImage(blurred, 0, 0, w, h, 0, 0, w, h);
      }
      src = res;
    }
    // compõe sombras + conteúdo num canvas próprio do objeto (o cache)
    const fc = cache?.cv ?? document.createElement('canvas');
    if (fc.width < w || fc.height < h) { fc.width = Math.max(fc.width, w); fc.height = Math.max(fc.height, h); }
    const out = fc.getContext('2d')!;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalCompositeOperation = 'source-over';
    out.globalAlpha = 1;
    out.clearRect(0, 0, fc.width, fc.height);
    (o as any).$fx = { key, cv: fc, x0, y0, w, h };
    {
    const ctx = out;
    const x0 = 0, y0 = 0;
    ctx.save();
    for (const f of fx) {
      if (f.inner) continue;
      const col = hex(f.color);
      const a = Math.min(1, (f.alpha ?? 1));
      ctx.shadowColor = css([col[0], col[1], col[2], 255 * a]);
      ctx.shadowBlur = Math.max(f.blurX, f.blurY) * v.dev * 0.8;
      const ang = (f.angle ?? 0) * Math.PI / 180;
      const dist = (f.distance ?? 0) * v.dev;
      ctx.shadowOffsetX = Math.cos(ang) * dist + FAR;
      ctx.shadowOffsetY = Math.sin(ang) * dist;
      const passes = Math.max(1, Math.min(4, Math.round(f.strength ?? 1)));
      for (let i = 0; i < passes; i++) ctx.drawImage(cv, 0, 0, w, h, x0 - FAR, y0, w, h);
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    if (!knockout || inner.length) ctx.drawImage(src, 0, 0, w, h, x0, y0, w, h);
    ctx.restore();
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fc, 0, 0, w, h, x0, y0, w, h);
    ctx.restore();
  }
  /** assinatura do estado visual de uma subárvore (para o cache de filtros) */
  private sigOf(o: DisplayObject): string {
    let s = o.charId + ':' + o.m.map(n => n.toFixed(3)).join(',') + ':' + (o.cx ? o.cx.join(',') : '') + (o.vis ? '' : ':h');
    if (o.flt.length) s += ':' + fxSig(o.flt);
    if (o instanceof MovieClip) { s += ':' + o.cur + (o.maskObj ? ':m' : ''); for (const c of o.children) s += '[' + this.sigOf(c) + ']'; }
    else if (o instanceof TextField) s += ':' + o.src + ':' + o.rect.x + ',' + o.rect.w + ',' + o.rect.h + ':' + o.color.join(',') + (o.input ? ':i' : '') + o.border + o.background;
    else if (o instanceof ButtonInst) s += ':' + o.state;
    else if (o instanceof BitmapInst) s += ':bmp';
    return s;
  }
  private buildMaskPath(path: Path2D, o: DisplayObject, pm: Mat, v: View) {
    const m = mul(pm, o.m);
    const dm = new DOMMatrix([v.dev * m[0], v.dev * m[1], v.dev * m[2], v.dev * m[3], v.dev * m[4] - v.ox, v.dev * m[5] - v.oy]);
    if (o instanceof ShapeInst) addShapeToPath(path, o.def, dm);
    else if (o instanceof MovieClip) for (const c of o.children) this.buildMaskPath(path, c, m, v);
    else {
      const b = o.localBounds();
      if (!rectEmpty(b)) { const r = new Path2D(); r.rect(b[0], b[1], b[2] - b[0], b[3] - b[1]); path.addPath(r, dm); }
    }
  }

  // --- hit testing
  hitTree(o: DisplayObject, x: number, y: number, m: Mat, respectVisible: boolean): boolean {
    if (respectVisible && (!o.vis || o.isMaskRef)) return false;
    if (o.removed) return false;
    if (o instanceof ShapeInst) {
      const b = xformRect(m, o.def.bounds);
      if (x < b[0] - 1 || x > b[2] + 1 || y < b[1] - 1 || y > b[3] + 1) return false;
      this.hitCtx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      return hitShape(this.hitCtx, o.def, x, y);
    }
    if (o instanceof MovieClip) {
      for (let i = o.children.length - 1; i >= 0; i--) {
        const c = o.children[i];
        if (c.clipDepthSwf) continue;
        if (this.hitTree(c, x, y, mul(m, c.m), respectVisible)) return true;
      }
      return false;
    }
    if (o instanceof ButtonInst) {
      for (const k of o.kids) if (k.s.includes('h') && this.hitTree(k.obj, x, y, mul(m, k.obj.m), false)) return true;
      return false;
    }
    const b = xformRect(m, o.localBounds());
    return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
  }
  pick(o: DisplayObject, x: number, y: number, pm: Mat): DisplayObject | null {
    if (!o.vis || o.isMaskRef || o.removed) return null;
    const m = mul(pm, o.m);
    if (o instanceof ButtonInst) return this.hitTree(o, x, y, m, true) ? o : null;
    if (!(o instanceof MovieClip)) return null;
    if (o.maskObj && !this.hitTree(o.maskObj, x, y, o.maskObj.globalMatrix(), false)) return null;
    if (o !== this.root && o.isInteractive()) {
      const ha = o.hitArea instanceof DisplayObject ? live(o.hitArea) : o.hitArea;
      if (ha === this.root) return o;
      if (ha instanceof DisplayObject) return this.hitTree(ha, x, y, ha.globalMatrix(), false) ? o : null;
      return this.hitTree(o, x, y, m, true) ? o : null;
    }
    for (let i = o.children.length - 1; i >= 0; i--) {
      const c = o.children[i];
      if (c.clipDepthSwf) continue;
      const r = this.pick(c, x, y, m);
      if (r) return r;
    }
    return null;
  }

  // --- input
  private bindInput() {
    const pos = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * this.data.width / r.width;
      this.mouseY = (e.clientY - r.top) * this.data.height / r.height;
    };
    addEventListener('pointermove', e => { pos(e); this.ctrlDown = e.ctrlKey; this.run(() => { this.updateDrag(); this.updateHover(); }); });
    addEventListener('keydown', e => { if (e.key === 'Control') this.ctrlDown = true; });
    addEventListener('keyup', e => { if (e.key === 'Control') { this.ctrlDown = false; this.run(() => this.updateDrag()); } });
    addEventListener('blur', () => { this.ctrlDown = false; });
    this.canvas.addEventListener('pointerdown', e => {
      pos(e);
      this.audio.resume();
      if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
      this.run(() => {
        this.updateHover();
        this.pressed = this.hover;
        if (this.pressed) { this.setButtonState(this.pressed, 'd'); this.fire(this.pressed, 'press'); }
      });
      e.preventDefault();
    });
    addEventListener('pointerup', e => {
      pos(e);
      this.run(() => {
        const p = this.pressed;
        this.pressed = null;
        if (p) {
          const over = this.pickTop() === p;
          this.setButtonState(p, over ? 'o' : 'u');
          this.fire(p, over ? 'release' : 'releaseOutside');
        }
        this.updateHover(true);
      });
    });
  }
  private pickTop() { return this.pick(this.root, this.mouseX, this.mouseY, IDENT); }
  private setButtonState(o: DisplayObject, s: string) { if (o instanceof ButtonInst) o.state = s; }
  updateHover(force = false) {
    const h = this.pickTop();
    if (h !== this.hover || force) {
      const old = this.hover;
      this.hover = h;
      if (h !== old) {
        if (this.pressed) {
          if (old === this.pressed) this.fire(old, 'dragOut');
          if (h === this.pressed) this.fire(h, 'dragOver');
        } else {
          if (old) { this.setButtonState(old, 'u'); this.fire(old, 'rollOut'); }
          if (h) { this.setButtonState(h, 'o'); this.fire(h, 'rollOver'); }
        }
      }
    }
    const en = h && (h as any).enabled !== false && (h as any).useHandCursor !== false;
    this.canvas.style.cursor = en ? 'pointer' : 'default';
  }
  fire(o: DisplayObject | null, ev: string) {
    if (!o || o.removed) return;
    if ((o as any).enabled === false) return;
    const h = o['on' + ev[0].toUpperCase() + ev.slice(1)];
    if (typeof h === 'function') this.safe(() => h.call(o));
    const ca = o.clipActs?.[ev];
    if (ca) this.safe(() => ca.call(o instanceof ButtonInst ? o.parent : o));
    this.drain();
  }
  startDrag(mc: DisplayObject, lock: boolean, l?: any, t?: any, r?: any, b?: any) {
    const p = mc.parent ? mc.parent.globalToLocalXY(this.mouseX, this.mouseY) : [this.mouseX, this.mouseY];
    const has = l !== undefined;
    this.drag = { mc, lock, ox: p[0] - mc.m[4], oy: p[1] - mc.m[5], ...(has ? { l: +l, t: +t, r: +r, b: +b } : {}) };
    this.updateDrag();
  }
  stopDrag() { this.drag = null; }
  /** extensão (não existe no Flash): Ctrl + mover o mouse na vertical gira o objeto arrastado */
  ctrlRotateDrag = false;
  private ctrlDown = false;
  private rotLastY: number | null = null;
  updateDrag() {
    const d = this.drag;
    if (!d || d.mc.removed) { this.drag = null; this.rotLastY = null; return; }
    if (this.ctrlRotateDrag && this.ctrlDown) {
      if (this.rotLastY === null) this.rotLastY = this.mouseY;
      const dy = this.mouseY - this.rotLastY;
      this.rotLastY = this.mouseY;
      if (dy) {
        d.mc._rotation = (d.mc._rotation || 0) + dy * 2;
        const o = (d.mc as any).owner; // besouros guardam a direção em owner.nRot (radianos)
        if (o && typeof o.nRot === 'number') o.nRot = d.mc._rotation * Math.PI / 180;
      }
      return;
    }
    if (this.rotLastY !== null) {
      // saiu do modo rotação: reancora para o objeto não pular até o mouse
      this.rotLastY = null;
      const q = d.mc.parent ? d.mc.parent.globalToLocalXY(this.mouseX, this.mouseY) : [this.mouseX, this.mouseY];
      d.lock = false; d.ox = q[0] - d.mc.m[4]; d.oy = q[1] - d.mc.m[5];
    }
    const p = d.mc.parent ? d.mc.parent.globalToLocalXY(this.mouseX, this.mouseY) : [this.mouseX, this.mouseY];
    let x = d.lock ? p[0] : p[0] - d.ox, y = d.lock ? p[1] : p[1] - d.oy;
    if (d.l !== undefined) { x = Math.min(Math.max(x, d.l), d.r!); y = Math.min(Math.max(y, d.t!), d.b!); }
    d.mc._x = x; d.mc._y = y;
  }

  // --- campos de texto de entrada (<input> sobreposto)
  inputs = new Set<TextField>();
  focusField(t: TextField) {
    this.ensureInput(t);
    setTimeout(() => t.input?.focus(), 0);
  }
  ensureInput(t: TextField) {
    if (t.input || t.type !== 'input') return;
    const el = document.createElement('input');
    el.type = t.password ? 'password' : 'text';
    el.value = t.text;
    el.spellcheck = false;
    el.autocomplete = 'off';
    Object.assign(el.style, {
      position: 'absolute', border: 'none', outline: 'none', background: 'transparent', padding: '0 2px', margin: '0',
      boxSizing: 'border-box', zIndex: '10',
    } as CSSStyleDeclaration);
    el.addEventListener('input', () => {
      let v = el.value;
      if (t.restrict) { const re = new RegExp('[' + t.restrict + ']'); v = [...v].filter(ch => re.test(ch)).join(''); }
      if (t.maxChars) v = v.slice(0, t.maxChars);
      if (v !== el.value) el.value = v;
      this.run(() => t.setInputValue(v));
    });
    el.addEventListener('pointerdown', e => e.stopPropagation());
    this.overlay.appendChild(el);
    t.input = el;
    this.inputs.add(t);
  }
  private updateInputs() {
    for (const t of this.inputs) {
      if (t.removed || !t.input || t.type !== 'input') { t.input?.remove(); t.input = null; this.inputs.delete(t); continue; }
      let visible = true;
      for (let o: DisplayObject | null = t; o; o = o.parent) if (!o.vis) visible = false;
      const g = t.globalMatrix();
      const r = xformRect(g, t.localBounds());
      const cr = this.canvas.getBoundingClientRect();
      const pr = this.overlay.getBoundingClientRect();
      const k = cr.width / this.data.width;
      const el = t.input;
      el.style.display = visible ? 'block' : 'none';
      el.style.left = (cr.left - pr.left + r[0] * k) + 'px';
      el.style.top = (cr.top - pr.top + r[1] * k) + 'px';
      el.style.width = (r[2] - r[0]) * k + 'px';
      el.style.height = (r[3] - r[1]) * k + 'px';
      el.style.fontSize = t.size * Math.hypot(g[2], g[3]) * k + 'px';
      el.style.color = css(t.color);
      el.style.fontFamily = t.font ? t.font.cssFamily : t.deviceFamily;
      el.style.textAlign = ['left', 'right', 'center', 'justify'][t.align] || 'left';
      if (t.maxChars) el.maxLength = t.maxChars;
      if (document.activeElement !== el && el.value !== t.text) el.value = t.text;
    }
  }
}

/** AS2 converte Number→String com 15 dígitos significativos (126.3), JS com 17 (126.30000000000001).
 *  Na exibição, normaliza decimais longos para o formato do Flash. */
function as2Digits(s: string): string {
  return s && /\d\.\d{12,}/.test(s) ? s.replace(/\d+\.\d{12,}/g, m => String(parseFloat(Number(m).toPrecision(15)))) : s;
}

function fxSig(fx: any[]): string {
  return fx.map(f => f instanceof ColorMatrixFilter ? 'cm' + f.matrix.join(',') : `${f.constructor.name}${f.blurX},${f.blurY},${f.distance},${f.angle},${f.color},${f.alpha},${f.strength},${f.inner},${f.knockout}`).join('|');
}

function hex(n: number): number[] { return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; }

