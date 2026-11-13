<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/mark-on-dark.svg">
    <img src=".github/assets/mark-on-light.svg" alt="Fluxygram" width="72" height="72">
  </picture>
</p>

<h1 align="center">Fluxygram</h1>

<p align="center">
  <strong>Diagrams that explain themselves.</strong><br>
  Describe anything in JSON; Fluxygram draws it and tells it step by step, with motion that helps people understand.
</p>

<p align="center">
  <a href="https://fluxygram.app">Website</a> ·
  <a href="https://fluxygram.app/play">Editor</a> ·
  <a href="https://docs.fluxygram.app">Docs</a> ·
  <a href="#for-agents">For agents</a> ·
  <a href="https://github.com/Fluxygram/fluxygram/discussions">Discussions</a> ·
  <a href="#español">Español</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@fluxygram/element"><img src="https://img.shields.io/npm/v/@fluxygram/element?label=npm&color=2bff88&labelColor=16161c" alt="npm version"></a>
  <a href="https://github.com/Fluxygram/fluxygram/actions/workflows/ci.yml"><img src="https://github.com/Fluxygram/fluxygram/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-MIT%20%2B%20FSL-16161c" alt="License: MIT + FSL"></a>
</p>

---

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/fluxygram@0.1"></script>

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

That's a complete diagram. With no steps, it uses the default motion of its type; add `steps` to tell your own story.

## Diagram types

| Type | Explains | Default motion |
| --- | --- | --- |
| `flow` | steps, decisions, pipelines, user journeys | the path builds column by column; a particle runs along each new edge |
| `architecture` | systems, layers, services | layers appear bottom-up, then requests travel between services |
| `timeline` | history, roadmaps, releases | the camera moves from milestone to milestone |
| `tree` | hierarchies, org charts, categories | grows from the root, level by level |
| `cycle` | loops, feedback, anything that repeats | each stage appears around the ring; at the end it all loops |
| `sequence` | API calls, logins, protocols | participants appear, then each message crosses between lifelines |
| `mindmap` | ideas around a topic, plans, syllabi | the central idea first, then one branch at a time |

You can switch a diagram's type at any time without losing its nodes and connections.

## Telling the story

Each step says what changes:

| Field | What it does |
| --- | --- |
| `show` / `hide` | Elements that appear or disappear |
| `flow` | A particle travels along these connections |
| `highlight` | These nodes stand out, everything else dims |
| `focus` | The camera moves in on a node or group |
| `state` | `success`, `error`, `warning` or `pending` on nodes **and connections** (errors shake, pending spins) |
| `caption` | The sentence under the diagram |
| `duration` | Seconds this step stays on screen |
| `notes` | Speaker notes, only visible to the presenter |

`motion` sets the style for the whole diagram, or per block and connection: how things enter (`fade`, `scale`, `draw`, `slide`), how they travel (`particle`, `pulse`, `dash`, `packets`), the speed, and whether the camera follows the action. At the end, the camera pulls back to show the whole picture.

