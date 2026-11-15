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
    const enter = n.node.enter ?? layout.motion?.enter ?? 'fade';
    const part = layout.type === 'timeline' ? drawMilestone(n, layout.axis!.y, slot) : drawNode(n, slot);
    part.setAttribute('data-enter', enter);
    // Secuencia: la línea de vida baja desde el participante, detrás de los mensajes.
    const life = layout.lifelines?.find((l) => l.id === n.id);
    if (life) {
      const line = el('line', { class: 'fx-lifeline', x1: life.x - n.x, x2: life.x - n.x, y1: life.y1 - n.y, y2: life.y2 - n.y });
      part.prepend(line);
    }
    // Para "dibujar" el borde, la longitud del trazo se normaliza a 1.
    if (enter === 'draw') part.querySelectorAll('.fx-shape, .fx-rim').forEach((s) => s.setAttribute('pathLength', '1'));
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

/** Rectángulo redondeado como path: un <rect> no siempre acepta pathLength para animar su trazo. */
const roundRect = (w: number, h: number, r: number) =>
  `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r} V${r} A${r} ${r} 0 0 1 ${r} 0 Z`;

/** Insignia de estado (éxito, error, alerta, espera). Está siempre y el CSS muestra la que corresponde. */
function drawBadge(part: Element, x: number, y: number) {
  // Posición en un grupo y animación en otro: el transform de CSS pisaría el del atributo.
  const at = el('g', { transform: `translate(${x} ${y})` }, part);
  const g = el('g', { class: 'fx-badge' }, at);
  el('circle', { r: 9 }, g);
  el('path', { class: 'i-success', d: 'M-3.6 0.2 L-1.1 2.7 L3.6 -2.4' }, g);
  el('path', { class: 'i-error', d: 'M-2.8 -2.8 L2.8 2.8 M2.8 -2.8 L-2.8 2.8' }, g);
  el('path', { class: 'i-warning', d: 'M0 -4 V0.6 M0 3.4 V3.6' }, g);
  el('path', { class: 'i-pending', d: 'M0 -3.8 A3.8 3.8 0 1 1 -3.8 0' }, g);
}

/** Dónde va el ícono en cada forma (por defecto, a 16 px del borde). */
const ICON_X: Partial<Record<string, number>> = { data: 22, event: 18, queue: 24, subprocess: 22, prepare: 22 };
/** Cuánto baja (o sube) el texto respecto al centro. */
const CY_SHIFT: Partial<Record<string, number>> = { database: 3.5, cloud: 9, screen: 6, document: -4 };
/** Corrimiento del texto centrado (formas asimétricas). */
const CENTER_SHIFT: Partial<Record<string, number>> = { wait: -8 };

