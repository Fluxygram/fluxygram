import { nodeSize } from './measure';
import type { Diagram, FluxEdge, LaidEdge, LaidGroup, LaidNode, Layout, Rect } from './types';

const PAD = 40;
const RANK_GAP = 112;
const NODE_GAP = 28;
/** Tamaño máximo del escenario: si el contenido es más grande, la cámara lo recorre. */
const MAX_STAGE = { w: 760, h: 600 };

export interface LayoutOptions {
  /** Ancho máximo del escenario. Más chico en pantallas angostas para que el texto se lea. */
  maxStageWidth?: number;
}

export const edgeId = (e: FluxEdge) => e.id ?? `${e.from}->${e.to}`;

export function layout(diagram: Diagram, options: LayoutOptions = {}): Layout {
  const result =
    diagram.type === 'timeline'
      ? layoutTimeline(diagram)
      : diagram.type === 'cycle'
        ? layoutCycle(diagram)
        : diagram.type === 'sequence'
          ? layoutSequence(diagram)
          : diagram.type === 'mindmap'
            ? layoutMindmap(diagram)
            : diagram.type === 'architecture' && diagram.groups?.length
              ? layoutLayers(diagram)
              : layoutLayered(diagram, diagram.type === 'architecture' || diagram.type === 'tree' ? 'TB' : (diagram.direction ?? 'LR'));
  // La línea de tiempo y la secuencia tienen posiciones con significado (orden en el tiempo): no se fijan a mano.
  const pinned = diagram.type === 'timeline' || diagram.type === 'sequence' ? result : applyPins(diagram, result);
  pinned.motion = diagram.motion;
  return withStage(diagram, pinned, options);
}

function withStage(diagram: Diagram, result: Layout, options: LayoutOptions): Layout {
  const maxW = options.maxStageWidth ?? MAX_STAGE.w;
  // La línea de tiempo se recorre de lado: su alto es siempre el del contenido.
  const maxH = diagram.type === 'timeline' ? Infinity : MAX_STAGE.h;
  result.stage = { w: Math.min(result.bounds.w, maxW), h: Math.min(result.bounds.h, maxH) };
  return result;
}

/* ------------------------------------------------------------------ */
/* Nodos fijados a mano (x, y)                                         */
/* ------------------------------------------------------------------ */

/**
 * Layout híbrido: todo se acomoda solo, y los nodos con `x`, `y` (los que alguien arrastró en el editor)
 * quedan donde se soltaron. Las conexiones se vuelven a trazar y los grupos crecen para contener a sus nodos.
 */
function applyPins(diagram: Diagram, result: Layout): Layout {
  const pins = diagram.nodes.filter((n) => typeof n.x === 'number' && typeof n.y === 'number');
  if (!pins.length) return result;
  const nodes = result.nodes.map((n) =>
    typeof n.node.x === 'number' && typeof n.node.y === 'number' ? { ...n, x: n.node.x, y: n.node.y } : n,
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const groups = result.groups.map((g) => {
    const members = nodes.filter((n) => n.node.group === g.id);
    if (!members.length) return g;
    const x1 = Math.min(g.x, ...members.map((m) => m.x - GROUP_PAD));
    const y1 = Math.min(g.y, ...members.map((m) => m.y - GROUP_HEAD));
    const x2 = Math.max(g.x + g.w, ...members.map((m) => m.x + m.w + GROUP_PAD));
    const y2 = Math.max(g.y + g.h, ...members.map((m) => m.y + m.h + GROUP_PAD));
    return { ...g, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  });

  const edges = (diagram.edges ?? []).map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const apart = b.x >= a.x + a.w + 16 || a.x >= b.x + b.w + 16;
    const dx = Math.abs(b.x + b.w / 2 - (a.x + a.w / 2));
    const dy = Math.abs(b.y + b.h / 2 - (a.y + a.h / 2));
    return routeCurve(e, a, b, apart && dx >= dy * 0.6 ? 'LR' : 'TB');
  });

  return finish(diagram, nodes, edges, groups, result.axis);
}

/* ------------------------------------------------------------------ */
/* Layered (flow, y architecture sin grupos)                           */
/* ------------------------------------------------------------------ */

