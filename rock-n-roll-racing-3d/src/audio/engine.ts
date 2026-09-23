/** Som de motor sintetizado (Web Audio) — placeholder até termos áudio gravado. */
export class EngineSound {
  private ctx: AudioContext | null = null;
  private osc1!: OscillatorNode;
  private osc2!: OscillatorNode;
  private gain!: GainNode;
  private filter!: BiquadFilterNode;
  muted = false;

  /** Precisa ser chamado dentro de um gesto do usuário (clique/toque). */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.osc1 = ctx.createOscillator();
    this.osc2 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2.type = 'square';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(ctx.destination);
    this.osc1.start();
    this.osc2.start();
  }

  update(speedRatio: number, throttle: number, boosting: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 45 + speedRatio * 120 + throttle * 15 + (boosting ? 30 : 0);
    this.osc1.frequency.setTargetAtTime(base, t, 0.05);
    this.osc2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    this.filter.frequency.setTargetAtTime(400 + speedRatio * 1400 + (boosting ? 800 : 0), t, 0.05);
    this.gain.gain.setTargetAtTime(this.muted ? 0 : 0.05 + throttle * 0.04, t, 0.08);
  }

  silence(): void {
    if (this.ctx) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }
}
