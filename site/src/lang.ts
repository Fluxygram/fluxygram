import { createRubberSegment } from './vendor/rubber-segment';
import { SEGMENT_THEME } from './editor/segment';
import { lang, t } from './i18n';
import { mountNavMenu } from './navmenu';

const KEY = 'fluxygram:lang';

// El enlace a la documentación abre la versión en el idioma de la página.
for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-docs-link]')) {
  a.href = lang === 'es' ? 'https://docs.fluxygram.app/es/' : 'https://docs.fluxygram.app/';
}

// EN | ES en el menú: reemplaza el botón de i18n.js. Al cambiar, se deja ver el rebote del
// elemento deslizante y luego se recarga la página en el otro idioma.
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-lang-switch]')) {
  const seg = createRubberSegment({
    ...SEGMENT_THEME,
    items: [
      { value: 'en', label: 'EN' },
      { value: 'es', label: 'ES' },
    ],
    value: lang,
    size: btn.closest('.ed-top') ? 'sm' : 'md',
    radius: 8,
    inset: 3,
    ariaLabel: t('lang.label'),
    className: 'lang-seg',
    onChange: (value) => {
      try {
        localStorage.setItem(KEY, value);
      } catch {
        /* sin almacenamiento: el idioma vuelve a salir del navegador */
      }
      // Si la página tiene su versión en el otro idioma en otra URL, se va a esa; si no, se recarga.
      const alt = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${value}"]`);
      window.setTimeout(() => (alt ? location.assign(alt.href) : location.reload()), 380);
    },
  });
  btn.replaceWith(seg.el);
}

// En el celular, los enlaces de la navegación se pliegan en un menú (solo en las páginas con navegación completa).
for (const header of document.querySelectorAll<HTMLElement>('header.nav')) {
  if (header.querySelector('[data-docs-link]')) mountNavMenu(header);
}
