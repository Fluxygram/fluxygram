import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { validate, type Diagram, type FluxNode } from '@fluxygram/core';
import {
  Circle, CircleDot, Database, Diamond, Download, FileCode, FilePlus, FolderOpen, LayoutGrid, Maximize, Milestone, Minus, Plus,
  CircleHelp, RectangleHorizontal, Redo2, Square, StickyNote, Undo2, X, type IconNode,
} from 'lucide';
import { exampleUrl, lang, t } from './i18n';
import { Canvas } from './editor/canvas';
import { h, icon } from './editor/dom';
import { renderInspector } from './editor/inspector';
import { copyText, diagramFromHash, download, exportHtml, pickFile, shareUrl, slug } from './editor/io';
import { emptyDiagram, Model } from './editor/model';
import { renderSteps } from './editor/steps';
import { startTour, tourSeen } from './editor/tour';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DRAFT_KEY = 'fluxygram:editor';

/* ---------- Estado inicial: link compartido > borrador > ejemplo ---------- */

async function initialDiagram(): Promise<Diagram> {
  const shared = await diagramFromHash();
  if (shared) {
    const r = validate(shared, { locale: lang });
    if (r.ok) return r.diagram;
  }
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const r = validate(JSON.parse(draft), { locale: lang });
      if (r.ok) return r.diagram;
      const parsed = JSON.parse(draft) as Diagram;
      if (Array.isArray(parsed.nodes) && parsed.nodes.length === 0) return parsed;
    }
  } catch {
    /* almacenamiento no disponible o borrador dañado */
  }
  const res = await fetch(exampleUrl('how-it-works'));
  return (await res.json()) as Diagram;
}

const model = new Model(await initialDiagram());
if (location.hash) history.replaceState(null, '', location.pathname);

const canvas = new Canvas(model);
$('stage').prepend(canvas.host);

/* ---------- Barra superior ---------- */

const setIcon = (id: string, node: IconNode) => $(id).append(icon(node));
setIcon('undo', Undo2);
setIcon('redo', Redo2);
setIcon('auto', LayoutGrid);
setIcon('fit', Maximize);
setIcon('new', FilePlus);
setIcon('open', FolderOpen);
setIcon('download', Download);
setIcon('export', FileCode);
setIcon('zoomIn', Plus);
setIcon('zoomOut', Minus);
setIcon('modalClose', X);
setIcon('tour', CircleHelp);

$('undo').onclick = () => model.undo();
$('redo').onclick = () => model.redo();
$('auto').onclick = () => model.autoLayout();
$('fit').onclick = () => canvas.fit();
$('zoomIn').onclick = () => canvas.zoomBy(1.2);
$('zoomOut').onclick = () => canvas.zoomBy(1 / 1.2);
$('new').onclick = () => model.load(emptyDiagram());
$('tour').onclick = () => startTour();

for (const btn of document.querySelectorAll<HTMLButtonElement>('#type button')) {
  btn.onclick = () => {
    if (model.diagram.type !== btn.dataset.type) model.setType(btn.dataset.type as Diagram['type']);
  };
}

$<HTMLSelectElement>('examples').onchange = async (e) => {
  const select = e.target as HTMLSelectElement;
  if (!select.value) return;
  const res = await fetch(exampleUrl(select.value));
  model.load((await res.json()) as Diagram);
  select.value = '';
};

$('open').onclick = async () => {
  const file = await pickFile();
  if (file) await openFile(file);
};

$('download').onclick = () => {
  download(`${slug(model.diagram.title)}.flux.json`, JSON.stringify(clean(model.diagram), null, 2) + '\n', 'application/json');
};

$('export').onclick = async () => {
  if (!model.diagram.nodes.length) return toast(t('ed.needNodes'));
  download(`${slug(model.diagram.title)}.html`, await exportHtml(clean(model.diagram), lang), 'text/html');
};

$('present').onclick = async () => {
  if (!model.diagram.nodes.length) return toast(t('ed.needNodes'));
  window.open(await shareUrl(clean(model.diagram), 'present'), '_blank');
};

$('share').onclick = async () => {
  if (!model.diagram.nodes.length) return toast(t('ed.needNodes'));
  const url = await shareUrl(clean(model.diagram));
  if (await copyText(url)) toast(t('ed.copied'));
  else toast(`${t('ed.copyFail')} ${url}`, 8000);
};

