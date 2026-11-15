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
  /** Ejemplo del modo seguimiento: se abre con controles para avanzar el proceso. */
  live?: Live;
}
interface Live {
  /** Etapas del camino feliz, en orden (puede repetir etapas si el proceso vuelve atrás). */
  path: string[];
  /** Etapa a la que salta "Simular un problema", si hay una conexión desde la etapa actual. */
  fail?: string;
  /** Se pasa el historial al componente: para ramas que se juntan o procesos que vuelven atrás. */
  history?: boolean;
}

// Orden mezclado a propósito: la galería muestra variedad desde la primera fila.
const EXAMPLES: Example[] = [
  { name: 'tracker', theme: 'work', live: { path: ['received', 'paid', 'packed', 'shipped', 'out', 'delivered'], fail: 'declined' } },
  { name: 'how-it-works', theme: 'software' },
  { name: 'bread', theme: 'cooking' },
  { name: 'game', theme: 'games' },
  { name: 'architecture', theme: 'software' },
  { name: 'track-food', theme: 'cooking', live: { path: ['placed', 'accepted', 'cooking', 'pickup', 'way', 'delivered'], fail: 'rejected' } },
  { name: 'blood', theme: 'health' },
  { name: 'coffee', theme: 'history' },
  { name: 'order', theme: 'work' },
  { name: 'law', theme: 'society' },
  {
    name: 'track-ticket',
    theme: 'work',
    live: { path: ['open', 'assigned', 'working', 'waiting', 'working', 'resolved', 'closed'], history: true },
  },
  { name: 'trip', theme: 'travel' },
  { name: 'sequence', theme: 'software' },
  { name: 'animals', theme: 'nature' },
  { name: 'doctor', theme: 'health' },
  {
    name: 'track-job',
    theme: 'work',
    live: { path: ['applied', 'screening', 'interview', 'offer', 'hired'], fail: 'rejected', history: true },
  },
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
  current = ex;
  if (ex.live) {
    viewerDiagram.setAttribute('mode', 'tracker');
    goLive(0);
  } else {
    for (const a of ['mode', 'stage', 'status', 'history']) viewerDiagram.removeAttribute(a);
  }
  $('live').hidden = !ex.live;
  viewerDiagram.diagram = d;
  showCode();
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

/* ---------- Ejemplos en vivo: avanzar el proceso ---------- */

let current: Example | null = null;
let at = 0; // posición en el camino feliz
let visited: string[] = [];

function goLive(index: number, status: 'pending' | 'success' | 'error' | 'warning' = 'pending', stage?: string) {
  const live = current!.live!;
  at = index;
  visited = stage ? [...live.path.slice(0, index + 1), stage] : live.path.slice(0, index + 1);
  const target = stage ?? live.path[index]!;
  // La última etapa queda como terminada (verde).
  const final = !stage && index === live.path.length - 1;
  viewerDiagram.history = live.history ? visited : null;
  viewerDiagram.setStage(target, final ? 'success' : status);
  updateButtons();
}
function updateButtons() {
  const live = current?.live;
  if (!live) return;
  const stage = viewerDiagram.stage;
  const ended = stage !== live.path[at] || at === live.path.length - 1;
  const canFail = !!live.fail && !ended && !!current!.diagram?.edges?.some((e) => e.from === stage && e.to === live.fail);
  $<HTMLButtonElement>('liveNext').disabled = ended;
  $<HTMLButtonElement>('liveDelay').disabled = ended;
  $<HTMLButtonElement>('liveFail').disabled = !canFail;
  $('liveFail').hidden = !live.fail;
}
function showCode() {
  if ($('live').hidden || !current) return;
  const stage = viewerDiagram.stage ?? '';
  const status = viewerDiagram.status;
  const history = current.live?.history ? `
  history="${viewerDiagram.history.join(',')}"` : '';
  $('liveCode').textContent = `<fluxy-gram src="${current.name}.flux.json" mode="tracker"
  stage="${stage}"${status !== 'pending' ? ` status="${status}"` : ''}${history}></fluxy-gram>`;
}
viewerDiagram.addEventListener('fluxy-stage', showCode);
$('liveNext').onclick = () => goLive(Math.min(at + 1, current!.live!.path.length - 1));
$('liveDelay').onclick = () => goLive(at, 'warning');
$('liveFail').onclick = () => goLive(at, 'error', current!.live!.fail);
$('liveReset').onclick = () => goLive(0);

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
