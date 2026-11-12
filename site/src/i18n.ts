declare global {
  interface Window {
    FLUXY_I18N?: { lang: 'en' | 'es'; t: (key: string, params?: Record<string, string>) => string };
  }
}

/** Idioma elegido por public/i18n.js (que corre antes que este módulo). */
export const lang: 'en' | 'es' = window.FLUXY_I18N?.lang ?? 'en';
export const t = (key: string, params?: Record<string, string>) => window.FLUXY_I18N?.t(key, params) ?? key;
export const exampleUrl = (name: string) => `/examples/${lang}/${name}.flux.json`;