/* ---------- Paleta: arrastrar al lienzo, o clic para agregar ---------- */

interface PaletteItem {
  label: string;
  icon: IconNode;
  add: (at?: { x: number; y: number }) => void;
}

/** Paralelogramo (entrada / salida): lucide no lo trae. */
const Parallelogram: IconNode = [['path', { d: 'M7 5h14l-4 14H3z' }]];

function paletteItems(): PaletteItem[] {
  const type = model.diagram.type;
  const node = (partial: Partial<FluxNode>, labelKey: string) => (at?: { x: number; y: number }) => {
    const p: Partial<FluxNode> = { ...partial };
    if (at && type !== 'timeline') {
      // Se fija donde se soltó (centrado bajo el cursor).
      p.x = Math.round((at.x - 70) / 8) * 8;
      p.y = Math.round((at.y - 24) / 8) * 8;
      if (type === 'architecture') p.group = canvas.groupAt(at.x, at.y) ?? model.diagram.groups?.at(-1)?.id;
    }
    model.addNode(p, t(labelKey));
  };
  if (type === 'timeline') {
    return [{ label: t('ed.add.milestone'), icon: Milestone, add: node({ date: String(new Date().getFullYear()) }, 'ed.newMilestone') }];
  }
  if (type === 'architecture') {
    return [
      { label: t('ed.add.node'), icon: Square, add: node({}, 'ed.newNode') },
      { label: t('ed.add.database'), icon: Database, add: node({ kind: 'database' }, 'ed.newDatabase') },
      { label: t('ed.add.note'), icon: StickyNote, add: node({ kind: 'note' }, 'ed.newNote') },
      { label: t('ed.add.layer'), icon: RectangleHorizontal, add: () => model.addGroup(t('ed.newLayer')) },
    ];
  }
  return [
    { label: t('ed.add.node'), icon: Square, add: node({}, 'ed.newNode') },
    { label: t('ed.add.decision'), icon: Diamond, add: node({ kind: 'decision' }, 'ed.newDecision') },
    { label: t('ed.add.start'), icon: Circle, add: node({ kind: 'start' }, 'ed.newStart') },
    { label: t('ed.add.end'), icon: CircleDot, add: node({ kind: 'end' }, 'ed.newEnd') },
    { label: t('ed.add.data'), icon: Parallelogram, add: node({ kind: 'data' }, 'ed.newData') },
    { label: t('ed.add.database'), icon: Database, add: node({ kind: 'database' }, 'ed.newDatabase') },
    { label: t('ed.add.note'), icon: StickyNote, add: node({ kind: 'note' }, 'ed.newNote') },
  ];
}

function renderPalette() {
  const root = $('palette');
  root.replaceChildren(
    ...paletteItems().map((item) => {
      const chip = h('button', { type: 'button', class: 'ed-chip' }, icon(item.icon, 16), item.label);
      chip.addEventListener('pointerdown', (e) => startPaletteDrag(e, item));
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.add();
        }
      });
      return chip;
    }),
  );
}

function startPaletteDrag(e: PointerEvent, item: PaletteItem) {
  if (e.button !== 0) return;
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY };
  let ghost: HTMLElement | undefined;
  const move = (ev: PointerEvent) => {
    if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4) {
      ghost = h('div', { class: 'ed-ghost' }, item.label);
      document.body.append(ghost);
    }
    if (ghost) {
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
    }
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (!ghost) return item.add(); // clic: el acomodo automático decide dónde va
    ghost.remove();
    if (canvas.contains(ev.clientX, ev.clientY)) item.add(canvas.toWorld(ev.clientX, ev.clientY));
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* ---------- Panel lateral ---------- */

const tabs = [...document.querySelectorAll<HTMLButtonElement>('.ed-tabs button')];
for (const tab of tabs) {
  tab.onclick = () => {
    for (const x of tabs) x.setAttribute('aria-selected', String(x === tab));
    $('props').hidden = tab.dataset.tab !== 'props';
    $('jsonPanel').hidden = tab.dataset.tab !== 'json';
    if (tab.dataset.tab === 'json') syncJson(true);
  };
}

