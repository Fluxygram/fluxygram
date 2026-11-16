import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Páginas de cada ejemplo (las genera scripts/example-pages.mjs antes de Vite).
const examplePages = Object.fromEntries(
  ['examples', 'ejemplos'].flatMap((dir) => {
    const abs = resolve(import.meta.dirname, dir);
    return existsSync(abs)
      ? readdirSync(abs)
          .filter((f) => f.endsWith('.html'))
          .map((f) => [`${dir}/${f.replace('.html', '')}`, resolve(abs, f)])
      : [];
  }),
);

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play.html'),
        view: resolve(import.meta.dirname, 'view.html'),
        present: resolve(import.meta.dirname, 'present.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        gallery: resolve(import.meta.dirname, 'gallery.html'),
        pricing: resolve(import.meta.dirname, 'pricing.html'),
        record: resolve(import.meta.dirname, 'record.html'),
        ...examplePages,
      },
    },
  },
});
