import * as THREE from 'three';

export interface CarVisual {
  root: THREE.Group;
  /** carroceria (balança com a suspensão) — filha de root */
  body: THREE.Group;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  /** partes escondidas na câmera de cockpit (teto/cabine) */
  cabin: THREE.Object3D[];
  /** painel, volante e colunas, visíveis só na câmera de cockpit */
  cockpit: THREE.Group;
  steeringWheel: THREE.Object3D;
  flame: THREE.Mesh;
}

/** Posição dos olhos do piloto, em coordenadas locais do carro (+z = frente). */
export const EYE = new THREE.Vector3(0, 1.3, -0.75);

/**
 * Cria uma peça a partir de um perfil lateral (u = comprimento, v = altura),
 * extrudada na largura do carro com chanfro — dá formas bem mais realistas que caixas.
 */
function sideProfile(shape: THREE.Shape, width: number, bevel: number): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geo.rotateY(-Math.PI / 2); // perfil vira o comprimento (z), extrusão vira a largura (x)
  geo.translate((width - bevel * 2) / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

function bodyShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-2.15, 0.42);
  s.lineTo(-1.95, 0.42);
  s.absarc(-1.35, 0.46, 0.6, Math.PI, 0, true); // caixa de roda traseira
  s.lineTo(0.75, 0.42);
  s.absarc(1.35, 0.46, 0.6, Math.PI, 0, true); // caixa de roda dianteira
  s.lineTo(2.1, 0.42);
  s.quadraticCurveTo(2.3, 0.5, 2.25, 0.66); // para-choque
  s.lineTo(1.95, 0.84);
  s.quadraticCurveTo(1.2, 0.92, 0.55, 0.97); // capô
  s.lineTo(-1.7, 1.02);
  s.quadraticCurveTo(-2.15, 1.02, -2.2, 0.92); // traseira
  s.lineTo(-2.2, 0.5);
  s.closePath();
  return s;
}

function cabinShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0.6, 0.95);
  s.quadraticCurveTo(0.1, 1.3, -0.25, 1.42); // para-brisa
  s.lineTo(-1.15, 1.42);
  s.quadraticCurveTo(-1.5, 1.3, -1.8, 1.0); // vidro traseiro
  s.closePath();
  return s;
}

