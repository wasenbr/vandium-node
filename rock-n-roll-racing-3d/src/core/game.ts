import * as THREE from 'three';
import { EngineSound } from '../audio/engine';
import { TRACKS } from '../data/tracks';
import { VEHICLES } from '../data/vehicles';
import { Controls, createTouchControls, isTouchDevice } from '../input/controls';
import { emptyInput } from '../sim/input';
import { clamp, lerp, lerpAngle, leftX, leftZ } from '../sim/math';
import { createProgress, updateProgress, type RacerProgress } from '../sim/race';
import { Track } from '../sim/track';
import { createVehicleState, forwardSpeed, stepVehicle, type VehicleSpec, type VehicleState } from '../sim/vehicle';
import { CAMERA_LABELS, CameraRig, type CameraMode } from '../render/cameras';
import { createCarMesh, type CarVisual } from '../render/carMesh';
import { buildEnvironment, buildGround, buildSky } from '../render/environment';
import { PostFx } from '../render/postfx';
import { buildScenery } from '../render/scenery';
import { THEMES } from '../render/themes';
import { buildTrackMesh } from '../render/trackMesh';
import { Hud, formatTime } from '../ui/hud';
import { Menus } from '../ui/menus';

const DT = 1 / 60;
const COUNTDOWN = 3;

type Phase = 'menu' | 'countdown' | 'racing' | 'finished' | 'paused';

interface Snapshot {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
}

