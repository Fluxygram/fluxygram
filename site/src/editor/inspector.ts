import { ArrowDown, ArrowLeftRight, ArrowUp, PinOff, Trash2 } from 'lucide';
import { ICON_NAMES, iconElement } from '@fluxygram/element';
import type { NodeKind } from '@fluxygram/core';
import { t } from '../i18n';
import { h, icon } from './dom';
import type { Model } from './model';

/** Panel de propiedades: el diagrama, o el nodo / conexión / capa seleccionados. */
export function renderInspector(root: HTMLElement, model: Model) {
  // No redibujar mientras se escribe en un campo del panel: se perdería el foco.
  if (root.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'INPUT') return;
  const sel = model.selection;
  root.replaceChildren(
    sel?.kind === 'node' ? nodePanel(model, sel.id) : sel?.kind === 'edge' ? edgePanel(model, sel.id) : sel?.kind === 'group' ? groupPanel(model, sel.id) : diagramPanel(model),
  );
}

/** Un campo de texto que guarda al terminar de escribir (un solo punto de deshacer por edición). */
function textField(label: string, value: string | undefined, onCommit: (v: string) => void, placeholder?: string) {
  let timer: number | undefined;
  const input = h('input', { type: 'text', value: value ?? '', placeholder });
  const commit = () => {
    clearTimeout(timer);
    if (input.value !== (value ?? '')) {
      value = input.value;
      onCommit(input.value.trim());
    }
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(commit, 500);
  });
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
  return h('label', { class: 'ed-field' }, h('span', {}, label), input);
}

function diagramPanel(model: Model) {
  const d = model.diagram;
  const box = h('div', {});
  box.append(h('h3', { class: 'ed-h' }, t('ed.diagram')));
  box.append(textField(t('ed.title'), d.title, (v) => model.change((x) => (v ? (x.title = v) : delete x.title)), t('ed.titlePh')));
  if (d.type === 'flow') {
    const dir = d.direction ?? 'LR';
    box.append(
      h('div', { class: 'ed-field' },
        h('span', {}, t('ed.direction')),
        h('div', { class: 'ed-seg' },
          ...(['LR', 'TB'] as const).map((v) =>
            h('button', {
              type: 'button',
              'aria-pressed': String(dir === v),
              onclick: () => model.change((x) => (v === 'LR' ? delete x.direction : (x.direction = v))),
            }, t(v === 'LR' ? 'ed.lr' : 'ed.tb')),
          ),
        ),
      ),
    );
  }
  box.append(h('p', { class: 'ed-tip' }, t('ed.tips')));
  return box;
}

