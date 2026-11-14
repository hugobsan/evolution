export default async (page, h) => {
  await h.newGame();
  for (let i = 0; i < 25; i++) await h.ev(async () => { await __clickObj(__player.root.mGame.f0, 50); });
  const r = await h.ev(() => { const p = __player; const t = []; for (let i = 0; i < 60; i++) { const a = performance.now(); p.render(); t.push(performance.now() - a); } t.sort((x, y) => x - y); const tk = []; for (let i = 0; i < 60; i++) { const a = performance.now(); p.tick(); tk.push(performance.now() - a); } tk.sort((x, y) => x - y); return { renderMed: t[30].toFixed(2), renderP95: t[57].toFixed(2), tickMed: tk[30].toFixed(2), dev: p.dev }; });
  console.log(JSON.stringify(r));
};
