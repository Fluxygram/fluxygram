import type { Diagram } from '@fluxygram/core';
import type { FluxyGram } from '@fluxygram/element';
import { X } from 'lucide';
import { h, icon } from './dom';
import { t } from '../i18n';
import { applyBrand, DEFAULT_BRAND, type Brand, type BrandFont } from '../brand';

/**
 * "Tu marca" (Pro): color, tema, fuente y logo, con una vista previa del diagrama que tienes abierto.
 * Se guarda en la cuenta y se usa en los videos, el HTML exportado y los links cortos.
 */

const PRESETS = ['#2bff88', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#14b8a6', '#ef4444'];
const MAX_LOGO_BYTES = 150 * 1024;

async function api(path: string, init: RequestInit = {}) {
  return fetch(`/api${path}`, { credentials: 'same-origin', ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
}

/** La marca guardada y si está activa (solo con Pro). Sin Cloud o sin sesión: null. */
export async function loadBrand(): Promise<{ brand: Brand | null; active: boolean } | null> {
  try {
    const r = await api('/brand');
    if (!r.ok || !r.headers.get('Content-Type')?.includes('application/json')) return null;
    return (await r.json()) as { brand: Brand | null; active: boolean };
  } catch {
    return null;
  }
}

export async function openBrandDialog(diagram: Diagram, toast: (text: string, ms?: number) => void) {
  const saved = await loadBrand();
  const brand: Brand = { ...DEFAULT_BRAND, ...(saved?.brand ?? {}) };
  const close = () => modal.remove();

  const preview = document.createElement('fluxy-gram') as FluxyGram;
  preview.setAttribute('autoplay', 'false');
  preview.className = 'ed-brand-preview';
  const logoBox = h('div', { class: 'ed-brand-logo' });
  const refresh = () => {
    applyBrand(preview, brand);
    previewWrap.dataset.theme = brand.theme;
    logoBox.replaceChildren(brand.logo ? h('img', { src: brand.logo, alt: '' }) : h('span', {}, t('brand.noLogo')));
    removeLogo.hidden = !brand.logo;
    for (const b of swatches.children) (b as HTMLElement).setAttribute('aria-pressed', String((b as HTMLElement).dataset.color === brand.accent));
    color.value = brand.accent;
    for (const b of themeSeg.children) (b as HTMLElement).setAttribute('aria-checked', String((b as HTMLElement).dataset.theme === brand.theme));
    font.value = brand.font;
  };

  const swatches = h('div', { class: 'ed-brand-swatches' }, ...PRESETS.map((c) =>
    h('button', { type: 'button', class: 'ed-brand-swatch', 'data-color': c, style: `--c:${c}`, 'aria-label': c, onclick: () => {
      brand.accent = c;
      refresh();
    } }),
  ));
  const color = h('input', { type: 'color', class: 'ed-brand-color', 'aria-label': t('brand.custom'), oninput: (e: Event) => {
    brand.accent = (e.target as HTMLInputElement).value.toLowerCase();
    refresh();
  } });
  const themeSeg = h('div', { class: 'ed-seg', role: 'radiogroup', 'aria-label': t('brand.theme') }, ...(['dark', 'light'] as const).map((th) =>
    h('button', { type: 'button', role: 'radio', 'data-theme': th, onclick: () => {
      brand.theme = th;
      refresh();
    } }, t(`brand.${th}`)),
  ));
  const font = h('select', { 'aria-label': t('brand.font'), onchange: (e: Event) => {
    brand.font = (e.target as HTMLSelectElement).value as BrandFont;
    refresh();
  } }, ...(['inter', 'system', 'serif', 'mono'] as const).map((f) => h('option', { value: f }, t(`brand.font.${f}`))));

  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', hidden: true, onchange: async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    if (f.size > MAX_LOGO_BYTES) return toast(t('brand.logoTooBig'), 4000);
    brand.logo = await new Promise<string>((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.readAsDataURL(f);
    });
    refresh();
  } }) as HTMLInputElement;
  const removeLogo = h('button', { type: 'button', class: 'ed-btn', onclick: () => {
    delete brand.logo;
    refresh();
  } }, t('brand.removeLogo'));

  const save = h('button', { type: 'button', class: 'ed-btn ed-btn-primary', onclick: async () => {
    save.disabled = true;
    const r = await api('/brand', { method: 'PUT', body: JSON.stringify({ brand }) });
    save.disabled = false;
    if (r.status === 402) return toast(t('pro.historyReason'));
    if (!r.ok) return toast(t('cloud.error'));
    toast(t('brand.saved'), 4000);
    close();
  } }, t('brand.save'));
  const reset = h('button', { type: 'button', class: 'ed-btn', onclick: async () => {
    await api('/brand', { method: 'DELETE' });
    Object.assign(brand, DEFAULT_BRAND);
    delete brand.logo;
    preview.removeAttribute('style');
    refresh();
    toast(t('brand.removed'));
  } }, t('brand.reset'));

  const previewWrap = h('div', { class: 'ed-brand-stage' }, logoBox, preview);
  const modal: HTMLDivElement = h('div', { class: 'ed-modal' },
    h('div', { class: 'ed-picker ed-brand-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('brand.title') },
      h('button', { type: 'button', class: 'ed-icon ed-modal-close', title: t('ed.close'), 'aria-label': t('ed.close'), onclick: close }, icon(X)),
      h('h2', { class: 'ed-picker-title' }, t('brand.title')),
      h('p', { class: 'ed-video-lead' }, t('brand.lead')),
      h('div', { class: 'ed-brand-grid' },
        h('div', { class: 'ed-brand-controls' },
          h('div', { class: 'ed-brand-field' }, h('span', {}, t('brand.color')), h('div', { class: 'ed-brand-colors' }, swatches, color)),
          h('div', { class: 'ed-brand-field' }, h('span', {}, t('brand.theme')), themeSeg),
          h('label', { class: 'ed-brand-field' }, h('span', {}, t('brand.font')), font),
          h('div', { class: 'ed-brand-field' }, h('span', {}, t('brand.logo')),
            h('div', { class: 'ed-brand-logo-actions' },
              h('button', { type: 'button', class: 'ed-btn', onclick: () => file.click() }, t('brand.upload')), removeLogo, file),
            h('small', {}, t('brand.logoHint'))),
        ),
        previewWrap,
      ),
      h('div', { class: 'ed-pro-actions' }, saved?.brand ? reset : undefined, h('button', { type: 'button', class: 'ed-btn', onclick: close }, t('ed.close')), save),
    ),
  );
  modal.addEventListener('click', (e) => e.target === modal && close());
  modal.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && close());
  document.body.append(modal);
  preview.diagram = diagram;
  refresh();
  save.focus();
}
