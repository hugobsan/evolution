export default async (page, h) => {
  await h.newGame();
  await h.ev(async () => { await __clickObj(__player.root.mGame.m3, 1500); });
  await h.shot('tests/out-badges.png');
  console.log(await h.ev(async () => { const g = __player.root.mGame; const l = []; const f = o => { if (o.owner && o.owner.nBattle !== undefined && o.mBadge) l.push(o.owner.nBattle); (o.children || []).forEach(f); }; f(g); return l; }));
  // clicar no ícone ainda abre o desafio
  console.log(await h.ev(async () => { const g = __player.root.mGame; let t; const f = o => { if (!t && o.owner && o.owner.nId !== 0 && o.mBadge) t = o; (o.children || []).forEach(f); }; f(g); await __clickObj(t.mBadge, 1200); return __pops(); }));
};
