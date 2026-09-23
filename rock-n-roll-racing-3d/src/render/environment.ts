import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Track } from '../sim/track';
import { canvasTexture } from './trackMesh';
import type { Theme } from './themes';

/** Céu em gradiente (cúpula) — barato e bonito também no celular. */
export function buildSky(theme: Theme): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      horizon: { value: new THREE.Color(theme.skyHorizon) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
      void main(){ float t = clamp(vDir.y * 2.2, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(t, 0.7)), 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

/** Mapa de ambiente para reflexos (pintura do carro, metais). */
export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

/** Terreno abaixo das pistas: pântano, oceano, lava ou chão sólido. */
export function buildGround(track: Track, theme: Theme, shadows: boolean): { mesh: THREE.Mesh; update: (t: number) => void } {
  const b = track.bounds();
  const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 700;
  const hex = `#${theme.ground.toString(16).padStart(6, '0')}`;
  const tex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      const light = Math.random() > 0.6;
      ctx.fillStyle = light ? `rgba(255,255,200,${Math.random() * 0.03})` : `rgba(0,0,0,${Math.random() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 30, 3 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.repeat.set(size / 40, size / 40);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: theme.liquid ? 0.18 : 0.95,
    metalness: theme.liquid ? 0.35 : 0,
    emissive: theme.liquidEmissive,
    emissiveIntensity: 1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((b.minX + b.maxX) / 2, theme.groundLevel, (b.minZ + b.maxZ) / 2);
  mesh.receiveShadow = shadows;
  const update = (t: number) => {
    if (theme.liquid) {
      // o líquido escorre devagar
      tex.offset.set(t * 0.004, t * 0.0025);
    }
  };
  return { mesh, update };
}