Full documentation at **[docs.fluxygram.app](https://docs.fluxygram.app)**: every field, every type with live examples, the component API and guides. Also: [`SKILL.md`](skills/fluxygram/SKILL.md) (format and storytelling rules) and the [JSON Schema](https://fluxygram.app/schema/v1.json).

## Editor and presentation mode

[fluxygram.app/play](https://fluxygram.app/play) is a canvas editor that runs entirely in your browser:

- Drag blocks from the palette, drag from a block's dot to connect it, and edit everything in the side panel (or in the JSON tab, with live validation).
- Build the story step by step: captions, states, timing and speaker notes.
- Open or drop a `.flux.json`, download it, share a link (the diagram is compressed into the URL, no server involved) or export a single self-contained HTML file.
- **Present** opens the diagram full screen for your audience. Press <kbd>N</kbd> for a second window with your notes, the next step and a timer.

Dragging a block pins it (`x`, `y` in the JSON); everything else keeps its automatic layout.

## Install

```bash
npm install @fluxygram/element
```

```js
import '@fluxygram/element'; // registers <fluxy-gram>
```

| Package | What it is |
| --- | --- |
| [`@fluxygram/element`](packages/element) | The `<fluxy-gram>` web component. Works in any framework, or none |
| [`@fluxygram/core`](packages/core) | Format, validation, layout and motion. No DOM |
| [`fluxygram`](packages/fluxygram) | Single-file build for `<script>` tags and CDNs |

The component picks English or Spanish from the page or browser language (the `lang` attribute wins when set).

## For agents

The skill in [`skills/fluxygram`](skills/fluxygram) teaches an agent the format, how to pick the diagram type and how to write good steps, plus a recipe for diagramming a whole codebase.

**Claude Code**

```
/plugin marketplace add Fluxygram/fluxygram
/plugin install fluxygram@fluxygram
```

**Cursor, Windsurf, Codex, Copilot and other coding agents**: save the skill in your project and point the agent at it.

```bash
curl -o FLUXYGRAM.md https://fluxygram.app/skill.md
```

**ChatGPT, Gemini, Claude.ai**: the [website](https://fluxygram.app/#agents) has a "Copy prompt" button for each one that includes the whole skill; paste the answer in the editor.

## Contributing

Questions, ideas and diagrams go to [Discussions](https://github.com/Fluxygram/fluxygram/discussions); bugs and concrete requests to [issues](https://github.com/Fluxygram/fluxygram/issues/new/choose). Read [CONTRIBUTING.md](CONTRIBUTING.md) to set up the project and open a pull request. Contributors sign the [CLA](CLA.md) once, on their first PR. Security problems: [SECURITY.md](SECURITY.md).

```bash
pnpm install
pnpm dev        # site, editor and presentation mode on http://localhost:5173
pnpm typecheck
```

| Path | What it is |
| --- | --- |
| `packages/core` | Format, validation, layout and motion. No framework, no DOM |
| `packages/element` | `<fluxy-gram>` web component (SVG, CSS transitions, Web Animations) |
| `packages/fluxygram` | Single-file build for CDNs |
| `site` | Landing, editor, viewer and presentation mode (Vite), deployed on Cloudflare Workers |
| `docs` | Documentation at docs.fluxygram.app (Astro Starlight), in English and Spanish |
| `skills/fluxygram` | Agent skill and examples, also a Claude Code plugin (`.claude-plugin/`) |

## License

- `packages/*`, `skills/fluxygram` and `docs`: **MIT**. Use, embed and ship them anywhere.
- `site` (landing, editor, presentation mode): **FSL-1.1-ALv2**. Free to read, modify and self-host for your own use; not to offer as a competing commercial service. Every release becomes Apache 2.0 after two years.

Details in [LICENSE.md](LICENSE.md).

---

## Español

**Diagramas que se explican solos.** Describes cualquier cosa en un JSON y Fluxygram la dibuja y la cuenta paso a paso, con movimiento que ayuda a entender.

- **Siete tipos de diagrama:** `flow` (procesos y decisiones), `architecture` (sistemas por capas), `timeline` (historia y roadmaps), `tree` (jerarquías), `cycle` (ciclos), `sequence` (quién le habla a quién, en orden) y `mindmap` (ideas alrededor de un tema). Cada uno se mueve a su manera, y se puede cambiar de tipo sin perder el contenido.
- **Pasos opcionales:** sin ellos, el diagrama usa el movimiento de su tipo. Con ellos decides qué aparece, por dónde viaja la partícula, qué se resalta, a dónde va la cámara, los estados (éxito, error, advertencia, en progreso) en bloques y conexiones, el texto de cada paso y su duración.
- **Editor visual** en [fluxygram.app/play](https://fluxygram.app/play): arrastras bloques, los conectas, armas la historia paso a paso y compartes un link, descargas el JSON o exportas un HTML. Todo pasa en tu navegador.
- **Modo presentación:** el diagrama a pantalla completa para tu público y, con la tecla <kbd>N</kbd>, una segunda ventana con tus notas, el siguiente paso y un cronómetro.
- **Para agentes:** la carpeta [`skills/fluxygram`](skills/fluxygram) le enseña a cualquier agente a escribir diagramas. En Claude Code se instala con `/plugin marketplace add Fluxygram/fluxygram` y `/plugin install fluxygram@fluxygram`; para ChatGPT, Gemini o Claude.ai, el sitio tiene un botón "Copiar prompt".
- **Documentación** completa en [docs.fluxygram.app/es](https://docs.fluxygram.app/es/), con ejemplos en vivo de cada tipo.
- **Paquetes en npm:** `@fluxygram/element` (el componente), `@fluxygram/core` (el formato) y `fluxygram` (un solo archivo para usar desde un CDN).
- El sitio y el componente se muestran en inglés o español según el idioma del navegador.

### Contribuir

Las preguntas e ideas van en [Discussions](https://github.com/Fluxygram/fluxygram/discussions) y los errores en [issues](https://github.com/Fluxygram/fluxygram/issues/new/choose), en inglés o español. La guía está en [CONTRIBUTING.md](CONTRIBUTING.md); en tu primer pull request firmas el [CLA](CLA.md) una sola vez.

### Licencia

- `packages/*`, `skills/fluxygram` y `docs`: **MIT**. Se pueden usar, incrustar y distribuir en cualquier parte.
- `site` (landing, editor, modo presentación): **FSL-1.1-ALv2**. Libre para leer, modificar e instalar para uso propio; no para ofrecerlo como un servicio comercial que compita. Cada versión pasa a Apache 2.0 a los dos años.

Detalles en [LICENSE.md](LICENSE.md).
