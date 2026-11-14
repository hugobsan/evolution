// Pirâmide interativa: vias possíveis em verde; 2 espécies tocadas mostram as chances do filhote principal (conta do
// Game.getBaby); "?" abre a explicação e ESC fecha.
export default async (page, h) => {
  await h.newGame(); // espécies 0 (Adam) e 1 (Hawaii)
  await h.ev(async () => { __player.root.mGame.mBar.goto('List'); await __sleep(900); });
  const st = () => h.ev(() => { const o = __player.root.mGame.mBar.mPyr; return { rings: o.children.filter(c => c.constructor.name === 'ShapeInst').length, odds: Object.fromEntries(o.children.filter(c => c.name?.startsWith('odds_')).map(c => [c.name.slice(5), c.tTxt?.text])) }; });
  const tapSp = (...ids) => h.ev(async ids => { for (const i of ids) await __clickObj(__player.root.mGame.mBar['mC_' + i], 350); }, ids);
  const r = { start: await st() };
  await h.shot('tests/out-pyramid-0.png');
  await tapSp(5, 1); r.p51 = await st();
  await h.shot('tests/out-pyramid-1.png');
  await tapSp(0, 5); r.p05 = await st(); // 3º toque recomeça: [0], depois [0,5]
  await h.ev(async () => { await __btn('?'); await __sleep(600); });
  r.help = await h.ev(() => !!__player.root.mPyrHelp);
  await h.shot('tests/out-pyramid-help.png');
  await page.keyboard.press('Escape'); await h.sleep(700);
  r.helpAfter = await h.ev(() => !!__player.root.mPyrHelp && !__player.root.mPyrHelp.removed);
  // VOLTAR: a camada da pirâmide (texto, anéis, vias) sai junto
  await tapSp(0, 1);
  await h.ev(async () => { await __btn('BACK'); await __sleep(900); });
  r.after = await h.ev(() => { const mb = __player.root.mGame.mBar; return { frame: mb._currentframe, layer: !!mb.mPyr && !mb.mPyr.removed, help: !!mb.btPyrHelp && !mb.btPyrHelp.removed }; });
  await h.shot('tests/out-pyramid-back.png');
  console.log(JSON.stringify(r));
  const ok = r.start.rings === 1 && r.p51.odds['6'] === '55%' && r.p51.odds['1'] === '45%' && r.p05.odds['0'] === '100%' && Object.keys(r.p05.odds).length === 1 && r.help && !r.helpAfter && r.after.frame !== 7 && !r.after.layer && !r.after.help;
  if (!ok) throw new Error('pirâmide interativa com resultado inesperado');
  console.log('ok: vias, chances 55/45, par sem ligação e ajuda com ESC');
};
