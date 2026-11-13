import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { validate } from '@fluxygram/core';
import { lang } from './i18n';
import { diagramFromHash, encodeDiagram } from './editor/io';

const el = document.querySelector<FluxyGram>('#diagram')!;
const missing = document.querySelector<HTMLElement>('#missing')!;
const edit = document.querySelector<HTMLAnchorElement>('#edit')!;

// Link corto de Fluxygram Cloud (/d/abc123): el diagrama se pide a la API. Si no, va dentro del link (#d=).
const short = location.pathname.match(/^\/d\/([A-Za-z0-9]+)\/?$/)?.[1];
async function diagramFromShortLink(slug: string): Promise<unknown | undefined> {
  try {
    const res = await fetch(`/api/links/${slug}`);
    return res.ok ? ((await res.json()) as { diagram: unknown }).diagram : undefined;
  } catch {
    return undefined;
  }
}
const data = short ? await diagramFromShortLink(short) : await diagramFromHash();
const result = data ? validate(data, { locale: lang }) : undefined;

if (result?.ok) {
  el.diagram = result.diagram;
  if (result.diagram.title) document.title = `${result.diagram.title} — Fluxygram`;
  // "Editar una copia" abre el editor con el mismo diagrama.
  const hash = short ? `#d=${await encodeDiagram(result.diagram)}` : location.hash;
  edit.href = `/play${hash}`;
  document.querySelector<HTMLAnchorElement>('#present')!.href = `/present${hash}`;
} else {
  el.hidden = true;
  missing.hidden = false;
  document.querySelector<HTMLElement>('#present')!.hidden = true;
}
