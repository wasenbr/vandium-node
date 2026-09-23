/** AudioContext compartilhado — só pode ser criado/retomado após um gesto do usuário. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function audio(): { ctx: AudioContext; out: GainNode } | null {
  return ctx && master ? { ctx, out: master } : null;
}

export function unlockAudio(): void {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
}

export function toggleMute(): boolean {
  muted = !muted;
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
  if (muted) window.speechSynthesis?.cancel();
  return muted;
}

export function isMuted(): boolean {
  return muted;
}
