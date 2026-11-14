// Renderização de shapes/glifos SWF em Canvas 2D + pipeline de cor (ColorTransform/ColorMatrix).

export type Mat = [number, number, number, number, number, number]; // a b c d tx ty
export type CMat = number[] | null; // 4x5 (20 valores, offsets 0..255) ou null = identidade

export const IDENT: Mat = [1, 0, 0, 1, 0, 0];

export function mul(p: Mat, c: Mat): Mat {
  // aplica c primeiro, depois p
  return [
    p[0] * c[0] + p[2] * c[1],
    p[1] * c[0] + p[3] * c[1],
    p[0] * c[2] + p[2] * c[3],
    p[1] * c[2] + p[3] * c[3],
    p[0] * c[4] + p[2] * c[5] + p[4],
    p[1] * c[4] + p[3] * c[5] + p[5],
  ];
}

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return [1, 0, 0, 1, -m[4], -m[5]];
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export type Rect = [number, number, number, number]; // xmin ymin xmax ymax
export const EMPTY: Rect = [Infinity, Infinity, -Infinity, -Infinity];
export function rectEmpty(r: Rect) { return !(r[2] >= r[0]); }
export function union(a: Rect, b: Rect): Rect {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}
export function xformRect(m: Mat, r: Rect): Rect {
  if (rectEmpty(r)) return r;
  const p = [apply(m, r[0], r[1]), apply(m, r[2], r[1]), apply(m, r[0], r[3]), apply(m, r[2], r[3])];
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// ---------------------------------------------------------------- cor

export function cxToMat(cx: number[] | null): CMat {
  if (!cx) return null;
  return [cx[0], 0, 0, 0, cx[4], 0, cx[1], 0, 0, cx[5], 0, 0, cx[2], 0, cx[6], 0, 0, 0, cx[3], cx[7]];
}

/** outer ∘ inner (inner aplicada primeiro) */
export function cmul(outer: CMat, inner: CMat): CMat {
  if (!outer) return inner;
  if (!inner) return outer;
  const r: number[] = new Array(20);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      let s = j === 4 ? outer[i * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) s += outer[i * 5 + k] * inner[k * 5 + j];
      r[i * 5 + j] = s;
    }
  }
  return r;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function colorOf(c: number[], m: CMat): number[] {
  if (!m) return c;
  const [r, g, b, a] = c;
  return [
    clamp(m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4]),
    clamp(m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9]),
    clamp(m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]),
    clamp(m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19]),
  ];
}