/** Calcula el rango (columna) de cada nodo con el camino más largo, ignorando las conexiones que cierran ciclos. */
export function computeRanks(diagram: Diagram): { rank: Map<string, number>; back: Set<string> } {
  const edges = diagram.edges ?? [];
  const out = new Map<string, FluxEdge[]>();
  for (const n of diagram.nodes) out.set(n.id, []);
  for (const e of edges) out.get(e.from)?.push(e);

  // DFS para marcar conexiones hacia atrás (ciclos).
  const back = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const e of out.get(id) ?? []) {
      const s = state.get(e.to) ?? 0;
      if (s === 1) back.add(edgeId(e));
      else if (s === 0) visit(e.to);
    }
    state.set(id, 2);
  };
  for (const n of diagram.nodes) if (!state.get(n.id)) visit(n.id);

  const forward = edges.filter((e) => !back.has(edgeId(e)) && e.from !== e.to);
  const rank = new Map<string, number>(diagram.nodes.map((n) => [n.id, 0]));
  // Relajación simple: suficiente para diagramas de explicación (decenas de nodos).
  for (let i = 0; i < diagram.nodes.length; i++) {
    let changed = false;
    for (const e of forward) {
      const r = (rank.get(e.from) ?? 0) + 1;
      if (r > (rank.get(e.to) ?? 0)) {
        rank.set(e.to, r);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { rank, back };
}

function layoutLayered(diagram: Diagram, dir: 'LR' | 'TB'): Layout {
  const { rank, back } = computeRanks(diagram);
  const edges = diagram.edges ?? [];
  const sizes = new Map(diagram.nodes.map((n) => [n.id, nodeSize(n, diagram.type)]));

  const ranks: string[][] = [];
  for (const n of diagram.nodes) {
    const r = rank.get(n.id) ?? 0;
    (ranks[r] ??= []).push(n.id);
  }
  for (let r = 0; r < ranks.length; r++) ranks[r] ??= [];

  // Dos barridos de baricentro para reducir cruces.
  const order = new Map<string, number>();
  const reindex = () => ranks.forEach((ids) => ids.forEach((id, i) => order.set(id, i)));
  reindex();
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let r = 1; r < ranks.length; r++) {
      const bary = new Map<string, number>();
      for (const id of ranks[r]!) {
        const parents = edges.filter((e) => e.to === id && (rank.get(e.from) ?? 0) < r).map((e) => order.get(e.from) ?? 0);
        bary.set(id, parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : (order.get(id) ?? 0));
      }
      ranks[r]!.sort((a, b) => bary.get(a)! - bary.get(b)!);
      reindex();
    }
  }

  const hasLabels = edges.some((e) => e.label);
  const gap = RANK_GAP + (hasLabels ? 32 : 0);
  const main = (s: { w: number; h: number }) => (dir === 'LR' ? s.w : s.h);
  const cross = (s: { w: number; h: number }) => (dir === 'LR' ? s.h : s.w);

  const nodes: LaidNode[] = [];
  let cursor = 0;
  for (const ids of ranks) {
    const thick = Math.max(0, ...ids.map((id) => main(sizes.get(id)!)));
    const span = ids.reduce((sum, id) => sum + cross(sizes.get(id)!), 0) + NODE_GAP * Math.max(0, ids.length - 1);
    let c = -span / 2;
    for (const id of ids) {
      const s = sizes.get(id)!;
      const along = cursor + (thick - main(s)) / 2;
      const node = diagram.nodes.find((n) => n.id === id)!;
      nodes.push(dir === 'LR' ? { id, node, x: along, y: c, ...s } : { id, node, x: c, y: along, ...s });
      c += cross(s) + NODE_GAP;
    }
    cursor += thick + gap;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const extent = bbox(nodes);
  const laidEdges: LaidEdge[] = edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    return back.has(edgeId(e)) || (rank.get(e.to) ?? 0) <= (rank.get(e.from) ?? 0)
      ? routeAround(e, a, b, dir, extent)
      : routeCurve(e, a, b, dir);
  });

  return finish(diagram, nodes, laidEdges, []);
}

