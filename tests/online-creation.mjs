// Online (UI no canvas): toggle MULTIPLAYER só na tela de novo jogo (não nas instruções avulsas do menu); desligado, o
// painel some e o texto das instruções volta.
import { OUT, toCreation } from './online-lib.mjs';

export default async (page, h) => {
  // menu → INSTRUCTIONS: sem INICIAR JOGO e sem toggle
  await h.ev(async () => { __player.root.mGame.btHelp.onrelease(); await __sleep(1500); });
  const help = await h.ev(() => { const mc = __player.root.mGame; return { cur: mc.cur, toggle: !!mc.mMp, start: !!__find('START GAME') }; });
  console.log('instruções avulsas:', JSON.stringify(help));
  await h.shot(OUT + 'creation-0-help.png');
  if (help.cur !== 32 || help.toggle || help.start) throw new Error('instruções avulsas mostram o toggle ou o INICIAR JOGO');
  await h.ev(async () => { __player.root.mGame.gotoAndStop('Menu'); await __sleep(500); });

  // novo jogo: liga (painel aparece, texto some) e desliga (painel some, texto volta)
  await toCreation(h, 'tog');
  const state = () => h.ev(() => { const mc = __player.root.mGame; return { opts: !!mc.mMpOpts, text: mc.children.find(c => c.depth === 115 - 16384)?._visible }; });
  const on = await state();
  await h.ev(async () => { __player.root.mGame.mMp.mToggle.onRelease(); await __sleep(300); });
  const off = await state();
  await h.shot(OUT + 'creation-1-off.png');
  console.log('ligado', JSON.stringify(on), 'desligado', JSON.stringify(off));
  if (!on.opts || on.text || off.opts || !off.text) throw new Error('o toggle não alterna painel e texto');
  console.log('ok: toggle só no novo jogo; desligar mostra as instruções de novo');
};
