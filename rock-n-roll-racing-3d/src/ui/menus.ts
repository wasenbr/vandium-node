import type { CameraMode } from '../render/cameras';
import type { VehicleSpec } from '../sim/vehicle';
import { formatTime } from './hud';

export interface StartOptions {
  vehicleId: string;
  color: number;
  camera: CameraMode;
}

interface MenuCallbacks {
  vehicles: VehicleSpec[];
  onStart: (o: StartOptions) => void;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

const COLORS = [0x2f7bff, 0xe02828, 0x2fc840, 0xf2c318, 0xb040e0, 0xf0f0f0];

function stat(label: string, value: number): string {
  return `<div class="stat"><span>${label}</span><i style="width:${Math.round(value * 100)}%"></i></div>`;
}

export class Menus {
  private main: HTMLElement;
  private pause: HTMLElement;
  private results: HTMLElement;
  private opts: StartOptions = { vehicleId: 'marauder', color: COLORS[0], camera: 'iso' };

  constructor(root: HTMLElement, cb: MenuCallbacks) {
    this.main = this.panel(root, 'menu-main');
    this.pause = this.panel(root, 'menu-pause');
    this.results = this.panel(root, 'menu-results');

    const maxSpeed = Math.max(...cb.vehicles.map((v) => v.maxSpeed));
    const maxAccel = Math.max(...cb.vehicles.map((v) => v.accel));
    const maxGrip = Math.max(...cb.vehicles.map((v) => v.grip));
    this.main.innerHTML = `
      <div class="card">
        <h1>ROCK <span>'N'</span> ROLL<br/>RACING <em>3D</em></h1>
        <p class="sub">Protótipo — Chem VI, Pista 1</p>
        <h3>Carro</h3>
        <div class="cars">
          ${cb.vehicles
            .map(
              (v) => `<button class="car" data-id="${v.id}"><b>${v.name}</b>
                ${stat('Velocidade', v.maxSpeed / maxSpeed)}${stat('Aceleração', v.accel / maxAccel)}${stat('Aderência', v.grip / maxGrip)}
              </button>`,
            )
            .join('')}
        </div>
        <h3>Cor</h3>
        <div class="colors">${COLORS.map((c) => `<button class="color" data-c="${c}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="cor"></button>`).join('')}</div>
        <h3>Câmera inicial</h3>
        <div class="cams">
          <button class="cam" data-m="iso">Vista aérea</button>
          <button class="cam" data-m="cockpit">Cockpit</button>
          <button class="cam" data-m="chase">Perseguição</button>
        </div>
        <button class="go" data-act="start">CORRER!</button>
        <details class="help">
          <summary>Controles</summary>
          <p><b>Teclado:</b> ↑/W acelera · ↓/S freia/ré · ←→/A D vira · Shift nitro · C troca câmera · Esc pausa</p>
          <p><b>Controle:</b> RT acelera · LT freia · analógico vira · L3/R3 nitro · Y câmera · Start pausa</p>
          <p><b>Celular:</b> botões na tela; 🎥 troca a câmera. Melhor com o aparelho deitado.</p>
          <p class="muted">Armas (tiro e mina) entram na próxima etapa.</p>
        </details>
      </div>`;
    this.pause.innerHTML = `
      <div class="card small">
        <h2>PAUSADO</h2>
        <button class="go" data-act="resume">Continuar</button>
        <button data-act="restart">Reiniciar corrida</button>
        <button data-act="menu">Menu principal</button>
      </div>`;

    for (const panel of [this.main, this.pause, this.results]) {
      panel.addEventListener('click', (e) => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t) return;
        if (t.dataset.id) this.opts.vehicleId = t.dataset.id;
        if (t.dataset.c) this.opts.color = Number(t.dataset.c);
        if (t.dataset.m) this.opts.camera = t.dataset.m as CameraMode;
        switch (t.dataset.act) {
          case 'start':
            cb.onStart({ ...this.opts });
            break;
          case 'resume':
            cb.onResume();
            break;
          case 'restart':
            cb.onRestart();
            break;
          case 'menu':
            cb.onMenu();
            break;
        }
        this.refreshSelection();
      });
    }
    this.refreshSelection();
  }

  private panel(root: HTMLElement, cls: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `overlay ${cls}`;
    el.style.display = 'none';
    root.appendChild(el);
    return el;
  }

  private refreshSelection(): void {
    this.main.querySelectorAll<HTMLElement>('.car').forEach((b) => b.classList.toggle('sel', b.dataset.id === this.opts.vehicleId));
    this.main.querySelectorAll<HTMLElement>('.color').forEach((b) => b.classList.toggle('sel', Number(b.dataset.c) === this.opts.color));
    this.main.querySelectorAll<HTMLElement>('.cam').forEach((b) => b.classList.toggle('sel', b.dataset.m === this.opts.camera));
  }

  hideAll(): void {
    for (const p of [this.main, this.pause, this.results]) p.style.display = 'none';
  }

  showMain(): void {
    this.hideAll();
    this.main.style.display = '';
  }

  showPause(): void {
    this.hideAll();
    this.pause.style.display = '';
  }

  showResults(lapTimes: number[], total: number): void {
    this.hideAll();
    const best = Math.min(...lapTimes);
    this.results.innerHTML = `
      <div class="card small">
        <h2>RESULTADO</h2>
        <table>
          ${lapTimes.map((t, i) => `<tr class="${t === best ? 'best' : ''}"><td>Volta ${i + 1}</td><td>${formatTime(t)}</td></tr>`).join('')}
          <tr class="total"><td>Total</td><td>${formatTime(total)}</td></tr>
        </table>
        <button class="go" data-act="restart">Correr de novo</button>
        <button data-act="menu">Menu principal</button>
      </div>`;
    this.results.style.display = '';
  }
}
