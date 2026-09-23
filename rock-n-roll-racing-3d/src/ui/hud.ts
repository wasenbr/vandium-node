import type { Track } from '../sim/track';
import { drawTrack, trackTransform } from './trackMap';

export function formatTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export interface HudData {
  time: number;
  best: number | null;
  speedKmh: number;
  place: number;
  total: number;
  /** 0..1 */
  armor: number;
  money: number;
  front: { label: string; n: number; max: number };
  rear: { label: string; n: number; max: number };
  nitro: number;
  nitroMax: number;
  boosting: boolean;
  cars: { x: number; z: number; color: string; me: boolean }[];
}

export class Hud {
  readonly el: HTMLElement;
  private lap: HTMLElement;
  private time: HTMLElement;
  private best: HTMLElement;
  private speed: HTMLElement;
  private weapons: HTMLElement;
  private armor: HTMLElement;
  private money: HTMLElement;
  private pos: HTMLElement;
  private posTotal: HTMLElement;
  private center: HTMLElement;
  private toast: HTMLElement;
  private mirrorFrame: HTMLElement;
  private minimap: HTMLCanvasElement;
  private mapCtx: CanvasRenderingContext2D;
  private mapBase: HTMLCanvasElement;
  private mapTransform: (x: number, z: number) => [number, number];
  private toastTimer = 0;
  private centerTimer = 0;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-tl">
        <div class="hud-pos"><b>1º</b><span>/4</span></div>
        <div class="hud-lap">VOLTA <b>1/4</b></div>
        <div class="hud-time">0:00.00</div>
        <div class="hud-best"></div>
      </div>
      <canvas class="hud-map" width="180" height="180"></canvas>
      <div class="hud-bl">
        <div class="hud-weapons"></div>
        <div class="hud-armor"><i></i></div>
        <div class="hud-speed"><b>0</b> km/h <span class="hud-money">$0</span></div>
      </div>
      <div class="hud-center"></div>
      <div class="hud-toast"></div>
      <div class="hud-mirror"></div>`;
    root.appendChild(this.el);
    const q = (s: string) => this.el.querySelector(s) as HTMLElement;
    this.lap = q('.hud-lap b');
    this.time = q('.hud-time');
    this.best = q('.hud-best');
    this.speed = q('.hud-speed b');
    this.weapons = q('.hud-weapons');
    this.armor = q('.hud-armor i');
    this.money = q('.hud-money');
    this.pos = q('.hud-pos b');
    this.posTotal = q('.hud-pos span');
    this.center = q('.hud-center');
    this.toast = q('.hud-toast');
    this.mirrorFrame = q('.hud-mirror');
    this.minimap = q('.hud-map') as HTMLCanvasElement;
    this.mapCtx = this.minimap.getContext('2d')!;

    this.mapBase = document.createElement('canvas');
    this.mapBase.width = this.mapBase.height = this.minimap.width;
    this.mapTransform = () => [0, 0];
  }

  /** Troca a pista mostrada no minimapa. */
  setTrack(track: Track): void {
    const size = this.minimap.width;
    this.mapTransform = trackTransform(track, size, size, 14);
    const ctx = this.mapBase.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    drawTrack(ctx, track, this.mapTransform);
  }

  setLap(lap: number, laps: number): void {
    this.lap.textContent = `${Math.min(lap, laps)}/${laps}`;
  }

  update(dt: number, data: HudData): void {
    this.time.textContent = formatTime(data.time);
    this.best.textContent = data.best !== null ? `MELHOR ${formatTime(data.best)}` : '';
    this.speed.textContent = String(Math.round(Math.abs(data.speedKmh)));
    this.pos.textContent = `${data.place}º`;
    this.posTotal.textContent = `/${data.total}`;
    this.money.textContent = `$${data.money.toLocaleString('pt-BR')}`;
    const ratio = Math.max(0, data.armor);
    this.armor.style.width = `${Math.round(ratio * 100)}%`;
    this.armor.className = ratio < 0.3 ? 'low' : ratio < 0.6 ? 'mid' : '';
    const row = (label: string, n: number, max: number, cls: string, active = false) =>
      `<div class="w ${cls}${active ? ' active' : ''}"><span>${label}</span>${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
    const html =
      row(data.front.label, data.front.n, data.front.max, 'front') +
      row(data.rear.label, data.rear.n, data.rear.max, 'rear') +
      row('NITRO', data.nitro, data.nitroMax, 'nitro', data.boosting);
    if (this.weapons.dataset.v !== html) {
      this.weapons.innerHTML = html;
      this.weapons.dataset.v = html;
    }

    const ctx = this.mapCtx;
    ctx.clearRect(0, 0, this.minimap.width, this.minimap.height);
    ctx.drawImage(this.mapBase, 0, 0);
    for (const c of [...data.cars].sort((a, b) => Number(a.me) - Number(b.me))) {
      const [x, y] = this.mapTransform(c.x, c.z);
      ctx.beginPath();
      ctx.arc(x, y, c.me ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.lineWidth = c.me ? 3 : 2;
      ctx.strokeStyle = c.me ? '#fff' : '#000';
      ctx.stroke();
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) this.center.classList.remove('show');
    }
  }

  /** Mensagem grande no centro (contagem, "VOLTA FINAL", etc.). duration <= 0 = fica até trocar. */
  message(text: string, duration = 1.5, cls = ''): void {
    this.center.textContent = text;
    this.center.className = `hud-center show ${cls ? `m-${cls}` : ''}`;
    this.centerTimer = duration > 0 ? duration : Infinity;
  }

  clearMessage(): void {
    this.center.classList.remove('show');
    this.centerTimer = 0;
  }

  showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    this.toastTimer = 1.4;
  }

  setMirror(visible: boolean, rect?: { x: number; y: number; w: number; h: number }): void {
    this.mirrorFrame.style.display = visible ? 'block' : 'none';
    if (visible && rect) {
      Object.assign(this.mirrorFrame.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    }
  }

  setVisible(v: boolean): void {
    this.el.style.display = v ? '' : 'none';
  }
}
