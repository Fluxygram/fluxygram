import { remarkFluxygram } from '@fluxygram/markdown';

/**
 * Fluxygram for Astro: ```fluxygram code blocks in .md and .mdx become animated diagrams, and the
 * <fluxy-gram> component is loaded on every page (so you can also write the tag by hand).
 *
 *     // astro.config.mjs
 *     import fluxygram from '@fluxygram/astro';
 *     export default defineConfig({ integrations: [fluxygram()] });
 *
 * Starlight works the same way: add it next to starlight() in `integrations`.
 */

interface SetupOptions {
  updateConfig: (config: { markdown: { remarkPlugins: unknown[] } }) => void;
  injectScript: (stage: 'page', content: string) => void;
}

export default function fluxygram() {
  return {
    name: '@fluxygram/astro',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript }: SetupOptions) => {
        // @astrojs/mdx reuses these markdown plugins by default, so .mdx files get them too.
        updateConfig({ markdown: { remarkPlugins: [remarkFluxygram] } });
        // Only in the browser: the component needs the DOM.
        injectScript('page', `import '@fluxygram/element';`);
      },
    },
  };
}