const jsonBox = $<HTMLTextAreaElement>('json');
const jsonStatus = $('jsonStatus');
function syncJson(force = false) {
  if (!force && document.activeElement === jsonBox) return;
  jsonBox.value = JSON.stringify(clean(model.diagram), null, 2);
  jsonStatus.textContent = '';
  jsonStatus.classList.remove('is-error');
}
let jsonTimer: number | undefined;
jsonBox.addEventListener('input', () => {
  clearTimeout(jsonTimer);
  jsonTimer = window.setTimeout(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonBox.value);
    } catch {
      jsonStatus.textContent = t('play.incomplete');
      jsonStatus.classList.add('is-error');
      return;
    }
    const r = validate(parsed, { locale: lang });
    if (!r.ok) {
      jsonStatus.classList.add('is-error');
      jsonStatus.replaceChildren(
        r.issues.length === 1 ? t('play.errors1') : t('play.errorsN', { n: String(r.issues.length) }),
        h('ul', {}, ...r.issues.slice(0, 6).map((i) => h('li', {}, `${i.path} ${i.message}`))),
      );
      return;
    }
    jsonStatus.classList.remove('is-error');
    jsonStatus.textContent = t('play.valid');
    model.load(r.diagram);
  }, 500);
});
jsonBox.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  jsonBox.setRangeText('  ', jsonBox.selectionStart, jsonBox.selectionEnd, 'end');
});

/* ---------- Vista previa ---------- */

const modal = $('modal');
const player = $<FluxyGram>('player');
$('preview').onclick = () => {
  if (!model.diagram.nodes.length) return toast(t('ed.needNodes'));
  modal.hidden = false;
  player.diagram = clean(model.diagram);
  player.replay();
  player.focus();
};
const closeModal = () => {
  modal.hidden = true;
  player.pause();
};
$('modalClose').onclick = closeModal;
modal.addEventListener('click', (e) => e.target === modal && closeModal());

/* ---------- Abrir archivos arrastrándolos al lienzo ---------- */

async function openFile(file: File) {
  try {
    const r = validate(JSON.parse(await file.text()), { locale: lang });
    if (!r.ok) return toast(`${t('ed.badFile')}: ${r.issues[0]?.path} ${r.issues[0]?.message}`, 6000);
    model.load(r.diagram);
  } catch {
    toast(t('ed.badFile'));
  }
}

const stage = $('stage');
const dropzone = $('dropzone');
stage.addEventListener('dragover', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  e.preventDefault();
  dropzone.classList.add('is-on');
});
stage.addEventListener('dragleave', (e) => {
  if (!stage.contains(e.relatedTarget as Node)) dropzone.classList.remove('is-on');
});
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-on');
  const file = e.dataTransfer?.files[0];
  if (file) void openFile(file);
});

/* ---------- Teclado ---------- */

window.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
  if (!modal.hidden) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) {
    e.preventDefault();
    if (e.shiftKey) model.redo();
    else model.undo();
  } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
    e.preventDefault();
    model.redo();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && model.selection) {
    e.preventDefault();
    model.remove(model.selection);
  } else if (e.key === 'Escape' && !typing) {
    if (model.step !== null) model.setStep(null);
    else model.select(null);
  }
});

/* ---------- Render ---------- */

let toastTimer: number | undefined;
function toast(text: string, ms = 2200) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-on'), ms);
}

/** Copia sin ids automáticos de conexión que nadie usa en los pasos (JSON más limpio). */
function clean(d: Diagram): Diagram {
  const copy = JSON.parse(JSON.stringify(d)) as Diagram;
  if (!copy.title) delete copy.title;
  return copy;
}

let saveTimer: number | undefined;
function renderAll(reason: string) {
  const d = model.diagram;
  for (const btn of document.querySelectorAll<HTMLButtonElement>('#type button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.type === d.type));
  }
  if (reason === 'load' || reason === 'type' || reason === 'init' || reason === 'history') renderPalette();
  $<HTMLButtonElement>('undo').disabled = !model.canUndo;
  $<HTMLButtonElement>('redo').disabled = !model.canRedo;
  $<HTMLButtonElement>('auto').disabled = d.type === 'timeline' || !d.nodes.some((n) => typeof n.x === 'number');
  $('empty').hidden = d.nodes.length > 0;
  if (reason !== 'move') {
    renderInspector($('props'), model);
    renderSteps($('steps'), model);
    if (!$('jsonPanel').hidden) syncJson();
  }
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* almacenamiento no disponible */
    }
  }, 400);
}

model.on(renderAll);
renderAll('init');

// La intro aparece sola la primera vez (cuando ya se dibujó todo, para que el foco encuentre cada zona).
if (!tourSeen()) setTimeout(startTour, 500);
