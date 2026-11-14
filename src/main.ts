import { Player } from './engine/core';
import { _global, setRoot } from './engine/as2';
import { frameScripts, clipActions } from './game/timeline';
import { constructVars } from './game/construct.gen';
import { addMuteButton } from './game/muteButton';
import { installI18n } from './game/i18n';

const BASE = import.meta.env.BASE_URL + 'assets/';

async function boot() {
  const stage = document.getElementById('stage')!;
  const data = await (await fetch(BASE + 'swf.json')).json();
  document.getElementById('msg')?.remove();
  const p = new Player(data, { frameScripts, clipActions, constructVars }, stage, BASE);
  p.global = _global;
  p.onRoot = setRoot;
  p.ctrlRotateDrag = true; // extra: Ctrl + arrastar gira objetos no terrário
  if (import.meta.env.DEV) { (window as any).__player = p; (await import('./devtools')).installDevtools(p); }
  installI18n(); // idioma: navegador/escolha salva; hook de tradução na exibição
  p.start();
  addMuteButton(p, stage);
}
boot();
