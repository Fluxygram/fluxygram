import { computeRanks, edgeId } from './layout';
import type { Diagram, FluxStep, Layout, MotionPlan, Rect, StepState } from './types';

const list = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/**
 * Convierte un diagrama en una secuencia de estados. Si el JSON trae `steps`, se respetan;
 * si no, cada tipo aplica su gramática de movimiento por defecto:
 *
 * - flow:         el camino se construye columna por columna y una partícula recorre cada tramo nuevo.
 * - architecture: las capas aparecen de abajo hacia arriba; al final las peticiones viajan por todo el sistema.
 * - timeline:     la cámara avanza hito por hito.
 */
export function plan(diagram: Diagram, layout: Layout): MotionPlan {
  const steps = diagram.steps?.length ? diagram.steps : defaultSteps(diagram);
  return { steps: resolve(diagram, layout, steps) };
}

function defaultSteps(diagram: Diagram): FluxStep[] {
  const edges = diagram.edges ?? [];

  if (diagram.type === 'timeline') {
    return orderedTimeline(diagram).map((n) => ({ show: [n.id] }));
  }

  if (diagram.type === 'architecture' && diagram.groups?.length) {
    const seen = new Set<string>();
    const steps: FluxStep[] = [];
    const layers = [...diagram.groups].reverse();
    for (const g of layers) {
      const members = diagram.nodes.filter((n) => n.group === g.id).map((n) => n.id);
      members.forEach((id) => seen.add(id));
      const links = edges.filter((e) => seen.has(e.from) && seen.has(e.to) && (members.includes(e.from) || members.includes(e.to)));
      steps.push({ show: [g.id, ...members, ...links.map(edgeId)] });
    }
    const loose = diagram.nodes.filter((n) => !n.group).map((n) => n.id);
    if (loose.length) steps.push({ show: loose });
    if (edges.length) steps.push({ flow: edges.map(edgeId) });
    return steps;
  }

  // flow (y architecture sin grupos): rango por rango.
  const { rank } = computeRanks(diagram);
  const max = Math.max(0, ...rank.values());
  const steps: FluxStep[] = [];
  const seen = new Set<string>();
  for (let r = 0; r <= max; r++) {
    const ids = diagram.nodes.filter((n) => rank.get(n.id) === r).map((n) => n.id);
    ids.forEach((id) => seen.add(id));
    const links = edges.filter((e) => seen.has(e.from) && seen.has(e.to) && (ids.includes(e.to) || ids.includes(e.from)));
    const into = links.filter((e) => ids.includes(e.to)).map(edgeId);
    steps.push({ show: [...ids, ...links.map(edgeId)], flow: into });
  }
  return steps;
}

function orderedTimeline(diagram: Diagram) {
  const dated = diagram.nodes.every((n) => n.date);
  return dated ? [...diagram.nodes].sort((a, b) => a.date!.localeCompare(b.date!, undefined, { numeric: true })) : diagram.nodes;
}

function resolve(diagram: Diagram, layout: Layout, steps: FluxStep[]): StepState[] {
  const edges = new Map(layout.edges.map((e) => [e.id, e]));
  const nodes = new Map(layout.nodes.map((n) => [n.id, n]));
  const groups = new Map(layout.groups.map((g) => [g.id, g]));
  const full: Rect = layout.bounds;

  const visible = new Set<string>();
  const states: StepState[] = [];
  let lastNode: string | undefined;

  for (const step of steps) {
    const entering: string[] = [];
    const reveal = (id: string) => {
      if (visible.has(id)) return;
      visible.add(id);
      entering.push(id);
    };

    for (const id of [...(step.show ?? []), ...list(step.flow)]) {
      const e = edges.get(id);
      if (e) {
        // Una conexión nunca aparece colgando: trae sus extremos.
        reveal(e.edge.from);
        reveal(e.edge.to);
      }
      reveal(id);
      if (nodes.has(id)) lastNode = id;
    }
    for (const id of step.hide ?? []) visible.delete(id);

    // Un grupo es visible cuando alguno de sus miembros lo es.
    for (const n of diagram.nodes) {
      if (n.group && visible.has(n.id) && !visible.has(n.group)) {
        visible.add(n.group);
        entering.unshift(n.group);
      }
    }

    const isLast = states.length === steps.length - 1;
    const active = [...entering, ...list(step.flow), ...list(step.highlight)];
    states.push({
      visible: new Set(visible),
      entering: entering.filter((id) => visible.has(id)),
      flowing: list(step.flow).filter((id) => edges.has(id)),
      highlighted: list(step.highlight),
      camera: cameraFor(step, layout, full, nodes, groups, lastNode, active, isLast),
      caption: step.caption,
    });
  }
  return states;
}

