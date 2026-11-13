import { ArrowDown, ArrowLeftRight, ArrowUp, PinOff, Trash2 } from 'lucide';
import { ICON_GROUPS, iconElement } from '@fluxygram/element';

/** Categoría de íconos abierta: se recuerda mientras se edita, para no volver a buscarla en cada nodo. */
let iconCategory = 'all';

/** Selector de íconos: buscador + categorías + grilla. Filtra sin redibujar el panel. */
function iconPicker(current: string | undefined, onPick: (name: string | undefined) => void) {
  const search = h('input', { type: 'search', class: 'ed-icon-search', placeholder: t('ed.iconSearch'), 'aria-label': t('ed.iconSearch') });
  const cats = h('div', { class: 'ed-icon-cats' });
  const grid = h('div', { class: 'ed-icons' });
  const empty = h('p', { class: 'ed-icon-empty', hidden: true }, t('ed.iconNone'));

  const button = (name: string, category: string) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(k, v);
    const g = iconElement(name, 0, 0, 24);
    if (g) svg.append(g);
    const b = h('button', { type: 'button', title: name, 'aria-label': name, 'aria-pressed': String(current === name), onclick: () => onPick(name) }, svg);
    b.dataset.name = name;
    b.dataset.cat = category;
    return b;
  };

  grid.append(h('button', { type: 'button', title: t('ed.noIcon'), 'aria-pressed': String(!current), onclick: () => onPick(undefined) }, '—'));
  for (const [category, icons] of Object.entries(ICON_GROUPS)) for (const name of Object.keys(icons)) grid.append(button(name, category));

  const apply = () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const b of grid.querySelectorAll<HTMLButtonElement>('button[data-name]')) {
      const label = t(`icons.${b.dataset.cat}`).toLowerCase();
      const ok = q ? b.dataset.name!.includes(q) || label.includes(q) : iconCategory === 'all' || b.dataset.cat === iconCategory;
      b.hidden = !ok;
      if (ok) shown++;
    }
    empty.hidden = shown > 0;
    for (const c of cats.querySelectorAll<HTMLButtonElement>('button')) c.setAttribute('aria-pressed', String(!q && c.dataset.cat === iconCategory));
  };

  for (const category of ['all', ...Object.keys(ICON_GROUPS)]) {
    const c = h('button', { type: 'button', onclick: () => {
      iconCategory = category;
      search.value = '';
      apply();
    } }, t(`icons.${category}`));
    c.dataset.cat = category;
    cats.append(c);
  }
  search.addEventListener('input', apply);
  apply();
  return h('div', { class: 'ed-icon-picker' }, search, cats, grid, empty);
}
import { DIAGRAM_TYPES, ENTER_STYLES, TRAVEL_STYLES, type DiagramType, type EnterStyle, type NodeKind, type TravelStyle } from '@fluxygram/core';
import { t } from '../i18n';
import { h, icon } from './dom';
import type { Model } from './model';
import { segment } from './segment';

/** Panel de propiedades: el diagrama, o el nodo / conexión / capa seleccionados. */
export function renderInspector(root: HTMLElement, model: Model) {
  // No redibujar mientras se escribe en un campo del panel: se perdería el foco.
  if (root.contains(document.activeElement) && ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement).tagName)) return;
  const sel = model.selection;
  root.replaceChildren(
    model.step !== null && model.diagram.steps?.[model.step] ? stepPanel(model, model.step) : sel?.kind === 'node' ? nodePanel(model, sel.id) : sel?.kind === 'edge' ? edgePanel(model, sel.id) : sel?.kind === 'group' ? groupPanel(model, sel.id) : diagramPanel(model),
  );
}

