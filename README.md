# Fluxygram

**Diagrams that explain themselves.** Describe anything in JSON; Fluxygram draws it and tells it step by step, with motion that helps people understand.

[Español](#español)

```html
<script type="module">import '@fluxygram/element';</script>
<fluxy-gram src="order.flux.json"></fluxy-gram>
```

```json
{
  "type": "flow",
  "title": "How an order gets processed",
  "nodes": [
    { "id": "start", "label": "Order received", "kind": "start", "icon": "cart" },
    { "id": "stock", "label": "In stock?", "kind": "decision" },
    { "id": "pay", "label": "Charge", "icon": "card" },
    { "id": "done", "label": "Delivered", "kind": "end", "accent": true }
  ],
  "edges": [
    { "from": "start", "to": "stock" },
    { "from": "stock", "to": "pay", "label": "yes" },
    { "from": "pay", "to": "done" }
  ]
}
```

## Diagram types

| Type | Explains | Motion |
| --- | --- | --- |
| `flow` | steps, decisions, pipelines | the path builds up and a particle runs along each new edge |
| `architecture` | systems, layers, services | layers appear bottom-up, requests travel between services |
| `timeline` | history, roadmaps | the camera moves from milestone to milestone |

Steps are optional. With them you control the story: `show`, `flow`, `highlight`, `focus`, `caption`. See [`skills/fluxygram/SKILL.md`](skills/fluxygram/SKILL.md) for the full format and the storytelling rules, and [`site/public/schema/v1.json`](site/public/schema/v1.json) for the JSON Schema.

## Visual editor

`/play` is a canvas editor that runs entirely in the browser: drag nodes from the toolbar, drag from a node's dot to connect it, edit properties on the side, and build the story step by step at the bottom. Open or drop a `.flux.json` to edit it; download the JSON, share a link (the diagram is compressed into the URL, no server involved) or export a single self-contained HTML file.

Dragging a node pins it (`x`, `y` in the JSON); everything else keeps its automatic layout. "Auto layout" removes the pins.

## Install

```bash
npm install @fluxygram/element
```

```js
import '@fluxygram/element';
```

No bundler? One file from a CDN:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/fluxygram@0.1"></script>
<fluxy-gram src="order.flux.json"></fluxy-gram>
```

| Package | What it is |
| --- | --- |
| [`@fluxygram/element`](packages/element) | The `<fluxy-gram>` web component |
| [`@fluxygram/core`](packages/core) | Format, validation, layout and motion. No DOM |
| [`fluxygram`](packages/fluxygram) | Single-file build for `<script>` tags and CDNs |

## For agents

The skill in [`skills/fluxygram`](skills/fluxygram) teaches an agent the format, how to pick the diagram type and how to write good steps, plus a recipe for diagramming a whole codebase.

**Claude Code**

```
/plugin marketplace add Fluxygram/fluxygram
/plugin install fluxygram@fluxygram
```

**Cursor, Windsurf, Codex, Copilot and other coding agents**: save the skill in your project and point the agent at it.

```bash
curl -o FLUXYGRAM.md https://fluxygram.salamancacmcol.workers.dev/skill.md
```

**ChatGPT, Gemini, Claude.ai**: the site has a "Copy prompt" button for each one that pastes the whole skill and asks for the JSON; paste the answer in the editor.

## Repository

| Path | What it is |
| --- | --- |
| `packages/core` | Format, validation, layout and motion grammar. No framework, no DOM. |
| `packages/element` | `<fluxy-gram>` web component (SVG + CSS transitions). |
| `site` | Landing page, examples and playground (Vite). |
| `skills/fluxygram` | Agent skill and examples (also a Claude Code plugin, see `.claude-plugin/`). |
| `packages/fluxygram` | Single-file build for `<script>` tags and CDNs. |
| `wrangler.jsonc` | Cloudflare Workers config for the site. |

```bash
pnpm install
pnpm dev        # site on http://localhost:5173
pnpm typecheck
pnpm cf:login   # once: log in with the Cloudflare account that owns Fluxygram
pnpm run deploy # build + deploy to Cloudflare Workers (uses only that login)
```

The site and the component pick English or Spanish from the browser language (`lang` attribute wins when set).

## License

- `packages/core`, `packages/element`, `packages/fluxygram` and `skills/fluxygram`: **MIT**. Use, embed and ship them anywhere.
- `site` (landing, editor, presentation mode): **FSL-1.1-ALv2**. Free to read, modify and self-host for your own use; not to offer as a competing commercial service. Every release becomes Apache 2.0 after two years.

Details in [LICENSE.md](LICENSE.md).

---

## Español

**Diagramas que se explican solos.** Describes cualquier cosa en un JSON y Fluxygram la dibuja y la cuenta paso a paso, con movimiento que ayuda a entender.

- Tres tipos en esta versión: `flow` (procesos y decisiones), `architecture` (sistemas por capas) y `timeline` (historia y roadmaps). Cada uno se mueve a su manera.
- Los pasos (`steps`) son opcionales: sin ellos, el diagrama usa el movimiento por defecto de su tipo.
- La carpeta [`skills/fluxygram`](skills/fluxygram) le enseña a cualquier agente a escribir diagramas de Fluxygram. En Claude Code se instala con `/plugin marketplace add Fluxygram/fluxygram` y `/plugin install fluxygram@fluxygram`.
- Paquetes en npm: `@fluxygram/element` (el componente), `@fluxygram/core` (el formato) y `fluxygram` (un solo archivo para usar desde un CDN).
- El sitio y el componente se muestran en inglés o español según el idioma del navegador.

```bash
pnpm install
pnpm dev
pnpm run deploy
```

### Licencia

- `packages/core`, `packages/element`, `packages/fluxygram` y `skills/fluxygram`: **MIT**. Se pueden usar, incrustar y distribuir en cualquier parte.
- `site` (landing, editor, modo presentación): **FSL-1.1-ALv2**. Libre para leer, modificar e instalar para uso propio; no para ofrecerlo como un servicio comercial que compita. Cada versión pasa a Apache 2.0 a los dos años.

Detalles en [LICENSE.md](LICENSE.md).
