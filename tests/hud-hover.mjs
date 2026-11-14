// rollover dos 4 botões novos do HUD (texto no painel de info), EN e PT
const OUT = process.env.OUT || 'tests/out-v2/';
export default async (page, h) => {
  await h.newGame();
  await h.ev(() => { __player.root.children.filter(c => c.name.startsWith('mFirst')).forEach(c => c.removeMovieClip()); });
  const hover = async name => {
    await h.ev(async name => { const o = __player.root.mGame[name]; const b = o.getBounds(); const c = __player.canvas; const r = c.getBoundingClientRect();
      c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + (b.xMin + b.xMax) / 2, clientY: r.top + (b.yMin + b.yMax) / 2, bubbles: true })); await __sleep(400); }, name);
  };
  for (const lang of ['en', 'pt']) {
    await h.ev(async l => { __lang.set(l); await __sleep(300); }, lang);
    await hover('btFriends'); await page.screenshot({ path: `${OUT}hv-${lang}-friends.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
    await hover('btWorld'); await page.screenshot({ path: `${OUT}hv-${lang}-world.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
    await h.ev(async () => { __player.global.FADE(); __player.global.GAME.mClip.gotoAndStop('Pause_0'); await __sleep(1200); });
    await hover('btPvp'); await page.screenshot({ path: `${OUT}hv-${lang}-pvp.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
    await h.ev(async () => { __player.global.FADE(); __player.global.GAME.mClip.gotoAndStop('Pause_1'); await __sleep(1200); });
    await hover('btTrade'); await page.screenshot({ path: `${OUT}hv-${lang}-trade.png`, clip: { x: 0, y: 380, width: 640, height: 100 } });
    await h.ev(async () => { __player.global.FADE(); __player.global.GAME.mClip.gotoAndStop('GameNow'); await __sleep(1200); });
  }
};
