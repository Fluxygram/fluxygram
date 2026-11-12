---
name: fluxygram
description: Create animated, step-by-step diagrams with Fluxygram by writing a .flux.json file. Use when the user asks to explain, visualize, diagram or animate a process, flow, system architecture, request path, decision tree, history or roadmap — for example "make an animated diagram of how OAuth works", "show how our backend handles an order", "draw a timeline of the company". Covers choosing the diagram type, writing nodes, edges and steps, and the storytelling rules that make the animation easy to follow.
---

# Fluxygram

Fluxygram turns a JSON file into an animated diagram that tells a story step by step. You write the JSON; Fluxygram computes the layout and the motion. You never position anything by hand.

## Workflow

1. **Pick the type** from what the user wants to explain (table below).
2. **List the nodes**: the 3 to 12 things the explanation is about. Short labels.
3. **Connect them** with edges (not needed for `timeline`).
4. **Write the story** as `steps`, one idea per step, each with a short caption. Optional, but it is what makes the diagram explain something.
5. **Check it** against the rules below and the schema at `/schema/v1.json`, then save it as `<name>.flux.json`.
6. **Show it**: embed it with `<fluxy-gram src="<name>.flux.json"></fluxy-gram>`, or paste it into the Fluxygram playground (`/play` on the Fluxygram site) to preview and validate it.

Write the labels and captions in the user's language.

## Choosing the type

| The user wants to explain… | type | Default motion (when there are no steps) |
| --- | --- | --- |
| Steps, a process, decisions, a pipeline, a user journey | `flow` | The path builds column by column; a particle runs along each new edge |
| A system: services, layers, who calls whom, where data lives | `architecture` | Layers appear bottom-up, then requests flow through every edge |
| History, a roadmap, releases, milestones in order | `timeline` | The camera moves from milestone to milestone |

If two types fit, prefer the one whose motion matches the question: "how does X happen" → `flow`; "how is X built" → `architecture`; "how did X change over time" → `timeline`.

## Format

```json
{
  "type": "flow",
  "title": "How a card payment is processed",
  "nodes": [
    { "id": "shop", "label": "Checkout", "icon": "cart", "kind": "start" },
    { "id": "gateway", "label": "Payment gateway", "description": "tokenizes the card", "icon": "shield" },
    { "id": "bank", "label": "Card issuer", "icon": "building" },
    { "id": "ok", "label": "Approved?", "kind": "decision" },
    { "id": "done", "label": "Order confirmed", "icon": "check", "kind": "end", "accent": true },
    { "id": "retry", "label": "Ask for another card", "icon": "card" }
  ],
  "edges": [
    { "id": "e1", "from": "shop", "to": "gateway", "carries": "card" },
    { "id": "e2", "from": "gateway", "to": "bank", "carries": "token" },
    { "id": "e3", "from": "bank", "to": "ok" },
    { "id": "yes", "from": "ok", "to": "done", "label": "yes" },
    { "id": "no", "from": "ok", "to": "retry", "label": "no" }
  ],
  "steps": [
    { "show": ["shop"], "caption": "The customer pays at checkout" },
    { "show": ["e1"], "flow": "e1", "caption": "The card never touches your server" },
    { "show": ["e2"], "flow": "e2", "caption": "The gateway asks the bank" },
    { "show": ["e3"], "flow": "e3", "state": { "bank": "pending" }, "caption": "The bank approves or declines" },
    { "show": ["no"], "flow": "no", "state": { "bank": "error", "no": "error" }, "caption": "Declined: the customer tries another card" },
    { "show": ["yes"], "flow": "yes", "state": { "bank": "success", "no": "default" }, "highlight": ["done"], "caption": "Approved: the order is confirmed" }
  ]
}
```

### Nodes

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique across nodes, edges and groups. Letters, digits, `-`, `_`. |
| `label` | yes | 1 to 3 words. It is a name, not a sentence. |
| `description` | no | One short line (under ~30 characters) under the label. |
| `icon` | no | One of the built-in names listed below. |
| `kind` | no | Block shape. `flow`: `decision` (diamond, phrase it as a question), `start` / `end` (pills), `data` (parallelogram: input or output), `database` (cylinder), `note` (folded note to annotate). `architecture`: `database`, `note`. |
| `group` | no | `architecture` only: the id of the layer it belongs to. |
| `date` | no | `timeline` only: `"1995"`, `"2026-03"`, `"Q3 2026"`. Milestones are sorted by it when every node has one. |
| `accent` | no | `true` on the one node that matters most (the outcome, the key service). Use it at most once or twice. |
| `state` | no | State from the start (`success`, `error`, `warning`, `pending`); steps can change it. Edges accept `state` too. |

Icons: `alert api book bot browser building cart chart check clock cloud code cpu card database disk file flag git globe heart idea image key layers lock mail message mobile monitor network notification package rocket search server settings shield store truck user users workflow zap`.

### Edges

`{ "id": "e1", "from": "a", "to": "b", "label": "optional", "carries": "optional" }`. Give edges an `id` whenever a step references them (otherwise their id is `"a->b"`). Labels are 1 or 2 words (`"yes"`, `"HTTPS"`, `"events"`).

