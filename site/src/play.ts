import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { validate } from '@fluxygram/core';
import { exampleUrl, lang, t } from './i18n';

const source = document.querySelector<HTMLTextAreaElement>('#source')!;
const preview = document.querySelector<FluxyGram>('#preview')!;
const preset = document.querySelector<HTMLSelectElement>('#preset')!;
const status = document.querySelector<HTMLElement>('#status')!;

const DRAFT_KEY = `fluxygram:draft:${lang}`;

function update() {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source.value);
  } catch {
    setStatus(t('play.incomplete'), true);
    return;
  }
  const result = validate(parsed, { locale: lang });
  if (result.ok) setStatus(t('play.valid'), false);
  else {
    const n = result.issues.length;
    setStatus(n === 1 ? t('play.errors1') : t('play.errorsN', { n: String(n) }), true);
  }
  preview.diagram = source.value;
  try {
    localStorage.setItem(DRAFT_KEY, source.value);
  } catch {
    /* almacenamiento no disponible */
  }
}

function setStatus(text: string, error: boolean) {
  status.textContent = text;
  status.classList.toggle('is-error', error);
}

async function loadPreset(name: string) {
  const res = await fetch(exampleUrl(name));
  source.value = await res.text();
  update();
}

let timer: number | undefined;
source.addEventListener('input', () => {
  clearTimeout(timer);
  timer = window.setTimeout(update, 450);
});

// Tab inserta dos espacios en vez de saltar de campo.
source.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  source.setRangeText('  ', source.selectionStart, source.selectionEnd, 'end');
});

preset.addEventListener('change', () => void loadPreset(preset.value));

let draft: string | null = null;
try {
  draft = localStorage.getItem(DRAFT_KEY);
} catch {
  /* almacenamiento no disponible */
}
if (draft) {
  source.value = draft;
  update();
} else {
  void loadPreset(preset.value);
}
