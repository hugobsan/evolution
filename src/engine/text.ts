// Fontes SWF (glifos como paths) e layout de texto para TextField / DefineText.
import { CMat, colorOf, css } from './render';

export interface FontDef {
  type: 'font'; name: string; glyphs: string[]; codes: number[]; adv: number[];
  ascent?: number; descent?: number; leading?: number; bold?: boolean; italic?: boolean;
}

export class Font {
  paths: (Path2D | null)[];
  map = new Map<number, number>();
  constructor(public def: FontDef) {
    this.paths = def.glyphs.map(() => null);
    def.codes.forEach((c, i) => this.map.set(c, i));
  }
  glyph(i: number) {
    let p = this.paths[i];
    if (!p) p = this.paths[i] = new Path2D(this.def.glyphs[i] || '');
    return p;
  }
  /** avanço em unidades EM 1024 */
  advance(i: number) {
    const a = this.def.adv[i];
    return a !== undefined ? a : 512;
  }
  get ascent() { return this.def.ascent ?? 900; }
  get descent() { return this.def.descent ?? 220; }
  /** família CSS de fallback para caracteres sem glifo */
  get cssFamily() {
    const n = this.def.name.replace(/_\d+pt_st$/, '');
    if (/curlz/i.test(n)) return '"Curlz MT", "Comic Sans MS", cursive';
    if (/times/i.test(n)) return '"Times New Roman", serif';
    return `"${n}", Arial, sans-serif`;
  }
}

/** caixa do glifo em unidades EM (coordenadas dos pares x,y do path), em cache */
const bboxCache = new WeakMap<Font, Map<number, [number, number, number, number]>>();
export function glyphBox(f: Font, gi: number): [number, number, number, number] {
  let m = bboxCache.get(f);
  if (!m) bboxCache.set(f, m = new Map());
  let b = m.get(gi);
  if (!b) {
    const n = (f.def.glyphs[gi] || '').match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
    b = isFinite(x0) ? [x0, y0, x1, y1] : [0, 0, 0, 0];
    m.set(gi, b);
  }
  return b;
}

// Acentos por composição (as fontes embutidas não têm Latin-1): base + marca combinante (NFD).
// grave = ` ; agudo = ` espelhado; circunflexo = ˆ ; til = ˜ ; cedilha = vírgula sob a base.
const MARK_SRC: Record<number, number> = { 0x300: 0x60, 0x301: 0x60, 0x302: 0x2c6, 0x303: 0x2dc, 0x327: 0x2c };
export interface Cluster { gi: number; mark?: number; mirror?: boolean; cedilla?: boolean; noDot?: boolean }
/** glifo simples ou composição base+acento; null se a fonte não consegue desenhar o caractere */
export function cluster(font: Font, ch: string): Cluster | null {
  const code = ch.codePointAt(0)!;
  const gi = font.map.get(code);
  if (gi !== undefined) return { gi };
  const d = ch.normalize('NFD');
  if (d.length !== 2) return null;
  const base = font.map.get(d.charCodeAt(0));
  const mk = MARK_SRC[d.charCodeAt(1)];
  const mi = mk === undefined ? undefined : font.map.get(mk);
  if (base === undefined || mi === undefined) return null;
  const mc = d.charCodeAt(1);
  return { gi: base, mark: mi, mirror: mc === 0x301, cedilla: mc === 0x327, noDot: mc !== 0x327 && (d[0] === 'i' || d[0] === 'j') };
}
/** a fonte desenha todos os caracteres de `s` (espaços e quebras contam como cobertos)? */
export function covers(font: Font, s: string): boolean {
  for (const ch of s) if (!/\s/.test(ch) && !cluster(font, ch)) return false;
  return true;
}
const styled = (n: string) => /_\d+pt_st$/.test(n);
/** fonte que desenha `s`: a própria, uma da mesma família com mais glifos, ou null (fallback CSS no campo todo) */
export function pickFont(fonts: Map<number, Font>, f: Font | null, s: string): Font | null {
  if (!f || covers(f, s)) return f;
  const root = (n: string) => n.replace(/_\d+pt_st$/, '');
  for (const c of fonts.values()) if (c !== f && root(c.def.name) === root(f.def.name) && styled(c.def.name) === styled(f.def.name) && covers(c, s)) return c;
  return null;
}

