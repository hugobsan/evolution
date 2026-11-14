export default async (page, h) => {
  await h.newGame();
  const st = () => h.ev(() => ({ cur: __player.root.mGame.cur, scr: __player.global.GAME?.nScreen, pops: __pops(), money: __player.global.GAME?.nMoney }), null, 5000);
  for (const kind of [1, -1]) {
    // entra na arena até sortear um competidor do tipo certo (1 = luta, -1 = corrida)
    for (let tries = 0; tries < 6; tries++) {
      await h.ev(async () => { await __clickObj(__player.root.mGame.m3, 1500); });
      const has = await h.ev((kind) => { let n = 0; const f = o => { if (o.owner && o.owner.nBattle === kind && o.owner.nId !== 0) n++; (o.children || []).forEach(f); }; f(__player.root.mGame); return n; }, kind);
      if (has) break;
      await h.ev(async () => { await __clickObj(__player.root.mGame.m1, 1500); });
    }
    const ok = await h.ev(async (kind) => {
      const g = __player.root.mGame; const list = [];
      const f = o => { if (o.owner && o.owner.nBattle !== undefined && o.owner.nId !== 0) list.push(o); (o.children || []).forEach(f); }; f(g);
      const t = list.find(o => o.owner.nBattle === kind); if (!t) return 'sem competidor ' + kind + ' (' + list.length + ')';
      await __clickObj(t, 1200); return 'ok';
    }, kind);
    console.log('competidor', kind, ok, JSON.stringify(await st()));
    await h.shot(`tests/out-pop-${kind}.png`);
    // seleciona os insetos do jogador (ícones lado 0) e aposta 10
    await h.ev(async () => {
      const pop = __player.root.children.find(c => c.name.startsWith('mPop'));
      const icos = pop.children.filter(c => c.owner && c.owner.nSide === 0);
      for (const i of icos) await __clickObj(i, 300);
    });
    await page.fill('#stage input', '10').catch(e => console.log('sem input', e.message));
    const lab = kind === 1 ? 'START FIGHT' : 'START RACE';
    console.log(lab, await h.ev(async (l) => await __btn(l), lab), JSON.stringify(await st()));
    await h.sleep(6000);
    await h.shot(`tests/out-run-${kind}.png`);
    console.log('rodando', JSON.stringify(await st()));
    // espera terminar (popup WARN) e confirma
    for (let i = 0; i < 20; i++) {
      const s = await st(); if (s.pops.length) { console.log('fim', JSON.stringify(s)); break; }
      await h.sleep(3000);
    }
    await h.shot(`tests/out-end-${kind}.png`);
    await h.ev(async () => { await __btn('OK'); await __sleep(1500); });
    console.log('apos OK', JSON.stringify(await st()));
    await h.ev(async () => { await __clickObj(__player.root.mGame.m1, 1500); }); // volta para casa
  }
};