/** Un área de texto que guarda al terminar de escribir. */
function areaField(label: string, value: string | undefined, onCommit: (v: string) => void, opts: { placeholder?: string; hint?: string; rows?: number; cls?: string } = {}) {
  let timer: number | undefined;
  const area = h('textarea', { rows: opts.rows ?? 3, placeholder: opts.placeholder, class: opts.cls });
  area.value = value ?? '';
  const commit = () => {
    clearTimeout(timer);
    if (area.value.trim() !== (value ?? '')) {
      value = area.value.trim();
      onCommit(area.value.trim());
    }
  };
  area.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(commit, 700);
  });
  area.addEventListener('blur', commit);
  return h('label', { class: 'ed-field' }, h('span', {}, label), area, opts.hint ? h('small', { class: 'ed-field-hint' }, opts.hint) : false);
}

/** El paso seleccionado: lo que ve el público, las notas del presentador y cuánto dura. */
function stepPanel(model: Model, i: number) {
  const step = model.diagram.steps![i]!;
  const box = h('div', {});
  box.append(h('h3', { class: 'ed-h' }, t('ed.step', { n: String(i + 1) })));
  box.append(areaField(t('ed.captionLabel'), step.caption, (v) => model.setCaption(v), { placeholder: t('ed.caption'), hint: t('ed.captionHint'), rows: 2 }));
  box.append(areaField(t('ed.notes'), step.notes, (v) => model.setNotes(v), { placeholder: t('ed.notesPh2'), hint: t('ed.notesHint'), rows: 6, cls: 'ed-notes-area' }));

  const fallback = model.diagram.motion?.hold;
  const seconds = h('input', {
    type: 'number', min: 0.5, max: 60, step: 0.5, value: step.duration ?? '',
    placeholder: fallback ? String(fallback) : t('ed.auto.short'),
  });
  seconds.addEventListener('change', () => {
    const v = Number(seconds.value);
    model.setStepDuration(v >= 0.5 && v <= 60 ? v : undefined);
  });
  box.append(h('label', { class: 'ed-field ed-field-inline' }, h('span', {}, t('ed.stepSeconds')), h('span', { class: 'ed-seconds-wrap' }, seconds, h('span', {}, 's'))));
  box.append(h('p', { class: 'ed-tip' }, t('ed.stepPanelTip')));
  return box;
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
  box.append(selectField<DiagramType>(t('ed.type'), d.type, DIAGRAM_TYPES, (v) => t(`type.${v}`), (v) => {
    if (!v || v === d.type) return;
    model.setType(v);
    document.dispatchEvent(new CustomEvent('ed:type-changed', { detail: v }));
  }));
  if (d.type === 'flow') {
    const dir = d.direction ?? 'LR';
    box.append(
      h('div', { class: 'ed-field' },
        h('span', {}, t('ed.direction')),
        segment(
          'direction',
          (['LR', 'TB'] as const).map((v) => ({ value: v, label: t(v === 'LR' ? 'ed.lr' : 'ed.tb') })),
          dir,
          (v) => model.change((x) => (v === 'LR' ? delete x.direction : (x.direction = v as 'TB'))),
          t('ed.direction'),
        ),
      ),
    );
  }
  box.append(motionPanel(model));
  box.append(h('p', { class: 'ed-tip' }, t('ed.tips')));
  return box;
}

/** Un selector compacto. `inherit` agrega la opción "Como el diagrama" (valor vacío). */
function selectField<T extends string>(label: string, value: T | undefined, options: readonly T[], labelOf: (v: T) => string, onChange: (v: T | undefined) => void, inherit = false) {
  const select = h('select', { onchange: (e) => onChange(((e.target as HTMLSelectElement).value || undefined) as T | undefined) },
    ...(inherit ? [h('option', { value: '', selected: !value }, t('ed.inherit'))] : []),
    ...options.map((o) => h('option', { value: o, selected: value === o }, labelOf(o))),
  );
  return h('label', { class: 'ed-field' }, h('span', {}, label), select);
}

function segField<T extends string>(label: string, value: T, options: readonly T[], labelOf: (v: T) => string, onChange: (v: T) => void) {
  return h('div', { class: 'ed-field' },
    h('span', {}, label),
    segment(`field:${label}`, options.map((o) => ({ value: o, label: labelOf(o) })), value, (v) => onChange(v as T), label),
  );
}

