// Avatar humano em 3D (WebGL, three.js), com sincronização labial pelo
// texto falado, piscar, respiração e pequenos movimentos de cabeça e olhar.
//
// Modelos: Microsoft Rocketbox (licença MIT), convertidos para GLB com as
// formas faciais (blendshapes) de boca, olhos e sobrancelhas. Ver
// public/avatars/LICENSE-Rocketbox.md e scripts/avatar/.
//
// Este módulo é carregado sob demanda (arquivo avatar3d.js no build), só
// quando o avatar 3D está ligado e o aparelho tem WebGL.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildTimeline, sampleTimeline, timeAtChar, VISEMES } from '../../../services/lipsync.js';

export const MODELS = {
  female: { id: 'f008', label: 'Rocketbox Female_Adult_08 (visual Clara)', look: 'clara' },
  male: { id: 'm014', label: 'Rocketbox Male_Adult_08' },
};

// Ajustes de visual aplicados por cima do modelo, em centímetros no espaço
// do mundo com o modelo em pose de repouso. Personagem original no estilo
// pedido pelo proprietário (cabelo escuro com pontas acobreadas, óculos,
// gola alta preta); as texturas vêm de scripts/avatar/style_f008.py.
const LOOKS = {
  clara: {
    // Cor do cabelo por altura: raiz escura, pontas acobreadas.
    hair: { top: 166, bottom: 141, root: [0.13, 0.075, 0.06], tip: [0.78, 0.25, 0.08] },
    // Pescoço abaixo desta altura vira a gola alta da blusa.
    collar: { below: 149.6, fade: 0.7, color: 0x111113, lift: 0.45 },
    glasses: {
      x: 3.2, y: 160.9, z: 6.45, w: 4.6, h: 3.5, rim: 0.34, wrap: 0.17,
      earX: 8.3, earY: 161.0, earZ: -3.5, color: 0x3c121a,
    },
    // Luz de recorte em duas cores (verde-azulada à esquerda, âmbar à direita).
    rim: [0x5fd6c8, 0xff8a3d],
  },
};

const VISEME_MORPH = {
  sil: 'AA_VI_00_Sil', PP: 'AA_VI_01_PP', FF: 'AA_VI_02_FF', TH: 'AA_VI_03_TH', DD: 'AA_VI_04_DD',
  kk: 'AA_VI_05_KK', CH: 'AA_VI_06_CH', SS: 'AA_VI_07_SS', nn: 'AA_VI_08_nn', RR: 'AA_VI_09_RR',
  aa: 'AA_VI_10_aa', E: 'AA_VI_11_E', I: 'AA_VI_12_I', O: 'AA_VI_13_O', U: 'AA_VI_14_U',
};

