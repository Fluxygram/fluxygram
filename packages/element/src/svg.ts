import type { LaidEdge, LaidGroup, LaidNode, Layout } from '@fluxygram/core';
import { iconElement } from './icons';

const NS = 'http://www.w3.org/2000/svg';

type Attrs = Record<string, string | number>;

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

export interface Scene {
  svg: SVGSVGElement;
  camera: SVGGElement;
  particles: SVGGElement;
  /** Capa sobre los nodos: pulsos y etiquetas que viajan. */
  overlay: SVGGElement;
  axis?: SVGGElement;
  /** Elemento animable por id (nodo, conexión o grupo). */
  parts: Map<string, SVGGElement>;
  /** Contenedor del nodo, para atenuarlo sin pisar su animación de entrada. */
  slots: Map<string, SVGGElement>;
  /** Paths de las conexiones, para que las partículas los recorran. */
  paths: Map<string, SVGPathElement>;
}

export function buildScene(layout: Layout, uid: string): Scene {
  const { w: W, h: H } = layout.stage;
  const svg = el('svg', { class: 'fx-stage', viewBox: `0 0 ${W} ${H}`, role: 'img' });
  const camera = el('g', { class: 'fx-camera' }, svg);

  // Cuadrícula de puntos: da sensación de lienzo y hace visible el movimiento de cámara.
  const defs = el('defs', {}, svg);
  const pattern = el('pattern', { id: `${uid}-grid`, width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, defs);
  el('circle', { cx: 1, cy: 1, r: 1, fill: 'var(--fx-grid)' }, pattern);
  const b = layout.bounds;
  el('rect', { x: b.x - 2000, y: b.y - 2000, width: b.w + 4000, height: b.h + 4000, fill: `url(#${uid}-grid)` }, camera);

  const parts = new Map<string, SVGGElement>();
  const slots = new Map<string, SVGGElement>();
  const paths = new Map<string, SVGPathElement>();

  const groupLayer = el('g', { class: 'fx-groups' }, camera);
  for (const g of layout.groups) parts.set(g.id, drawGroup(g, groupLayer));

  let axis: SVGGElement | undefined;
  if (layout.axis) {
    axis = el('g', { class: 'fx-axis' }, camera);
    el('line', { x1: layout.axis.x1, x2: layout.axis.x2, y1: layout.axis.y, y2: layout.axis.y, pathLength: 1 }, axis);
  }

  const edgeLayer = el('g', { class: 'fx-edges' }, camera);
  for (const e of layout.edges) {
    const { group, path } = drawEdge(e, edgeLayer);
    parts.set(e.id, group);
    paths.set(e.id, path);
  }

  const particles = el('g', { class: 'fx-particles' }, camera);

  const nodeLayer = el('g', { class: 'fx-nodes' }, camera);
  for (const n of layout.nodes) {
    const slot = el('g', { class: 'fx-slot', 'data-id': n.id, transform: `translate(${n.x} ${n.y})` }, nodeLayer);
    const part = layout.type === 'timeline' ? drawMilestone(n, layout.axis!.y, slot) : drawNode(n, slot);
    slots.set(n.id, slot);
    parts.set(n.id, part);
  }

  const overlay = el('g', { class: 'fx-overlay' }, camera);
  return { svg, camera, particles, overlay, axis, parts, slots, paths };
}

function drawGroup(g: LaidGroup, parent: Element) {
  const group = el('g', { class: 'fx-group', 'data-id': g.id }, parent);
  el('rect', { class: 'fx-group-box', x: g.x, y: g.y, width: g.w, height: g.h, rx: 16 }, group);
  const label = el('text', { class: 'fx-group-label', x: g.x + 16, y: g.y + 22 }, group);
  label.textContent = g.group.label;
  return group;
}

function drawEdge(e: LaidEdge, parent: Element) {
  const group = el('g', { class: 'fx-edge', 'data-id': e.id }, parent);
  const path = el('path', { class: 'fx-edge-line', d: e.d, pathLength: 1 }, group);
  const { x, y, angle } = e.end;
  el('path', { class: 'fx-edge-head', d: 'M0 0 L-9 -4.5 L-7 0 L-9 4.5 Z', transform: `translate(${x} ${y}) rotate(${angle})` }, group);

  if (e.edge.label && e.labelAt) {
    const w = Math.ceil(e.edge.label.length * 6.4) + 14;
    const label = el('g', { class: 'fx-edge-label', transform: `translate(${e.labelAt.x} ${e.labelAt.y})` }, group);
    el('rect', { x: -w / 2, y: -10, width: w, height: 20, rx: 6 }, label);
    const text = el('text', { 'text-anchor': 'middle', y: 4 }, label);
    text.textContent = e.edge.label;
  }
  return { group, path };
}

/** Insignia de estado (éxito, error, alerta, espera). Está siempre y el CSS muestra la que corresponde. */
function drawBadge(part: Element, x: number, y: number) {
  // Posición en un grupo y animación en otro: el transform de CSS pisaría el del atributo.
  const at = el('g', { transform: `translate(${x} ${y})` }, part);
  const g = el('g', { class: 'fx-badge' }, at);
  el('circle', { r: 9 }, g);
  el('path', { class: 'i-success', d: 'M-3.6 0.2 L-1.1 2.7 L3.6 -2.4' }, g);
  el('path', { class: 'i-error', d: 'M-2.8 -2.8 L2.8 2.8 M2.8 -2.8 L-2.8 2.8' }, g);
  el('path', { class: 'i-warning', d: 'M0 -4 V0.6 M0 3.4 V3.6' }, g);
  el('path', { class: 'i-pending', d: 'M0 -3.6 V0 L2.4 1.6' }, g);
}

function drawNode(n: LaidNode, slot: Element) {
  const { node, w, h } = n;
  const part = el('g', { class: `fx-node${node.accent ? ' is-accent' : ''}`, 'data-id': n.id }, slot);

  if (node.kind === 'decision') {
    el('path', { class: 'fx-shape', d: `M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`, 'stroke-linejoin': 'round' }, part);
  } else {
    const rx = node.kind === 'start' || node.kind === 'end' ? h / 2 : 12;
    el('rect', { class: 'fx-shape', width: w, height: h, rx }, part);
  }

  const icon = node.icon && node.kind !== 'decision' ? iconElement(node.icon, 16, h / 2 - 9, 18) : null;
  const center = !icon;
  const tx = center ? w / 2 : 44;
  const anchor = center ? 'middle' : 'start';
  if (icon) part.appendChild(icon);

  const label = el('text', { class: 'fx-label', x: tx, y: node.description ? h / 2 - 4 : h / 2 + 5, 'text-anchor': anchor }, part);
  label.textContent = node.label;
  if (node.description) {
    const desc = el('text', { class: 'fx-desc', x: tx, y: h / 2 + 15, 'text-anchor': anchor }, part);
    desc.textContent = node.description;
  }
  if (node.kind === 'decision') drawBadge(part, w * 0.75, h * 0.25);
  else drawBadge(part, w - 4, 4);
  return part;
}

function drawMilestone(n: LaidNode, axisY: number, slot: Element) {
  const { node, w, h, y } = n;
  const part = el('g', { class: `fx-node${node.accent ? ' is-accent' : ''}`, 'data-id': n.id }, slot);
  const above = y < axisY;
  const cx = w / 2;
  const localAxis = axisY - y;

  // Tallo y punto sobre el eje.
  el('line', { class: 'fx-stem', x1: cx, x2: cx, y1: above ? h : 0, y2: localAxis + (above ? -6 : 6) }, part);
  el('circle', { class: 'fx-dot', cx, cy: localAxis, r: 5 }, part);

  el('rect', { class: 'fx-shape', width: w, height: h, rx: 12 }, part);
  let ty = 26;
  if (node.date) {
    const date = el('text', { class: 'fx-date', x: 18, y: ty }, part);
    date.textContent = node.date;
    ty += 22;
  }
  const label = el('text', { class: 'fx-label', x: 18, y: ty }, part);
  label.textContent = node.label;
  if (node.description) {
    const desc = el('text', { class: 'fx-desc', x: 18, y: ty + 20 }, part);
    desc.textContent = node.description;
  }
  drawBadge(part, w - 4, 4);
  return part;
}
