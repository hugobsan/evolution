// Sons via WebAudio. Grupos: 'music' (timeline do mMusic) e 'sfx' (resto).

export class AudioEngine {
  ctx: AudioContext | null = null;
  buffers = new Map<number, AudioBuffer>();
  raw = new Map<number, Promise<ArrayBuffer>>();
  gains = new Map<string, GainNode>();
  volumes: Record<string, number> = { music: 100, sfx: 100 };
  playing = new Set<{ src: AudioBufferSourceNode; id: number }>();

  constructor(data: any, base: string) {
    for (const [id, c] of Object.entries<any>(data.chars)) {
      if (c.type === 'sound' && c.src) this.raw.set(+id, fetch(base + c.src).then(r => r.arrayBuffer()));
    }
    try { this.ctx = new AudioContext(); } catch { this.ctx = null; }
    this.decodeAll();
  }
  private async decodeAll() {
    if (!this.ctx) return;
    for (const [id, p] of this.raw) {
      try { this.buffers.set(id, await this.ctx.decodeAudioData((await p).slice(0))); } catch { /* som inválido */ }
    }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  gain(group: string) {
    let g = this.gains.get(group);
    if (!g && this.ctx) {
      g = this.ctx.createGain();
      g.gain.value = this.level(group);
      g.connect(this.ctx.destination);
      this.gains.set(group, g);
    }
    return g!;
  }
  muted: Record<string, boolean> = {};
  private level(group: string) { return this.muted[group] ? 0 : this.volumes[group] / 100; }
  setVolume(group: string, v: number) {
    this.volumes[group] = v;
    const g = this.gains.get(group);
    if (g) g.gain.value = this.level(group);
  }
  setMuted(group: string, m: boolean) {
    this.muted[group] = m;
    const g = this.gains.get(group);
    if (g) g.gain.value = this.level(group);
  }
  async startSound(id: number, group: string, stop = false) {
    if (stop) { for (const p of this.playing) if (p.id === id) { try { p.src.stop(); } catch { /* */ } this.playing.delete(p); } return; }
    if (!this.ctx) return;
    let buf = this.buffers.get(id);
    if (!buf) {
      const raw = this.raw.get(id);
      if (!raw) return;
      try { buf = await this.ctx.decodeAudioData((await raw).slice(0)); this.buffers.set(id, buf); } catch { return; }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = group === 'music';
    src.connect(this.gain(group));
    const entry = { src, id };
    this.playing.add(entry);
    src.onended = () => this.playing.delete(entry);
    src.start();
  }
  stopAll() {
    for (const p of this.playing) { try { p.src.stop(); } catch { /* */ } }
    this.playing.clear();
  }
}
