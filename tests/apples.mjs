export default async (page, h) => {
  await h.newGame();
  for (let i = 0; i < 25; i++) await h.ev(async () => { await __clickObj(__player.root.mGame.f0, 60); });
  for (let t = 0; t < 4; t++) {
    await h.sleep(2500);
    // visível de fato? compara pixels com e sem o besouro
    const r = await h.ev(() => {
      const p = __player; const out = [];
      for (const a of p.global.GAME.aAdult) {
        const m = a.mClip; if (!m) { out.push('sem clip'); continue; }
        const b = m.getBounds(); const k = p.dev;
        const grab = () => { p.render(); return Array.from(p.ctx.getImageData(b.xMin * k, b.yMin * k, Math.max(1, (b.xMax - b.xMin) * k), Math.max(1, (b.yMax - b.yMin) * k)).data); };
        const A = grab(); m.vis = false; const B = grab(); m.vis = true;
        let diff = 0; for (let i = 0; i < A.length; i++) diff += Math.abs(A[i] - B[i]);
        out.push({ diff, st: a.nStatement, cur: m.cur, kids: m.children.length, b: [b.xMin|0, b.yMin|0, b.xMax|0, b.yMax|0] });
      }
      return { out, food: p.global.GAME.aFood.length, words: p.root.children.filter(c => c.name.startsWith('Word')).length };
    });
    console.log('t', t, JSON.stringify(r));
  }
  await h.shot('tests/out-apples.png');
};