export function css(c: number[]) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${(c[3] / 255).toFixed(3)})`;
}

// ---------------------------------------------------------------- shapes

export interface Layer { f?: any; l?: any; d: string; p?: Path2D }
export interface ShapeDef { type: 'shape'; bounds: Rect; layers: Layer[]; grid?: Rect }

const pathOf = (l: Layer) => (l.p ??= new Path2D(l.d));

let getBitmap: (id: number) => HTMLImageElement | undefined = () => undefined;
export function setBitmapResolver(fn: (id: number) => HTMLImageElement | undefined) { getBitmap = fn; }

function fillStyleFor(_ctx: CanvasRenderingContext2D, f: any, cm: CMat): string | null {
  if (f.t === 0) return css(colorOf(f.c, cm));
  return null;
}

/** desenha um preenchimento com gradiente/bitmap no espaço da matriz do estilo */
function drawComplexFill(ctx: CanvasRenderingContext2D, f: any, path: Path2D, cm: CMat) {
  const m: Mat = f.m;
  if (f.t === 16 || f.t === 18 || f.t === 19) {
    const stops = f.s as number[][];
    const addStops = (g: CanvasGradient) => {
      for (const s of stops) g.addColorStop(Math.min(1, Math.max(0, s[0])), css(colorOf([s[1], s[2], s[3], s[4]], cm)));
      return g;
    };
    const R = 819.2;
    if (f.t === 16 && Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-9) {
      // eixos perpendiculares: gradiente direto no espaço da shape
      const p0 = apply(m, -R, 0), p1 = apply(m, R, 0);
      ctx.fillStyle = addStops(ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]));
      ctx.fill(path, 'evenodd');
      return;
    }
    const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]);
    if ((f.t === 18 || f.t === 19) && Math.abs(sx - sy) < 1e-6 && Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-9) {
      const fx = f.t === 19 ? (f.fp || 0) * R : 0;
      const fp = apply(m, fx, 0);
      ctx.fillStyle = addStops(ctx.createRadialGradient(fp[0], fp[1], 0, m[4], m[5], R * sx));
      ctx.fill(path, 'evenodd');
      return;
    }
    // caso geral: recorta pela forma e pinta no espaço do gradiente
    ctx.save();
    ctx.clip(path, 'evenodd');
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    if (f.t === 16) ctx.fillStyle = addStops(ctx.createLinearGradient(-R, 0, R, 0));
    else ctx.fillStyle = addStops(ctx.createRadialGradient(f.t === 19 ? (f.fp || 0) * R : 0, 0, 0, 0, 0, R));
    ctx.fillRect(-R * 4, -R * 4, R * 8, R * 8);
    ctx.restore();
    return;
  }
  if (f.t >= 64 && f.t <= 67) {
    const img = getBitmap(f.b);
    if (!img || !img.complete) return;
    ctx.save();
    ctx.clip(path, 'evenodd');
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.imageSmoothingEnabled = f.t === 64 || f.t === 65;
    if (cm) ctx.globalAlpha *= Math.min(1, Math.max(0, cm[18] + cm[19] / 255));
    if (f.t === 64 || f.t === 66) {
      ctx.fillStyle = ctx.createPattern(img, 'repeat')!;
      ctx.fillRect(-4096, -4096, 8192, 8192);
    } else ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}

export function drawShape(ctx: CanvasRenderingContext2D, def: ShapeDef, cm: CMat, dev = 1) {
  for (const l of def.layers) {
    const p = pathOf(l);
    if (l.f) {
      const s = fillStyleFor(ctx, l.f, cm);
      if (s) { ctx.fillStyle = s; ctx.fill(p, 'evenodd'); }
      else drawComplexFill(ctx, l.f, p, cm);
    } else if (l.l) {
      ctx.strokeStyle = css(colorOf(l.l.c, cm));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const t = ctx.getTransform();
      if (l.l.ns) {
        // traço "non-scaling": largura fixa em pixels do palco, sem deformar com escala não uniforme
        const dp = new Path2D();
        dp.addPath(p, t);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.lineWidth = Math.max(l.l.w, 1) * dev;
        ctx.stroke(dp);
        ctx.restore();
      } else {
        // hairline: no mínimo 1px na tela
        const scale = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c)) || 1;
        ctx.lineWidth = Math.max(l.l.w, 1 / scale);
        ctx.stroke(p);
      }
    }
  }
}

/** 9-slice (DefineScalingGrid do sprite pai). m = matriz global do sprite; b = bounds do sprite; g = grid. */
export function drawShapeGrid(ctx: CanvasRenderingContext2D, def: ShapeDef, g: Rect, b: Rect, cm: CMat, m: Mat, dev: number, ox: number, oy: number) {
  const sx = m[0], sy = m[3];
  if (Math.abs(m[1]) > 1e-6 || Math.abs(m[2]) > 1e-6 || sx <= 0 || sy <= 0) {
    ctx.setTransform(dev * m[0], dev * m[1], dev * m[2], dev * m[3], dev * m[4] - ox, dev * m[5] - oy);
    drawShape(ctx, def, cm, dev);
    return;
  }
  const W = (b[2] - b[0]) * sx, H = (b[3] - b[1]) * sy;
  const xs = [b[0], g[0], g[2], b[2]];
  const ys = [b[1], g[1], g[3], b[3]];
  const lw = Math.min(g[0] - b[0], W / 2), rw = Math.min(b[2] - g[2], W / 2);
  const th = Math.min(g[1] - b[1], H / 2), bh = Math.min(b[3] - g[3], H / 2);
  const cw = Math.max(0, W - lw - rw), ch = Math.max(0, H - th - bh);
  const dx = [0, lw, lw + cw], dw = [lw, cw, rw];
  const dy = [0, th, th + ch], dh = [th, ch, bh];
  const X0 = m[4] + b[0] * sx, Y0 = m[5] + b[1] * sy;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const srcW = xs[i + 1] - xs[i], srcH = ys[j + 1] - ys[j];
    if (srcW <= 0 || srcH <= 0 || dw[i] <= 0 || dh[j] <= 0) continue;
    const kx = dw[i] / srcW, ky = dh[j] / srcH;
    const X = X0 + dx[i], Y = Y0 + dy[j];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(X * dev - ox, Y * dev - oy, dw[i] * dev + 0.5, dh[j] * dev + 0.5);
    ctx.clip();
    ctx.setTransform(dev * kx, 0, 0, dev * ky, dev * (X - xs[i] * kx) - ox, dev * (Y - ys[j] * ky) - oy);
    drawShape(ctx, def, cm, dev);
    ctx.restore();
  }
}

export function hitShape(ctx: CanvasRenderingContext2D, def: ShapeDef, x: number, y: number): boolean {
  for (const l of def.layers) {
    const p = pathOf(l);
    if (l.f && ctx.isPointInPath(p, x, y, 'evenodd')) return true;
    if (l.l) {
      ctx.lineWidth = Math.max(l.l.w, 1);
      if (ctx.isPointInStroke(p, x, y)) return true;
    }
  }
  return false;
}

export function addShapeToPath(target: Path2D, def: ShapeDef, m: DOMMatrix) {
  for (const l of def.layers) if (l.f) target.addPath(pathOf(l), m);
}
