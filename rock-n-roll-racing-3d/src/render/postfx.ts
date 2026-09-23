import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Linhas de resolução no modo 16-bit (o SNES tinha 224; a Definitive Edition amplia essa imagem). */
export const RETRO_ROWS = 270;

/**
 * Paleta reduzida com pontilhado ordenado (Bayer 4x4), aplicada depois do tone mapping —
 * imita a cor de 15 bits e o dithering dos jogos 16-bit.
 */
const RetroShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    levels: { value: 22 },
    saturation: { value: 1.18 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float levels; uniform float saturation;
    varying vec2 vUv;
    float bayer(vec2 p) {
      int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
      float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      return m[i] / 16.0;
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = clamp(mix(vec3(l), c.rgb, saturation), 0.0, 1.0);
      float d = (bayer(floor(vUv * resolution)) - 0.5) / levels;
      c.rgb = floor((c.rgb + d) * levels + 0.5) / levels;
      gl_FragColor = c;
    }`,
};

/** Pós-processamento: bloom (luzes, chamas, nitro) e o filtro 16-bit opcional. */
export class PostFx {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private retro: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    // limiar alto (HDR): só o que é emissivo de verdade brilha, não o asfalto ao sol
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 2.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.retro = new ShaderPass(RetroShader);
    this.composer.addPass(this.retro);
  }

  configure(o: { bloom: boolean; retro: boolean }): void {
    this.bloom.enabled = o.bloom;
    this.retro.enabled = o.retro;
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.retro.uniforms.resolution.value.set(w * pixelRatio, h * pixelRatio);
  }

  render(camera: THREE.Camera): void {
    this.renderPass.camera = camera;
    this.composer.render();
  }
}
