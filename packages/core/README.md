# @fluxygram/core

The diagram format behind [Fluxygram](https://github.com/Fluxygram/fluxygram): validation with readable errors (English and Spanish), automatic layout for every diagram type, and the motion grammar that turns a diagram into steps. No framework, no DOM: it runs in the browser, in Node and in Workers.

```bash
npm install @fluxygram/core
```

```js
import { validate, layout, plan } from '@fluxygram/core';

const result = validate(json, { locale: 'en' });
if (!result.ok) console.log(result.issues); // [{ path: 'edges[0].to', message: '"to" points to "x", which is not a node.' }]
else {
  const placed = layout(result.diagram);       // positions, edge paths, bounds
  const story = plan(result.diagram, placed);  // the state of every step, camera included
}
```

To draw diagrams, use [`@fluxygram/element`](https://www.npmjs.com/package/@fluxygram/element). Format reference: [SKILL.md](https://github.com/Fluxygram/fluxygram/blob/main/skills/fluxygram/SKILL.md) and the [JSON Schema](https://fluxygram.app/schema/v1.json).

MIT license.
