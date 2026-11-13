# @fluxygram/element

`<fluxy-gram>`: a web component that draws a [Fluxygram](https://github.com/Fluxygram/fluxygram) diagram and tells it step by step, with motion that helps people understand. Works in any framework, or none.

```bash
npm install @fluxygram/element
```

```js
import '@fluxygram/element'; // registers <fluxy-gram>
```

```html
<fluxy-gram src="/diagrams/checkout.flux.json"></fluxy-gram>

<!-- or inline -->
<fluxy-gram>
  <script type="application/json">
    { "type": "flow", "nodes": [{ "id": "a", "label": "Start" }, { "id": "b", "label": "Done" }], "edges": [{ "from": "a", "to": "b" }] }
  </script>
</fluxy-gram>
```

| Attribute | Values |
| --- | --- |
| `src` | URL of a `.flux.json` file |
| `autoplay` | `"false"` to start paused |
| `controls` | `"false"` to hide the step bar |
| `theme` | `dark` (default) or `light` |
| `lang` | `en` or `es` (defaults to the page / browser language) |
| `gestures` | `"full"` when the diagram is the main content (touch pan and pinch) |

Methods: `next()`, `prev()`, `goTo(i)`, `play()`, `pause()`, `replay()`. Property: `.diagram` (object or JSON string). Event: `fluxy-step` with `{ index, count }`.

Without a bundler, use the single-file build: [`fluxygram`](https://www.npmjs.com/package/fluxygram).

MIT license.
