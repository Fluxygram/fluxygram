import type { Diagram } from '@fluxygram/core';
import { layout } from '@fluxygram/core';
import { ArrowLeftRight, BrainCircuit, Layers, Milestone, Network, RefreshCw, Workflow, type IconNode } from 'lucide';

/** Ícono de cada tipo de diagrama (el mismo del selector de tipo del editor). */
export const TYPE_ICONS: Record<string, IconNode> = {
  flow: Workflow, architecture: Layers, timeline: Milestone, tree: Network, cycle: RefreshCw, sequence: ArrowLeftRight, mindmap: BrainCircuit,
};
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Miniatura estática: la misma posición de bloques que el diagrama real, sin animación ni texto. */
export function thumbnail(diagram: Diagram): SVGSVGElement | null {
  let lay;
  try {
    lay = layout(diagram);
  } catch {
    return null;
  }
  const pad = 24;
  const b = lay.bounds;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  const add = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    // Mismo grosor de línea en cualquier tamaño: los flujos largos no quedan con trazos invisibles.
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(el);
  };
  for (const g of lay.groups) add('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 14, class: 'th-group' });
  for (const l of lay.lifelines ?? []) add('line', { x1: l.x, y1: l.y1, x2: l.x, y2: l.y2, class: 'th-life' });
  if (lay.axis) add('line', { x1: lay.axis.x1, y1: lay.axis.y, x2: lay.axis.x2, y2: lay.axis.y, class: 'th-edge' });
  for (const e of lay.edges) add('path', { d: e.d, class: 'th-edge' });
  for (const n of lay.nodes) {
    const round = n.node.kind === 'start' || n.node.kind === 'end' ? n.h / 2 : 10;
    add('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: round, class: n.node.accent ? 'th-node th-accent' : 'th-node' });
  }
  return svg;
}