/** desenha um caractere (glifo ou composição) com a origem em (x, y=linha de base); devolve o avanço */
function drawCluster(ctx: CanvasRenderingContext2D, font: Font, c: Cluster, x: number, y: number, k: number): number {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const base = glyphBox(font, c.gi);
  let path = font.glyph(c.gi);
  if (c.noDot) { // 'i'/'j' sem o pingo (o acento ocupa o lugar): descarta o subpath mais alto
    const subs = (font.def.glyphs[c.gi] || '').split(/(?=M)/).filter(Boolean);
    if (subs.length > 1) {
      const bot = subs.map(p => (p.match(/-?\d*\.?\d+/g) || []).map(Number).filter((_, i) => i % 2).reduce((a, v) => Math.max(a, v), -Infinity));
      const top = bot.indexOf(Math.min(...bot));
      path = new Path2D(subs.filter((_, i) => i !== top).join(' '));
    }
  }
  ctx.fill(path, 'nonzero');
  if (c.mark !== undefined) {
    const m = glyphBox(font, c.mark);
    const gap = styled(font.def.name) ? 85.35 : 24;
    const mcx = (m[0] + m[2]) / 2;
    if (c.cedilla) ctx.translate((base[0] + base[2]) / 2 - mcx, 0);
    else {
      ctx.translate((base[0] + base[2]) / 2 - mcx, (c.noDot ? xTop(font) : base[1]) - gap - m[3]);
    }
    if (c.mirror) { ctx.translate(mcx, 0); ctx.scale(-1, 1); ctx.translate(-mcx, 0); }
    ctx.fill(font.glyph(c.mark), 'nonzero');
  }
  ctx.restore();
  return font.advance(c.gi) * k;
}
/** altura do x (topo do 'x') da fonte: onde fica o acento de 'í' sem pingo */
function xTop(f: Font) { const gi = f.map.get(120); return gi === undefined ? -512 : glyphBox(f, gi)[1]; }