/** Caja que envuelve los elementos indicados (nodos, grupos y extremos de conexiones). */
function boxOf(ids: string[], layout: Layout): Rect | undefined {
  const rects: Rect[] = [];
  for (const id of ids) {
    const n = layout.nodes.find((x) => x.id === id) ?? layout.groups.find((x) => x.id === id);
    if (n) rects.push(n);
    const e = layout.edges.find((x) => x.id === id);
    if (e) for (const end of [e.edge.from, e.edge.to]) {
      const m = layout.nodes.find((x) => x.id === end);
      if (m) rects.push(m);
    }
  }
  if (!rects.length) return undefined;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
}

/** Mantiene un rectángulo de cámara dentro del contenido. */
function clampTo(r: Rect, full: Rect): Rect {
  const w = Math.min(r.w, full.w);
  const h = Math.min(r.h, full.h);
  return {
    x: Math.min(Math.max(r.x, full.x), full.x + full.w - w),
    y: Math.min(Math.max(r.y, full.y), full.y + full.h - h),
    w,
    h,
  };
}

function cameraFor(
  step: FluxStep,
  layout: Layout,
  full: Rect,
  nodes: Map<string, Rect>,
  groups: Map<string, Rect>,
  lastNode: string | undefined,
  active: string[],
  isLast: boolean,
): Rect {
  const { w: W, h: H } = layout.stage;
  const aspect = W / H;
  const wide = full.w > W + 1 || full.h > H + 1;

  const target = step.focus ? (nodes.get(step.focus) ?? groups.get(step.focus)) : undefined;
  if (target) {
    // Acercamiento moderado: el elemento queda grande pero con contexto alrededor.
    const rw = Math.max(target.w * 2.4, W * 0.5, target.h * 2.4 * aspect);
    const rh = rw / aspect;
    return { x: target.x + target.w / 2 - rw / 2, y: target.y + target.h / 2 - rh / 2, w: rw, h: rh };
  }

  if (layout.type === 'timeline') {
    const anchor = lastNode ? nodes.get(lastNode) : undefined;
    const cx = anchor ? anchor.x + anchor.w / 2 : full.x + W / 2;
    const x = Math.min(Math.max(cx - W / 2, full.x), full.x + full.w - W);
    return { x, y: full.y, w: W, h: H };
  }

  if (!wide) return full;

  // El contenido es más grande que el escenario: la cámara sigue la acción a escala 1
  // y al final se aleja para mostrar todo, si así se sigue pudiendo leer.
  const fitScale = Math.min(W / full.w, H / full.h);
  if (isLast && fitScale >= 0.6) return full;
  // Lo nuevo manda: si todo lo activo no cabe, la cámara se centra en el último nodo que entró.
  const primary = active.filter((id) => nodes.has(id));
  let focus = boxOf(active, layout) ?? full;
  if (focus.w > W && primary.length) focus = nodes.get(primary[primary.length - 1]!)!;
  const cx = focus.x + focus.w / 2;
  const cy = focus.y + focus.h / 2;
  return clampTo({ x: cx - W / 2, y: cy - H / 2, w: W, h: H }, full);
}
