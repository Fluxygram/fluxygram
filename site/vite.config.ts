import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play.html'),
        view: resolve(import.meta.dirname, 'view.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
});
