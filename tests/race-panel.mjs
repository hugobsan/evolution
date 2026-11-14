export default async (page, h) => {
  await h.newGame();
  // mais um besouro com atributos diferentes, para a marca "pior selecionado" ter efeito visível
  await h.ev(() => { const g = __player.global.GAME; g.aAdult[1].nGrow = 400; for (const a of g.aAdult) { a.nFed = a.nHeart = a.nHealth = 95; a.setNum(); } });
  for (let t = 0; t < 6; t++) {
    await h.ev(async () => { await __clickObj(__player.root.mGame.m3, 1500); });
    const n = await h.ev(() => { let n = 0; const f = o => { if (o.owner && o.owner.nBattle === -1 && o.owner.nId !== 0) n++; (o.children || []).forEach(f); }; f(__player.root.mGame); return n; });
    if (n) break; await h.ev(async () => { await __clickObj(__player.root.mGame.m1, 1500); });
  }
  await h.ev(async () => { const g = __player.root.mGame; const l = []; const f = o => { if (o.owner && o.owner.nBattle === -1 && o.owner.nId !== 0) l.push(o); (o.children || []).forEach(f); }; f(g); await __clickObj(l[0], 1200); });
  console.log('icones', JSON.stringify(await h.ev(() => __player.root.children.find(c => c.name.startsWith('mPop')).children.filter(c => c.owner && c.owner.nSide !== undefined).map(c => [c.owner.nSide, c.owner.nId_2, c.owner.nId]))));
  const hover = (side, id2) => h.ev(async ([side, id2]) => { const p = __player; const pop = p.root.children.find(c => c.name.startsWith('mPop')); const i = pop.children.find(c => c.owner && c.owner.nSide === side && c.owner.nId_2 === id2); const b = i.getBounds(); const c = p.canvas; const rc = c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointermove', { clientX: rc.left + (b.xMin + b.xMax) / 2, clientY: rc.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(300);
    const info = p.root.mGame.mInfo; const mk = info.children.find(c => c.name === 'mBest_nFly'); return { ob: info.ob, mark: mk && Math.round(mk._x) }; }, [side, id2]);
  const ids = await h.ev(() => __player.root.children.find(c => c.name.startsWith('mPop')).children.filter(c => c.owner && c.owner.nSide === 1).map(c => c.owner.nId_2));
  const cpu = []; for (const k of ids) cpu.push((await hover(1, k)).ob);
  const before = await hover(0, 0);
  const mine = await h.ev(() => __player.global.GAME.aAdult.map(a => a.nFly.toFixed(3)));
  // seleciona só o besouro mais lento (índice 0, nGrow 0)
  await h.ev(async () => { const pop = __player.root.children.find(c => c.name.startsWith('mPop')); await __clickObj(pop.children.find(c => c.owner && c.owner.nSide === 0 && c.owner.nId_2 === 0), 400); });
  const after = await hover(0, 1);
  console.log('meus nFly', mine, 'marca antes', before.mark, 'depois de selecionar o lento', after.mark);
  await page.fill('#stage input', '10');
  await h.ev(async () => await __btn('START RACE')); await h.sleep(500);
  const real = await h.ev(() => __player.global.GAME.paRace_2.map(a => [a.nFly, a.nHp, a.nPower]));
  real.sort((a, b) => a[0] - b[0]);
  console.log('painel CPU', JSON.stringify(cpu.map(o => [o.n_1, o.n_2, o.n_0].map(x => +x.toFixed(4))).sort((a, b) => a[0] - b[0])));
  console.log('real   CPU', JSON.stringify(real.map(r => r.map(x => +x.toFixed(4)))));
};
