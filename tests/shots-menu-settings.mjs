// Configurações abertas pelo menu inicial (sem jogo): seção de conta online no mesmo estilo
const OUT = process.env.OUT || 'tests/out-v2/';
export default async (page, h) => {
  await h.ev(() => __lang.set('en'));
  await h.ev(async () => { await __btn('SETTINGS'); });
  await h.sleep(800);
  await page.screenshot({ path: OUT + 'menu-settings-en.png' });
  await h.ev(() => __lang.set('pt')); await h.sleep(400);
  await page.screenshot({ path: OUT + 'menu-settings-pt.png' });
};