const loaders = new Map();
function gltfLoader() {
  if (!loaders.has('gltf')) {
    const l = new GLTFLoader();
    l.setMeshoptDecoder(MeshoptDecoder);
    loaders.set('gltf', l);
  }
  return loaders.get('gltf');
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
// Ruído suave (soma de senos) para movimentos ociosos.
const wave = (t, seed) => Math.sin(t * 0.31 + seed) * 0.6 + Math.sin(t * 0.73 + seed * 2.1) * 0.3 + Math.sin(t * 1.37 + seed * 3.7) * 0.1;

// O Artifact do claude.ai não serve arquivos .glb; lá o modelo vai em um
// .json com o binário em base64 (gerado por scripts/build.mjs).
async function loadGltf(dir) {
  if (document.documentElement.dataset.build !== 'artifact') return gltfLoader().loadAsync(`${dir}model.glb`);
  const res = await fetch(`${dir}model.glb.json`);
  if (!res.ok) throw new Error(`model.glb.json: HTTP ${res.status}`);
  const { b64 } = await res.json();
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return gltfLoader().parseAsync(bytes.buffer, dir);
}

async function loadModel(base, id, maxAniso) {
  const dir = `${base}${id}/`;
  const tex = new THREE.TextureLoader();
  const load = (file, color) => tex.loadAsync(dir + file).then((t) => {
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(4, maxAniso);
    return t;
  });
  const [gltf, head, body, headN, bodyN, hair] = await Promise.all([
    loadGltf(dir),
    load('head.jpg', true), load('body.jpg', true), load('head_n.jpg'), load('body_n.jpg'), load('hair.webp', true),
  ]);
  const root = gltf.scene;
  let mesh = null;
  root.traverse((o) => {
    if (o.isSkinnedMesh || (o.isMesh && o.morphTargetDictionary)) mesh = mesh || o;
  });
  // O GLB pode dividir a malha em várias primitivas (uma por material).
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    const mats = [].concat(m.material).map((mat) => {
      const n = mat.name || '';
      if (/head/.test(n)) {
        return new THREE.MeshStandardMaterial({ name: n, map: head, normalMap: headN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.58, metalness: 0 });
      }
      if (/opacity/.test(n)) {
        return new THREE.MeshStandardMaterial({ name: n, map: hair, alphaTest: 0.35, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.7, metalness: 0 });
      }
      return new THREE.MeshStandardMaterial({ name: n, map: body, normalMap: bodyN, roughness: 0.78, metalness: 0 });
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
    m.frustumCulled = false;
  }
  return { root, meshes };
}

// Posição de cada vértice já deformada pelo esqueleto, no mundo (cm).
function worldVertices(mesh) {
  mesh.updateMatrixWorld(true);
  mesh.skeleton?.update();
  const n = mesh.geometry.attributes.position.count;
  const out = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    if (mesh.isSkinnedMesh) mesh.getVertexPosition(i, v); else v.fromBufferAttribute(mesh.geometry.attributes.position, i);
    v.applyMatrix4(mesh.matrixWorld);
    v.toArray(out, i * 3);
  }
  return out;
}

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Cabelo: cor por vértice (a textura é em tons de cinza).
function tintHair(mesh, hair) {
  const p = worldVertices(mesh);
  const n = p.length / 3;
  const col = new Float32Array(n * 3);
  const root = new THREE.Color().setRGB(...hair.root);
  const tip = new THREE.Color().setRGB(...hair.tip);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    c.copy(root).lerp(tip, smooth(hair.top, hair.bottom, p[i * 3 + 1]) ** 1.3);
    c.toArray(col, i * 3);
  }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const m of [].concat(mesh.material)) { m.vertexColors = true; m.needsUpdate = true; }
}

// Gola alta: pinta de malha preta o pescoço abaixo do queixo e o afasta um
// pouco da pele, para ter volume.
function addCollar(mesh, collar) {
  const p = worldVertices(mesh);
  const pos = mesh.geometry.attributes.position;
  const n = pos.count;
  const mask = new Float32Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    mask[i] = 1 - smooth(collar.below - collar.fade, collar.below, p[i * 3 + 1]);
    any ||= mask[i] > 0;
  }
  if (!any) return;
  // Escala entre o espaço do objeto (modelo quantizado) e centímetros.
  const a = new THREE.Vector3().fromBufferAttribute(pos, 0);
  let k = 1;
  for (let i = 1; i < n; i++) {
    const b = new THREE.Vector3().fromBufferAttribute(pos, i);
    const dObj = a.distanceTo(b);
    if (dObj > 1e-4) {
      const dW = Math.hypot(p[i * 3] - p[0], p[i * 3 + 1] - p[1], p[i * 3 + 2] - p[2]);
      if (dW > 5) { k = dW / dObj; break; }
    }
  }
  mesh.geometry.setAttribute('collar', new THREE.BufferAttribute(mask, 1));
  const color = new THREE.Color(collar.color);
  for (const m of [].concat(mesh.material)) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.collarColor = { value: color };
      sh.uniforms.collarLift = { value: collar.lift / k };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float collar;\nvarying float vCollar;\nuniform float collarLift;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCollar = collar;\ntransformed += normalize(objectNormal) * collar * collarLift;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCollar;\nuniform vec3 collarColor;')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, collarColor * (0.8 + 0.4 * dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))), vCollar);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.8, vCollar);');
    };
    m.customProgramCacheKey = () => 'collar';
    m.needsUpdate = true;
  }
}

