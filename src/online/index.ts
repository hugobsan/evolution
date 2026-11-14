// v2: camada online. Liga-se ao jogo por fora: embrulha os frame scripts das telas do jogo (sprite 434) e põe o botão
// ONLINE (sprite 57, o botão padrão do jogo) no canto. Sem login, nada de rede é carregado.
import { _global } from '../engine/as2';
import { frameScripts } from '../game/timeline';
import * as api from './api';
import * as sync from './sync';
import * as shop from './shop';
import * as match from './match';
import * as ui from './ui';

const BUTTON = 57;
let hud: any = null;

function label() { return ' ONLINE' + (sync.state.pending ? ` (${sync.state.pending})` : '') + ' '; }
function addButton(mc: any) {
  hud = mc.attachSymbol(BUTTON, 'btOnline', 450, {
    _sLabel: label(), _bOn: true, autoSize: 'left', bAni_visible: true, enabled: true, sSwitch: '', sPop: '', y_tPop: -50,
  }, true);
  if (!hud) return;
  hud.onrelease = () => ui.open();
  place();
}
function place() {
  if (!hud || hud.removed) return;
  hud._x = 632 - hud._width;
  hud._y = 8;
}
sync.onState(() => {
  if (!hud || hud.removed) return;
  hud.sLabel = label();
  hud.Frame?.();
  place();
});

function screen(mc: any, kind: 'home' | 'arena' | 'shop' | 'match' | 'menu') {
  if (kind !== 'match') match.leave();
  shop.setHere(kind === 'shop');
  if (kind === 'menu') { ui.close(); return; }
  if (kind === 'match') return;
  addButton(mc);
  if (api.session) { sync.processInbox(); sync.pushNow(); }
}

async function boot() {
  await api.client();
  if (!api.session) return;
  await sync.connect();
  await shop.connect();
}

export function installOnline() {
  const wrap = (fr: number, after: (mc: any) => void) => {
    const f = frameScripts[434][fr];
    frameScripts[434][fr] = (mc: any) => { f?.(mc); after(mc); };
  };
  wrap(6, mc => screen(mc, 'menu'));
  wrap(38, mc => screen(mc, 'home'));
  wrap(43, mc => screen(mc, 'arena'));
  wrap(46, mc => screen(mc, 'shop'));
  wrap(49, mc => screen(mc, 'match'));
  wrap(52, mc => screen(mc, 'match'));
  shop.setProfileOpener(ui.openProfile);
  ui.setAuthHooks(
    async () => {
      await boot();
      // primeiro acesso: o jogo aberto vira o save na nuvem (com save já existente, o painel pergunta)
      if (_global.GAME && !sync.linked() && !(await api.getSave())) await sync.linkThisGame();
      ui.open(undefined, 'account');
    },
    async () => { sync.disconnect(); shop.disconnect(); await sync.refreshPending(); },
  );
  if (api.hasStoredSession()) boot();
  if (import.meta.env.DEV) (window as any).__online = { api, sync, shop, match, ui };
}
