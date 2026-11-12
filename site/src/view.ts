import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { validate } from '@fluxygram/core';
import { lang } from './i18n';
import { diagramFromHash } from './editor/io';

const el = document.querySelector<FluxyGram>('#diagram')!;
const missing = document.querySelector<HTMLElement>('#missing')!;
const edit = document.querySelector<HTMLAnchorElement>('#edit')!;

const data = await diagramFromHash();
const result = data ? validate(data, { locale: lang }) : undefined;

if (result?.ok) {
  el.diagram = result.diagram;
  if (result.diagram.title) document.title = `${result.diagram.title} — Fluxygram`;
  // "Editar una copia" abre el editor con el mismo diagrama.
  edit.href = `/play${location.hash}`;
} else {
  el.hidden = true;
  missing.hidden = false;
}
