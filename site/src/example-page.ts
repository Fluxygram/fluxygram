import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import type { Diagram } from '@fluxygram/core';
import { exampleUrl, t } from './i18n';
import { encodeDiagram } from './editor/io';
import examples from './examples.json';
import { mountLive, type Live } from './live-demo';
import './lang';
import { initSiteAccount } from './cloud';

/** Página pública de un ejemplo (generada por scripts/example-pages.mjs): diagrama, editor, en vivo y copiar. */

void initSiteAccount(document.getElementById('account')!);

const name = document.querySelector<HTMLElement>('main[data-example]')!.dataset.example!;
const meta = (examples as { name: string; live?: Live }[]).find((x) => x.name === name);
const el = document.querySelector<FluxyGram>('#diagram')!;

// Botones de copiar en los bloques de código.
for (const wrap of document.querySelectorAll<HTMLElement>('.ag-copy')) {
  const pre = wrap.querySelector('pre')!;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ag-copy-btn';
  btn.textContent = t('agents.copy');
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent ?? '');
      btn.textContent = t('agents.copied');
      btn.classList.add('is-done');
      window.setTimeout(() => {
        btn.textContent = t('agents.copy');
        btn.classList.remove('is-done');
      }, 1800);
    } catch {
      btn.textContent = t('agents.copyFail');
    }
  };
  wrap.append(btn);
}

try {
  const d = (await (await fetch(exampleUrl(name))).json()) as Diagram;
  if (meta?.live) {
    el.removeAttribute('src');
    mountLive(el, document.getElementById('live')!).start(name, d, meta.live);
    el.diagram = d;
  }
  const href = `/play#d=${await encodeDiagram(d)}`;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('#edit, #edit2')) a.href = href;
} catch {
  /* sin red: el diagrama igual carga por su src y los enlaces abren el editor vacío */
}
