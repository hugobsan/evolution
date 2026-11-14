// imprime a árvore de clips de uma tela (spriteId, nome, posição, tamanho): para copiar o estilo das telas do jogo
export default async (page, h) => {
  await h.newGame();
  const dump = (o, d = 0, out = []) => {
    const b = o.getBounds ? o.getBounds() : null;
    out.push('  '.repeat(d) + `d${o.depth} #${o.spriteId ?? o.constructor.name} ${o.name} @${(+o._x).toFixed(0)},${(+o._y).toFixed(0)} ${b ? (b.xMax - b.xMin).toFixed(0) + 'x' + (b.yMax - b.yMin).toFixed(0) : ''}${o.sLabel ? ' "' + o.sLabel + '"' : ''}${o.tTxt ? ' txt' : ''}`);
    if (d < 2) for (const c of o.children || []) dump(c, d + 1, out);
    return out;
  };
  const which = process.env.WHICH || 'SELL';
  await h.ev(async w => {
    const R = __player.root;
    if (w === 'Setting' || w === 'List') { R.mGame.mBar.goto(w); await __sleep(1500); }
    else { const { SFM } = await import('/src/game/classes/SFM.ts'); SFM.addClip('mPop', R, { sFrame: w }); await __sleep(800); }
  }, which);
  const txt = await h.ev(which => {
    const R = __player.root;
    const o = which === 'Setting' || which === 'List' ? R.mGame.mBar : R.children.find(c => c.name.startsWith('mPop'));
    const dump = (o, d = 0, out = []) => {
      const b = o.getBounds ? o.getBounds() : null;
      out.push('  '.repeat(d) + `d${o.depth} #${o.spriteId ?? o.constructor.name} ${o.name} @${(+o._x).toFixed(0)},${(+o._y).toFixed(0)} ${b ? (b.xMax - b.xMin).toFixed(0) + 'x' + (b.yMax - b.yMin).toFixed(0) : ''}${o.sLabel ? ' "' + o.sLabel + '"' : ''}`);
      if (d < 1) for (const c of o.children || []) dump(c, d + 1, out);
      return out;
    };
    return dump(o).join('\n');
  }, which);
  console.log(txt);
  await page.screenshot({ path: `tests/out-v2/tree-${which}.png` });
};
