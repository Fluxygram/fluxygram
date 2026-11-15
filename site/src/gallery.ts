import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { DIAGRAM_TYPES, type Diagram } from '@fluxygram/core';
import { exampleUrl, t } from './i18n';
import { encodeDiagram } from './editor/io';
import { h, icon } from './editor/dom';
import { thumbnail, TYPE_ICONS } from './thumbnail';
import './lang';
import { initSiteAccount } from './cloud';

void initSiteAccount(document.getElementById('account')!);

/** Galería de ejemplos: tarjetas con miniatura, filtros por tema y por tipo, y el diagrama animado al abrir una. */

type Theme = 'software' | 'work' | 'cooking' | 'games' | 'health' | 'history' | 'society' | 'travel' | 'nature';
interface Example {
  name: string;
  theme: Theme;
  diagram?: Diagram;
}

// Orden mezclado a propósito: la galería muestra variedad desde la primera fila.
const EXAMPLES: Example[] = [
  { name: 'how-it-works', theme: 'software' },
  { name: 'bread', theme: 'cooking' },
  { name: 'game', theme: 'games' },
  { name: 'architecture', theme: 'software' },
  { name: 'blood', theme: 'health' },
  { name: 'coffee', theme: 'history' },
  { name: 'order', theme: 'work' },
  { name: 'law', theme: 'society' },
  { name: 'trip', theme: 'travel' },
  { name: 'sequence', theme: 'software' },
  { name: 'animals', theme: 'nature' },
  { name: 'doctor', theme: 'health' },
  { name: 'mindmap', theme: 'work' },
  { name: 'cycle', theme: 'nature' },
  { name: 'tree', theme: 'work' },
  { name: 'web-history', theme: 'software' },
];
const THEMES: Theme[] = ['software', 'work', 'cooking', 'games', 'health', 'history', 'society', 'travel', 'nature'];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const grid = $('grid');
const count = $('count');
const typeSelect = $<HTMLSelectElement>('type');
let theme: Theme | 'all' = 'all';
let type: string = 'all';

/* ---------- Filtros ---------- */

const themeTabs = [
  h('button', { class: 'tab', role: 'tab', 'aria-selected': 'true', 'data-theme': 'all' }, t('gallery.all')),
  ...THEMES.map((th) => h('button', { class: 'tab', role: 'tab', 'aria-selected': 'false', 'data-theme': th }, t(`uses.${th}`))),
];
for (const tab of themeTabs) {
  tab.addEventListener('click', () => {
    for (const x of themeTabs) x.setAttribute('aria-selected', String(x === tab));
    theme = tab.dataset.theme as Theme | 'all';
    render();
  });
}
$('themes').replaceChildren(...themeTabs);
typeSelect.replaceChildren(
  h('option', { value: 'all' }, t('gallery.allTypes')),
  ...DIAGRAM_TYPES.map((ty) => h('option', { value: ty }, t(`type.${ty}`))),
);
typeSelect.onchange = () => {
  type = typeSelect.value;
  render();
};

/* ---------- Tarjetas ---------- */

function card(ex: Example) {
  const d = ex.diagram!;
  const thumb = h('div', { class: 'gal-thumb' });
  const svg = thumbnail(d);
  if (svg) thumb.append(svg);
  return h('li', {},
    h('button', { type: 'button', class: 'gal-card', onclick: () => void open(ex) },
      thumb,
      h('span', { class: 'gal-card-body' },
        h('strong', {}, d.title ?? ex.name),
        h('span', { class: 'gal-meta' },
          icon(TYPE_ICONS[d.type] ?? TYPE_ICONS.flow!, 13),
          t(`type.${d.type}`),
          h('span', { class: 'gal-theme' }, t(`uses.${ex.theme}`)),
        ),
      ),
    ),
  );
}

function render() {
  const shown = EXAMPLES.filter((ex) => ex.diagram && (theme === 'all' || ex.theme === theme) && (type === 'all' || ex.diagram.type === type));
  count.textContent = t('gallery.count', { n: String(shown.length) });
  grid.replaceChildren(...(shown.length ? shown.map(card) : [h('li', { class: 'gal-none' }, t('gallery.none'))]));
}

/* ---------- Ver un ejemplo ---------- */

const viewer = $('viewer');
const viewerDiagram = $<FluxyGram>('viewerDiagram');
let lastFocus: HTMLElement | null = null;

async function open(ex: Example) {
  const d = ex.diagram!;
  lastFocus = document.activeElement as HTMLElement | null;
  $('viewerTitle').textContent = d.title ?? ex.name;
  viewerDiagram.diagram = d;
  const code = await encodeDiagram(d);
  $<HTMLAnchorElement>('viewerPresent').href = `/present#d=${code}`;
  $<HTMLAnchorElement>('viewerEdit').href = `/play#d=${code}`;
  viewer.hidden = false;
  document.body.style.overflow = 'hidden';
  $('viewerClose').focus();
}
function close() {
  viewer.hidden = true;
  document.body.style.overflow = '';
  viewerDiagram.pause();
  lastFocus?.focus();
}
$('viewerClose').onclick = close;
viewer.addEventListener('click', (e) => e.target === viewer && close());
document.addEventListener('keydown', (e) => e.key === 'Escape' && !viewer.hidden && close());

/* ---------- Carga ---------- */

render();
await Promise.all(
  EXAMPLES.map(async (ex) => {
    try {
      ex.diagram = (await (await fetch(exampleUrl(ex.name))).json()) as Diagram;
    } catch {
      /* si un ejemplo no carga, la galería sigue con el resto */
    }
  }),
);
render();
