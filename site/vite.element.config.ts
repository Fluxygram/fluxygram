import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Bundle autónomo de <fluxy-gram> (core + componente + íconos) en un solo archivo:
 * site/public/fluxygram.js. Lo usa "Exportar HTML" y cualquiera que quiera incrustarlo con un <script>.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: resolve(import.meta.dirname, 'public'),
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve(import.meta.dirname, '../packages/element/src/index.ts'),
      formats: ['es'],
      fileName: () => 'fluxygram.js',
    },
  },
});