// Óculos de acetato vinho, presos ao osso da cabeça.
function makeGlasses(g) {
  const group = new THREE.Group();
  group.name = 'glasses';
  const frameMat = new THREE.MeshPhysicalMaterial({ color: g.color, roughness: 0.38, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.6,
  });
  // Contorno levemente "gatinho": topo reto e mais alto por fora, base arredondada.
  const shape = (w, h, rt, rb, lift) => {
    const s = new THREE.Shape();
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    s.moveTo(x0 + rb, y0);
    s.lineTo(x1 - rb, y0);
    s.quadraticCurveTo(x1, y0, x1, y0 + rb);
    s.lineTo(x1, y1 - rt + lift);
    s.quadraticCurveTo(x1, y1 + lift, x1 - rt, y1 + lift * 0.7);
    s.lineTo(x0 + rt, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - rt);
    s.lineTo(x0, y0 + rb);
    s.quadraticCurveTo(x0, y0, x0 + rb, y0);
    return s;
  };
  for (const side of [1, -1]) {
    const lens = new THREE.Group();
    const inner = shape(g.w, g.h, 0.8, 1.7, 0.2);
    const outer = shape(g.w + g.rim * 2, g.h + g.rim * 2, 0.8 + g.rim, 1.7 + g.rim, 0.35);
    outer.holes.push(inner);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, {
      depth: 0.32, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, curveSegments: 12,
    }), frameMat);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(inner, 12), lensMat);
    glass.position.z = 0.16;
    glass.renderOrder = 2;
    lens.add(frame, glass);
    if (side < 0) lens.scale.x = -1; // espelha o formato para o outro olho
    lens.position.set(side * g.x, g.y, g.z);
    lens.rotation.y = side * g.wrap;
    group.add(lens);
  }
  const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), 24, r, 8, false), frameMat);
  const innerX = g.x - g.w / 2 - g.rim * 0.6;
  // Ponte sobre o nariz.
  group.add(tube([[-innerX, g.y + 0.55, g.z + 0.12], [0, g.y + 0.95, g.z + 0.3], [innerX, g.y + 0.55, g.z + 0.12]], 0.2));
  // Hastes até as orelhas.
  const outX = g.x + (g.w / 2 + g.rim) * Math.cos(g.wrap);
  const outZ = g.z - (g.w / 2 + g.rim) * Math.sin(g.wrap) + 0.15;
  for (const side of [1, -1]) {
    group.add(tube([
      [side * (outX - 0.1), g.y + 0.9, outZ], [side * (g.earX - 0.25), g.y + 0.7, outZ - 3.5],
      [side * g.earX, g.earY, g.earZ], [side * (g.earX - 0.6), g.earY - 1.4, g.earZ - 1.8],
    ], 0.17));
  }
  return group;
}

function applyLook(model, look, head) {
  if (!look) return;
  for (const m of model.meshes) {
    const names = [].concat(m.material).map((x) => x.name).join(' ');
    if (look.hair && /opacity/.test(names)) tintHair(m, look.hair);
    if (look.collar && /head/.test(names)) addCollar(m, look.collar);
  }
  if (look.glasses && head) {
    model.root.updateMatrixWorld(true);
    head.attach(makeGlasses(look.glasses));
  }
}

// Gira um osso em torno de um eixo do mundo (independe da orientação local).
function rotateWorld(bone, axis, angle) {
  bone.updateWorldMatrix(true, false);
  const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
  const target = new THREE.Quaternion().setFromAxisAngle(axis, angle).multiply(boneQ);
  bone.quaternion.copy(parentQ.invert().multiply(target));
  bone.updateMatrixWorld(true);
}

