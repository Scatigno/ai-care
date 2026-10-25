// Ponto de entrada do pacote separado avatar3d.js (ver scripts/build.mjs).
import { createAvatar3D, webglAvailable, MODELS } from './scene.js';

globalThis.AICareAvatar3D = { createAvatar3D, webglAvailable, MODELS };
