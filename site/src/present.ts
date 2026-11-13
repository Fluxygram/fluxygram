import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { validate, type Diagram } from '@fluxygram/core';
import { lang, t } from './i18n';
import { diagramFromHash } from './editor/io';

/**
 * Presentación en dos ventanas sincronizadas:
 * - público (/present#d=…): el diagrama a pantalla completa, avanza con clic, flechas, espacio o un puntero inalámbrico.
 * - presentador (/present?role=presenter#d=…): notas, texto del paso siguiente, vista previa y cronómetro.
 * Se hablan por BroadcastChannel: cualquiera de las dos puede avanzar.
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const role = new URLSearchParams(location.search).get('role') === 'presenter' ? 'presenter' : 'audience';
document.body.dataset.role = role;

const data = await diagramFromHash();
const result = data ? validate(data, { locale: lang }) : undefined;
if (!result?.ok) {
  $('missing').hidden = false;
  throw new Error('No diagram in the link');
}
const diagram: Diagram = result.diagram;
if (diagram.title) document.title = `${diagram.title} — Fluxygram`;

/* ---------- Canal entre ventanas ---------- */

// El canal se identifica por el diagrama, así dos presentaciones distintas no se mezclan.
const code = new URLSearchParams(location.hash.slice(1)).get('d') ?? '';
let hash = 0;
for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) | 0;
const channel = new BroadcastChannel(`fluxygram-present-${hash}`);
type Message = { type: 'go'; index: number } | { type: 'hello' } | { type: 'state'; index: number };

let index = 0;
let count = 1;
let applying = false;

const main = $<FluxyGram>(role === 'audience' ? 'diagram' : 'mini');
main.diagram = diagram;
main.addEventListener('fluxy-step', (e) => {
  const detail = (e as CustomEvent<{ index: number; count: number }>).detail;
  index = detail.index;
  count = detail.count;
  if (!applying) channel.postMessage({ type: 'go', index } satisfies Message);
  render();
});

function go(i: number) {
  main.goTo(Math.max(0, Math.min(count - 1, i)));
}

channel.onmessage = (e: MessageEvent<Message>) => {
  const msg = e.data;
  if (msg.type === 'hello') channel.postMessage({ type: 'state', index } satisfies Message);
  if ((msg.type === 'go' || msg.type === 'state') && msg.index !== index) {
    applying = true;
    main.goTo(msg.index);
    applying = false;
  }
};

/* ---------- Teclado (también punteros inalámbricos: envían Page Down / Page Up) ---------- */

window.addEventListener(
  'keydown',
  (e) => {
    if (!helpEl.hidden && ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      showHelp(false);
      return;
    }
    const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
    const prevKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
    let handled = true;
    if (nextKeys.includes(e.key)) go(index + 1);
    else if (prevKeys.includes(e.key)) go(index - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(count - 1);
    else if (e.key.toLowerCase() === 'f' && role === 'audience') toggleFullscreen();
    else if (e.key.toLowerCase() === 'n') openPresenter();
    else if (e.key === '?' && role === 'audience') showHelp(true);
    else if (e.key === 'Escape' && !helpEl.hidden) showHelp(false);
    else handled = false;
    // Con la ayuda abierta, las teclas de avance la cierran en lugar de avanzar.
    if (handled && !helpEl.hidden && role === 'audience' && e.key !== '?' && e.key.toLowerCase() !== 'n') {
      showHelp(false);
    }
    if (handled) {
      // El componente también escucha flechas: así no avanza dos veces.
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true,
);

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}

function openPresenter() {
  if (role === 'presenter') return;
  window.open(`/present?role=presenter${location.hash}`, 'fluxygram-presenter', 'width=1100,height=720');
}

/* ---------- Ayuda: aparece la primera vez; "?" la abre de nuevo ---------- */

const helpEl = $('help');
const HELP_KEY = 'fluxygram:present-help';
function showHelp(open: boolean) {
  helpEl.hidden = !open;
  if (open) $('helpStart').focus();
  else {
    try {
      localStorage.setItem(HELP_KEY, 'done');
    } catch {
      /* almacenamiento no disponible */
    }
    main.focus();
  }
}
$('helpStart').onclick = () => showHelp(false);
$('helpNotes').onclick = () => {
  openPresenter();
  showHelp(false);
};
helpEl.addEventListener('click', (e) => e.stopPropagation());

/* ---------- Público ---------- */

if (role === 'audience') {
  $('audience').hidden = false;
  main.focus();
  let seen = false;
  try {
    seen = localStorage.getItem(HELP_KEY) === 'done';
  } catch {
    seen = false;
  }
  if (!seen) showHelp(true);

  // El diagrama ocupa todo lo que puede sin salirse de la pantalla (ancho según su proporción).
  const fit = () => {
    const vb = main.shadowRoot?.querySelector('svg')?.viewBox.baseVal;
    if (!vb?.width) return;
    const room = innerHeight * 0.94 - 140; // título + texto del paso
    const width = Math.min(innerWidth * 0.94, (room * vb.width) / vb.height);
    main.style.setProperty('--pr-width', `${Math.max(320, width)}px`);
  };
  window.addEventListener('resize', fit);
  main.addEventListener('fluxy-step', fit);
  setTimeout(fit, 50);

  // La ayuda y el cursor se esconden si no se mueve el mouse.
  const stage = $('audience');
  let idle: number | undefined;
  const wake = () => {
    stage.classList.remove('is-idle');
    clearTimeout(idle);
    idle = window.setTimeout(() => stage.classList.add('is-idle'), 2500);
  };
  window.addEventListener('pointermove', wake);
  wake();
}

/* ---------- Presentador ---------- */

const notesEl = $('notes');
const started = Date.now();
let timerStart = started;

function render() {
  if (role !== 'presenter') return;
  const steps = diagram.steps ?? [];
  const isFinale = index >= steps.length && index === count - 1 && count > steps.length;
  $('count').textContent = `${index + 1} / ${count}`;
  const step = steps[index];
  const notes = step?.notes?.trim();
  notesEl.textContent = notes || (isFinale ? t('pr.finaleNotes') : t('pr.noNotes'));
  notesEl.classList.toggle('is-empty', !notes);
  $('nowCaption').textContent = step?.caption ?? (isFinale ? t('pr.finale') : '—');
  const next = steps[index + 1];
  $('nextCaption').textContent =
    index >= count - 1 ? t('pr.end') : next?.caption ?? (index + 1 === count - 1 && count > steps.length ? t('pr.finale') : '—');
  $<HTMLButtonElement>('prev').disabled = index <= 0;
  $<HTMLButtonElement>('next').disabled = index >= count - 1;
}

if (role === 'presenter') {
  $('presenter').hidden = false;
  $('prev').onclick = () => go(index - 1);
  $('next').onclick = () => go(index + 1);
  $('timerReset').onclick = () => (timerStart = Date.now());
  setInterval(() => {
    const s = Math.floor((Date.now() - timerStart) / 1000);
    $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
  // Al abrir, se pide el paso actual a la ventana del público.
  channel.postMessage({ type: 'hello' } satisfies Message);
}

// Primer paso visible apenas carga (sin reproducción automática).
setTimeout(() => {
  if (index === 0 && count === 1) main.goTo(0);
  render();
}, 120);