/* ------------------------------------------------------------------ */
/* Capas (architecture con grupos)                                     */
/* ------------------------------------------------------------------ */

const GROUP_HEAD = 34;
const GROUP_PAD = 20;
const GROUP_GAP = 48;

function layoutLayers(diagram: Diagram): Layout {
  const groups = [...(diagram.groups ?? [])];
  const loose = diagram.nodes.filter((n) => !n.group);
  if (loose.length) groups.push({ id: '__ungrouped', label: '' });

  const rows = groups.map((g) => ({
    group: g,
    members: diagram.nodes.filter((n) => (g.id === '__ungrouped' ? !n.group : n.group === g.id)),
  }));

  const sized = rows.map((row) => {
    const items = row.members.map((n) => ({ node: n, ...nodeSize(n, diagram.type) }));
    const width = items.reduce((s, i) => s + i.w, 0) + NODE_GAP * Math.max(0, items.length - 1);
    const height = Math.max(48, ...items.map((i) => i.h));
    return { ...row, items, width, height };
  });

  const inner = Math.max(...sized.map((r) => r.width), 320);
  const nodes: LaidNode[] = [];
  const laidGroups: LaidGroup[] = [];
  let y = 0;
  for (const row of sized) {
    const h = GROUP_HEAD + row.height + GROUP_PAD;
    if (row.group.id !== '__ungrouped') {
      laidGroups.push({ id: row.group.id, group: row.group, x: -GROUP_PAD, y, w: inner + GROUP_PAD * 2, h });
    }
    // Ordena cada capa según la posición de los nodos ya colocados con los que se conecta: menos cruces.
    const placed = new Map(nodes.map((n) => [n.id, n.x + n.w / 2]));
    const pull = (id: string) => {
      const xs = (diagram.edges ?? [])
        .flatMap((e) => (e.from === id ? [e.to] : e.to === id ? [e.from] : []))
        .map((other) => placed.get(other))
        .filter((v): v is number => v !== undefined);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
    };
    const keyed = row.items.map((item, i) => ({ item, i, k: pull(item.node.id) }));
    if (keyed.every((r) => r.k !== undefined)) keyed.sort((a, b) => a.k! - b.k! || a.i - b.i);
    let x = (inner - row.width) / 2;
    for (const { item } of keyed) {
      nodes.push({ id: item.node.id, node: item.node, x, y: y + GROUP_HEAD + (row.height - item.h) / 2, w: item.w, h: item.h });
      x += item.w + NODE_GAP;
    }
    y += h + GROUP_GAP;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = (diagram.edges ?? []).map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const sameRow = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < 4;
    return routeCurve(e, a, b, sameRow ? 'LR' : 'TB');
  });

  return finish(diagram, nodes, edges, laidGroups);
}

/* ------------------------------------------------------------------ */
/* Línea de tiempo                                                     */
/* ------------------------------------------------------------------ */

const TL_STEP = 200;
const TL_STEM = 44;

function layoutTimeline(diagram: Diagram): Layout {
  const dated = diagram.nodes.every((n) => n.date);
  const ordered = dated ? [...diagram.nodes].sort((a, b) => a.date!.localeCompare(b.date!, undefined, { numeric: true })) : diagram.nodes;

  const nodes: LaidNode[] = ordered.map((node, i) => {
    const s = nodeSize(node, 'timeline');
    const cx = i * TL_STEP;
    const above = i % 2 === 0;
    return { id: node.id, node, x: cx - s.w / 2, y: above ? -TL_STEM - s.h : TL_STEM, ...s };
  });

  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  const axis = { x1: first.x + first.w / 2 - 80, x2: last.x + last.w / 2 + 80, y: 0 };
  return finish(diagram, nodes, [], [], axis);
}

/* ------------------------------------------------------------------ */
/* Ciclo: nodos en un anillo, conexiones como arcos hacia afuera        */
/* ------------------------------------------------------------------ */

