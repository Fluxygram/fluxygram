import { applyBrand, type Brand } from './brand';
import '@fluxygram/element';
import type { FluxyGram } from '@fluxygram/element';
import { validate } from '@fluxygram/core';
import { lang, t } from './i18n';
import { diagramFromHash, encodeDiagram } from './editor/io';

const el = document.querySelector<FluxyGram>('#diagram')!;
const missing = document.querySelector<HTMLElement>('#missing')!;
const edit = document.querySelector<HTMLAnchorElement>('#edit')!;

// Link corto de Fluxygram Cloud (/d/abc123): el diagrama se pide a la API. Si no, va dentro del link (#d=).
const short = location.pathname.match(/^\/d\/([A-Za-z0-9]+)\/?$/)?.[1];
let linkProblem: 'disabled' | 'expired' | null = null;
let ownerBrand: Brand | null = null;

/** Formulario de contraseña: resuelve con lo que se escriba. */
function askPassword(wrong: boolean): Promise<string> {
  return new Promise((resolve) => {
    const form = document.createElement('form');
    form.className = 'view-lock';
    form.innerHTML = `<h1></h1><p></p><input type="password" autocomplete="current-password" required /><button class="btn btn-primary" type="submit"></button><small></small>`;
    form.querySelector('h1')!.textContent = t('view.lockTitle');
    form.querySelector('p')!.textContent = t('view.lockLead');
    const input = form.querySelector('input')!;
    input.setAttribute('aria-label', t('view.password'));
    input.placeholder = t('view.password');
    form.querySelector('button')!.textContent = t('view.open');
    form.querySelector('small')!.textContent = wrong ? t('view.wrongPassword') : '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.remove();
      resolve(input.value);
    });
    el.before(form);
    input.focus();
  });
}

async function diagramFromShortLink(slug: string): Promise<unknown | undefined> {
  try {
    let res = await fetch(`/api/links/${slug}`);
    // Con contraseña: se pide hasta que sea la correcta.
    let wrong = false;
    while (res.status === 401) {
      el.hidden = true;
      const password = await askPassword(wrong);
      res = await fetch(`/api/links/${slug}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.status === 403) {
        wrong = true;
        res = new Response(null, { status: 401 });
      }
    }
    el.hidden = false;
    if (res.status === 410) linkProblem = ((await res.json()) as { error: string }).error === 'expired' ? 'expired' : 'disabled';
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
  const problem = linkProblem as 'disabled' | 'expired' | null;
  if (problem) missing.textContent = t(problem === 'expired' ? 'view.expired' : 'view.disabled');
  missing.hidden = false;
  document.querySelector<HTMLElement>('#present')!.hidden = true;
}
