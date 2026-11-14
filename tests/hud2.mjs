export default async (page, h) => {
  await h.newGame();
  console.log(JSON.stringify(await h.ev(async () => {
    const g = __player.root.mGame; const o = g.m0; const b = o.getBounds(); const c = __player.canvas; const r = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + (b.xMin + b.xMax) / 2, clientY: r.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(300);
    const info = g.mInfo; const pb = info.getBounds(info);
    return { pb, ob: info.ob, lines: [28, 45, 47].map(d => { const l = info.children.find(c => c.depth === d - 16384); const t = l?.tTxt; return t && { ww: t.wordWrap, rect: t.rect, auto: t.autoMode, text: t.text?.slice(0, 60), n: t.getLines().length }; }) };
  })));
};
