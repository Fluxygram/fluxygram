# @fluxygram/markdown

Turn ` ```fluxygram ` code blocks into animated [Fluxygram](https://fluxygram.app) diagrams. remark and markdown-it plugins for Docusaurus, Astro, VitePress, Next.js MDX and anything else built on them.

````md
```fluxygram theme=light
{ "type": "flow", "nodes": [...], "edges": [...], "steps": [...] }
```
````

```js
import { remarkFluxygram, markdownItFluxygram } from '@fluxygram/markdown';

remarkPlugins: [remarkFluxygram]    // remark / MDX
md.use(markdownItFluxygram)          // markdown-it / VitePress
```

The page also needs the component: `import '@fluxygram/element'` in the browser, or the CDN script.

Setup for each tool: https://docs.fluxygram.app/guides/integrations/