function nodePanel(model: Model, id: string) {
  const n = model.node(id);
  if (!n) return h('div');
  const d = model.diagram;
  const box = h('div', {});
  box.append(h('h3', { class: 'ed-h' }, d.type === 'timeline' ? t('ed.add.milestone') : t('ed.node')));
  box.append(textField(t('ed.label'), n.label, (v) => v && model.updateNode(id, { label: v })));
  if (d.type === 'timeline') box.append(textField(t('ed.date'), n.date, (v) => model.updateNode(id, { date: v }), '2026'));
  box.append(textField(t('ed.desc'), n.description, (v) => model.updateNode(id, { description: v })));

  if (d.type === 'flow') {
    const kinds: [NodeKind, string][] = [['default', 'ed.kind.default'], ['decision', 'ed.add.decision'], ['start', 'ed.add.start'], ['end', 'ed.add.end']];
    box.append(
      h('div', { class: 'ed-field' },
        h('span', {}, t('ed.kind')),
        h('div', { class: 'ed-seg' },
          ...kinds.map(([k, label]) =>
            h('button', {
              type: 'button',
              'aria-pressed': String((n.kind ?? 'default') === k),
              onclick: () => model.updateNode(id, { kind: k === 'default' ? undefined : k }),
            }, t(label)),
          ),
        ),
      ),
    );
  }

  if (d.type === 'architecture' && d.groups?.length) {
    const select = h('select', { onchange: (e) => model.updateNode(id, { group: (e.target as HTMLSelectElement).value }) },
      ...d.groups.map((g) => h('option', { value: g.id, selected: g.id === n.group }, g.label)),
    );
    box.append(h('label', { class: 'ed-field' }, h('span', {}, t('ed.group')), select));
  }

  if (d.type !== 'timeline' && n.kind !== 'decision') {
    const grid = h('div', { class: 'ed-icons' });
    grid.append(h('button', { type: 'button', title: t('ed.noIcon'), 'aria-pressed': String(!n.icon), onclick: () => model.updateNode(id, { icon: undefined }) }, '—'));
    for (const name of ICON_NAMES) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const g = iconElement(name, 0, 0, 24);
      if (g) svg.append(g);
      grid.append(h('button', { type: 'button', title: name, 'aria-label': name, 'aria-pressed': String(n.icon === name), onclick: () => model.updateNode(id, { icon: name }) }, svg));
    }
    box.append(h('div', { class: 'ed-field' }, h('span', {}, t('ed.icon')), grid));
  }

  box.append(
    h('label', { class: 'ed-check' },
      h('input', { type: 'checkbox', checked: !!n.accent, onchange: (e) => model.updateNode(id, { accent: (e.target as HTMLInputElement).checked }) }),
      t('ed.accent'),
    ),
  );

  const row = h('div', { class: 'ed-row' });
  if (typeof n.x === 'number') {
    row.append(h('button', { type: 'button', class: 'ed-btn', onclick: () => model.updateNode(id, { x: undefined, y: undefined }) }, icon(PinOff, 14), ' ', t('ed.unpin')));
  }
  row.append(h('button', { type: 'button', class: 'ed-btn ed-danger', onclick: () => model.remove({ kind: 'node', id }) }, icon(Trash2, 14), ' ', t('ed.delete')));
  box.append(row);
  return box;
}

function edgePanel(model: Model, id: string) {
  const e = model.edge(id);
  if (!e) return h('div');
  const from = model.node(e.from)?.label ?? e.from;
  const to = model.node(e.to)?.label ?? e.to;
  const box = h('div', {});
  box.append(h('h3', { class: 'ed-h' }, t('ed.edge')));
  box.append(h('p', { class: 'ed-field' }, `${from}  →  ${to}`));
  box.append(textField(t('ed.edgeLabel'), e.label, (v) => model.updateEdge(id, { label: v })));
  box.append(textField(t('ed.carries'), e.carries, (v) => model.updateEdge(id, { carries: v }), t('ed.carriesPh')));
  box.append(
    h('div', { class: 'ed-row' },
      h('button', { type: 'button', class: 'ed-btn', onclick: () => model.updateEdge(id, { from: e.to, to: e.from }) }, icon(ArrowLeftRight, 14), ' ', t('ed.reverse')),
      h('button', { type: 'button', class: 'ed-btn ed-danger', onclick: () => model.remove({ kind: 'edge', id }) }, icon(Trash2, 14), ' ', t('ed.delete')),
    ),
  );
  return box;
}

function groupPanel(model: Model, id: string) {
  const g = model.group(id);
  if (!g) return h('div');
  const groups = model.diagram.groups ?? [];
  const i = groups.indexOf(g);
  const box = h('div', {});
  box.append(h('h3', { class: 'ed-h' }, t('ed.layer')));
  box.append(textField(t('ed.label'), g.label, (v) => v && model.updateGroup(id, { label: v })));
  box.append(
    h('div', { class: 'ed-row' },
      h('button', { type: 'button', class: 'ed-btn', disabled: i === 0, onclick: () => model.moveGroup(id, -1) }, icon(ArrowUp, 14), ' ', t('ed.up')),
      h('button', { type: 'button', class: 'ed-btn', disabled: i === groups.length - 1, onclick: () => model.moveGroup(id, 1) }, icon(ArrowDown, 14), ' ', t('ed.down')),
      h('button', { type: 'button', class: 'ed-btn ed-danger', disabled: groups.length < 2, onclick: () => model.remove({ kind: 'group', id }) }, icon(Trash2, 14), ' ', t('ed.delete')),
    ),
  );
  return box;
}