function layoutCycle(diagram: Diagram): Layout {
  const n = diagram.nodes.length;
  const sizes = diagram.nodes.map((node) => nodeSize(node, diagram.type));
  const avg = sizes.reduce((s, z) => s + Math.max(z.w, z.h * 2), 0) / Math.max(1, n);
  const R = Math.max(150, (n * avg * 0.62) / (2 * Math.PI) + 60);
  const nodes: LaidNode[] = diagram.nodes.map((node, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
    const s = sizes[i]!;
    return { id: node.id, node, x: Math.cos(a) * R - s.w / 2, y: Math.sin(a) * R - s.h / 2, ...s };
  });
  const byId = new Map(nodes.map((x) => [x.id, x]));
  const edges = (diagram.edges ?? []).map((e) => routeArc(e, byId.get(e.from)!, byId.get(e.to)!, { x: 0, y: 0 }));
  return finish(diagram, nodes, edges, []);
}

/** Punto del borde de un rectángulo en dirección a (tx, ty). */
function borderPoint(r: Rect, tx: number, ty: number, pad = 4) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const t = Math.min((r.w / 2 + pad) / Math.abs(dx || 1e-6), (r.h / 2 + pad) / Math.abs(dy || 1e-6));
  return { x: cx + dx * t, y: cy + dy * t };
}

/** Arco entre dos nodos que se curva hacia afuera de un centro. */
function routeArc(e: FluxEdge, a: Rect, b: Rect, center: { x: number; y: number }): LaidEdge {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const mid = { x: (ac.x + bc.x) / 2, y: (ac.y + bc.y) / 2 };
  let ox = mid.x - center.x;
  let oy = mid.y - center.y;
  const len = Math.hypot(ox, oy) || 1;
  ox /= len;
  oy /= len;
  const bulge = Math.hypot(bc.x - ac.x, bc.y - ac.y) * 0.22;
  const c = { x: mid.x + ox * bulge, y: mid.y + oy * bulge };
  const p1 = borderPoint(a, c.x, c.y);
  const p2 = borderPoint(b, c.x, c.y);
  const angle = (Math.atan2(p2.y - c.y, p2.x - c.x) * 180) / Math.PI;
  return {
    id: edgeId(e), edge: e,
    d: `M${p1.x} ${p1.y} Q${c.x} ${c.y} ${p2.x} ${p2.y}`,
    end: { x: p2.x, y: p2.y, angle },
    labelAt: { x: (p1.x + 2 * c.x + p2.x) / 4 + ox * 14, y: (p1.y + 2 * c.y + p2.y) / 4 + oy * 14 },
  };
}

/* ------------------------------------------------------------------ */
/* Secuencia: participantes arriba, mensajes en orden hacia abajo      */
/* ------------------------------------------------------------------ */

const SEQ_GAP = 72;
const SEQ_ROW = 56;

function layoutSequence(diagram: Diagram): Layout {
  const sizes = diagram.nodes.map((node) => nodeSize(node, diagram.type));
  const colW = Math.max(160, ...sizes.map((s) => s.w)) + SEQ_GAP;
  const top = Math.max(...sizes.map((s) => s.h));
  const nodes: LaidNode[] = diagram.nodes.map((node, i) => {
    const s = sizes[i]!;
    return { id: node.id, node, x: i * colW + (colW - SEQ_GAP - s.w) / 2, y: top - s.h, ...s };
  });
  const cx = new Map(nodes.map((n) => [n.id, n.x + n.w / 2]));
  const edges: LaidEdge[] = (diagram.edges ?? []).map((e, i) => {
    const y = top + 52 + i * SEQ_ROW;
    const x1 = cx.get(e.from)!;
    const x2 = cx.get(e.to)!;
    if (e.from === e.to) {
      // Mensaje a sí mismo: un pequeño lazo a la derecha.
      const d = `M${x1} ${y - 8} H${x1 + 36} V${y + 12} H${x1 + 6}`;
      return { id: edgeId(e), edge: e, d, end: { x: x1 + 6, y: y + 12, angle: 180 }, labelAt: { x: x1 + 70, y } };
    }
    const dir = x2 > x1 ? 1 : -1;
    const end = x2 - dir * 6;
    return {
      id: edgeId(e), edge: e,
      d: `M${x1 + dir * 6} ${y} H${end}`,
      end: { x: end, y, angle: dir > 0 ? 0 : 180 },
      labelAt: { x: (x1 + x2) / 2, y: y - 15 },
    };
  });
  const bottom = top + 52 + Math.max(0, edges.length - 1) * SEQ_ROW + 36;
  const lifelines = nodes.map((n) => ({ id: n.id, x: n.x + n.w / 2, y1: n.y + n.h, y2: bottom }));
  const result = finish(diagram, nodes, edges, [], undefined, lifelines.map((l) => ({ x: l.x - 1, y: l.y1, w: 2, h: l.y2 - l.y1 })));
  result.lifelines = lifelines;
  return result;
}

