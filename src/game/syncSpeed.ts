// Opção (novo, não existe no original): "sincronizar insetos com a velocidade do jogo".
// Ligada, Game.run() roda `1000 / nInterval` vezes por frame no terrário. Persistida em localStorage; padrão desligada.
const KEY = 'evolution.syncSpeed';
let on = false;
try { on = localStorage.getItem(KEY) === '1'; } catch { /* sem storage */ }
export const getSyncSpeed = () => on;
export function setSyncSpeed(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* */ }
}
