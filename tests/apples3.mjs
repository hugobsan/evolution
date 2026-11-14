export default async (page, h) => {
  await h.newGame();
  for (let i = 0; i < 25; i++) await h.ev(async () => { await __clickObj(__player.root.mGame.f0, 60); });
  await h.sleep(800);
  console.log(JSON.stringify(await h.ev(() => {
    const p = __player; const m = p.global.GAME.aAdult[0].mClip;
    let info = null; const orig = p.drawFiltered;
    p.drawFiltered = function (ctx, o) { const i0 = this.poolIdx; const r = orig.apply(this, arguments); if (o === m) { const cv = this.pool[i0]; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let s = 0; for (let k = 3; k < d.length; k += 4) s += d[k]; info = { i0, w: cv.width, h: cv.height, alphaSum: s, ctxNull: !cv.getContext('2d') }; } return r; };
    p.render(); p.drawFiltered = orig;
    // render do besouro isolado sem filtro
    const t = document.createElement('canvas'); t.width = 640; t.height = 480; const tc = t.getContext('2d');
    p.drawObj(tc, m, m.parent.globalMatrix(), null, { dev: 1, ox: 0, oy: 0 }, true);
    const d = tc.getImageData(0, 0, 640, 480).data; let s = 0; for (let k = 3; k < d.length; k += 4) s += d[k];
    return { info, isolatedAlpha: s, cm: p.colorMatOf(m), mcx: m.cx, parentsCx: [m.parent.cx, m.parent.parent.cx] };
  })));
};