/* ------------------------------------------------------------------ */
/* Mapa mental: una idea central y ramas alrededor                     */
/* ------------------------------------------------------------------ */

function layoutMindmap(diagram: Diagram): Layout {
  const edges = diagram.edges ?? [];
  const degree = new Map(diagram.nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const root = mindmapRoot(diagram);
  const { parent, children } = spanningTree(diagram, root);
  const sizes = new Map(diagram.nodes.map((n) => [n.id, nodeSize(n, diagram.type)]));

  // Ángulo de cada rama proporcional a cuántas hojas tiene, para que no se amontonen.
  const leaves = (id: string): number => {
    const c = children.get(id) ?? [];
    return c.length ? c.reduce((s, k) => s + leaves(k), 0) : 1;
  };
  const center = new Map<string, { x: number; y: number }>();
  center.set(root, { x: 0, y: 0 });
  const place = (id: string, a0: number, a1: number, depth: number) => {
    const kids = children.get(id) ?? [];
    const total = kids.reduce((s, k) => s + leaves(k), 0) || 1;
    let a = a0;
    for (const k of kids) {
      const span = ((a1 - a0) * leaves(k)) / total;
      const mid = a + span / 2;
      const r = 230 + (depth - 1) * 190;
      center.set(k, { x: Math.cos(mid) * r * 1.25, y: Math.sin(mid) * r * 0.8 });
      place(k, a, a + span, depth + 1);
      a += span;
    }
  };
  place(root, -Math.PI / 2, (Math.PI * 3) / 2, 1);
  // Nodos sueltos (sin conexión al centro): abajo, en fila.
  let loose = 0;
  for (const n of diagram.nodes) if (!center.has(n.id)) center.set(n.id, { x: -200 + loose++ * 200, y: 420 });

  const nodes: LaidNode[] = diagram.nodes.map((node) => {
    const s = sizes.get(node.id)!;
    const c = center.get(node.id)!;
    return { id: node.id, node, x: c.x - s.w / 2, y: c.y - s.h / 2, ...s };
  });
  const byId = new Map(nodes.map((x) => [x.id, x]));
  const laid = edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const apart = b.x >= a.x + a.w + 16 || a.x >= b.x + b.w + 16;
    const dx = Math.abs(b.x + b.w / 2 - (a.x + a.w / 2));
    const dy = Math.abs(b.y + b.h / 2 - (a.y + a.h / 2));
    return routeCurve(e, a, b, apart && dx >= dy * 0.6 ? 'LR' : 'TB');
  });
  void parent;
  void degree;
  return finish(diagram, nodes, laid, []);
}

/** La idea central: el primer nodo, salvo que otro tenga claramente más conexiones. */
export function mindmapRoot(diagram: Diagram): string {
  const degree = new Map(diagram.nodes.map((n) => [n.id, 0]));
  for (const e of diagram.edges ?? []) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const first = diagram.nodes[0]!.id;
  let best = first;
  for (const n of diagram.nodes) if ((degree.get(n.id) ?? 0) > (degree.get(best) ?? 0) + 1) best = n.id;
  return best;
}

/** Árbol de recorrido en anchura desde la raíz, ignorando la dirección de las conexiones. */
export function spanningTree(diagram: Diagram, root: string) {
  const adj = new Map<string, string[]>(diagram.nodes.map((n) => [n.id, []]));
  for (const e of diagram.edges ?? []) {
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  }
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  const seen = new Set([root]);
  const queue = [root];
  while (queue.length) {
    const id = queue.shift()!;
    for (const k of adj.get(id) ?? []) {
      if (seen.has(k)) continue;
      seen.add(k);
      parent.set(k, id);
      (children.get(id) ?? children.set(id, []).get(id)!).push(k);
      queue.push(k);
    }
  }
  return { parent, children };
}

