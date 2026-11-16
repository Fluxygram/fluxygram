import { applyBrand, type Brand } from './brand';
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
let linkDisabled = false;
let ownerBrand: Brand | null = null;
async function diagramFromShortLink(slug: string): Promise<unknown | undefined> {
  try {
    const res = await fetch(`/api/links/${slug}`);
    linkDisabled = res.status === 410;
    if (!res.ok) return undefined;
    const body = (await res.json()) as { diagram: unknown; brand?: Brand | null };
    ownerBrand = body.brand ?? null;
    return body.diagram;
  } catch {
    return undefined;
  }
}
const data = short ? await diagramFromShortLink(short) : await diagramFromHash();
const result = data ? validate(data, { locale: lang }) : undefined;

if (result?.ok) {
  // Link de una cuenta Pro con marca: sus colores, su fuente y su logo en lugar del de Fluxygram.
  // (se asigna dentro de diagramFromShortLink: TypeScript no lo ve, por eso el cast)
  const brand = ownerBrand as Brand | null;
  if (brand) {
    applyBrand(el, brand);
    document.body.dataset.brand = brand.theme;
    const brandLink = document.querySelector<HTMLAnchorElement>('.brand');
    if (brandLink && brand.logo) {
      const img = document.createElement('img');
      img.src = brand.logo;
      img.alt = '';
      img.className = 'view-logo';
      brandLink.replaceWith(img);
    }
  }
  el.diagram = result.diagram;
  if (result.diagram.title) document.title = `${result.diagram.title} — Fluxygram`;
  // "Editar una copia" abre el editor con el mismo diagrama.
  const hash = short ? `#d=${await encodeDiagram(result.diagram)}` : location.hash;
  edit.href = `/play${hash}`;
  document.querySelector<HTMLAnchorElement>('#present')!.href = `/present${hash}`;
} else {
  el.hidden = true;
  if (linkDisabled) missing.textContent = window.FLUXY_I18N?.t('view.disabled') ?? missing.textContent;
  missing.hidden = false;
  document.querySelector<HTMLElement>('#present')!.hidden = true;
}