function drawNode(n: LaidNode, slot: Element) {
  const { node, w, h } = n;
  const part = el('g', { class: `fx-node${node.accent ? ' is-accent' : ''}`, 'data-id': n.id }, slot);

  const RY = 7; // radio vertical de la tapa del cilindro
  switch (node.kind) {
    case 'decision':
      el('path', { class: 'fx-shape', d: `M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`, 'stroke-linejoin': 'round' }, part);
      break;
    case 'data':
      el('path', { class: 'fx-shape', d: `M14 0 H${w} L${w - 14} ${h} H0 Z`, 'stroke-linejoin': 'round' }, part);
      break;
    case 'database':
      el('path', { class: 'fx-shape', d: `M0 ${RY} A${w / 2} ${RY} 0 0 1 ${w} ${RY} V${h - RY} A${w / 2} ${RY} 0 0 1 0 ${h - RY} Z` }, part);
      el('path', { class: 'fx-rim', d: `M0 ${RY} A${w / 2} ${RY} 0 0 0 ${w} ${RY}` }, part);
      break;
    case 'note':
      el('path', { class: 'fx-shape fx-note', d: `M0 0 H${w - 14} L${w} 14 V${h} H0 Z`, 'stroke-linejoin': 'round' }, part);
      el('path', { class: 'fx-rim', d: `M${w - 14} 0 V14 H${w}` }, part);
      break;
    case 'person': {
      // Píldora con el avatar a la izquierda: alguien que hace algo.
      el('path', { class: 'fx-shape', d: roundRect(w, h, h / 2) }, part);
      el('circle', { class: 'fx-rim fx-avatar', cx: h / 2, cy: h / 2, r: h / 2 - 7 }, part);
      break;
    }
    case 'event':
      // Doble contorno, como los eventos de BPMN: algo que pasa.
      el('path', { class: 'fx-shape', d: roundRect(w, h, h / 2) }, part);
      el('path', { class: 'fx-rim', d: roundRect(w - 8, h - 8, (h - 8) / 2), transform: 'translate(4 4)' }, part);
      break;
    case 'document': {
      // Hoja con el borde inferior ondulado.
      const b = h - 7;
      el('path', { class: 'fx-shape', d: `M12 0 H${w - 12} Q${w} 0 ${w} 12 V${b} Q${w * 0.75} ${b - 9} ${w / 2} ${b} T0 ${b} V12 Q0 0 12 0 Z`, 'stroke-linejoin': 'round' }, part);
      break;
    }
    case 'wait':
      // Forma de D: una espera o una demora.
      el('path', { class: 'fx-shape', d: `M12 0 H${w - h / 2} A${h / 2} ${h / 2} 0 0 1 ${w - h / 2} ${h} H12 Q0 ${h} 0 ${h - 12} V12 Q0 0 12 0 Z` }, part);
      break;
    case 'cloud': {
      // Tres bultos arriba que se reparten según el ancho, y la base plana.
      const top = h * 0.42;
      const x0 = h * 0.24;
      const x3 = w - h * 0.24;
      const c = (x3 - x0) / 3;
      const r = c * 0.56;
      const side = h * 0.34;
      const pts = [[x0, top + 6], [x0 + c, top - 3], [x0 + 2 * c, top - 6], [x3, top + 6]];
      let d = `M${h * 0.34} ${h} A${side} ${side} 0 0 1 ${pts[0]![0]} ${pts[0]![1]}`;
      for (let k = 1; k < pts.length; k++) d += ` A${r} ${r} 0 0 1 ${pts[k]![0]} ${pts[k]![1]}`;
      d += ` A${side} ${side} 0 0 1 ${w - h * 0.34} ${h} Z`;
      el('path', { class: 'fx-shape', d, 'stroke-linejoin': 'round' }, part);
      break;
    }
    case 'queue': {
      // Cilindro acostado: cosas esperando en fila.
      const rx = 9;
      el('path', { class: 'fx-shape', d: `M${rx} 0 H${w - rx} A${rx} ${h / 2} 0 0 1 ${w - rx} ${h} H${rx} A${rx} ${h / 2} 0 0 1 ${rx} 0 Z` }, part);
      el('path', { class: 'fx-rim', d: `M${w - rx} 0 A${rx} ${h / 2} 0 0 0 ${w - rx} ${h}` }, part);
      break;
    }
    case 'subprocess':
      el('path', { class: 'fx-shape', d: roundRect(w, h, 10) }, part);
      el('path', { class: 'fx-rim', d: `M12 0 V${h} M${w - 12} 0 V${h}` }, part);
      break;
    case 'screen':
      // Una ventana: lo que ve el usuario.
      el('path', { class: 'fx-shape', d: roundRect(w, h, 10) }, part);
      el('path', { class: 'fx-rim', d: `M0 14 H${w}` }, part);
      for (const x of [10, 17, 24]) el('circle', { class: 'fx-rim fx-dot', cx: x, cy: 7, r: 1.8 }, part);
      break;
    case 'prepare':
      // Hexágono: preparar, alistar, configurar.
      el('path', { class: 'fx-shape', d: `M16 0 H${w - 16} L${w} ${h / 2} L${w - 16} ${h} H16 L0 ${h / 2} Z`, 'stroke-linejoin': 'round' }, part);
      break;
    default: {
      const rx = node.kind === 'start' || node.kind === 'end' ? h / 2 : 12;
      el('path', { class: 'fx-shape', d: roundRect(w, h, rx) }, part);
    }
  }

  // Algunas formas corren el texto: debajo de la tapa del cilindro, de la barra de la ventana, sobre la onda.
  const cy = h / 2 + (CY_SHIFT[node.kind ?? 'default'] ?? 0);
  const person = node.kind === 'person';
  const iconName = node.icon ?? (person ? 'user' : undefined);
  const iconX = person ? h / 2 - 9 : (ICON_X[node.kind ?? 'default'] ?? 16);
  const icon = iconName && node.kind !== 'decision' ? iconElement(iconName, iconX, cy - 9, 18) : null;
  const center = !icon;
  const tx = person ? h + 4 : center ? w / 2 + (CENTER_SHIFT[node.kind ?? 'default'] ?? 0) : iconX + 28;
  const anchor = center ? 'middle' : 'start';
  if (icon) part.appendChild(icon);

  const label = el('text', { class: `fx-label${node.kind === 'note' ? ' fx-note-text' : ''}`, x: tx, y: node.description ? cy - 4 : cy + 5, 'text-anchor': anchor }, part);
  label.textContent = node.label;
  if (node.description) {
    const desc = el('text', { class: 'fx-desc', x: tx, y: cy + 15, 'text-anchor': anchor }, part);
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

  el('path', { class: 'fx-shape', d: roundRect(w, h, 12) }, part);
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