/* ------------------------------------------------------------------ */
/* Rutas de conexiones                                                 */
/* ------------------------------------------------------------------ */

function routeCurve(e: FluxEdge, a: Rect, b: Rect, dir: 'LR' | 'TB'): LaidEdge {
  let x1: number, y1: number, x2: number, y2: number, d: string, angle: number;
  if (dir === 'LR') {
    const forward = b.x >= a.x;
    x1 = forward ? a.x + a.w : a.x;
    x2 = forward ? b.x : b.x + b.w;
    y1 = a.y + a.h / 2;
    y2 = b.y + b.h / 2;
    const k = Math.max(24, Math.abs(x2 - x1) / 2);
    const s = forward ? 1 : -1;
    d = `M${x1} ${y1} C${x1 + k * s} ${y1} ${x2 - k * s} ${y2} ${x2} ${y2}`;
    angle = forward ? 0 : 180;
  } else {
    const down = b.y >= a.y;
    x1 = a.x + a.w / 2;
    x2 = b.x + b.w / 2;
    y1 = down ? a.y + a.h : a.y;
    y2 = down ? b.y : b.y + b.h;
    const k = Math.max(24, Math.abs(y2 - y1) / 2);
    const s = down ? 1 : -1;
    d = `M${x1} ${y1} C${x1} ${y1 + k * s} ${x2} ${y2 - k * s} ${x2} ${y2}`;
    angle = down ? 90 : -90;
  }
  return { id: edgeId(e), edge: e, d, end: { x: x2, y: y2, angle }, labelAt: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
}

/** Conexiones que vuelven atrás: rodean el diagrama por debajo (LR) o por la derecha (TB). */
function routeAround(e: FluxEdge, a: Rect, b: Rect, dir: 'LR' | 'TB', extent: Rect): LaidEdge {
  const r = 14;
  if (dir === 'LR') {
    const x1 = a.x + a.w / 2;
    const y1 = a.y + a.h;
    const x2 = b.x + b.w / 2;
    const y2 = b.y + b.h;
    const yy = extent.y + extent.h + 36;
    const d = `M${x1} ${y1} V${yy - r} Q${x1} ${yy} ${x1 - r} ${yy} H${x2 + r} Q${x2} ${yy} ${x2} ${yy - r} V${y2}`;
    return { id: edgeId(e), edge: e, d, end: { x: x2, y: y2, angle: -90 }, labelAt: { x: (x1 + x2) / 2, y: yy } };
  }
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x + b.w;
  const y2 = b.y + b.h / 2;
  const xx = extent.x + extent.w + 36;
  const d = `M${x1} ${y1} H${xx - r} Q${xx} ${y1} ${xx} ${y1 - r} V${y2 + r} Q${xx} ${y2} ${xx - r} ${y2} H${x2}`;
  return { id: edgeId(e), edge: e, d, end: { x: x2, y: y2, angle: 180 }, labelAt: { x: xx, y: (y1 + y2) / 2 } };
}

/* ------------------------------------------------------------------ */

function bbox(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

function finish(diagram: Diagram, nodes: LaidNode[], edges: LaidEdge[], groups: LaidGroup[], axis?: Layout['axis'], extra: Rect[] = []): Layout {
  const rects: Rect[] = [...nodes, ...groups, ...extra];
  // Las rutas que rodean el diagrama y las etiquetas también ocupan espacio.
  for (const e of edges) if (e.labelAt) rects.push({ x: e.labelAt.x - 40, y: e.labelAt.y - 14, w: 80, h: 28 });
  if (axis) rects.push({ x: axis.x1, y: axis.y - 1, w: axis.x2 - axis.x1, h: 2 });
  const b = bbox(rects);
  const bounds = { x: b.x - PAD, y: b.y - PAD, w: b.w + PAD * 2, h: b.h + PAD * 2 };
  return { type: diagram.type, bounds, stage: { w: bounds.w, h: bounds.h }, nodes, edges, groups, axis };
}
