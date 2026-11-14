// v2: camada online. Liga-se ao jogo por fora: embrulha os frame scripts das telas do jogo (sprite 434 e 404) e põe os
// botões do multiplayer no HUD (hud.ts); as telas (kit.ts) seguem o estilo das telas modais do jogo. Sem login, nada de
// rede é carregado.
import { _global } from '../engine/as2';
import { frameScripts } from '../game/timeline';
import * as api from './api';
import * as sync from './sync';
import * as shop from './shop';
import * as match from './match';
import * as kit from './kit';
import * as hud from './hud';
import { installIcons } from './icons';
import { setAuthHooks, buildSettings } from './account';
import { worldView } from './world';
import { friendsView, profileView } from './friends';
import { pvpView } from './pvp';
import { tradeView } from './trade';
import * as creation from './creation';

function screen(mc: any, kind: 'home' | 'arena' | 'shop' | 'match' | 'menu') {
  // botão SPEED do HUD (434:38:199): o tempo só passa no insetário; na loja/arena/disputa ele não faz nada
  const speed = mc.children.find((c: any) => c.depth === 199 - 16384);
  if (speed) speed._visible = kind === 'home';
  if (kind !== 'match') match.leave();
  if (kind === 'home') creation.finish(); // jogo novo com o multiplayer ligado: vincula à conta
  shop.setHere(kind === 'shop' && sync.mpGame());
  if (kind === 'menu') { kit.close(false, false); return; }
  if (kind === 'match' || !sync.mpGame()) return;
  hud.installHud(mc, kind);
  if (api.session) { sync.processInbox(); sync.pushNow(); }
}

async function boot() {
  await api.client();
  if (!api.session) return;
  await sync.connect();
  await shop.connect();
}

export function installOnline() {
  installIcons();
  const wrap = (sprite: number, fr: number, after: (mc: any) => void) => {
    const f = frameScripts[sprite][fr];
    frameScripts[sprite][fr] = (mc: any) => { f?.(mc); after(mc); };
  };
  wrap(434, 6, mc => screen(mc, 'menu'));
  wrap(434, 38, mc => screen(mc, 'home'));
  wrap(434, 43, mc => screen(mc, 'arena'));
  wrap(434, 46, mc => screen(mc, 'shop'));
  wrap(434, 49, mc => screen(mc, 'match'));
  wrap(434, 52, mc => screen(mc, 'match'));
  wrap(404, 5, mc => buildSettings(mc)); // conta online na tela de Configurações (só em jogo multiplayer)
  wrap(434, 32, mc => creation.build(mc)); // toggle MULTIPLAYER na tela de novo jogo (instruções)
  creation.install(boot);
  const views = { world: worldView, friends: friendsView, pvp: pvpView, trade: tradeView };
  hud.setOpener(id => kit.open(views[id]));
  shop.setProfileOpener(id => kit.open(profileView(id, null)));
  setAuthHooks(
    async () => {
      await boot();
      // primeiro acesso: o jogo aberto vira o save na nuvem (com save já existente, a tela de Configurações pergunta)
      if (_global.GAME && !sync.linked() && !(await api.getSave())) await sync.linkThisGame();
    },
    async () => { sync.disconnect(); shop.disconnect(); await sync.refreshPending(); },
  );
  if (api.hasStoredSession()) boot();
  if (import.meta.env.DEV) (window as any).__online = { api, sync, shop, match, kit };
}
