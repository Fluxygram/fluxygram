# @fluxygram/docusaurus

[Fluxygram](https://fluxygram.app) for Docusaurus: animated, step-by-step diagrams in your docs and blog.

```js
// docusaurus.config.mjs
import { remarkFluxygram } from '@fluxygram/markdown';

export default {
  plugins: ['@fluxygram/docusaurus'],
  presets: [['classic', { docs: { remarkPlugins: [remarkFluxygram] }, blog: { remarkPlugins: [remarkFluxygram] } }]],
};
```

Docs: https://docs.fluxygram.app/guides/integrations/
