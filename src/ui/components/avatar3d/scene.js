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
  female: { id: 'f002', label: 'Rocketbox Female_Adult_02' },
  male: { id: 'm014', label: 'Rocketbox Male_Adult_08' },
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
  scene.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0x8a7a70, 0.35));

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
    brow: 0, smile: 0.12, tilt: 0, nod: 0,
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
    const { id } = MODELS[g] || MODELS.female;
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
    key.target.position.copy(target); fill.target.position.copy(target); rim.target.position.copy(target);
    scene.add(key.target, fill.target, rim.target);
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
    anim.smile = damp(anim.smile, listening ? 0.28 : speaking ? 0.16 : 0.2, 3, dt);
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
    debug() { return { speaking: Boolean(speech), weights: { ...anim.weights } }; },
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
