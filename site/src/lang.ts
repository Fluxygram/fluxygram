import { createRubberSegment } from './vendor/rubber-segment';
import { SEGMENT_THEME } from './editor/segment';
import { lang, t } from './i18n';

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
    size: 'sm',
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
      window.setTimeout(() => location.reload(), 380);
    },
  });
  btn.replaceWith(seg.el);
}