`carries` is what travels along the edge, shown riding with the particle whenever the edge flows (`"token"`, `"$"`, `"order"`, `"event"`). Use it on the edges of the main path so the viewer sees *what* moves, not just that something moves. 1 or 2 words.

### Groups (architecture only)

`"groups": [{ "id": "clients", "label": "Clients" }, …]` listed **top to bottom**: who the user touches first goes on top, storage at the bottom. Every node in an architecture diagram should have a `group`.

### Steps

Steps are **cumulative**: whatever appears stays visible until a later step `hide`s it.

| Field | Effect |
| --- | --- |
| `show` | Elements that appear in this step. Showing an edge also shows its two nodes. |
| `flow` | Edge id or list of ids: a particle travels along them while the step is active. Also shows them. |
| `highlight` | Node ids that stand out; everything else dims. Use it to follow one path through a busy diagram. |
| `focus` | The camera moves in on one node or group. Use it for a detail, typically near the end. |
| `state` | Node **or connection** states from this step on: `{ "bank": "pending", "declined": "error" }`. Values: `success` (green, check), `error` (red, the node shakes), `warning` (amber, badge blinks), `pending` (in progress: dashed border spins), `default` (back to normal). On a connection it colors the line, its particle and its label. Persists until a later step changes it. |
| `hide` | Elements that disappear. Rarely needed. |
| `caption` | The sentence shown under the diagram. |
| `duration` | Seconds this step stays on screen in autoplay (overrides `motion.hold`). |

### Motion

The default motion is good; change it to match the tone of what is being explained.

```json
"motion": { "enter": "draw", "travel": "pulse", "speed": "slow", "camera": "follow", "finale": true }
```

| Field | Values | Use it when |
| --- | --- | --- |
| `enter` | `fade` (default), `scale`, `draw`, `slide` | `draw` for whiteboard-style explanations, `scale` for playful or product content, `slide` for pipelines that move one way |
| `travel` | `particle` (default), `pulse`, `dash`, `packets` | `pulse` for signals or energy, `dash` for continuous streams (logs, events), `packets` for data or requests in batches |
| `speed` | `slow`, `normal`, `fast` | `slow` for teaching or dense diagrams, `fast` for short loops on a landing page |
| `camera` | `follow` (default), `fixed` | `fixed` when the whole picture should stay in view (small diagrams, presentations) |
| `hold` | seconds (0.5–60) | Time each step stays on screen in autoplay. Omit it: Fluxygram times each step by how much enters and how long the caption is. |

A single step can set `"duration": 6` (seconds) to stay longer, for example one with a dense caption or a key outcome. `speed` changes how fast things move; `hold` and `duration` change how long each step waits.

Any node can set its own `"enter"` and any edge its own `"travel"`, overriding the diagram: for example one `"enter": "scale"` on the outcome node, or `"travel": "dash"` on a background stream while the main path uses particles. Use overrides to make one thing stand apart, not on every element.

### Ending

After the last step, Fluxygram adds an automatic finale: the camera zooms out to the whole diagram and particles run along every visible connection. Leave it on (the default); set `"motion": { "finale": false }` only when the last step must stay framed on a detail.

## Storytelling rules

These make the difference between a diagram that moves and one that explains.

1. **One idea per step.** If a caption needs "and", it is probably two steps.
2. **At most ~5 new elements per step.** A step that shows everything at once explains nothing.
3. **Captions under 12 words**, in plain language, saying *what happens*, not what the box is ("The gateway asks the bank", not "Payment gateway").
4. **Follow the reading order**: the order of `show` is the order things enter. Show a node before the edge that leaves it.
5. **Use `flow` for movement of something real** (a request, money, data, a message), not as decoration, and name it with `carries`.
6. **Use `state` for outcomes**: approved/declined, healthy/failing, in progress. Show the result on the node instead of describing it in the caption. **Not everything is green**: when a path fails, mark the node `error` and the connection that carries the failure `error` too, so the bad path reads red at a glance. Use `pending` while something is being processed and switch it to `success` or `error` in the next step.
7. **End on the outcome**: the last step highlights or focuses the result, and the full diagram is visible.
8. **Architecture**: build it bottom-up (data → services → edge → clients), then trace one request with `flow` + `highlight`.
9. **Timeline**: no steps needed unless you want captions; keep 4 to 10 milestones.
10. **5 to 8 steps** is the sweet spot. Under 3 feels static; over 10 feels slow.

## Before you hand it over

- Every `from`, `to`, `group` and step reference matches an existing `id`.
- No two elements share an `id`.
- Labels are short; nothing reads like a paragraph.
- The first step shows one or two things, the last step shows the outcome.
- The title says what the diagram shows ("How a card payment is processed"), not a topic ("Payments").

The renderer validates the file and shows readable errors (`edges[2].to "to" points to "x", which is not a node.`) — fix exactly what it names.

## More examples

See `examples/` next to this file: `order.flux.json` (flow with a decision, no steps), `architecture.flux.json` (layers + traced request + focus), `web-history.flux.json` (timeline), `how-it-works.flux.json` (flow with captions).
