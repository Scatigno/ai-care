// Registro de telas. Os ids são simples (letras) para funcionar como
// âncoras de URL também dentro do Artifact.

import * as assistant from './assistant.js';
import * as menu from './menu.js';
import * as residents from './residents.js';
import * as memories from './memories.js';
import * as reminders from './reminders.js';
import * as shopping from './shopping.js';
import * as cameras from './cameras.js';
import * as emergency from './emergency.js';
import * as settings from './settings.js';
import * as features from './features.js';

// compact: aparece também na barra inferior (telas estreitas)
export const VIEWS = [
  { id: 'inicio', title: 'Assistente', icon: 'chat', nav: true, compact: true, module: assistant },
  { id: 'menu', title: 'Funcionalidades', navLabel: 'Menu', icon: 'grid', nav: true, compact: true, module: menu },
  { id: 'lembretes', title: 'Lembretes', icon: 'bell', nav: true, compact: true, module: reminders },
  { id: 'moradores', title: 'Moradores', icon: 'users', nav: true, compact: true, module: residents },
  { id: 'memorias', title: 'Memórias', icon: 'brain', nav: true, module: memories },
  { id: 'compras', title: 'Lista de compras', navLabel: 'Compras', icon: 'cart', nav: true, module: shopping },
  { id: 'cameras', title: 'Câmeras', icon: 'camera', nav: true, module: cameras },
  { id: 'emergencia', title: 'Emergência', icon: 'sos', nav: false, parent: 'menu', module: emergency },
  { id: 'recursos', title: 'Recursos', icon: 'info', nav: false, parent: 'menu', module: features },
  { id: 'configuracoes', title: 'Configurações', navLabel: 'Ajustes', icon: 'gear', nav: true, compact: true, module: settings },
];

export function findView(id) {
  return VIEWS.find((v) => v.id === id) || null;
}