const snap = (v: VehicleState): Snapshot => ({ x: v.x, y: v.y, z: v.z, heading: v.heading, pitch: v.pitch, roll: v.roll });

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private rig = new CameraRig();
  private track: Track;
  private spec: VehicleSpec = VEHICLES.marauder;
  private car!: VehicleState;
  private prev!: Snapshot;
  private progress!: RacerProgress;
  private visual: CarVisual | null = null;
  private carColor = 0x2f7bff;
  private sun: THREE.DirectionalLight;
  private hud: Hud;
  private menus: Menus;
  private controls = new Controls();
  private engine = new EngineSound();
  private phase: Phase = 'menu';
  private phaseBeforePause: Phase = 'racing';
  private raceTime = 0;
  private countdown = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private shake = 0;
  private bounce = 0;
  private bounceVel = 0;
  private lastInput = emptyInput();
  private readonly touch = isTouchDevice();
  private readonly shadows: boolean;
  private postfx: PostFx | null = null;
  private animated: ((t: number) => void)[] = [];
  private sky: THREE.Mesh;
  private clock = 0;

  constructor(private root: HTMLElement) {
    this.shadows = !this.touch;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.touch ? 1.5 : 2));
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    root.appendChild(this.renderer.domElement);

    const def = TRACKS[0];
    this.track = new Track(def);
    const theme = THEMES[def.theme];
    this.scene.environment = buildEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.45;
    this.sky = buildSky(theme);
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(theme.fog, 110, 380);
    this.scene.add(new THREE.HemisphereLight(theme.ambientSky, theme.ambientGround, 0.9));
    this.sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
    this.sun.castShadow = this.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -50;
    sc.right = sc.top = 50;
    sc.near = 1;
    sc.far = 220;
    this.scene.add(this.sun, this.sun.target);
    const ground = buildGround(this.track, theme, this.shadows);
    this.scene.add(ground.mesh);
    this.scene.add(buildTrackMesh(this.track, theme, this.shadows));
    const scenery = buildScenery(this.track, theme, this.shadows);
    this.scene.add(scenery.group);
    this.animated.push(ground.update, scenery.update);
    // bloom só no PC: no celular pesa demais
    if (!this.touch) this.postfx = new PostFx(this.renderer, this.scene);

    this.hud = new Hud(root, this.track);
    this.hud.setVisible(false);
    if (this.touch) createTouchControls(root, this.controls);
    this.menus = new Menus(root, {
      vehicles: Object.values(VEHICLES),
      onStart: (opts) => {
        this.engine.start();
        if (this.touch) this.enterFullscreen();
        this.spec = VEHICLES[opts.vehicleId];
        this.carColor = opts.color;
        this.rig.mode = opts.camera;
        this.startRace();
      },
      onResume: () => this.togglePause(),
      onRestart: () => this.startRace(),
      onMenu: () => this.toMenu(),
    });

    this.controls.onUiAction((a) => {
      if (a === 'camera' && this.phase !== 'menu') this.setCamera(this.rig.cycle());
      if (a === 'pause') this.togglePause();
    });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.phase === 'racing' || this.phase === 'countdown')) this.togglePause();
    });

    this.resetCar();
    this.resize();
    this.menus.showMain();
    requestAnimationFrame((t) => this.frame(t));
  }

  private enterFullscreen(): void {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen()
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => {});
    }
  }

  private resetCar(): void {
    const p = this.track.pieces[0];
    // posição de largada logo depois da linha, lado esquerdo do grid
    const s = 5;
    const x = p.x0 + Math.sin(p.heading0) * s + leftX(p.heading0) * 2.4;
    const z = p.z0 + Math.cos(p.heading0) * s + leftZ(p.heading0) * 2.4;
    this.car = createVehicleState(this.spec, x, z, p.heading0, p.h0);
    this.prev = snap(this.car);
    this.progress = createProgress(this.track, this.car);

    if (this.visual) this.scene.remove(this.visual.root);
    this.visual = createCarMesh(this.carColor, this.shadows);
    this.scene.add(this.visual.root);
    this.setCamera(this.rig.mode, false);
  }

  private startRace(): void {
    this.resetCar();
    this.raceTime = 0;
    this.countdown = COUNTDOWN;
    this.phase = 'countdown';
    this.menus.hideAll();
    this.hud.setVisible(true);
    this.hud.setLap(1, this.track.def.laps);
    this.hud.message('3', 0, 'count');
  }

  private toMenu(): void {
    this.phase = 'menu';
    this.engine.silence();
    this.hud.setVisible(false);
    this.menus.showMain();
  }

  private togglePause(): void {
    if (this.phase === 'paused') {
      this.phase = this.phaseBeforePause;
      this.menus.hideAll();
    } else if (this.phase === 'racing' || this.phase === 'countdown') {
      this.phaseBeforePause = this.phase;
      this.phase = 'paused';
      this.engine.silence();
      this.menus.showPause();
    }
  }

  private setCamera(mode: CameraMode, toast = true): void {
    this.rig.mode = mode;
    if (this.visual) {
      const cockpit = mode === 'cockpit';
      this.visual.cockpit.visible = cockpit;
      for (const c of this.visual.cabin) c.visible = !cockpit;
    }
    if (toast) this.hud.showToast(`🎥 ${CAMERA_LABELS[mode]}`);
    this.resize();
  }

  private resize(): void {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.renderer.setSize(w, h);
    this.postfx?.setSize(w, h);
    this.rig.resize(w, h);
    const mirror = this.mirrorRect();
    this.hud.setMirror(this.rig.mode === 'cockpit' && this.phase !== 'menu', mirror);
    this.rig.mirror.aspect = mirror.w / mirror.h;
    this.rig.mirror.updateProjectionMatrix();
  }

  private mirrorRect() {
    const w = this.root.clientWidth;
    const mw = Math.round(Math.min(360, w * 0.36));
    const mh = Math.round(mw * 0.26);
    return { x: Math.round((w - mw) / 2), y: 8, w: mw, h: mh };
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const frameDt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.1) : DT;
    this.lastFrame = now;
    this.clock += frameDt;
    for (const fn of this.animated) fn(this.clock);

    const simulating = this.phase === 'countdown' || this.phase === 'racing' || this.phase === 'finished';
    if (simulating) {
      this.accumulator += frameDt;
      let steps = 0;
      while (this.accumulator >= DT && steps < 5) {
        this.step(DT);
        this.accumulator -= DT;
        steps++;
      }
      if (steps === 5) this.accumulator = 0;
    }
    this.render(simulating ? this.accumulator / DT : 1, frameDt);
  }

  private step(dt: number): void {
    this.prev = snap(this.car);
    let input = this.controls.read();
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.hud.message('VAI!', 1, 'go');
      } else {
        this.hud.message(String(n), 0, 'count');
      }
      input = { ...emptyInput(), throttle: 0 };
    } else if (this.phase === 'finished') {
      input = { ...emptyInput(), brake: 0.3 };
    }
    this.lastInput = input;

    stepVehicle(this.car, this.spec, input, this.track, dt);

    if (this.phase === 'racing') {
      this.raceTime += dt;
      const laps = this.track.def.laps;
      const ev = updateProgress(this.progress, this.track, this.car, this.raceTime, laps, dt);
      if (ev?.type === 'lap') {
        this.hud.setLap(ev.lap, laps);
        const last = this.progress.lapTimes[this.progress.lapTimes.length - 1];
        this.hud.message(ev.lap === laps ? 'VOLTA FINAL!' : `VOLTA ${ev.lap}`, 1.6, 'lap');
        this.hud.showToast(`Volta: ${formatTime(last)}`);
        this.car.nitroCharges = this.spec.nitroCharges; // recarrega a cada volta, como no original
      } else if (ev?.type === 'finish') {
        this.phase = 'finished';
        this.hud.message('CHEGADA!', 2.5, 'go');
        setTimeout(() => {
          if (this.phase === 'finished') this.menus.showResults(this.progress.lapTimes, this.progress.finishTime);
        }, 2500);
      }
      if (this.progress.wrongWayTime > 1) this.hud.message('CONTRAMÃO!', 0.2, 'warn');
    }

    // efeitos de impacto
    if (this.car.landingImpact > 2) {
      this.bounceVel -= this.car.landingImpact * 0.12;
      this.shake = Math.max(this.shake, clamp(this.car.landingImpact / 25, 0, 0.6));
    }
    if (this.car.wallImpact > 4) this.shake = Math.max(this.shake, clamp(this.car.wallImpact / 30, 0, 0.5));
    this.bounceVel += (-this.bounce * 300 - this.bounceVel * 18) * dt;
    this.bounce += this.bounceVel * dt;
    this.shake *= Math.exp(-dt * 6);
  }

  private render(alpha: number, frameDt: number): void {
    const v = this.car;
    const p = this.prev;
    const visual = this.visual!;
    const x = lerp(p.x, v.x, alpha);
    const y = lerp(p.y, v.y, alpha);
    const z = lerp(p.z, v.z, alpha);
    const heading = lerpAngle(p.heading, v.heading, alpha);
    const pitch = lerp(p.pitch, v.pitch, alpha);
    const roll = lerp(p.roll, v.roll, alpha);

    visual.root.position.set(x, y, z);
    visual.root.rotation.set(-pitch, heading, roll, 'YXZ');
    visual.body.position.y = clamp(this.bounce, -0.25, 0.15);
    for (const w of visual.wheels) w.rotation.x = v.wheelSpin;
    for (const fw of visual.frontWheels) fw.rotation.y = -v.steer * 0.45;
    visual.steeringWheel.rotation.z = v.steer * 1.6;
    visual.flame.visible = v.nitroTime > 0;
    if (visual.flame.visible) visual.flame.scale.setScalar(0.8 + Math.random() * 0.5);

    visual.root.updateMatrixWorld();
    this.rig.update(
      {
        position: new THREE.Vector3(x, y, z),
        quaternion: visual.root.quaternion,
        heading,
        velocity: new THREE.Vector3(v.vx, v.vy, v.vz),
        shake: this.shake,
      },
      frameDt,
    );

    this.sun.position.set(x + 40, y + 70, z - 30);
    this.sun.target.position.set(x, y, z);
    this.sky.position.copy(this.rig.active.position);

    const speed = forwardSpeed(v);
    if (this.phase !== 'menu' && this.phase !== 'paused') {
      this.hud.update(frameDt, {
        time: this.raceTime,
        best: this.progress.lapTimes.length ? Math.min(...this.progress.lapTimes) : null,
        speedKmh: speed * 3.6,
        nitro: v.nitroCharges,
        nitroMax: this.spec.nitroCharges,
        boosting: v.nitroTime > 0,
        cars: [{ x: v.x, z: v.z, color: `#${this.carColor.toString(16).padStart(6, '0')}` }],
      });
      this.engine.update(clamp(Math.abs(speed) / this.spec.maxSpeed, 0, 1.3), this.lastInput.throttle, v.nitroTime > 0);
    }

    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, w, h);
    if (this.postfx) this.postfx.render(this.rig.active);
    else this.renderer.render(this.scene, this.rig.active);

    if (this.rig.mode === 'cockpit' && this.phase !== 'menu') {
      const m = this.mirrorRect();
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(m.x, h - m.y - m.h, m.w, m.h);
      this.renderer.setViewport(m.x, h - m.y - m.h, m.w, m.h);
      this.renderer.render(this.scene, this.rig.mirror);
      this.renderer.setScissorTest(false);
    }
  }
}
