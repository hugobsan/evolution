// Presença na loja: quem está na loja entra no canal Realtime "shop:<mundo>"; cada membro presente vira um NPC andando
// na loja dos outros (mesmo clip/rota dos vendedores particulares), com o nome em cima. Clique = perfil do amigo.
import { _global } from '../engine/as2';
import { Sellman } from '../game/classes/Sellman';
import { SFM } from '../game/classes/SFM';
import * as api from './api';
import { state, emit, uid, onState } from './sync';

export const inShop = new Set<string>(); // amigos (ou qualquer um) presentes na loja agora
let channel: any = null;
let tracking = false;
let here = false; // eu estou na loja
let openProfile: (id: string) => void = () => {};
export const setProfileOpener = (f: (id: string) => void) => { openProfile = f; };

class FriendNpc extends Sellman {
  constructor(public fid: string, public fname: string, look: number) {
    super(2);
    this.aSell_list = [];
    this.nFrame = look;
  }
  // não vende, não compra e o nome fica sempre visível
  addMouse() {}
  addMouse_1() {}
  removeMouse() {}
  buy() { return false as any; }
  setClip(mc: any) {
    super.setClip(mc);
    if (!this.mClip) return;
    const t = this.mClip.attachSymbol(76, 'mName', 901, { sTxt: this.fname, sVariable: 'sTxt', autoSize: 'center' }, false);
    if (t?.tTxt) Object.assign(t.tTxt, { border: true, borderColor: 0xffffff, background: true, backgroundColor: 0 });
    if (t) t._y = -112;
    this.mClip.onPress = () => openProfile(this.fid);
    this.mClip.onRollOver = () => _global.GAME?.mClip?.mInfo?.setFrame('txt', { s_0: 'Friend : ' + _global.TXTCOLOR('00ccff', this.fname), s_1: '', s_2: '' });
    this.moveClip();
  }
  moveClip() {
    super.moveClip();
    const t = this.mClip?.mName;
    if (t) t._xscale = this.mClip._xscale < 0 ? -100 : 100; // o NPC espelha (_xscale ±100); o nome não
  }
}

const npcs = new Map<string, FriendNpc>();

function syncNpcs() {
  const G = _global.GAME;
  const ground = G?.mClip?.mGround_2;
  const want = here && G?.nScreen === 2 && ground ? [...inShop].filter(id => state.friends.has(id)) : [];
  for (const [id, n] of npcs) {
    if (!want.includes(id) || !n.vCurr) { n.remove(); G?.removeArray?.(G.aSellman, n); npcs.delete(id); }
  }
  for (const id of want) {
    if (npcs.has(id)) continue;
    const p = state.friends.get(id)!;
    const n = new FriendNpc(id, p.username, p.look);
    G.aSellman.push(n);
    n.setClip(SFM.addClip('mPeople', ground));
    npcs.set(id, n);
  }
}
setInterval(syncNpcs, 1000); // recria o NPC quando a rota dele termina (o Sellman se remove no fim da rota)

// um canal por mundo: só os membros do mundo se veem na loja
let joined: string | null = null;
onState(() => { if ((state.world?.id ?? null) !== joined) connect(); });

export async function connect() {
  const c = await api.client();
  disconnect();
  const me = uid();
  joined = state.world?.id ?? null;
  if (!me || !joined) return;
  channel = c.channel('shop:' + joined, { config: { presence: { key: me } } });
  channel.on('presence', { event: 'sync' }, () => {
    inShop.clear();
    for (const id of Object.keys(channel.presenceState())) if (id !== me) inShop.add(id);
    syncNpcs();
    emit();
  });
  channel.subscribe((s: string) => { if (s === 'SUBSCRIBED') track(); });
}
export function disconnect() {
  if (channel) api.sbNow()?.removeChannel(channel);
  channel = null;
  tracking = false;
  inShop.clear();
}

function track() {
  if (!channel || !api.me) return;
  if (here && !tracking) { tracking = true; channel.track({ name: api.me.username, look: api.me.look }); }
  else if (!here && tracking) { tracking = false; channel.untrack(); }
}
export function setHere(v: boolean) {
  here = v;
  track();
  syncNpcs();
}