/** Marauder: buggy de combate, gerado 100% por código. */
export function createCarMesh(color: number, shadows: boolean): CarVisual {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x141418, metalness: 0.5, roughness: 0.55 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0f16, metalness: 0.2, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 1, roughness: 0.18 });
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.9, roughness: 0.35 });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    parent.add(m);
    return m;
  };

  add(sideProfile(bodyShape(), 2.0, 0.08), paint, 0, 0, 0);
  const cabin = add(sideProfile(cabinShape(), 1.62, 0.06), glass, 0, 0, 0);
  const roof = add(new THREE.BoxGeometry(1.5, 0.06, 0.95), paint, 0, 1.44, -0.7);

  // saias laterais e para-choques
  add(new THREE.BoxGeometry(0.12, 0.2, 1.3), trim, 1.02, 0.5, 0);
  add(new THREE.BoxGeometry(0.12, 0.2, 1.3), trim, -1.02, 0.5, 0);
  add(new THREE.BoxGeometry(1.9, 0.22, 0.25), trim, 0, 0.5, 2.2);
  add(new THREE.BoxGeometry(1.9, 0.25, 0.2), trim, 0, 0.55, -2.22);
  // grade dianteira
  add(new THREE.BoxGeometry(1.0, 0.14, 0.05), gunMetal, 0, 0.66, 2.24).rotation.x = -0.4;
  // tomada de ar no capô
  add(new THREE.BoxGeometry(0.6, 0.12, 0.8), trim, 0, 1.0, 1.1);

  // aerofólio
  const wing = add(new THREE.BoxGeometry(2.0, 0.06, 0.5), paint, 0, 1.38, -1.95);
  wing.rotation.x = 0.12;
  for (const sx of [-0.75, 0.75]) add(new THREE.BoxGeometry(0.08, 0.38, 0.35), trim, sx, 1.18, -1.95);

  // canhões dianteiros (arma frontal do Marauder)
  for (const sx of [-0.62, 0.62]) {
    const gun = add(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 10), gunMetal, sx, 1.02, 1.35);
    gun.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.26, 0.16, 0.5), gunMetal, sx, 1.0, 0.8);
  }
  // escapamentos
  for (const sx of [-0.55, 0.55]) {
    const ex = add(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 10), chrome, sx, 0.5, -2.3);
    ex.rotation.x = Math.PI / 2;
  }

  // luzes (emissivas — brilham com o bloom no PC)
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 5 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a10, emissiveIntensity: 5 });
  for (const sx of [-0.68, 0.68]) {
    add(new THREE.BoxGeometry(0.38, 0.1, 0.06), head, sx, 0.72, 2.2).rotation.x = -0.6;
    add(new THREE.BoxGeometry(0.45, 0.12, 0.05), tail, sx, 0.82, -2.21);
  }

  // chama do nitro
  const flame = add(
    new THREE.ConeGeometry(0.22, 1.4, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5ac8ff).multiplyScalar(4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    0,
    0.5,
    -3.0,
  );
  flame.rotation.x = -Math.PI / 2;
  flame.castShadow = false;
  flame.visible = false;

  // rodas: pneu com banda e flanco arredondados + aro cromado de 5 raios
  const tireGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.28, -0.22),
      new THREE.Vector2(0.44, -0.22),
      new THREE.Vector2(0.49, -0.16),
      new THREE.Vector2(0.5, 0),
      new THREE.Vector2(0.49, 0.16),
      new THREE.Vector2(0.44, 0.22),
      new THREE.Vector2(0.28, 0.22),
    ],
    24,
  );
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 });
  const rimGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.36, 20);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.06, 0.5, 0.07);
  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 1.02, 0.5, sz * 1.35);
      const w = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = shadows;
      w.add(tire, new THREE.Mesh(rimGeo, gunMetal));
      for (let k = 0; k < 5; k++) {
        const spoke = new THREE.Mesh(spokeGeo, chrome);
        spoke.position.x = sx * 0.19;
        spoke.rotation.x = (k / 5) * Math.PI;
        w.add(spoke);
      }
      pivot.add(w);
      body.add(pivot);
      wheels.push(w);
      if (sz > 0) frontWheels.push(pivot);
    }

  // cockpit: painel, volante, colunas e moldura do teto
  const cockpit = new THREE.Group();
  cockpit.visible = false;
  body.add(cockpit);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.85 });
  add(new THREE.BoxGeometry(1.6, 0.16, 0.5), dashMat, 0, 1.0, 0.1, cockpit).rotation.x = 0.15;
  add(new THREE.BoxGeometry(0.5, 0.12, 0.12), dashMat, 0, 1.1, -0.1, cockpit); // visor dos instrumentos
  const gaugeGeo = new THREE.CircleGeometry(0.045, 20);
  const gaugeA = new THREE.MeshBasicMaterial({ color: 0x3aff7a });
  const gaugeB = new THREE.MeshBasicMaterial({ color: 0xff8a3a });
  add(gaugeGeo, gaugeA, -0.1, 1.11, -0.17, cockpit).rotation.y = Math.PI;
  add(gaugeGeo, gaugeB, 0.1, 1.11, -0.17, cockpit).rotation.y = Math.PI;
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 1.06, -0.3);
  steeringWheel.rotation.x = -0.45;
  cockpit.add(steeringWheel);
  steeringWheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 28), trim));
  steeringWheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), trim));
  steeringWheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12).rotateX(Math.PI / 2), trim));
  // colunas A e moldura do teto (só do cockpit: mais altas que a cabine externa para não tapar a visão)
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(sx * 0.8, 1.0, 0.55);
    const b = new THREE.Vector3(sx * 0.74, 1.7, -0.2);
    const len = a.distanceTo(b);
    const pillar = add(new THREE.BoxGeometry(0.06, len, 0.08), trim, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, cockpit);
    pillar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    // painel interno da porta (esconde a lataria vista de dentro)
    add(new THREE.BoxGeometry(0.12, 0.28, 1.9), dashMat, sx * 0.86, 1.06, -0.45, cockpit);
  }
  add(new THREE.BoxGeometry(1.5, 0.06, 0.1), trim, 0, 1.7, -0.2, cockpit);
  // assoalho/banco escuros: escondem a lataria sob o piloto
  add(new THREE.BoxGeometry(1.6, 0.06, 1.6), dashMat, 0, 1.05, -0.6, cockpit);
  return { root, body, wheels, frontWheels, cabin: [cabin, roof], cockpit, steeringWheel, flame };
}
