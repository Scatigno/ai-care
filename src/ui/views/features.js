// Tela "O que já funciona": transparência sobre cada recurso.

import { h } from '../../core/dom.js';
import { statusTag, viewHeader } from '../components/common.js';
import { FEATURES, STATUS } from '../../data/features.js';

export function render() {
  const order = ['real', 'demo', 'planned'];
  return h('div', { class: 'page' },
    viewHeader('O que já funciona', { subtitle: 'Situação de cada recurso nesta versão de teste (v0.1).' }),
    h('div', { class: 'legend' }, order.map((s) => h('div', { class: 'legend-item' }, statusTag(s), h('span', {}, STATUS[s].description)))),
    order.map((s) => h('section', { class: 'panel' },
      h('h2', { class: 'panel-title' }, STATUS[s].label, h('span', { class: 'count' }, String(FEATURES.filter((f) => f.status === s).length))),
      h('ul', { class: 'feature-list' }, FEATURES.filter((f) => f.status === s).map((f) => h('li', { class: 'feature' },
        h('div', { class: 'feature-head' }, h('strong', {}, f.name), h('span', { class: 'feature-phase' }, `Fase ${f.phase}`)),
        f.detail ? h('p', {}, f.detail) : null,
        f.dependency ? h('p', { class: 'feature-dep' }, h('span', {}, 'Depende de: '), f.dependency) : null))))));
}