export async function createAvatar3D({ gender = 'female', base = 'public/avatars/', container, still = false, onReady, onError } = {}) {
  const el = document.createElement('div');
  el.className = 'avatar3d';
  const canvas = document.createElement('canvas');
  canvas.className = 'avatar3d-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  el.append(canvas);
  container?.append(el);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const key = new THREE.DirectionalLight(0xfff1e6, 2.1);
  const fill = new THREE.DirectionalLight(0xe6f0ff, 0.7);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4);
  // Recortes coloridos atrás da personagem (só nos visuais que pedem).
  const rimL = new THREE.DirectionalLight(0xffffff, 0);
  const rimR = new THREE.DirectionalLight(0xffffff, 0);
  scene.add(key, fill, rim, rimL, rimR, new THREE.HemisphereLight(0xffffff, 0x8a7a70, 0.35));

  const camera = new THREE.PerspectiveCamera(18, 1, 1, 2000);

  let model = null;
  let rig = null;
  let gender_ = gender;
  let state = 'idle';
  let speech = null; // { timeline, start }
  let raf = 0;
  let last = 0;
  let visible = true;
  let destroyed = false;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const anim = {
    blinkAt: 0, blink: 0, blinking: 0,
    gaze: new THREE.Vector2(), gazeTarget: new THREE.Vector2(), gazeAt: 0,
    brow: 0, smile: 0.26, tilt: 0, nod: 0,
    weights: {},
  };

  function morphIndex(name) {
    const out = [];
    for (const m of model.meshes) {
      const i = m.morphTargetDictionary?.[name];
      if (i !== undefined) out.push([m, i]);
    }
    return out;
  }

  function setMorph(name, value) {
    for (const [m, i] of rig.morph[name] || []) m.morphTargetInfluences[i] = value;
  }

  async function mount(g) {
    const { id, look: lookName } = MODELS[g] || MODELS.female;
    const look = LOOKS[lookName];
    const next = await loadModel(base, id, renderer.capabilities.getMaxAnisotropy());
    if (destroyed) return;
    if (model) {
      scene.remove(model.root);
      model.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach((m) => m.dispose()); } });
    }
    model = next;
    scene.add(model.root);
    const bone = (n) => model.root.getObjectByName(n);
    rig = {
      head: bone('Bip01_Head'), neck: bone('Bip01_Neck'), spine: bone('Bip01_Spine2'),
      lEye: bone('Bip01_LEye'), rEye: bone('Bip01_REye'),
      lArm: bone('Bip01_L_UpperArm'), rArm: bone('Bip01_R_UpperArm'),
      lFore: bone('Bip01_L_Forearm'), rFore: bone('Bip01_R_Forearm'),
      morph: {},
    };
    const names = [...Object.values(VISEME_MORPH), 'AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight', 'AK_03_BrowInnerUp',
      'AK_04_BrowOuterUpLeft', 'AK_05_BrowOuterUpRight', 'AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight',
      'AK_19_EyeSquintLeft', 'AK_20_EyeSquintRight', 'AK_25_JawOpen'];
    for (const n of names) rig.morph[n] = morphIndex(n);

    applyLook(model, look, rig.head);
    rimL.color.set(look?.rim?.[0] ?? 0xffffff);
    rimR.color.set(look?.rim?.[1] ?? 0xffffff);
    rimL.intensity = look?.rim ? 2.6 : 0;
    rimR.intensity = look?.rim ? 3.2 : 0;
    rim.intensity = look?.rim ? 0.6 : 1.4;
    el.dataset.look = lookName || '';
    relaxPose();
    for (const b of ['head', 'neck', 'spine', 'lEye', 'rEye']) if (rig[b]) rig[b].userData.rest = rig[b].quaternion.clone();
    frame();
  }

  // Braços abaixados (o modelo vem de braços abertos).
  function relaxPose() {
    model.root.updateMatrixWorld(true);
    const head = rig.head.getWorldPosition(new THREE.Vector3());
    const l = rig.lArm.getWorldPosition(new THREE.Vector3());
    const forward = new THREE.Vector3(0, 0, 1);
    // Lado do braço esquerdo em relação à cabeça decide o sentido da rotação.
    const sL = Math.sign(l.x - head.x) || 1;
    rotateWorld(rig.lArm, forward, -sL * THREE.MathUtils.degToRad(72));
    rotateWorld(rig.rArm, forward, sL * THREE.MathUtils.degToRad(72));
    if (rig.lFore) rotateWorld(rig.lFore, new THREE.Vector3(1, 0, 0), -0.25);
    if (rig.rFore) rotateWorld(rig.rFore, new THREE.Vector3(1, 0, 0), -0.25);
  }

  // Enquadra cabeça e ombros.
  function frame() {
    if (!model) return;
    model.root.updateMatrixWorld(true);
    const head = rig.head.getWorldPosition(new THREE.Vector3());
    const w = el.clientWidth || 300;
    const hgt = el.clientHeight || 300;
    camera.aspect = w / hgt;
    // Altura visível ~ 62 cm (cabeça e ombros), ajustada ao formato da área.
    const visibleH = 60 * Math.max(1, 0.85 / camera.aspect);
    const dist = visibleH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const target = new THREE.Vector3(head.x, head.y - 1, head.z);
    camera.position.set(target.x, target.y + 3, target.z + dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    key.position.set(target.x - 60, target.y + 80, target.z + 120);
    fill.position.set(target.x + 90, target.y + 10, target.z + 80);
    rim.position.set(target.x + 40, target.y + 60, target.z - 120);
    rimL.position.set(target.x - 110, target.y + 30, target.z - 70);
    rimR.position.set(target.x + 110, target.y + 10, target.z - 60);
    for (const l of [key, fill, rim, rimL, rimR]) { l.target.position.copy(target); scene.add(l.target); }
    renderer.setSize(w, hgt, false);
  }

  function update(dt, t) {
    if (!rig) return;
    // ---- Boca ----
    let target = {};
    if (speech) {
      const now = performance.now() - speech.start;
      target = sampleTimeline(speech.timeline, now);
      if (now > speech.timeline.duration + 250 && !speech.open) speech = null;
    }
    let mouthOpen = 0;
    for (const v of VISEMES) {
      const goal = target[v] || 0;
      const cur = damp(anim.weights[v] || 0, goal, goal > (anim.weights[v] || 0) ? 28 : 18, dt);
      anim.weights[v] = cur;
      if (v !== 'sil') setMorph(VISEME_MORPH[v], cur);
      if (v === 'aa' || v === 'O' || v === 'E') mouthOpen = Math.max(mouthOpen, cur);
    }

    // ---- Piscar ----
    if (t > anim.blinkAt && !still) {
      anim.blinking = 1;
      anim.blinkAt = t + rnd(2.2, 5.5) + (Math.random() < 0.15 ? -1.8 : 0);
    }
    if (anim.blinking) {
      anim.blink += dt / 0.07;
      if (anim.blink >= 2) { anim.blink = 0; anim.blinking = 0; }
    }
    const b = anim.blinking ? (anim.blink < 1 ? anim.blink : 2 - anim.blink) : 0;
    // Pálpebra superior levemente baixa em repouso: olhar mais natural.
    const lid = 0.12 + b * 0.88;
    setMorph('AK_09_EyeBlinkLeft', lid);
    setMorph('AK_10_EyeBlinkRight', lid);

    // ---- Expressão por estado ----
    const listening = state === 'listening';
    const thinking = state === 'thinking';
    const speaking = state === 'speaking' || Boolean(speech);
    anim.brow = damp(anim.brow, listening ? 0.35 : thinking ? 0.25 : speaking ? 0.04 + mouthOpen * 0.1 : 0, 6, dt);
    anim.smile = damp(anim.smile, listening ? 0.32 : speaking ? 0.18 : 0.26, 3, dt);
    anim.tilt = damp(anim.tilt, listening ? 0.07 : 0, 3, dt);
    setMorph('AK_03_BrowInnerUp', anim.brow);
    setMorph('AK_04_BrowOuterUpLeft', anim.brow * 0.5);
    setMorph('AK_05_BrowOuterUpRight', anim.brow * 0.5);
    setMorph('AK_44_MouthSmileLeft', anim.smile);
    setMorph('AK_45_MouthSmileRight', anim.smile);
    setMorph('AK_19_EyeSquintLeft', anim.smile * 0.6);
    setMorph('AK_20_EyeSquintRight', anim.smile * 0.6);

    // ---- Olhar: pequenas sacadas, mirando a câmera ----
    if (t > anim.gazeAt && !still) {
      anim.gazeAt = t + (thinking ? rnd(0.8, 1.6) : rnd(0.6, 2.8));
      anim.gazeTarget.set(thinking ? rnd(0.1, 0.18) : rnd(-0.05, 0.05), thinking ? rnd(0.08, 0.14) : rnd(-0.03, 0.03));
    }
    anim.gaze.x = damp(anim.gaze.x, anim.gazeTarget.x, 25, dt);
    anim.gaze.y = damp(anim.gaze.y, anim.gazeTarget.y, 25, dt);
    for (const eye of [rig.lEye, rig.rEye]) {
      if (!eye) continue;
      eye.quaternion.copy(eye.userData.rest);
      eye.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), anim.gaze.x);
      eye.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), -anim.gaze.y);
    }

    // ---- Cabeça e respiração ----
    const amp = still ? 0 : reduced ? 0.3 : 1;
    const yaw = wave(t, 1.3) * 0.045 * amp;
    const pitch = wave(t, 4.1) * 0.025 * amp + (speaking ? mouthOpen * 0.025 : 0) + (listening ? -0.02 : 0);
    const roll = wave(t, 7.7) * 0.02 * amp + anim.tilt;
    rig.head.quaternion.copy(rig.head.userData.rest);
    rig.head.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), yaw);
    rig.head.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), pitch);
    rig.head.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), roll);
    if (rig.spine) {
      rig.spine.quaternion.copy(rig.spine.userData.rest);
      rig.spine.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.sin(t * 1.25) * 0.012 * amp);
    }
  }

  function tick(now) {
    raf = 0;
    if (destroyed || !visible) return;
    const t = now / 1000;
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    update(dt, t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (!raf && !destroyed && visible && model) { last = 0; raf = requestAnimationFrame(tick); }
  }

  const ro = new ResizeObserver(() => { frame(); if (model) renderer.render(scene, camera); });
  ro.observe(el);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting) && document.visibilityState !== 'hidden';
    if (visible) start();
  });
  io.observe(el);
  const onVis = () => { visible = document.visibilityState !== 'hidden'; if (visible) start(); };
  document.addEventListener('visibilitychange', onVis);

  const api = {
    el,
    get gender() { return gender_; },
    get ready() { return Boolean(model); },
    async setGender(g) {
      if (g === gender_) return;
      gender_ = g;
      try { await mount(g); el.dataset.gender = g; } catch (err) { onError?.(err); }
    },
    setState(s) { state = s; if (s !== 'speaking' && speech) speech.open = false; },
    // Começa a mexer a boca para este texto, na velocidade da voz.
    speak(text, { rate = 1 } = {}) {
      speech = { timeline: buildTimeline(text, { rate }), start: performance.now(), open: true };
    },
    // O navegador avisou que a palavra no caractere ci começou agora.
    boundary(ci) {
      if (!speech) return;
      speech.start = performance.now() - timeAtChar(speech.timeline, ci);
    },
    stopSpeaking() { speech = null; },
    // Para testes: pesos atuais dos visemas e se há fala em curso.
    debug() { return { speaking: Boolean(speech), weights: { ...anim.weights }, glasses: Boolean(model?.root.getObjectByName('glasses')) }; },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (model) model.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach((m) => { m.map?.dispose(); m.normalMap?.dispose(); m.dispose(); }); } });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };

  try {
    await mount(gender_);
    el.dataset.gender = gender_;
    el.dataset.ready = 'true';
    start();
    onReady?.(api);
  } catch (err) {
    api.destroy();
    throw err;
  }
  return api;
}
