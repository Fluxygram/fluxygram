// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
  site: 'https://docs.fluxygram.app',
  integrations: [
    starlight({
      title: 'Fluxygram',
      description: 'Diagrams that explain themselves: describe anything in JSON and get an animated, step-by-step diagram.',
      logo: { src: './src/assets/mark.svg' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Fluxygram/fluxygram' }],
      editLink: { baseUrl: 'https://github.com/Fluxygram/fluxygram/edit/main/docs/' },
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        es: { label: 'Español', lang: 'es' },
      },
      customCss: ['./src/styles/theme.css'],
      // El sitio de Fluxygram es solo oscuro: las docs también.
      components: {
        ThemeProvider: './src/components/DarkOnly.astro',
        ThemeSelect: './src/components/Empty.astro',
      },
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' } },
        {
          tag: 'link',
          attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
        },
      ],
      sidebar: [
        {
          label: 'Getting started',
          translations: { es: 'Empezar' },
          items: ['start/quickstart', 'start/editor', 'start/install'],
        },
        {
          label: 'Diagrams',
          translations: { es: 'Diagramas' },
          items: ['diagrams/types', 'diagrams/steps', 'diagrams/motion'],
        },
        {
          label: 'Guides',
          translations: { es: 'Guías' },
          items: ['guides/present', 'guides/agents', 'guides/codebase'],
        },
        {
          label: 'Reference',
          translations: { es: 'Referencia' },
          items: ['reference/format', 'reference/element', 'reference/icons'],
        },
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: 'Fluxygram',
          description:
            'Fluxygram turns a JSON file (.flux.json) into an animated diagram that tells a story step by step. These docs cover the format, the seven diagram types, steps and motion, the <fluxy-gram> web component, the visual editor, presentation mode and the agent skill.',
        }),
      ],
    }),
  ],
});
