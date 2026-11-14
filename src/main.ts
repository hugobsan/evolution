import { Player } from './engine/core';
import { _global, setRoot } from './engine/as2';
import { frameScripts, clipActions } from './game/timeline';
import { constructVars } from './game/construct.gen';
import { addMuteButton } from './game/muteButton';
import { installI18n } from './game/i18n';
import { installOnline } from './online';

const BASE = import.meta.env.BASE_URL + 'assets/';

async function boot() {
  const stage = document.getElementById('stage')!;
  const data = await (await fetch(BASE + 'swf.json')).json();
  document.getElementById('msg')?.remove();
  const p = new Player(data, { frameScripts, clipActions, constructVars }, stage, BASE);
  p.global = _global;
  p.onRoot = setRoot;
  p.ctrlRotateDrag = true; // extra: Ctrl + arrastar gira objetos no terrário
  // extra: pinça amplia o insetário no celular (só o mGround; HUD, popups e telas ficam no tamanho normal).
  // Só no insetário (frame 38, nScreen 0) sem a tela Setting/List (mBar) nem as do multiplayer (mOnline) abertas.
  p.zoomRect = [0, 0, data.width, 380]; // acima da barra inferior do HUD
  p.zoomTarget = () => {
    const mg = (p.root as any).mGame;
    return _global.GAME?.nScreen === 0 && mg?.cur === 38 && mg.mBar?._currentframe == 1 && !mg.mOnline ? mg.mGround ?? null : null;
  };
  if (import.meta.env.DEV) { (window as any).__player = p; (await import('./devtools')).installDevtools(p); }
  installI18n(); // idioma: navegador/escolha salva; hook de tradução na exibição
  installOnline(); // v2: amigos, trocas, desafios e presença (só carrega a rede com login)
  p.start();
  addMuteButton(p, stage);
}
boot();
