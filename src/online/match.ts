// Luta/corrida online nas arenas da v1, determinística: durante a simulação, Math.random vira um PRNG semeado com a
// seed do desafio (gravada no servidor). O mesmo (seed, times) reproduz o mesmo resultado: é o replay.
import { _global, _root, forIn } from '../engine/as2';
import { Game } from '../game/classes/Game';
import { Adult } from '../game/classes/Adult';
import { SFM } from '../game/classes/SFM';
import type { Bug, Match } from './api';
import * as api from './api';

/** mulberry32: PRNG de 32 bits, rápido e com boa distribuição para jogo */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Run = { m: Match; rnd: () => number; steps: number; live: boolean; names: [string, string] };
let cur: Run | null = null;
export const current = () => cur;
/** saiu da arena (HUD: casa/loja/arena) no meio da disputa: volta ao modo normal */
export const leave = () => { cur = null; };

function seeded<T>(f: () => T): T {
  const r = Math.random;
  Math.random = cur!.rnd;
  try { return f(); } finally { Math.random = r; }
}

function adultOf(b: Bug, sideB: boolean) {
  // o lado B usa o nome "CPU ": é assim que Adult.movementCase escolhe o time inimigo
  return new Adult(b.nId, {
    nId_color: b.nId_color, nGrow: b.nGrow, nRandom: b.nRandom, nHealth: b.nHealth, nAge_now: b.nAge_now, nSex: b.nSex,
    nFed: b.nFed, nHeart: b.nHeart, sNickName: sideB ? 'CPU ' : b.sNickName, sReal: b.sNickName,
  });
}
function place(G: any, a: any, x: number, y: number, rot: number) {
  a.vCurr.setTo(x, y);
  a.nRot = rot;
  a.setClip(SFM.addClip('beetle', G.mClip?.mGround?.mHit_0), true);
  // painel de info com o nome real (o lado B se chama "CPU " internamente)
  a.mClip.onRollOver = function () { _global.GAME.mClip?.mInfo?.setFrame('battle', { ...this.owner, sNickName: this.owner.sReal }); };
}

const P = Game.prototype as any;
const orig = { initial_3: P.initial_3, initial_4: P.initial_4, run: P.run, battleEnd: P.battleEnd, raceEnd: P.raceEnd };

// mesmas posições/rotações de initial_3 e initial_4, mas os dois times vêm dos snapshots do desafio
P.initial_3 = function () {
  if (!cur) return orig.initial_3.call(this);
  this.stop();
  seeded(() => {
    this.paBattle = cur!.m.team_a.map(b => adultOf(b, false));
    this.paBattle_2 = cur!.m.team_b!.map(b => adultOf(b, true));
    this.paJoin = this.paBattle.concat();
    for (const k of forIn(this.paBattle)) place(this, this.paBattle[k], SFM.rdm_2(100, 540), SFM.rdm_2(250, 350), -1.57);
    for (const k of forIn(this.paBattle_2)) place(this, this.paBattle_2[k], SFM.rdm_2(100, 540), SFM.rdm_2(50, 150), 1.57);
  });
  this.nScreen = 3;
  this.start();
};
P.initial_4 = function () {
  if (!cur) return orig.initial_4.call(this);
  this.stop();
  seeded(() => {
    this.paRace = cur!.m.team_a.map(b => adultOf(b, false));
    this.paRace_2 = cur!.m.team_b!.map(b => adultOf(b, true));
    this.paJoin = this.paRace.concat();
    this.paRace.forEach((a: any, i: number) => { a.nFed = 70; a.nDir = 0; place(this, a, 50, 240 + i * 80, 0); });
    this.paRace_2.forEach((a: any, i: number) => place(this, a, 50, 80 + i * 80, 0));
  });
  this.nScreen = 4;
  this.start();
};
P.run = function () {
  if (!cur || (this.nScreen !== 3 && this.nScreen !== 4)) return orig.run.call(this);
  seeded(() => { cur!.steps++; orig.run.call(this); });
};
// mesmas regras de fim da v1 (empate favorece o lado B, como a CPU na v1)
P.battleEnd = function () {
  if (!cur) return orig.battleEnd.call(this);
  if (this.paBattle.length < 1) end(this, 'b');
  else if (this.paBattle_2.length < 1) end(this, 'a');
};
P.raceEnd = function () {
  if (!cur) return orig.raceEnd.call(this);
  if (this.paRace_2.length < 1) end(this, 'b');
  else if (this.paRace.length < 1) end(this, 'a');
};

function end(G: any, side: 'a' | 'b') {
  const run = cur!;
  cur = null;
  G.stop();
  const m = run.m;
  const result = { winner: side, steps: run.steps };
  const official: 'a' | 'b' | undefined = m.status === 'done' ? (m.winner === m.challenger ? 'a' : 'b') : undefined;
  if (run.live && m.status === 'accepted') api.finishMatch(m.id, side, result).catch(e => console.warn('[online] finish', e.message));
  const me = api.session?.user.id;
  const winnerId = side === 'a' ? m.challenger : m.opponent;
  const winnerName = run.names[side === 'a' ? 0 : 1];
  let txt: string;
  if (run.live && m.status === 'accepted' && (me === m.challenger || me === m.opponent))
    txt = me === winnerId ? 'You win!\nYou got $ ' + 2 * m.bet + '!' : 'You lose!\nYou lost $ ' + m.bet + '!';
  else txt = winnerName + ' wins!';
  // replay divergiu (ex.: outro navegador, §8 do discovery): vale o resultado gravado. O popup tem uma linha só.
  if (official && official !== side) { txt = 'Official winner: ' + run.names[official === 'a' ? 0 : 1]; console.warn('[online] replay diverged', m.id); }
  (window as any).__lastMatch = { id: m.id, ...result, official }; // testes
  const pop = SFM.addClip('mPop', _root, { sTxt: txt, sFrame: 'WARN' });
  pop.rtFun = function () { _global.FADE(); _global.GAME.mClip?.gotoAndStop('Pause_0'); };
}

/** abre a arena e roda o desafio (live = pode gravar o resultado) */
export function play(m: Match, names: [string, string], live: boolean) {
  const G = _global.GAME;
  if (!G || !m.team_b) return;
  cur = { m, rnd: mulberry32(m.seed), steps: 0, live, names };
  // pSell: o que a UI da arena da v1 lê (painel de info e botões de corrida)
  G.pSell = { nId: -1, nBattle: m.kind === 'battle' ? 1 : -1, nMoney: m.bet, nDif: 1, aBug_have: [], aBug_age: [], aBug_color: [], aBug_random: [] };
  G.clear_paBattle();
  G.clear_paRace();
  _global.FADE();
  G.mClip.gotoAndStop(m.kind === 'battle' ? 'Pause_2' : 'Pause_3');
}
