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

Steps are optional. With them you control the story: `show`, `flow`, `highlight`, `focus`, `caption`. See [`skill/SKILL.md`](skill/SKILL.md) for the full format and the storytelling rules, and [`site/public/schema/v1.json`](site/public/schema/v1.json) for the JSON Schema.

## For agents

[`skill/`](skill) is an agent skill: it teaches an agent the format, how to pick the diagram type and how to write good steps. Copy it into your agent's skills folder (for Claude Code: `~/.claude/skills/fluxygram/`).

## Repository

| Path | What it is |
| --- | --- |
| `packages/core` | Format, validation, layout and motion grammar. No framework, no DOM. |
| `packages/element` | `<fluxy-gram>` web component (SVG + CSS transitions). |
| `site` | Landing page, examples and playground (Vite). |
| `skill` | Agent skill and examples. |
| `wrangler.jsonc` | Cloudflare Workers config for the site. |

```bash
pnpm install
pnpm dev        # site on http://localhost:5173
pnpm typecheck
pnpm cf:login   # once: log in with the Cloudflare account that owns Fluxygram
pnpm run deploy # build + deploy to Cloudflare Workers (uses only that login)
```

The site and the component pick English or Spanish from the browser language (`lang` attribute wins when set).

---

## Español

**Diagramas que se explican solos.** Describes cualquier cosa en un JSON y Fluxygram la dibuja y la cuenta paso a paso, con movimiento que ayuda a entender.

- Tres tipos en esta versión: `flow` (procesos y decisiones), `architecture` (sistemas por capas) y `timeline` (historia y roadmaps). Cada uno se mueve a su manera.
- Los pasos (`steps`) son opcionales: sin ellos, el diagrama usa el movimiento por defecto de su tipo.
- La carpeta [`skill/`](skill) le enseña a cualquier agente a escribir diagramas de Fluxygram.
- El sitio y el componente se muestran en inglés o español según el idioma del navegador.

```bash
pnpm install
pnpm dev
pnpm run deploy
```
