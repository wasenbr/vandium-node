import * as THREE from 'three';
import { createRng } from '../sim/math';
import type { Track } from '../sim/track';
import { canvasTexture } from './trackMesh';
import type { Theme } from './themes';

export interface Scenery {
  group: THREE.Group;
  update: (t: number) => void;
}

function rustTexture(base: number, seed: number): THREE.CanvasTexture {
  const rng = createRng(seed);
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = rng() > 0.5 ? `rgba(120,50,20,${rng() * 0.35})` : `rgba(0,0,0,${rng() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(rng() * 256, rng() * 256, 3 + rng() * 22, 2 + rng() * 10, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < 256; y += 42) ctx.fillRect(0, y, 256, 3); // soldas
  });
}

/**
 * Cenário ao redor da pista. Chem VI: pântano químico com refinarias,
 * tanques enferrujados e canos queimando metano (como no fundo do original).
 */
export function buildScenery(track: Track, theme: Theme, shadows: boolean, seed = 6): Scenery {
  const group = new THREE.Group();
  const rng = createRng(seed);
  const b = track.bounds();
  const margin = 70;
  const G = theme.groundLevel;
  const rust = theme.props.map((c, i) => new THREE.MeshStandardMaterial({ map: rustTexture(c, 10 + i), roughness: 0.7, metalness: 0.6 }));
  const rock = new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 1, flatShading: true });
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a20).multiplyScalar(3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe6a0).multiplyScalar(4), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameGeo = new THREE.ConeGeometry(0.9, 4, 10, 1, true);
  flameGeo.translate(0, 2, 0);
  const flames: { outer: THREE.Mesh; inner: THREE.Mesh; phase: number }[] = [];

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    group.add(m);
    return m;
  };

  const addFlame = (x: number, y: number, z: number, scale: number) => {
    const outer = new THREE.Mesh(flameGeo, flameMat);
    const inner = new THREE.Mesh(flameGeo, flameCore);
    outer.position.set(x, y, z);
    inner.position.set(x, y, z);
    outer.scale.setScalar(scale);
    inner.scale.setScalar(scale * 0.55);
    group.add(outer, inner);
    flames.push({ outer, inner, phase: rng() * 10 });
  };

  const clearOfTrack = (x: number, z: number, need: number) => {
    const q = track.query(x, z);
    return Math.hypot(q.outside, Math.max(0, Math.abs(q.lateral) - track.halfWidth)) > need;
  };

  let placed = 0;
  for (let tries = 0; tries < 1500 && placed < 150; tries++) {
    const x = b.minX - margin + rng() * (b.maxX - b.minX + margin * 2);
    const z = b.minZ - margin + rng() * (b.maxZ - b.minZ + margin * 2);
    const kind = rng();
    const big = kind < 0.3;
    if (!clearOfTrack(x, z, big ? 14 : 8)) continue;
    placed++;
    const mat = rust[Math.floor(rng() * rust.length)];

    if (kind < 0.18 && theme.flames) {
      // cano de gás com chama no topo
      const h = 6 + rng() * 10;
      mesh(new THREE.CylinderGeometry(0.55, 0.7, h, 12), mat, x, G + h / 2, z);
      mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 12), mat, x, G + h, z);
      addFlame(x, G + h + 0.2, z, 0.8 + rng() * 0.6);
    } else if (kind < 0.3) {
      // tanque de armazenamento sobre base
      const r = 3 + rng() * 3;
      const h = 5 + rng() * 5;
      mesh(new THREE.CylinderGeometry(r + 1, r + 1.4, 1.5, 20), rock, x, G + 0.5, z);
      mesh(new THREE.CylinderGeometry(r, r, h, 24), mat, x, G + 1.2 + h / 2, z);
      mesh(new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat, x, G + 1.2 + h, z).scale.y = 0.35;
      // escada lateral
      mesh(new THREE.BoxGeometry(0.4, h, 0.15), rust[0], x + r + 0.1, G + 1.2 + h / 2, z);
    } else if (kind < 0.42) {
      // torre de refinaria
      const h = 14 + rng() * 14;
      mesh(new THREE.CylinderGeometry(1.2, 1.6, h, 14), mat, x, G + h / 2, z);
      for (let k = 1; k < 4; k++) mesh(new THREE.TorusGeometry(1.7, 0.18, 6, 16), rust[0], x, G + (h * k) / 4, z).rotation.x = Math.PI / 2;
      if (theme.flames && rng() > 0.5) addFlame(x, G + h, z, 1.2);
    } else if (kind < 0.55) {
      // tubulação horizontal apoiada em suportes
      const len = 10 + rng() * 20;
      const ang = rng() * Math.PI;
      const pipe = mesh(new THREE.CylinderGeometry(0.5, 0.5, len, 10), mat, x, G + 2.5, z);
      pipe.rotation.set(0, ang, Math.PI / 2);
      for (const t of [-0.4, 0, 0.4]) {
        mesh(new THREE.BoxGeometry(0.4, 2.5, 0.4), rust[0], x + Math.cos(ang) * len * t, G + 1.25, z - Math.sin(ang) * len * t);
      }
    } else if (kind < 0.8) {
      // ilhotas de rocha saindo do pântano
      const r = 1.5 + rng() * 4;
      const m = mesh(new THREE.DodecahedronGeometry(r, 0), rock, x, G + r * 0.1, z);
      m.scale.set(1, 0.4 + rng() * 0.5, 1 + rng() * 0.6);
      m.rotation.y = rng() * Math.PI;
    } else {
      // juncos
      const reeds = new THREE.Group();
      const reedMat = new THREE.MeshStandardMaterial({ color: 0x3a4a22, roughness: 1 });
      for (let k = 0; k < 7; k++) {
        const h = 1 + rng() * 2;
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, h, 4), reedMat);
        r.position.set((rng() - 0.5) * 2, G + h / 2, (rng() - 0.5) * 2);
        r.rotation.set((rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.4);
        reeds.add(r);
      }
      reeds.position.set(x, 0, z);
      group.add(reeds);
    }
  }

  const update = (t: number) => {
    for (const f of flames) {
      const n = Math.sin(t * 13 + f.phase) * 0.12 + Math.sin(t * 29 + f.phase * 2) * 0.08;
      f.outer.scale.y = f.outer.scale.x * (1 + n);
      f.inner.scale.y = f.inner.scale.x * (1 + n * 1.5);
      f.outer.rotation.y = t * 2 + f.phase;
    }
  };
  return { group, update };
}
