import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { DIAGRAM_TYPES, type Diagram } from '@fluxygram/core';
import { examplePage, exampleUrl, t } from './i18n';
import examples from './examples.json';
import { mountLive, type Live } from './live-demo';
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
  /** Ejemplo del modo seguimiento: se abre con controles para avanzar el proceso. */
  live?: Live;
}

// La lista (y el texto de cada página de ejemplo) vive en examples.json. Orden mezclado a propósito:
// la galería muestra variedad desde la primera fila.
const EXAMPLES = (examples as Example[]).map((ex) => ({ ...ex }));
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
    h('a', { class: 'gal-card', href: examplePage(ex.name), onclick: (ev: Event) => {
      const e = ev as MouseEvent;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      void open(ex);
    } },
      thumb,
      h('span', { class: 'gal-card-body' },
        h('strong', {}, d.title ?? ex.name, ex.live ? h('span', { class: 'gal-live-badge' }, t('live.badge')) : undefined),
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
  // El modo se fija antes de cargar el diagrama: el componente dibuja según el modo.
  if (ex.live) live.start(ex.name, d, ex.live);
  else live.stop();
  $('live').hidden = !ex.live;
  viewerDiagram.diagram = d;
  $<HTMLAnchorElement>('viewerPage').href = examplePage(ex.name);
  const code = await encodeDiagram(d);
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

/* ---------- Ejemplos en vivo: avanzar el proceso ---------- */

const live = mountLive(viewerDiagram, $('live'));

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
