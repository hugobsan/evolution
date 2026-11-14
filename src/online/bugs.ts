// Besouro do jogo (Adult) ↔ JSON do online, resumo público do jogo e aplicação das entregas (inbox) no GAME.
import { _global } from '../engine/as2';
import { Adult_sell } from '../game/classes/Adult_sell';
import type { Bug, InboxRow } from './api';

const G = () => _global.GAME;
const r3 = (n: any) => Math.round((Number(n) || 0) * 1000) / 1000;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** id estável do besouro (vai junto no save da v1, que serializa todas as propriedades do Adult) */
export function uidOf(a: any): string {
  return (a.sUid ??= crypto.randomUUID());
}

export function bugOf(a: any): Bug {
  return {
    uid: uidOf(a), nId: a.nId, nId_color: Number(a.nId_color) || 0, nGrow: clamp(r3(a.nGrow), 0, 1000),
    nRandom: clamp(r3(a.nRandom), 0, 1), nHealth: clamp(r3(a.nHealth), 0, 100), nAge_now: Math.max(0, Math.floor(a.nAge_now) || 0),
    nSex: a.nSex <= 0 ? -1 : 1, sNickName: String(a.sNickName ?? '').slice(0, 24), nFed: r3(a.nFed), nHeart: r3(a.nHeart),
  };
}

/** mesmas contas de Adult.setNum (atributos de luta/corrida) */
export function stats(b: Bug) {
  const D = _global.DATA[b.nId];
  return {
    attack: D[2] + b.nGrow * 0.1 + b.nRandom * 5,
    hp: (D[3] + b.nGrow * 0.1) * b.nHealth * 0.01 + b.nRandom * 50,
    speed: 0.3 + b.nGrow * 0.0005 + D[4] + b.nRandom * 0.2,
    size: 10 + b.nGrow * 0.025 + b.nRandom,
  };
}

/** besouro da lista de venda (aAdult_sell) → resumo com preço; o v1 só guarda alguns atributos: o resto fica no padrão */
export function sellBugOf(a: any): Bug & { price: number } {
  uidOf(a); // a identidade fica no próprio item da lista (vai no save)
  const b = bugOf({ nRandom: 0.5, nHealth: 50, nFed: 80, nHeart: 80, ...a });
  return { ...b, price: clamp(Math.floor(Number(a.nValue_c) || 0), 0, 6666666) };
}

/** resumo público (amigos veem no perfil) */
export function snapshotOf() {
  const g = G();
  g.setscore?.();
  return {
    money: Math.floor(g.nMoney), level: g.nLevel | 0, days: Math.floor(g.nTime / 10), score: g.nScore | 0,
    have: (g.aBug_have as any[]).map((v, i) => (v ? i : -1)).filter(i => i >= 0),
    bugs: (g.aAdult as any[]).slice(0, 12).map(bugOf), selling: g.aAdult_sell?.length | 0,
    sell: ((g.aAdult_sell ?? []) as any[]).slice(0, 12).map(sellBugOf),
  };
}

/** meu besouro pelo uid: no terrário ou na lista de venda (a compra por um amigo pede um besouro à venda) */
export const myBug = (uid: string) => (G()?.aAdult as any[] | undefined)?.find(a => a.sUid === uid) ?? (G()?.aAdult_sell as any[] | undefined)?.find(a => a.sUid === uid);

function removeBug(uid: string) {
  const g = G();
  const a = (g.aAdult as any[]).find(x => x.sUid === uid);
  if (a) { a.remove(); g.removeArray(g.aAdult, a); g.clearMandF?.(); return; }
  const s = (g.aAdult_sell as any[]).find(x => x.sUid === uid);
  s?.remove();
}

function addBug(b: Bug) {
  const g = G();
  const ob: any = { ...b, sUid: b.uid };
  delete ob.uid;
  if (g.aAdult.length >= 12) {
    // terrário cheio (máx. 12 na v1): vai para a lista de venda com preço que nenhum NPC paga; "RETIRAR" traz de volta
    // (Object.assign mantém nRandom/saúde/uid, que o Adult_sell da v1 descartaria)
    g.aAdult_sell.push(Object.assign(new Adult_sell(6666666, ob), ob));
    return 'sell';
  }
  g.addAdult(b.nId, ob, g.nScreen === 0 && !!g.mClip?.mGround);
  return 'tank';
}

/** aplica uma entrega no jogo atual; devolve o texto do aviso (ou '') */
export function applyEntry(r: InboxRow): string {
  const g = G();
  for (const u of r.remove_uids ?? []) removeBug(u);
  let full = false;
  for (const b of r.add_bugs ?? []) if (addBug(b) === 'sell') full = true;
  if (r.money) g.setMoney(r.money);
  const msg = MSG[r.kind]?.(r) ?? '';
  return full ? 'Tank full: the bug went to your sell list!' : msg;
}

const MSG: Record<string, (r: InboxRow) => string> = {
  offer_accepted: () => 'Trade completed!',
  offer_declined: () => 'Your offer was declined.',
  match_declined: () => 'Your challenge was declined.',
  match_won: r => 'You won a challenge! +$ ' + r.money,
  match_lost: () => 'You lost a challenge.',
  world_joined: () => 'A player joined your world!',
  world_kicked: () => 'You were removed from the world.',
  world_ended: () => 'The world was ended by its owner.',
};
