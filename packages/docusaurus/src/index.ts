import { fileURLToPath } from 'node:url';

/**
 * Fluxygram for Docusaurus: loads the <fluxy-gram> component in the browser.
 * Pair it with the remark plugin so ```fluxygram code blocks become diagrams:
 *
 *     // docusaurus.config.mjs
 *     import { remarkFluxygram } from '@fluxygram/markdown';
 *     export default {
 *       plugins: ['@fluxygram/docusaurus'],
 *       presets: [['classic', { docs: { remarkPlugins: [remarkFluxygram] }, blog: { remarkPlugins: [remarkFluxygram] } }]],
 *     };
 */
export default function fluxygramPlugin() {
  return {
    name: '@fluxygram/docusaurus',
    getClientModules() {
      return [fileURLToPath(new URL('./client.js', import.meta.url))];
    },
  };
}