function motionPanel(model: Model) {
  const m = model.diagram.motion ?? {};
  const finale = m.finale ?? model.diagram.finale ?? true;
  return h('div', { class: 'ed-section' },
    h('h3', { class: 'ed-h' }, t('ed.motion')),
    selectField(t('ed.enter'), m.enter ?? 'fade', ENTER_STYLES, (v) => t(`enter.${v}`), (v) => model.setMotion({ enter: v === 'fade' ? undefined : v })),
    selectField(t('ed.travel'), m.travel ?? 'particle', TRAVEL_STYLES, (v) => t(`travel.${v}`), (v) => model.setMotion({ travel: v === 'particle' ? undefined : v })),
    segField(t('ed.speed'), m.speed ?? 'normal', ['slow', 'normal', 'fast'] as const, (v) => t(`speed.${v}`), (v) => model.setMotion({ speed: v === 'normal' ? undefined : v })),
    h('label', { class: 'ed-field' },
      h('span', {}, t('ed.hold')),
      h('select', { onchange: (e) => {
        const v = Number((e.target as HTMLSelectElement).value);
        model.setMotion({ hold: v || undefined });
      } },
        h('option', { value: '', selected: !m.hold }, t('ed.holdAuto')),
        ...[2, 3, 4, 5, 7, 10].map((s) => h('option', { value: String(s), selected: m.hold === s }, t('ed.seconds', { n: String(s) }))),
      ),
    ),
    segField(t('ed.camera'), m.camera ?? 'follow', ['follow', 'fixed'] as const, (v) => t(`camera.${v}`), (v) => model.setMotion({ camera: v === 'follow' ? undefined : v })),
    h('label', { class: 'ed-check' },
      h('input', { type: 'checkbox', checked: finale, onchange: (e) => model.setMotion({ finale: (e.target as HTMLInputElement).checked ? undefined : false }) }),
      t('ed.finale'),
    ),
    h('button', { type: 'button', class: 'ed-btn', onclick: () => document.getElementById('preview')?.click() }, t('ed.preview')),
  );
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

  if (d.type !== 'timeline' && d.type !== 'sequence') {
    const kinds: [NodeKind, string][] =
      d.type === 'flow'
        ? [['default', 'ed.kind.default'], ['decision', 'ed.add.decision'], ['start', 'ed.add.start'], ['end', 'ed.add.end'], ['data', 'ed.add.data'], ['database', 'ed.add.database'], ['note', 'ed.add.note']]
        : [['default', 'ed.kind.default'], ['database', 'ed.add.database'], ['note', 'ed.add.note']];
    const select = h('select', {
      onchange: (e) => {
        const k = (e.target as HTMLSelectElement).value as NodeKind;
        model.updateNode(id, { kind: k === 'default' ? undefined : k });
      },
    }, ...kinds.map(([k, label]) => h('option', { value: k, selected: (n.kind ?? 'default') === k }, t(label))));
    box.append(h('label', { class: 'ed-field' }, h('span', {}, t('ed.kind')), select));
  }

  if (d.type === 'architecture' && d.groups?.length) {
    const select = h('select', { onchange: (e) => model.updateNode(id, { group: (e.target as HTMLSelectElement).value }) },
      ...d.groups.map((g) => h('option', { value: g.id, selected: g.id === n.group }, g.label)),
    );
    box.append(h('label', { class: 'ed-field' }, h('span', {}, t('ed.group')), select));
  }

  if (d.type !== 'timeline' && n.kind !== 'decision') {
    box.append(h('div', { class: 'ed-field' }, h('span', {}, t('ed.icon')), iconPicker(n.icon, (name) => model.updateNode(id, { icon: name }))));
  }

  box.append(selectField<EnterStyle>(t('ed.enterNode'), n.enter, ENTER_STYLES, (v) => t(`enter.${v}`), (v) => model.updateNode(id, { enter: v }), true));

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
  box.append(selectField<TravelStyle>(t('ed.travel'), e.travel, TRAVEL_STYLES, (v) => t(`travel.${v}`), (v) => model.updateEdge(id, { travel: v }), true));
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