export interface Run { text: string; color: number[] | null }
export interface Para { runs: Run[]; align: number }

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) => s.replace(/&(#\d+|\w+);/g, (m, e) => e[0] === '#' ? String.fromCharCode(+e.slice(1)) : ENT[e] ?? m);

function hexColor(s: string): number[] | null {
  const m = /#?([0-9a-f]{6})/i.exec(s);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** HTML simples do Flash -> parágrafos com runs coloridos */
export function parseHtml(html: string, defAlign: number): Para[] {
  const paras: Para[] = [];
  let cur: Para = { runs: [], align: defAlign };
  const colors: (number[] | null)[] = [null];
  const re = /<\/?([a-z]+)([^>]*)>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  let started = false;
  const push = (t: string) => { if (t) cur.runs.push({ text: t, color: colors[colors.length - 1] }); };
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) { push(decode(m[3])); started = true; continue; }
    const tag = m[1].toLowerCase();
    const close = m[0][1] === '/';
    const attrs = m[2] || '';
    if (tag === 'p') {
      if (!close) {
        if (started) { paras.push(cur); }
        const a = /align\s*=\s*["']?(\w+)/i.exec(attrs);
        cur = { runs: [], align: a ? ({ left: 0, right: 1, center: 2, justify: 3 } as any)[a[1].toLowerCase()] ?? defAlign : defAlign };
        started = true;
      }
    } else if (tag === 'br') {
      paras.push(cur);
      cur = { runs: [], align: cur.align };
    } else if (tag === 'font') {
      if (close) { if (colors.length > 1) colors.pop(); }
      else {
        const c = /color\s*=\s*["']?(#[0-9a-f]{6})/i.exec(attrs);
        colors.push(c ? hexColor(c[1]) : colors[colors.length - 1]);
      }
    }
  }
  paras.push(cur);
  // quebras \n / \r dentro dos runs também viram parágrafos
  const out: Para[] = [];
  for (const p of paras) {
    let np: Para = { runs: [], align: p.align };
    for (const r of p.runs) {
      const parts = r.text.split(/\r\n|\r|\n/);
      parts.forEach((t, i) => {
        if (i > 0) { out.push(np); np = { runs: [], align: p.align }; }
        if (t) np.runs.push({ text: t, color: r.color });
      });
    }
    out.push(np);
  }
  return out;
}

export function plainParas(text: string, align: number): Para[] {
  return text.split(/\r\n|\r|\n/).map(t => ({ runs: t ? [{ text: t, color: null }] : [], align }));
}

export interface Line { runs: Run[]; width: number; align: number }

export interface TextStyle { font: Font | null; size: number; deviceFamily: string; bold: boolean }

const measureCtx = (() => {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  return c ? c.getContext('2d')! : null;
})();

export function measure(st: TextStyle, s: string): number {
  let w = 0;
  const k = st.size / 1024;
  for (const ch of s) {
    const cl = st.font ? cluster(st.font, ch) : null;
    if (st.font && cl) w += st.font.advance(cl.gi) * k;
    else if (measureCtx) {
      measureCtx.font = `${st.bold ? 'bold ' : ''}${st.size}px ${st.font ? st.font.cssFamily : st.deviceFamily}`;
      w += measureCtx.measureText(ch).width;
    }
  }
  return w;
}

export function layout(paras: Para[], st: TextStyle, wrapWidth: number | null): Line[] {
  const lines: Line[] = [];
  for (const p of paras) {
    if (wrapWidth === null) {
      lines.push({ runs: p.runs, width: p.runs.reduce((a, r) => a + measure(st, r.text), 0), align: p.align });
      continue;
    }
    // quebra por palavras
    let line: Run[] = [];
    let lw = 0;
    const flush = () => { lines.push({ runs: line, width: lw, align: p.align }); line = []; lw = 0; };
    for (const r of p.runs) {
      const words = r.text.split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        const ww = measure(st, w);
        if (lw + ww > wrapWidth && lw > 0 && !/^\s+$/.test(w)) flush();
        if (!line.length && /^\s+$/.test(w) && lines.length) continue;
        const last = line[line.length - 1];
        if (last && last.color === r.color) last.text += w; else line.push({ text: w, color: r.color });
        lw += ww;
      }
    }
    flush();
  }
  return lines;
}

/** desenha um texto (glifos/composição, ou CSS se não houver fonte); (x, y=linha de base); devolve a largura */
export function drawRun(ctx: CanvasRenderingContext2D, text: string, st: TextStyle, x: number, y: number): number {
  const k = st.size / 1024;
  let w = 0;
  for (const ch of text) {
    const cl = st.font ? cluster(st.font, ch) : null;
    if (st.font && cl) w += drawCluster(ctx, st.font, cl, x + w, y, k);
    else {
      ctx.font = `${st.bold ? 'bold ' : ''}${st.size}px ${st.font ? st.font.cssFamily : st.deviceFamily}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ch, x + w, y);
      w += ctx.measureText(ch).width;
    }
  }
  return w;
}

/** desenha as linhas; ctx já transformado para o espaço local do campo */
export function drawLines(ctx: CanvasRenderingContext2D, lines: Line[], st: TextStyle, x0: number, y0: number,
  boxW: number, lineH: number, defColor: number[], cm: CMat) {
  const k = st.size / 1024;
  const asc = st.font ? st.font.ascent * k : st.size * 0.9;
  let y = y0 + asc;
  for (const ln of lines) {
    let x = x0;
    if (ln.align === 1) x = x0 + boxW - ln.width;
    else if (ln.align === 2) x = x0 + (boxW - ln.width) / 2;
    for (const r of ln.runs) {
      ctx.fillStyle = css(colorOf(r.color ?? defColor, cm));
      x += drawRun(ctx, r.text, st, x, y);
    }
    y += lineH;
  }
}
